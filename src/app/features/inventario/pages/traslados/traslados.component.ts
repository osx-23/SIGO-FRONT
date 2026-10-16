import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { InventarioApiService } from '../../services/inventario-api.service';
import { CatalogoItem, StockActual } from '../../models/inventario.models';

type EstadoTraslado = 'EN_TRANSITO' | 'RECIBIDO';

interface Traslado {
  id: number;
  origenPlazaId: number;
  origen: string;
  destinoPlazaId: number;
  destino: string;
  productoId: number;
  producto: string;
  unidad: string;
  cantidad: number;
  estado: EstadoTraslado;
  enviadoEn: string;
  recibidoEn: string | null;
  observacion: string | null;
}

@Component({
  selector: 'app-traslados',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './traslados.component.html'
})
export class TrasladosComponent implements OnInit {
  plazas: CatalogoItem[] = [];
  stock: StockActual[] = [];
  traslados: Traslado[] = [];

  // La lista es la vista principal; el formulario se utiliza en un modal.
  modalAbierto = false;
  origenPlazaId: number | null = null;
  destinoPlazaId: number | null = null;
  productoId: number | null = null;
  cantidad: number | null = null;
  observacion = '';

  // Filtros locales de los últimos 300 registros que devuelve la API.
  origenFiltro: number | null = null;
  destinoFiltro: number | null = null;
  estadoFiltro: 'TODOS' | EstadoTraslado = 'TODOS';
  textoBusqueda = '';
  fechaDesde = '';
  fechaHasta = '';
  pagina = 1;
  readonly tamanoPagina = 10;

  cargando = true;
  enviando = false;
  error = '';
  errorModal = '';
  mensaje = '';

  constructor(
    private readonly api: InventarioApiService,
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute,
    public readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  esSupervisor(): boolean { return this.auth.tieneRol('SUPERVISOR'); }

  async ngOnInit(): Promise<void> {
    this.origenPlazaId = this.auth.usuario()?.plazaId ?? null;

    const plazaParametro = Number(this.route.snapshot.queryParamMap.get('plazaId'));
    if (this.esSupervisor() && plazaParametro > 0) this.origenPlazaId = plazaParametro;

    const materialParametro = Number(this.route.snapshot.queryParamMap.get('productoId'));
    if (materialParametro > 0) this.productoId = materialParametro;

    await this.cargar();
    // Mantiene el acceso desde el botón «Mover a otra plaza» en Stock.
    if (materialParametro > 0 && this.productoSeleccionado()) this.abrirModal();
  }

  productosOrigen(): StockActual[] {
    return this.stock
      .filter(item => item.plazaId === this.origenPlazaId && Number(item.cantidadActual) > 0)
      .sort((a, b) => a.producto.localeCompare(b.producto));
  }

  productoSeleccionado(): StockActual | undefined {
    return this.productosOrigen().find(item => item.productoId === this.productoId);
  }

  plazasDestino(): CatalogoItem[] {
    return this.plazas.filter(plaza => plaza.id !== this.origenPlazaId);
  }

  cambiarOrigen(): void {
    if (!this.productoSeleccionado()) this.productoId = null;
    if (this.destinoPlazaId === this.origenPlazaId) this.destinoPlazaId = null;
    const disponible = Number(this.productoSeleccionado()?.cantidadActual ?? 0);
    if (this.cantidad !== null && this.cantidad > disponible) this.cantidad = null;
  }

  abrirModal(): void {
    if (this.cargando || this.enviando) return;
    this.errorModal = '';
    this.modalAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    if (this.enviando) return;
    this.modalAbierto = false;
    this.errorModal = '';
  }

  @HostListener('document:keydown.escape')
  alPresionarEscape(): void {
    if (this.modalAbierto) this.cerrarModal();
  }

  get listaFiltrada(): Traslado[] {
    const busqueda = this.textoBusqueda.toLocaleLowerCase('es-PE').trim();
    return this.traslados.filter(t => {
      if (this.origenFiltro !== null && t.origenPlazaId !== this.origenFiltro) return false;
      if (this.destinoFiltro !== null && t.destinoPlazaId !== this.destinoFiltro) return false;
      if (this.estadoFiltro !== 'TODOS' && t.estado !== this.estadoFiltro) return false;
      if (busqueda && ![t.producto, t.origen, t.destino, String(t.id)]
        .some(valor => valor.toLocaleLowerCase('es-PE').includes(busqueda))) return false;
      const fecha = this.fechaLocal(t.enviadoEn);
      if (this.fechaDesde && fecha < this.fechaDesde) return false;
      if (this.fechaHasta && fecha > this.fechaHasta) return false;
      return true;
    });
  }

  private fechaLocal(valor: string): string {
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor.slice(0, 10);
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return anio + '-' + mes + '-' + dia;
  }

  get totalPaginas(): number { return Math.max(1, Math.ceil(this.listaFiltrada.length / this.tamanoPagina)); }
  get listaPagina(): Traslado[] {
    return this.listaFiltrada.slice((this.pagina - 1) * this.tamanoPagina, this.pagina * this.tamanoPagina);
  }
  get primerResultado(): number {
    return this.listaFiltrada.length ? (this.pagina - 1) * this.tamanoPagina + 1 : 0;
  }
  get ultimoResultado(): number {
    return Math.min(this.pagina * this.tamanoPagina, this.listaFiltrada.length);
  }

  cambiarFiltros(): void { this.pagina = 1; }
  limpiarFiltros(): void {
    this.origenFiltro = null;
    this.destinoFiltro = null;
    this.estadoFiltro = 'TODOS';
    this.textoBusqueda = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.pagina = 1;
  }
  anterior(): void { if (this.pagina > 1) this.pagina--; }
  siguiente(): void { if (this.pagina < this.totalPaginas) this.pagina++; }

  get totalTraslados(): number { return this.traslados.length; }
  get totalEnTransito(): number { return this.traslados.filter(t => t.estado === 'EN_TRANSITO').length; }
  get totalRecibidos(): number { return this.traslados.filter(t => t.estado === 'RECIBIDO').length; }
  get totalPorRecibir(): number {
    return this.traslados.filter(t => t.estado === 'EN_TRANSITO' && this.puedeRecibir(t)).length;
  }
  puedeRecibir(t: Traslado): boolean {
    return this.esSupervisor() || this.auth.usuario()?.plazaId === t.destinoPlazaId;
  }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const plazaFiltro = this.esSupervisor() ? null : this.auth.usuario()?.plazaId ?? null;
      const [plazas, stock, traslados] = await Promise.all([
        firstValueFrom(this.api.catalogo('plazas')),
        firstValueFrom(this.api.stock({ plazaId: plazaFiltro })),
        firstValueFrom(this.http.get<Traslado[]>(environment.apiUrl + '/inventario/traslados'))
      ]);
      this.plazas = plazas;
      this.stock = stock;
      this.traslados = traslados;
      if (this.origenPlazaId === null && this.esSupervisor() && plazas.length > 0) {
        this.origenPlazaId = plazas[0].id;
      }
      this.cambiarOrigen();
      if (this.pagina > this.totalPaginas) this.pagina = this.totalPaginas;
    } catch (e: any) {
      this.error = this.errorApi(e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async enviar(): Promise<void> {
    if (this.enviando) return;
    const item = this.productoSeleccionado();
    const cantidad = Number(this.cantidad);
    if (!item || !this.origenPlazaId || !this.destinoPlazaId
        || this.destinoPlazaId === this.origenPlazaId
        || !Number.isFinite(cantidad) || cantidad <= 0
        || Math.abs(Math.round(cantidad * 100) - cantidad * 100) > 0.000001
        || cantidad > Number(item.cantidadActual)) {
      this.errorModal = 'Revisa las plazas, el material y la cantidad disponible (máximo dos decimales).';
      return;
    }
    if (!window.confirm(
      '¿Enviar ' + cantidad + ' ' + item.unidadMedida + ' de ' + item.producto +
      ' a la plaza de destino? La cantidad se descontará del origen.'
    )) return;

    this.enviando = true;
    this.errorModal = '';
    this.error = '';
    this.mensaje = '';
    try {
      await firstValueFrom(this.http.post(environment.apiUrl + '/inventario/traslados', {
        origenPlazaId: this.origenPlazaId,
        destinoPlazaId: this.destinoPlazaId,
        productoId: this.productoId,
        cantidad,
        observacion: this.observacion.trim()
      }));
      this.modalAbierto = false;
      this.cantidad = null;
      this.destinoPlazaId = null;
      this.observacion = '';
      await this.cargar();
      this.mensaje = 'Traslado registrado. Se descontó del origen y quedó pendiente de recepción.';
    } catch (e: any) {
      this.errorModal = this.errorApi(e);
    } finally {
      this.enviando = false;
      this.cdr.detectChanges();
    }
  }

  async recibir(t: Traslado): Promise<void> {
    if (this.enviando || !this.puedeRecibir(t) || t.estado !== 'EN_TRANSITO') return;
    if (!window.confirm(
      '¿Confirmas que llegaron ' + t.cantidad + ' ' + t.unidad + ' de ' +
      t.producto + ' a ' + t.destino + '? Se sumarán al stock de destino.'
    )) return;
    this.enviando = true;
    this.error = '';
    this.mensaje = '';
    try {
      await firstValueFrom(this.http.post(environment.apiUrl + '/inventario/traslados/' + t.id + '/recibir', {}));
      await this.cargar();
      this.mensaje = 'Recepción confirmada. Se sumaron las unidades al stock de destino.';
    } catch (e: any) {
      this.error = this.errorApi(e);
    } finally {
      this.enviando = false;
      this.cdr.detectChanges();
    }
  }

  private errorApi(e: any): string {
    const detalle = e?.error?.detail || e?.error?.message || e?.error?.error;
    return typeof detalle === 'string' ? detalle : 'No se pudo completar la operación.';
  }
}
