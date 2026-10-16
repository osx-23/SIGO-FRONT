import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CatalogoItem } from '../../models/inventario.models';
import {
  ConsumoHistorico, ItemPedidoPayload, MaterialConsolidado,
  PedidoDetalle, PedidoLista, PedidoPayload, SugerenciaPedido
} from '../../models/pedidos.models';
import { InventarioApiService } from '../../services/inventario-api.service';
import { InventarioPedidosApiService } from '../../services/inventario-pedidos-api.service';

@Component({
  selector: 'app-inventario-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pedidos.component.html'
})
export class PedidosComponent implements OnInit {
  vista: 'nuevo' | 'seguimiento' | 'consolidado' | 'historico' = 'nuevo';
  mes: string = this.mesActual();
  plazaId: number | null = null;
  plazas: CatalogoItem[] = [];
  sugerencias: SugerenciaPedido[] = [];
  pedidos: PedidoLista[] = [];
  seleccionado: PedidoDetalle | null = null;
  consolidado: MaterialConsolidado[] = [];
  consumo: ConsumoHistorico[] = [];
  busqueda = '';
  observacion = '';
  notaRecepcion = '';
  cantidadesRecibir: Record<number, number> = {};
  editandoId: number | null = null;
  cargando = false;
  guardando = false;
  error = '';
  exito = '';
  private claveRecepcion: string | null = null;

  constructor(
    public readonly auth: AuthService,
    private readonly catalogos: InventarioApiService,
    private readonly api: InventarioPedidosApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  esSupervisor(): boolean { return this.auth.tieneRol('SUPERVISOR'); }
  get productosFiltrados(): SugerenciaPedido[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.sugerencias.filter(s => s.producto.toLowerCase().includes(q));
  }
  private mesActual(): string {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  get sinHistorico(): number { return this.sugerencias.filter(s => !s.conHistorico).length; }
  get totalSolicitado(): number {
    return this.sugerencias.reduce((total, s) => total + (Number(s.cantidad) || 0), 0);
  }
  get pendienteRecepcion(): number {
    return this.seleccionado?.items.reduce((n, x) => n + Number(x.pendiente), 0) ?? 0;
  }
  fueraDePlazo(): boolean {
    const ahora = new Date();
    return this.mes === this.mesActual() && ahora.getDate() > 8;
  }

  async ngOnInit(): Promise<void> {
    this.plazaId = this.auth.usuario()?.plazaId ?? null;
    if (this.esSupervisor()) {
      try {
        this.plazas = await firstValueFrom(this.catalogos.catalogo('plazas'));
        if (!this.plazaId && this.plazas.length > 0) this.plazaId = this.plazas[0].id;
      } catch (e: any) {
        this.error = this.obtenerError(e);
      }
    }
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const p = this.plazaId;
      const tareas: Promise<unknown>[] = [
        firstValueFrom(this.api.listar(this.esSupervisor() ? null : p, this.mes))
          .then(datos => { this.pedidos = datos; })
      ];
      if (p) {
        tareas.push(firstValueFrom(this.api.sugerencias(p, this.mes))
          .then(datos => {
            this.sugerencias = datos.map(s => ({ ...s, cantidad: Number(s.sugerido ?? 0) }));
          }));
        tareas.push(firstValueFrom(this.api.consumo(p))
          .then(datos => { this.consumo = datos; }));
      } else {
        this.sugerencias = [];
        this.consumo = [];
      }
      if (this.esSupervisor()) {
        tareas.push(firstValueFrom(this.api.consolidado(this.mes))
          .then(datos => { this.consolidado = datos; }));
      }
      await Promise.all(tareas);
    } catch (e: any) {
      this.error = this.obtenerError(e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private payload(): PedidoPayload {
    const items: ItemPedidoPayload[] = this.sugerencias
      .filter(s => Number(s.cantidad) > 0)
      .map(s => ({
        productoId: s.productoId,
        cantidad: Number(s.cantidad),
        sugerida: s.sugerido === null ? null : Number(s.sugerido),
        promedio: s.promedioMensual === null ? null : Number(s.promedioMensual),
        stock: Number(s.stockActual)
      }));
    return { plazaId: Number(this.plazaId), periodo: this.mes,
      observacion: this.observacion.trim(), items };
  }

  async guardar(enviar = false): Promise<void> {
    if (this.guardando) return;
    const datos = this.payload();
    if (!this.plazaId || datos.items.length === 0) {
      this.error = 'Selecciona la plaza e indica al menos un material con cantidad mayor a cero.';
      return;
    }
    if (datos.items.some(x => !Number.isFinite(x.cantidad) ||
        x.cantidad < 0 || Math.round(x.cantidad * 100) !== x.cantidad * 100)) {
      this.error = 'Las cantidades deben ser positivas y tener como máximo dos decimales.';
      return;
    }
    this.guardando = true; this.error = ''; this.exito = '';
    try {
      let creado = this.editandoId
        ? await firstValueFrom(this.api.editar(this.editandoId, datos))
        : await firstValueFrom(this.api.crear(datos));
      if (enviar) creado = await firstValueFrom(this.api.enviar(creado.id));
      this.editandoId = null;
      this.seleccionado = creado;
      this.observacion = '';
      this.exito = enviar ? 'Pedido enviado a revisión del supervisor.' : 'Borrador guardado.';
      await this.cargar();
      this.vista = 'seguimiento';
    } catch (e: any) {
      this.error = this.obtenerError(e);
    } finally {
      this.guardando = false; this.cdr.detectChanges();
    }
  }

  async abrir(id: number): Promise<void> {
    this.error = ''; this.exito = '';
    try {
      this.seleccionado = await firstValueFrom(this.api.detalle(id));
      this.cantidadesRecibir = {};
      this.notaRecepcion = '';
      this.claveRecepcion = null;
      this.vista = 'seguimiento';
    } catch (e: any) {
      this.error = this.obtenerError(e);
    } finally { this.cdr.detectChanges(); }
  }

  async editar(pedido: PedidoDetalle): Promise<void> {
    if (pedido.estado !== 'BORRADOR' && pedido.estado !== 'RECHAZADO') return;
    this.mes = pedido.periodo;
    this.plazaId = pedido.plazaId;
    await this.cargar();
    const actuales = new Map(pedido.items.map(i => [i.productoId, i]));
    this.sugerencias = this.sugerencias.map(s => ({
      ...s, cantidad: Number(actuales.get(s.productoId)?.cantidad ?? 0)
    }));
    for (const i of pedido.items) {
      if (!this.sugerencias.some(s => s.productoId === i.productoId)) {
        this.sugerencias.push({
          productoId: i.productoId, producto: i.producto, unidadMedida: i.unidad,
          stockActual: i.stock ?? 0, stockMinimo: 0,
          promedioMensual: i.promedio, sugerido: i.sugerida,
          conHistorico: i.promedio !== null, cantidad: Number(i.cantidad)
        });
      }
    }
    this.editandoId = pedido.id;
    this.observacion = pedido.observacion ?? '';
    this.vista = 'nuevo';
  }

  async cambiarEstado(accion: 'aprobar'|'rechazar'|'cerrar'): Promise<void> {
    if (!this.seleccionado || this.guardando) return;
    const id = this.seleccionado.id;
    const titulo = accion === 'aprobar' ? 'aprobar' :
      accion === 'rechazar' ? 'rechazar' : 'cerrar con faltantes';
    if (!confirm('¿Deseas ' + titulo + ' el pedido #' + id + '?')) return;
    this.guardando = true; this.error = ''; this.exito = '';
    try {
      this.seleccionado = await firstValueFrom(
        accion === 'aprobar' ? this.api.aprobar(id)
          : accion === 'rechazar' ? this.api.rechazar(id)
          : this.api.cerrarFaltantes(id)
      );
      this.exito = 'Estado actualizado correctamente.';
      await this.cargar();
    } catch (e: any) { this.error = this.obtenerError(e); }
    finally { this.guardando = false; this.cdr.detectChanges(); }
  }

  async recibir(): Promise<void> {
    if (!this.seleccionado || this.guardando) return;
    const items = this.seleccionado.items
      .map(x => ({ productoId: x.productoId, cantidad: Number(this.cantidadesRecibir[x.productoId] || 0) }))
      .filter(x => x.cantidad > 0);
    const valido = items.every(x => {
      const pedido = this.seleccionado?.items.find(p => p.productoId === x.productoId);
      return Number.isFinite(x.cantidad) && x.cantidad <= Number(pedido?.pendiente ?? 0) &&
        Math.round(x.cantidad * 100) === x.cantidad * 100;
    });
    if (!valido || items.length === 0) {
      this.error = 'Ingresa cantidades válidas que no superen lo pendiente.';
      return;
    }
    if (!confirm('¿Confirmas la recepción de ' + items.length + ' materiales? Esto actualizará el stock.')) return;
    this.guardando = true; this.error = ''; this.exito = '';
    this.claveRecepcion ??= crypto.randomUUID();
    try {
      this.seleccionado = await firstValueFrom(this.api.recibir(
        this.seleccionado.id, this.claveRecepcion, items, this.notaRecepcion.trim()
      ));
      this.cantidadesRecibir = {};
      this.notaRecepcion = '';
      this.claveRecepcion = null;
      this.exito = 'Recepción registrada. El stock ya refleja solo las cantidades recibidas.';
      await this.cargar();
    } catch (e: any) { this.error = this.obtenerError(e); }
    finally { this.guardando = false; this.cdr.detectChanges(); }
  }
  resetearClaveRecepcion(): void { this.claveRecepcion = null; }

  async elevar(): Promise<void> {
    if (this.guardando || !this.esSupervisor()) return;
    if (!confirm('¿Consolidar los pedidos aprobados de ' + this.mes + ' y marcarlos como enviados a Planificación?')) return;
    this.guardando = true; this.error = ''; this.exito = '';
    try {
      this.consolidado = await firstValueFrom(this.api.consolidar(this.mes));
      this.exito = 'Consolidado generado y pedidos aprobados marcados como enviados.';
      await this.cargar();
    } catch (e: any) { this.error = this.obtenerError(e); }
    finally { this.guardando = false; this.cdr.detectChanges(); }
  }

  readonly etiquetaEstado: Record<string,string> = {
    BORRADOR:'Borrador', PENDIENTE:'Pendiente de aprobación', APROBADO:'Aprobado',
    ENVIADO:'Enviado a planificación', PARCIAL:'Recibido parcialmente',
    COMPLETADO:'Completado', CERRADO_FALTANTES:'Cerrado con faltantes', RECHAZADO:'Rechazado'
  };
  private obtenerError(e: any): string {
    return e?.error?.detail || e?.error?.message || e?.error?.error ||
      e?.message || 'No se pudo completar la operación.';
  }
}
