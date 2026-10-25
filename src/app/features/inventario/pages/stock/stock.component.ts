import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { InventarioSectionTabsComponent } from '../../components/inventario-section-tabs.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { CatalogoItem, StockActual } from '../../models/inventario.models';
import { InventarioApiService } from '../../services/inventario-api.service';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, InventarioSectionTabsComponent],
  templateUrl: './stock.component.html',
  styleUrl: './stock.component.css'
})
export class StockComponent implements OnInit {
  items: StockActual[] = [];
  plazas: CatalogoItem[] = [];
  categorias: CatalogoItem[] = [];
  private nombresCategoriaPorId = new Map<number, string>();
  private codigosPorProducto = new Map<number, string>();
  private catalogoCodigosCargado = false;

  cargando = true;
  error = '';
  busqueda = '';
  plazaId: number | null = null;
  categoriaId: number | null = null;
  estado: 'TODOS' | 'BAJO' | 'OK' = 'TODOS';

  constructor(
    private readonly api: InventarioApiService,
    public readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    // Iniciar en la plaza de la sesión, también para supervisores.
    this.plazaId = this.auth.usuario()?.plazaId ?? null;
    await this.inicializar();
  }

  esSupervisor(): boolean {
    return this.auth.tieneRol('SUPERVISOR');
  }

  async inicializar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      // El listado de plazas es de consulta para supervisores y controladores.
      await Promise.all([this.cargarStock(), this.cargarCategorias(), this.cargarPlazas()]);
    } catch (e: any) {
      this.error = this.extraerError(e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async cargarStock(): Promise<void> {
    const stock = await firstValueFrom(this.api.stock({
      // Se respeta la plaza elegida; la API valida el alcance de lectura.
      plazaId: this.plazaId,
      buscar: this.busqueda
    }));

    // Compatibilidad con APIs antiguas que todavía no incluyen "codigo" en Stock.
    if (stock.some(item => !item.codigo?.trim()) && !this.catalogoCodigosCargado) {
      try {
        const productos = await firstValueFrom(this.api.productosAdmin());
        this.codigosPorProducto = new Map(
          productos
            .filter(producto => !!producto.codigo?.trim())
            .map(producto => [producto.id, producto.codigo.trim()])
        );
        this.catalogoCodigosCargado = true;
      } catch {
        // Los usuarios sin acceso al catálogo pueden consultar Stock igualmente.
      }
    }

    this.items = stock.map(item => ({
      ...item,
      codigo: item.codigo?.trim() || this.codigosPorProducto.get(item.productoId) || ''
    }));
  }

  async cargarPlazas(): Promise<void> {
    this.plazas = await firstValueFrom(this.api.catalogo('plazas'));
  }

  async cargarCategorias(): Promise<void> {
    this.categorias = await firstValueFrom(this.api.catalogo('categorias'));
    this.nombresCategoriaPorId = new Map(
      this.categorias.map(categoria => [categoria.id, categoria.nombre])
    );
  }

  async aplicarFiltros(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      await this.cargarStock();
    } catch (e: any) {
      this.error = this.extraerError(e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async limpiarFiltros(): Promise<void> {
    this.busqueda = '';
    this.estado = 'TODOS';
    this.categoriaId = null;
    this.plazaId = this.auth.usuario()?.plazaId ?? null;
    await this.aplicarFiltros();
  }

  nombrePlazaSeleccionada(): string {
    if (this.plazaId === null) return 'Todas las plazas';
    const plaza = this.plazas.find(item => item.id === this.plazaId);
    if (plaza) return plaza.codigo || plaza.nombre;
    return this.plazaId === this.auth.usuario()?.plazaId
      ? (this.auth.usuario()?.plaza || 'Tu plaza')
      : 'Plaza seleccionada';
  }

  nombreCategoria(categoriaId: number | null): string {
    if (categoriaId == null) return 'Sin categoría';
    return this.nombresCategoriaPorId.get(categoriaId) ?? 'Categoría no disponible';
  }

  itemsVisibles(): StockActual[] {
    const filtrados = this.items.filter(item => {
      // -1 representa los productos que todavía no tienen categoría asignada.
      if (this.categoriaId === -1 && item.categoriaId != null) return false;
      if (this.categoriaId !== null && this.categoriaId !== -1 && item.categoriaId !== this.categoriaId) return false;
      if (this.estado === 'BAJO') return item.bajoMinimo;
      if (this.estado === 'OK') return !item.bajoMinimo;
      return true;
    });

    return [...filtrados].sort((a, b) => {
      // Primero stock adecuado, después stock bajo; el stock agotado queda al final.
      if (a.bajoMinimo !== b.bajoMinimo) return a.bajoMinimo ? 1 : -1;
      const aTieneStock = Number(a.cantidadActual) > 0;
      const bTieneStock = Number(b.cantidadActual) > 0;
      if (aTieneStock !== bTieneStock) return aTieneStock ? -1 : 1;
      const porPlaza = a.plaza.localeCompare(b.plaza, 'es', { numeric: true });
      return porPlaza !== 0 ? porPlaza : a.producto.localeCompare(b.producto);
    });
  }

  totalProductos(): number {
    return this.items.length;
  }

  totalBajoMinimo(): number {
    return this.items.filter(item => item.bajoMinimo).length;
  }

  totalSaludable(): number {
    return this.items.filter(item => !item.bajoMinimo).length;
  }

  totalPlazas(): number {
    return new Set(this.items.map(item => item.plazaId)).size;
  }

  porcentajeStock(item: StockActual): number {
    if (!item.stockMinimo || item.stockMinimo <= 0) return 100;
    return Math.min(100, Math.max(0, (Number(item.cantidadActual) / Number(item.stockMinimo)) * 100));
  }

  formatearFecha(valor: string): string {
    if (!valor) return 'Sin fecha';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(fecha);
  }

  trackStock(_: number, item: StockActual): string {
    return `${item.plazaId}-${item.productoId}`;
  }

  private extraerError(e: any): string {
    return e?.error?.message || e?.error?.detail || e?.error?.error || 'No se pudo cargar el stock actual.';
  }
}
