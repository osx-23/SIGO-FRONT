import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { InventarioSectionTabsComponent } from '../../components/inventario-section-tabs.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { CatalogoItem, InventarioDetalle, InventarioResumen } from '../../models/inventario.models';
import { InventarioApiService } from '../../services/inventario-api.service';

type EstadoFiltro = '' | 'EN_PROCESO' | 'FINALIZADO' | 'ANULADO';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, InventarioSectionTabsComponent],
  templateUrl: './historial.component.html',
  styleUrl: './historial.component.css'
})
export class HistorialComponent implements OnInit {
  private readonly api = inject(InventarioApiService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  items: InventarioResumen[] = [];
  detalle: InventarioDetalle | null = null;
  plazas: CatalogoItem[] = [];

  cargando = true;
  cargandoDetalle = false;
  exportandoExcelId: number | null = null;
  error = '';
  pagina = 0;
  totalPaginas = 0;
  totalElementos = 0;
  tamanoPagina = 12;

  plazaId: number | null = null;
  estado: EstadoFiltro = '';
  rol = '';
  desde = '';
  hasta = '';
  busqueda = '';

  get esSupervisor(): boolean { return this.auth.tieneRol('SUPERVISOR'); }
  get usuario() { return this.auth.usuario(); }

  async ngOnInit(): Promise<void> {
    if (this.esSupervisor) {
      try {
        this.plazas = await firstValueFrom(this.api.catalogo('plazas'));
      } catch {
        this.plazas = [];
      }
    } else {
      this.plazaId = this.usuario?.plazaId ?? null;
    }

    await this.cargar(0);
  }

  async cargar(page = this.pagina): Promise<void> {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    try {
      const respuesta = await firstValueFrom(this.api.historial({
        plazaId: this.esSupervisor ? this.plazaId : this.usuario?.plazaId,
        rol: this.rol || null,
        estado: this.estado || null,
        desde: this.desde || null,
        hasta: this.hasta || null,
        page,
        size: this.tamanoPagina
      }));

      this.items = respuesta?.content ?? [];
      this.pagina = respuesta?.number ?? page;
      this.totalPaginas = respuesta?.totalPages ?? 0;
      this.totalElementos = respuesta?.totalElements ?? this.items.length;
    } catch (e: any) {
      this.items = [];
      this.error = this.extraerError(e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async aplicarFiltros(): Promise<void> {
    await this.cargar(0);
  }

  async limpiarFiltros(): Promise<void> {
    this.plazaId = this.esSupervisor ? null : (this.usuario?.plazaId ?? null);
    this.estado = '';
    this.rol = '';
    this.desde = '';
    this.hasta = '';
    this.busqueda = '';
    await this.cargar(0);
  }

  itemsVisibles(): InventarioResumen[] {
    const q = this.busqueda.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter(i =>
      String(i.id).includes(q) ||
      (i.plaza || '').toLowerCase().includes(q) ||
      (i.responsable || '').toLowerCase().includes(q) ||
      (i.rol || '').toLowerCase().includes(q) ||
      (i.estado || '').toLowerCase().includes(q)
    );
  }

  async ver(id: number): Promise<void> {
    this.cargandoDetalle = true;
    this.error = '';
    this.cdr.detectChanges();

    try {
      this.detalle = await firstValueFrom(this.api.detalle(id));
    } catch (e: any) {
      this.error = this.extraerError(e);
    } finally {
      this.cargandoDetalle = false;
      this.cdr.detectChanges();
    }
  }

  cerrarDetalle(): void {
    if (!this.cargandoDetalle) this.detalle = null;
  }

  async exportarExcel(item?: InventarioResumen): Promise<void> {
    const id = item?.id ?? this.detalle?.id;
    if (!id || this.exportandoExcelId !== null) return;

    this.exportandoExcelId = id;
    this.error = '';
    this.cdr.detectChanges();
    try {
      const archivo = await firstValueFrom(this.api.exportarExcel(id));
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement('a');
      try {
        enlace.href = url;
        enlace.download = `inventario-${id}.xlsx`;
        document.body.appendChild(enlace);
        enlace.click();
      } finally {
        enlace.remove();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      this.error = this.extraerError(e);
    } finally {
      this.exportandoExcelId = null;
      this.cdr.detectChanges();
    }
  }

  anterior(): void {
    if (this.pagina > 0 && !this.cargando) void this.cargar(this.pagina - 1);
  }

  siguiente(): void {
    if (this.pagina + 1 < this.totalPaginas && !this.cargando) void this.cargar(this.pagina + 1);
  }

  estadoTexto(estado: string): string {
    const mapa: Record<string, string> = {
      EN_PROCESO: 'En proceso',
      FINALIZADO: 'Finalizado',
      ANULADO: 'Anulado'
    };
    return mapa[estado] ?? estado;
  }

  formatearFecha(fecha: string | null): string {
    if (!fecha) return '-';
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return fecha;
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  }

  formatearCantidad(valor: number): string {
    return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(Number(valor ?? 0));
  }

  private extraerError(e: any): string {
    if (e instanceof Error && e.message) return e.message;
    return e?.error?.message || e?.error?.detail || e?.error?.error || 'No se pudo cargar el historial de inventarios.';
  }
}
