import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { InventarioSectionTabsComponent } from '../../components/inventario-section-tabs.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { CatalogoItem, ProductoAdmin } from '../../models/inventario.models';
import { InventarioApiService } from '../../services/inventario-api.service';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, InventarioSectionTabsComponent],
  templateUrl: './productos.component.html',
  styleUrl: './productos.component.css'
})
export class ProductosComponent implements OnInit {
  productos: ProductoAdmin[] = [];
  categorias: CatalogoItem[] = [];
  ambitos: CatalogoItem[] = [];
  roles: CatalogoItem[] = [];
  plazas: CatalogoItem[] = [];

  mensaje = '';
  error = '';
  guardando = false;
  cargando = true;
  editandoId: number | null = null;
  modalAbierto = false;
  confirmarGuardado = false;
  productoCambioEstado: ProductoAdmin | null = null;
  cambiandoEstado = false;
  busqueda = '';
  filtroEstado: 'TODOS' | 'ACTIVOS' | 'INACTIVOS' = 'TODOS';

  form: any = this.nuevoFormulario();
  private payloadPendiente: any = null;

  constructor(
    private api: InventarioApiService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.cargarCatalogos();
      this.prepararPlazaControlador();
      await this.cargarProductos();
    } catch (e: any) {
      this.error = this.extraerError(e);
    } finally {
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  esControlador(): boolean { return this.auth.tieneRol('CONTROLADOR'); }
  esSupervisor(): boolean { return this.auth.tieneRol('SUPERVISOR'); }
  esEdicion(): boolean { return this.editandoId !== null; }

  productosVisibles(): ProductoAdmin[] {
    let items = this.esSupervisor()
      ? this.productos
      : this.productos.filter(producto => producto.plazas?.some(plaza => plaza.plazaId === this.auth.usuario()?.plazaId));

    if (this.filtroEstado === 'ACTIVOS') items = items.filter(p => p.activo);
    if (this.filtroEstado === 'INACTIVOS') items = items.filter(p => !p.activo);

    const q = this.busqueda.trim().toLowerCase();
    if (q) {
      items = items.filter(p => [p.codigo, p.nombre, p.descripcion, p.categoria, p.ambito, p.unidadMedida]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q)));
    }

    return [...items].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  totalActivos(): number { return this.productosVisiblesBase().filter(p => p.activo).length; }
  totalInactivos(): number { return this.productosVisiblesBase().filter(p => !p.activo).length; }

  private productosVisiblesBase(): ProductoAdmin[] {
    if (this.esSupervisor()) return this.productos;
    const plazaId = this.auth.usuario()?.plazaId;
    return this.productos.filter(producto => producto.plazas?.some(plaza => plaza.plazaId === plazaId));
  }

  async cargarProductos(): Promise<void> {
    this.productos = await firstValueFrom(this.api.productosAdmin());
  }

  async cargarCatalogos(): Promise<void> {
    const [categorias, ambitos, roles, plazas] = await Promise.all([
      firstValueFrom(this.api.catalogo('categorias')),
      firstValueFrom(this.api.catalogo('ambitos')),
      firstValueFrom(this.api.catalogo('roles')),
      firstValueFrom(this.api.catalogo('plazas'))
    ]);
    this.categorias = categorias;
    this.ambitos = ambitos;
    this.roles = roles;
    this.plazas = plazas;
  }

  abrirCrear(): void {
    this.editandoId = null;
    this.form = this.nuevoFormulario();
    this.prepararPlazaControlador();
    this.error = '';
    this.modalAbierto = true;
  }

  editar(producto: ProductoAdmin): void {
    this.editandoId = producto.id;
    this.mensaje = '';
    this.error = '';
    this.form = {
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      categoriaId: producto.categoriaId,
      ambitoId: producto.ambitoId,
      unidadMedida: producto.unidadMedida,
      activo: producto.activo,
      roles: [...(producto.roles ?? [])],
      plazas: (producto.plazas ?? []).map(p => ({ plazaId: p.plazaId, stockMinimo: p.stockMinimo ?? 0 }))
    };
    this.prepararPlazaControlador();
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    if (this.guardando) return;
    this.confirmarGuardado = false;
    this.payloadPendiente = null;
    this.modalAbierto = false;
    this.editandoId = null;
    this.form = this.nuevoFormulario();
    this.prepararPlazaControlador();
    this.error = '';
  }

  cancelarEdicion(): void {
    this.cerrarModal();
  }

  toggleRol(codigo: string): void {
    if (!codigo || (this.esControlador() && codigo === 'SUPERVISOR')) return;
    const index = this.form.roles.indexOf(codigo);
    index >= 0 ? this.form.roles.splice(index, 1) : this.form.roles.push(codigo);
  }

  togglePlaza(plazaId: number): void {
    if (this.esControlador()) return;
    const index = this.form.plazas.findIndex((p: any) => p.plazaId === plazaId);
    if (index >= 0) this.form.plazas.splice(index, 1);
    else this.form.plazas.push({ plazaId, stockMinimo: 0 });
  }

  plazaSeleccionada(id: number): any {
    return this.form.plazas.find((p: any) => p.plazaId === id);
  }

  solicitarGuardado(): void {
    this.mensaje = '';
    this.error = '';
    if (!this.form.codigo?.trim() || !this.form.nombre?.trim()) return void (this.error = 'Código y nombre son obligatorios.');
    if (!this.form.categoriaId || !this.form.ambitoId) return void (this.error = 'Selecciona categoría y ámbito.');
    if (!this.form.unidadMedida?.trim()) return void (this.error = 'La unidad de medida es obligatoria.');
    if (this.form.roles.length === 0) return void (this.error = 'Selecciona al menos un rol.');

    this.prepararPlazaControlador();
    if (this.form.plazas.length === 0) return void (this.error = 'Selecciona al menos una plaza.');
    if (this.form.plazas.some((p: any) => p.stockMinimo === null || Number(p.stockMinimo) < 0)) return void (this.error = 'El stock mínimo no puede ser negativo.');

    this.payloadPendiente = {
      ...this.form,
      codigo: this.form.codigo.trim().toUpperCase(),
      nombre: this.form.nombre.trim(),
      descripcion: this.form.descripcion?.trim() || null,
      unidadMedida: this.form.unidadMedida.trim(),
      plazas: this.form.plazas.map((p: any) => ({ plazaId: Number(p.plazaId), stockMinimo: Number(p.stockMinimo ?? 0) }))
    };
    this.confirmarGuardado = true;
  }

  cancelarConfirmacion(): void {
    if (this.guardando) return;
    this.confirmarGuardado = false;
    this.payloadPendiente = null;
  }

  async guardar(): Promise<void> {
    if (!this.payloadPendiente || this.guardando) return;
    this.guardando = true;
    this.error = '';

    try {
      let guardado: ProductoAdmin;
      if (this.editandoId) {
        guardado = await firstValueFrom(this.api.actualizarProducto(this.editandoId, this.payloadPendiente));
        this.mensaje = 'Producto actualizado correctamente.';
      } else {
        guardado = await firstValueFrom(this.api.crearProducto(this.payloadPendiente));
        this.mensaje = 'Producto creado correctamente.';
      }

      const index = this.productos.findIndex(p => p.id === guardado.id);
      if (index >= 0) {
        this.productos = this.productos.map(p => p.id === guardado.id ? guardado : p);
      } else {
        this.productos = [guardado, ...this.productos];
      }

      this.confirmarGuardado = false;
      this.payloadPendiente = null;
      this.modalAbierto = false;
      this.editandoId = null;
      this.form = this.nuevoFormulario();
      this.prepararPlazaControlador();
    } catch (e: any) {
      this.confirmarGuardado = false;
      this.error = this.extraerError(e);
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  // La acción de la tarjeta abre primero una confirmación consistente con SIGO.
  cambiarEstado(producto: ProductoAdmin): void {
    if (this.cambiandoEstado || this.guardando) return;
    this.error = '';
    this.mensaje = '';
    this.productoCambioEstado = producto;
  }

  cancelarCambioEstado(): void {
    if (this.cambiandoEstado) return;
    this.productoCambioEstado = null;
    this.error = '';
  }

  async confirmarCambioEstadoProducto(): Promise<void> {
    const producto = this.productoCambioEstado;
    if (!producto || this.cambiandoEstado) return;

    const activar = !producto.activo;
    this.cambiandoEstado = true;
    this.error = '';
    this.mensaje = '';
    try {
      const actualizado = await firstValueFrom(this.api.cambiarEstadoProducto(producto.id, activar));
      this.productos = this.productos.map(p => p.id === actualizado.id ? actualizado : p);
      this.mensaje = `Producto ${activar ? 'activado' : 'desactivado'} correctamente.`;
      this.productoCambioEstado = null;
    } catch (e: any) {
      // Mantener la confirmación abierta para que se vea el error y se pueda reintentar.
      this.error = this.extraerError(e);
    } finally {
      this.cambiandoEstado = false;
      this.cdr.detectChanges();
    }
  }

  @HostListener('document:keydown.escape')
  cerrarDialogosConEscape(): void {
    // No permitir interrumpir operaciones en curso.
    if (this.cambiandoEstado || this.guardando) return;
    if (this.productoCambioEstado) {
      this.cancelarCambioEstado();
    } else if (this.confirmarGuardado) {
      this.cancelarConfirmacion();
    } else if (this.modalAbierto) {
      this.cerrarModal();
    }
  }

  private prepararPlazaControlador(): void {
    if (!this.esControlador()) return;
    const plazaId = this.auth.usuario()?.plazaId;
    if (!plazaId) return;
    const existente = this.form.plazas.find((p: any) => p.plazaId === plazaId);
    this.form.plazas = [{ plazaId, stockMinimo: existente?.stockMinimo ?? 0 }];
    if (!this.form.roles.includes('CONTROLADOR')) this.form.roles.push('CONTROLADOR');
  }

  private nuevoFormulario(): any {
    return { codigo: '', nombre: '', descripcion: '', categoriaId: null, ambitoId: null, unidadMedida: 'Unidad', activo: true, roles: [], plazas: [] };
  }

  private extraerError(e: any): string {
    return e?.error?.message || e?.error?.detail || e?.error?.error || 'No se pudo completar la operación.';
  }
}
