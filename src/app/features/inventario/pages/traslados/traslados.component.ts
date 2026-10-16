import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { InventarioApiService } from '../../services/inventario-api.service';
import { CatalogoItem, StockActual } from '../../models/inventario.models';

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
  estado: 'EN_TRANSITO' | 'RECIBIDO';
  enviadoEn: string;
  recibidoEn: string | null;
  observacion: string | null;
}

@Component({
  selector: 'app-traslados',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <main class="min-h-full bg-slate-50 px-4 py-6 sm:px-6">
    <div class="mx-auto max-w-7xl space-y-6">
      <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <a routerLink="/inventario/stock" class="text-sm font-semibold text-blue-700 hover:underline">← Volver a Stock</a>
          <h1 class="mt-2 text-2xl font-extrabold text-slate-900">Transferencias entre plazas</h1>
          <p class="mt-1 text-sm text-slate-500">Controla el envío, el tránsito y la recepción de materiales sin confundir traslados con consumo.</p>
        </div>
        <button type="button" (click)="cargar()" [disabled]="cargando" class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Actualizar información</button>
      </header>

      @if (error) {
        <p role="alert" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{{ error }}</p>
      }
      @if (mensaje) {
        <p role="status" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{{ mensaje }}</p>
      }

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-lg font-bold text-slate-900">Mover material a otra plaza</h2>
          <p class="mt-1 text-sm text-slate-500">El descuento del origen se hará cuando confirmes el envío.</p>

          <form (ngSubmit)="enviar()" class="mt-5 space-y-4">
            <div>
              <label for="origen" class="mb-1 block text-sm font-semibold text-slate-700">Plaza de origen</label>
              <select id="origen" [(ngModel)]="origenPlazaId" (ngModelChange)="cambiarOrigen()" name="origen" [disabled]="!esSupervisor() || enviando" required class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                @for (p of plazas; track p.id) {
                  <option [ngValue]="p.id">{{ p.codigo || p.nombre }}</option>
                }
              </select>
            </div>
            <div>
              <label for="material" class="mb-1 block text-sm font-semibold text-slate-700">Material</label>
              <select id="material" [(ngModel)]="productoId" name="material" [disabled]="enviando" required class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <option [ngValue]="null">Selecciona el material</option>
                @for (item of productosOrigen(); track item.productoId) {
                  <option [ngValue]="item.productoId">{{ item.producto }}</option>
                }
              </select>
            </div>
            @if (productoSeleccionado()) {
              <p class="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Saldo registrado: <strong>{{ productoSeleccionado()?.cantidadActual }} {{ productoSeleccionado()?.unidadMedida }}</strong>.
                @if (productoSeleccionado()?.inventarioId === 0) {
                  <span class="block pt-1 text-xs">Puede provenir de la referencia de septiembre; comprueba físicamente la cantidad antes de transferir.</span>
                }
              </p>
            }
            <div>
              <label for="destino" class="mb-1 block text-sm font-semibold text-slate-700">Plaza de destino</label>
              <select id="destino" [(ngModel)]="destinoPlazaId" name="destino" [disabled]="enviando" required class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <option [ngValue]="null">Selecciona la plaza</option>
                @for (p of plazasDestino(); track p.id) {
                  <option [ngValue]="p.id">{{ p.codigo || p.nombre }}</option>
                }
              </select>
            </div>
            <div>
              <label for="cantidad" class="mb-1 block text-sm font-semibold text-slate-700">Cantidad a enviar</label>
              <input id="cantidad" [(ngModel)]="cantidad" name="cantidad" type="number" min="0.01" step="0.01" required [disabled]="enviando" class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"/>
            </div>
            <div>
              <label for="nota" class="mb-1 block text-sm font-semibold text-slate-700">Observación (opcional)</label>
              <textarea id="nota" [(ngModel)]="observacion" name="nota" rows="2" maxlength="1000" [disabled]="enviando" class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" placeholder="Motivo del traslado"></textarea>
            </div>
            <button type="submit" [disabled]="enviando || cargando || !productoSeleccionado() || !destinoPlazaId || !cantidad || cantidad <= 0"
              class="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {{ enviando ? 'Registrando...' : 'Confirmar envío a otra plaza' }}
            </button>
          </form>
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Seguimiento de transferencias</h2>
              <p class="mt-1 text-sm text-slate-500">La plaza receptora confirma lo recibido para aumentar su stock.</p>
            </div>
            <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{{ pendientes() }} en tránsito</span>
          </div>
          @if (cargando) {
            <p class="py-8 text-center text-sm text-slate-500">Cargando movimientos…</p>
          } @else if (traslados.length === 0) {
            <p class="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Todavía no hay traslados registrados.</p>
          } @else {
            <div class="mt-5 max-h-[680px] space-y-3 overflow-auto pr-1">
              @for (t of traslados; track t.id) {
                <article class="rounded-xl border border-slate-200 p-4">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p class="text-sm font-bold text-slate-900">{{ t.producto }}</p>
                      <p class="mt-1 text-xs text-slate-500">#{{ t.id }} · {{ t.origen }} → {{ t.destino }}</p>
                    </div>
                    <span class="rounded-full px-2.5 py-1 text-xs font-bold"
                      [class.bg-amber-100]="t.estado === 'EN_TRANSITO'" [class.text-amber-800]="t.estado === 'EN_TRANSITO'"
                      [class.bg-emerald-100]="t.estado === 'RECIBIDO'" [class.text-emerald-800]="t.estado === 'RECIBIDO'">
                      {{ t.estado === 'EN_TRANSITO' ? 'En tránsito' : 'Recibido' }}
                    </span>
                  </div>
                  <p class="mt-2 text-sm"><strong>{{ t.cantidad }} {{ t.unidad }}</strong></p>
                  <p class="mt-1 text-xs text-slate-500">Enviado: {{ t.enviadoEn | date:'dd/MM/yyyy HH:mm' }}</p>
                  @if (t.recibidoEn) {
                    <p class="mt-1 text-xs text-slate-500">Recibido: {{ t.recibidoEn | date:'dd/MM/yyyy HH:mm' }}</p>
                  }
                  @if (t.observacion) { <p class="mt-2 text-xs text-slate-600">{{ t.observacion }}</p> }
                  @if (t.estado === 'EN_TRANSITO' && puedeRecibir(t)) {
                    <button type="button" (click)="recibir(t)" [disabled]="enviando"
                      class="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                      Confirmar recepción completa
                    </button>
                  }
                </article>
              }
            </div>
          }
        </section>
      </div>
    </div>
  </main>
  `
})
export class TrasladosComponent implements OnInit {
  plazas: CatalogoItem[] = [];
  stock: StockActual[] = [];
  traslados: Traslado[] = [];
  origenPlazaId: number | null = null;
  destinoPlazaId: number | null = null;
  productoId: number | null = null;
  cantidad: number | null = null;
  observacion = '';
  cargando = true;
  enviando = false;
  error = '';
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
    if (this.esSupervisor()) {
      const valor = Number(this.route.snapshot.queryParamMap.get('plazaId'));
      if (valor > 0) this.origenPlazaId = valor;
    }
    const material = Number(this.route.snapshot.queryParamMap.get('productoId'));
    if (material > 0) this.productoId = material;
    await this.cargar();
  }

  productosOrigen(): StockActual[] {
    return this.stock.filter(i => i.plazaId === this.origenPlazaId && Number(i.cantidadActual) > 0);
  }
  productoSeleccionado(): StockActual | undefined {
    return this.productosOrigen().find(i => i.productoId === this.productoId);
  }
  plazasDestino(): CatalogoItem[] { return this.plazas.filter(p => p.id !== this.origenPlazaId); }
  cambiarOrigen(): void {
    if (!this.productoSeleccionado()) this.productoId = null;
    if (this.destinoPlazaId === this.origenPlazaId) this.destinoPlazaId = null;
  }
  pendientes(): number { return this.traslados.filter(t => t.estado === 'EN_TRANSITO').length; }
  puedeRecibir(t: Traslado): boolean {
    return this.esSupervisor() || this.auth.usuario()?.plazaId === t.destinoPlazaId;
  }

  async cargar(): Promise<void> {
    this.cargando = true; this.error = '';
    try {
      const plazaFiltro = this.esSupervisor() ? null : this.auth.usuario()?.plazaId ?? null;
      const [plazas, stock, traslados] = await Promise.all([
        firstValueFrom(this.api.catalogo('plazas')),
        firstValueFrom(this.api.stock({ plazaId: plazaFiltro })),
        firstValueFrom(this.http.get<Traslado[]>(`${environment.apiUrl}/inventario/traslados`))
      ]);
      this.plazas = plazas;
      this.stock = stock;
      this.traslados = traslados;
      if (this.origenPlazaId === null && plazas.length > 0) this.origenPlazaId = plazas[0].id;
      this.cambiarOrigen();
    } catch (e: any) { this.error = this.errorApi(e); }
    finally { this.cargando = false; this.cdr.detectChanges(); }
  }

  async enviar(): Promise<void> {
    const item = this.productoSeleccionado();
    if (!item || !this.origenPlazaId || !this.destinoPlazaId || !this.cantidad
        || this.cantidad <= 0 || this.cantidad > Number(item.cantidadActual)) {
      this.error = 'Revisa las plazas, el material y la cantidad disponible.'; return;
    }
    if (!window.confirm(`¿Enviar ${this.cantidad} ${item.unidadMedida} de ${item.producto} a otra plaza? Se descontará del origen.`)) return;
    this.enviando = true; this.error = ''; this.mensaje = '';
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/inventario/traslados`, {
        origenPlazaId: this.origenPlazaId, destinoPlazaId: this.destinoPlazaId,
        productoId: this.productoId, cantidad: this.cantidad, observacion: this.observacion.trim()
      }));
      this.mensaje = 'Traslado enviado. La plaza destino debe confirmar su recepción.';
      this.cantidad = null; this.observacion = '';
      await this.cargar();
    } catch (e: any) { this.error = this.errorApi(e); }
    finally { this.enviando = false; this.cdr.detectChanges(); }
  }

  async recibir(t: Traslado): Promise<void> {
    if (!window.confirm(`¿Confirmas que llegaron ${t.cantidad} ${t.unidad} de ${t.producto} a ${t.destino}?`)) return;
    this.enviando = true; this.error = ''; this.mensaje = '';
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/inventario/traslados/${t.id}/recibir`, {}));
      this.mensaje = 'Recepción confirmada. Las unidades ya se sumaron al stock destino.';
      await this.cargar();
    } catch (e: any) { this.error = this.errorApi(e); }
    finally { this.enviando = false; this.cdr.detectChanges(); }
  }

  private errorApi(e: any): string {
    return e?.error?.message || e?.error?.detail || e?.error?.error || 'No se pudo completar la operación.';
  }
}
