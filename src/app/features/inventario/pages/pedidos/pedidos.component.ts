import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CatalogoItem, ProductoAdmin } from '../../models/inventario.models';
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
  categoriaFiltro = 'TODAS';
  filtroStock: 'TODOS' | 'REPOSICION' | 'SUFICIENTE' | 'SIN_DATOS' = 'TODOS';
  productosMeta: ProductoAdmin[] = [];
  seleccionados = new Set<number>();
  revisionAbierta = false;
  observacion = '';
  notaRecepcion = '';
  cantidadesRecibir: Record<number, number> = {};
  editandoId: number | null = null;
  cargando = false;
  guardando = false;
  error = '';
  exito = '';
  private claveRecepcion: string | null = null;
  private claveRecepcionCompleta: string | null = null;

  constructor(
    public readonly auth: AuthService,
    private readonly catalogos: InventarioApiService,
    private readonly api: InventarioPedidosApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  esSupervisor(): boolean { return this.auth.tieneRol('SUPERVISOR'); }
  private get metadata(): Map<number, ProductoAdmin> {
    return new Map(this.productosMeta.map(p => [p.id, p]));
  }

  codigoDe(item: SugerenciaPedido): string {
    return item.codigo || this.metadata.get(item.productoId)?.codigo || ('#' + item.productoId);
  }

  categoriaDe(item: SugerenciaPedido): string {
    return this.metadata.get(item.productoId)?.categoria ?? 'Sin categoría';
  }

  private categoriaDeProducto(productoId: number): string {
    return this.metadata.get(productoId)?.categoria ?? 'Sin categoría';
  }

  get categoriasDisponibles(): string[] {
    // Mantener opciones útiles al pasar entre Planificar, Histórico y Consolidado.
    const categorias = [
      ...this.sugerencias.map(s => this.categoriaDe(s)),
      ...this.consumo.map(item => this.categoriaDeProducto(item.productoId)),
      ...this.consolidado.map(item => this.categoriaDeProducto(item.productoId))
    ];
    return [...new Set(categorias)].sort((a, b) => a.localeCompare(b, 'es'));
  }

  get pedidosVisibles(): PedidoLista[] {
    // El supervisor puede consultar todas las plazas; el selector muestra la elegida.
    return this.plazaId === null
      ? this.pedidos
      : this.pedidos.filter(pedido => pedido.plazaId === this.plazaId);
  }

  get consolidadoVisible(): MaterialConsolidado[] {
    return this.consolidado.filter(item =>
      this.categoriaFiltro === 'TODAS' || this.categoriaDeProducto(item.productoId) === this.categoriaFiltro
    );
  }

  get consumoVisible(): ConsumoHistorico[] {
    return this.consumo.filter(item =>
      this.categoriaFiltro === 'TODAS' || this.categoriaDeProducto(item.productoId) === this.categoriaFiltro
    );
  }

  get productosBase(): SugerenciaPedido[] {
    return this.sugerencias.filter(s =>
      this.categoriaFiltro === 'TODAS' || this.categoriaDe(s) === this.categoriaFiltro
    );
  }

  requiereReposicion(item: SugerenciaPedido): boolean {
    return item.stockOrigen !== 'SIN_REGISTRO' && item.conHistorico &&
      item.promedioMensual !== null && Number(item.promedioMensual) > Number(item.stockActual);
  }

  tieneCobertura(item: SugerenciaPedido): boolean {
    return item.stockOrigen !== 'SIN_REGISTRO' && item.conHistorico && item.promedioMensual !== null;
  }

  cobertura(item: SugerenciaPedido): number | null {
    if (!this.tieneCobertura(item) || Number(item.promedioMensual) <= 0) return null;
    return Math.max(0, Number(item.stockActual) / Number(item.promedioMensual) * 100);
  }

  anchoCobertura(item: SugerenciaPedido): number {
    return Math.min(100, this.cobertura(item) ?? 0);
  }

  get materialesEvaluados(): number { return this.productosBase.length; }
  get materialesReposicion(): number { return this.productosBase.filter(s => this.requiereReposicion(s)).length; }
  get materialesSuficientes(): number {
    return this.productosBase.filter(s => this.tieneCobertura(s) && !this.requiereReposicion(s)).length;
  }
  get materialesSinDatos(): number {
    return this.productosBase.filter(s => !this.tieneCobertura(s)).length;
  }
  get productosFiltrados(): SugerenciaPedido[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.productosBase.filter(s => {
      if (this.filtroStock === 'REPOSICION' && !this.requiereReposicion(s)) return false;
      if (this.filtroStock === 'SUFICIENTE' && (!this.tieneCobertura(s) || this.requiereReposicion(s))) return false;
      if (this.filtroStock === 'SIN_DATOS' && this.tieneCobertura(s)) return false;
      return !q || [s.producto, this.codigoDe(s), this.categoriaDe(s)]
        .some(valor => valor.toLowerCase().includes(q));
    });
  }

  estaSeleccionado(id: number): boolean { return this.seleccionados.has(id); }
  seleccionar(id: number, activo: boolean): void {
    const nuevo = new Set(this.seleccionados);
    if (activo) nuevo.add(id); else nuevo.delete(id);
    this.seleccionados = nuevo;
  }
  get todosVisiblesSeleccionados(): boolean {
    return this.productosFiltrados.length > 0 &&
      this.productosFiltrados.every(s => this.estaSeleccionado(s.productoId));
  }
  seleccionarVisibles(activado: boolean): void {
    const nuevo = new Set(this.seleccionados);
    for (const s of this.productosFiltrados) {
      if (activado) nuevo.add(s.productoId); else nuevo.delete(s.productoId);
    }
    this.seleccionados = nuevo;
  }
  actualizarCantidad(item: SugerenciaPedido, valor: number | null): void {
    item.cantidad = valor === null ? 0 : Number(valor);
    if (item.cantidad > 0) {
      this.seleccionar(item.productoId, true);
    } else {
      this.seleccionar(item.productoId, false);
    }
  }
  aplicarSugerencias(): void {
    let aplicadas = 0;
    const nuevo = new Set(this.seleccionados);
    for (const item of this.productosFiltrados) {
      if (item.sugerido !== null && Number(item.sugerido) > 0) {
        item.cantidad = Number(item.sugerido);
        nuevo.add(item.productoId);
        aplicadas++;
      }
    }
    this.seleccionados = nuevo;
    this.exito = aplicadas
      ? 'Se aplicaron ' + aplicadas + ' sugerencias verificables. Puedes ajustar las cantidades.'
      : '';
    if (!aplicadas) this.error = 'No hay sugerencias históricas positivas para los materiales visibles.';
    else this.error = '';
  }
  get itemsParaRevision(): SugerenciaPedido[] {
    return this.sugerencias.filter(s => this.estaSeleccionado(s.productoId) && Number(s.cantidad) > 0);
  }
  get totalLineas(): number { return this.itemsParaRevision.length; }
  revisarPedido(): void {
    this.error = ''; this.exito = '';
    if (this.guardando || this.cargando) return;
    if (!this.plazaId || this.totalLineas === 0) {
      this.error = 'Selecciona al menos un material e indica su cantidad para revisar el pedido.';
      return;
    }
    if (this.itemsParaRevision.some(s => !Number.isFinite(Number(s.cantidad)) ||
      Number(s.cantidad) <= 0 ||
      Math.abs(Math.round(Number(s.cantidad) * 100) - Number(s.cantidad) * 100) > 0.000001)) {
      this.error = 'Revisa las cantidades. Deben ser mayores a cero y tener como máximo dos decimales.';
      return;
    }
    this.revisionAbierta = true;
  }
  get plazaSeleccionadaTexto(): string {
    if (!this.esSupervisor()) return this.auth.usuario()?.plaza ?? 'Plaza asignada';
    const plaza = this.plazas.find(p => p.id === this.plazaId);
    return plaza ? (plaza.codigo ?? plaza.nombre) : 'Plaza';
  }
  async cambiarContexto(): Promise<void> {
    this.editandoId = null;
    this.revisionAbierta = false;
    // Evitar mostrar un pedido de otra plaza o periodo al cambiar filtros.
    this.seleccionado = null;
    this.categoriaFiltro = 'TODAS';
    this.filtroStock = 'TODOS';
    this.busqueda = '';
    await this.cargar();
  }
  exportarVista(): void {
    const columnas = ['Material', 'Codigo', 'Categoria', 'Stock actual', 'Consumo mensual',
      'Cobertura (%)', 'Sugerido', 'Cantidad a pedir', 'Seleccionado'];
    const proteger = (valor: string | number): string => {
      const texto = String(valor);
      const seguro = /^[\s]*[=+@-]/.test(texto) ? "'" + texto : texto;
      return '"' + seguro.replace(/"/g, '""') + '"';
    };
    const filas = this.productosFiltrados.map(item => [
      item.producto, this.codigoDe(item), this.categoriaDe(item),
      item.stockVerificado ? Number(item.stockActual) : 'Sin conteo',
      item.conHistorico ? Number(item.promedioMensual) : 'Sin histórico',
      this.cobertura(item) === null ? 'Sin datos' : Math.round(this.cobertura(item)!),
      item.sugerido ?? 'Sin sugerencia',
      Number(item.cantidad) || 0,
      this.estaSeleccionado(item.productoId) ? 'Si' : 'No'
    ].map(v => proteger(v)).join(';'));
    const blob = new Blob(['\uFEFF' + [columnas.map(v => proteger(v)).join(';'), ...filas].join('\r\n')],
      { type: 'text/csv;charset=utf-8' });
    const enlace = document.createElement('a');
    const url = URL.createObjectURL(blob);
    enlace.href = url;
    enlace.download = 'SIGO-pedido-' + this.mes + '-' + this.plazaSeleccionadaTexto.replace(/[^a-zA-Z0-9-]/g, '-') + '.csv';
    enlace.click();
    URL.revokeObjectURL(url);
  }
  private mesActual(): string {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  get sinHistorico(): number { return this.sugerencias.filter(s => !s.conHistorico).length; }
  stockDisponible(item: SugerenciaPedido): boolean {
    return item.stockOrigen !== 'SIN_REGISTRO';
  }
  etiquetaOrigen(item: SugerenciaPedido): string {
    if (item.stockOrigen === 'EXCEL_SEPTIEMBRE') return 'Referencia septiembre 2026';
    if (item.stockOrigen === 'CONTEO') return 'Conteo confirmado';
    return item.stockOrigen === 'RECEPCION' ? 'Recepción registrada' : 'Sin registro';
  }

  get totalSolicitado(): number {
    return this.itemsParaRevision.reduce((total, s) => total + (Number(s.cantidad) || 0), 0);
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
    try {
      this.productosMeta = await firstValueFrom(this.catalogos.productosAdmin());
    } catch {
      this.productosMeta = [];
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
            // La sugerencia es informativa: no llenar ni seleccionar cantidades al entrar.
            this.sugerencias = datos.map(s => ({ ...s, cantidad: 0 }));
            this.seleccionados = new Set<number>();
          }));
        tareas.push(firstValueFrom(this.api.consumo(p))
          .then(datos => { this.consumo = datos; }));
      } else {
        this.sugerencias = [];
        this.seleccionados = new Set();
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
    const items: ItemPedidoPayload[] = this.itemsParaRevision
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
        x.cantidad < 0 || Math.abs(Math.round(x.cantidad * 100) - x.cantidad * 100) > 0.000001)) {
      this.error = 'Las cantidades deben ser positivas y tener como máximo dos decimales.';
      return;
    }
    this.guardando = true; this.error = ''; this.exito = '';
    try {
      let creado = this.editandoId
        ? await firstValueFrom(this.api.editar(this.editandoId, datos))
        : await firstValueFrom(this.api.crear(datos));
      this.editandoId = creado.id; // conserva el borrador si falla el envío
      if (enviar) creado = await firstValueFrom(this.api.enviar(creado.id));
      this.editandoId = null;
      this.revisionAbierta = false;
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
      this.claveRecepcionCompleta = null;
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
          productoId: i.productoId, codigo: i.codigo, producto: i.producto, unidadMedida: i.unidad,
          stockActual: i.stock ?? 0, stockVerificado: i.stock !== null,
          stockOrigen: i.stock !== null ? 'CONTEO' : 'SIN_REGISTRO',
          stockMinimo: 0, promedioMensual: i.promedio, sugerido: i.sugerida,
          fuenteConsumo: i.promedio !== null ? 'CONTEOS' : 'SIN_DATOS',
          fuenteSugerencia: i.sugerida !== null ? 'CONSUMO_CALCULADO' : 'SIN_DATOS',
          periodoReferencia: null, conHistorico: i.promedio !== null,
          cantidad: Number(i.cantidad)
        });
      }
    }
    this.editandoId = pedido.id;
    this.seleccionados = new Set(pedido.items.map(i => i.productoId));
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
        Math.abs(Math.round(x.cantidad * 100) - x.cantidad * 100) < 0.000001;
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
  async recibirCompleto(): Promise<void> {
    const pedido = this.seleccionado;
    if (!pedido || this.guardando || !['APROBADO', 'ENVIADO', 'PARCIAL'].includes(pedido.estado)) return;

    // En pedidos parciales se recibe solo el saldo faltante, nunca lo ya registrado.
    const items = pedido.items
      .map(item => ({ productoId: item.productoId, cantidad: Number(item.pendiente) }))
      .filter(item => item.cantidad > 0);

    if (!items.length || items.some(item => !Number.isFinite(item.cantidad))) {
      this.error = 'No hay materiales pendientes para registrar.';
      return;
    }

    const total = items.reduce((suma, item) => suma + item.cantidad, 0);
    const mensaje = '¿Confirmas que recibiste todos los materiales pendientes del pedido #' +
      pedido.id + '? Se agregarán ' + total.toLocaleString('es-PE') +
      ' unidades de ' + items.length + ' materiales al stock de ' + pedido.plaza +
      '. Esta operación registra una recepción real.';
    if (!confirm(mensaje)) return;

    this.guardando = true;
    this.error = '';
    this.exito = '';
    // Conservar la clave en caso de error de red para no duplicar la entrega al reintentar.
    this.claveRecepcionCompleta ??= crypto.randomUUID();
    try {
      this.seleccionado = await firstValueFrom(this.api.recibir(
        pedido.id,
        this.claveRecepcionCompleta,
        items,
        'Recepción completa de los materiales pendientes'
      ));
      this.cantidadesRecibir = {};
      this.notaRecepcion = '';
      this.claveRecepcion = null;
      this.claveRecepcionCompleta = null;
      this.exito = 'Pedido completado. Todos los materiales pendientes se sumaron al stock.';
      await this.cargar();
    } catch (e: any) {
      this.error = this.obtenerError(e);
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  resetearClaveRecepcion(): void { this.claveRecepcion = null; }

  async elevar(): Promise<void> {
    if (this.guardando || !this.esSupervisor()) return;
    if (!confirm('¿Consolidar los pedidos aprobados de ' + this.mes + ' y marcarlos como enviados a Planificación?')) return;
    this.guardando = true; this.error = ''; this.exito = '';
    try {
      this.consolidado = await firstValueFrom(this.api.consolidar(this.mes));
      this.exito = 'Consolidado generado. Compártelo con Planificación por el canal habitual.';
      await this.cargar();
    } catch (e: any) { this.error = this.obtenerError(e); }
    finally { this.guardando = false; this.cdr.detectChanges(); }
  }

  readonly etiquetaEstado: Record<string,string> = {
    BORRADOR:'Borrador', PENDIENTE:'Pendiente de aprobación', APROBADO:'Aprobado',
    ENVIADO:'Consolidado para Planificación', PARCIAL:'Recibido parcialmente',
    COMPLETADO:'Completado', CERRADO_FALTANTES:'Cerrado con faltantes', RECHAZADO:'Rechazado'
  };
  private obtenerError(e: any): string {
    return e?.error?.detail || e?.error?.message || e?.error?.error ||
      e?.message || 'No se pudo completar la operación.';
  }
}
