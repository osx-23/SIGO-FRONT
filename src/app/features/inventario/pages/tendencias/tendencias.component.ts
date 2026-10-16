import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { InventarioApiService } from '../../services/inventario-api.service';
import { CatalogoItem, StockActual } from '../../models/inventario.models';

interface PuntoConteo {
  inventarioId: number;
  fecha: string;
  cantidad: number;
}

@Component({
  selector: 'app-tendencias-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <main class="min-h-full bg-slate-50 px-4 py-6 sm:px-6">
    <div class="mx-auto max-w-7xl space-y-6">
      <header class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <span class="text-xs font-extrabold uppercase tracking-widest text-blue-700">SIGO · Inventario</span>
        <h1 class="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">Tendencia de existencias</h1>
        <p class="mt-2 text-sm text-slate-500">Cada barra representa un inventario finalizado. Consulta la evolución del saldo de cada producto, sin confundir entregas y traslados con consumo.</p>
      </header>

      <section class="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
        <div>
          <label for="plaza" class="mb-2 block text-xs font-bold uppercase text-slate-500">Plaza</label>
          <select id="plaza" [(ngModel)]="plazaId" (ngModelChange)="cambiarPlaza()" [disabled]="!esSupervisor()" class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            @for (plaza of plazas; track plaza.id) {
              <option [ngValue]="plaza.id">{{ plaza.codigo || plaza.nombre }}</option>
            }
          </select>
        </div>
        <div>
          <label for="producto" class="mb-2 block text-xs font-bold uppercase text-slate-500">Material</label>
          <select id="producto" [(ngModel)]="productoId" (ngModelChange)="cargarPuntos()" class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            @for (p of productos(); track p.productoId) {
              <option [ngValue]="p.productoId">{{ p.producto }}</option>
            }
          </select>
        </div>
        <div class="flex items-end">
          <button type="button" (click)="cargarPuntos()" [disabled]="cargando"
            class="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">Actualizar gráfico</button>
        </div>
      </section>

      @if (error) { <p role="alert" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{{ error }}</p> }

      <section class="grid gap-4 sm:grid-cols-3">
        <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-bold uppercase text-slate-400">Último conteo finalizado</p>
          <p class="mt-2 text-3xl font-black text-slate-900">{{ ultimo()?.cantidad ?? '—' }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ ultimo()?.fecha ? (ultimo()?.fecha | date:'dd/MM/yyyy HH:mm') : 'Sin registro de conteo' }}</p>
        </article>
        <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-bold uppercase text-slate-400">Cambio entre últimos conteos</p>
          <p class="mt-2 text-3xl font-black" [class.text-red-600]="variacion() !== null && variacion()! < 0"
            [class.text-emerald-600]="variacion() !== null && variacion()! > 0">{{ variacion() === null ? '—' : variacion() }}</p>
          <p class="mt-1 text-xs text-slate-500">Variación neta de existencias, no consumo confirmado</p>
        </article>
        <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-bold uppercase text-slate-400">Conteos disponibles</p>
          <p class="mt-2 text-3xl font-black text-slate-900">{{ puntos.length }}</p>
          <p class="mt-1 text-xs text-slate-500">Últimos 12 meses</p>
        </article>
      </section>

      <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 class="text-lg font-extrabold text-slate-900">Evolución del stock contado</h2>
        <p class="mt-1 text-sm text-slate-500">Comparación cronológica por material y plaza.</p>
        @if (cargando) {
          <p class="py-16 text-center text-sm text-slate-500">Cargando conteos…</p>
        } @else if (puntos.length === 0) {
          <div class="mt-6 rounded-xl border border-dashed border-slate-200 px-5 py-16 text-center">
            <h3 class="font-bold text-slate-700">No hay conteos finalizados para este material</h3>
            <p class="mt-2 text-sm text-slate-500">Las cifras importadas de septiembre son referenciales y no se dibujan como mediciones recientes.</p>
          </div>
        } @else {
          <div class="mt-6 overflow-x-auto">
            <div class="flex h-72 items-end gap-3 border-b border-slate-200 pb-1" [style.min-width.px]="anchoGrafico()">
              @for (punto of puntos; track punto.inventarioId) {
                <div class="flex h-full min-w-16 flex-1 flex-col items-center justify-end gap-1" [attr.title]="'Inventario #' + punto.inventarioId + ': ' + punto.cantidad">
                  <span class="text-xs font-bold text-slate-600">{{ punto.cantidad }}</span>
                  <div class="w-full max-w-20 rounded-t-lg bg-blue-500 transition-all hover:bg-blue-700"
                    [style.height.%]="altura(punto.cantidad)" role="img" [attr.aria-label]="'Saldo: ' + punto.cantidad"></div>
                  <span class="w-full truncate text-center text-[10px] text-slate-500">{{ punto.fecha | date:'dd/MM' }}</span>
                </div>
              }
            </div>
          </div>
        }
        <p class="mt-5 text-xs leading-5 text-slate-500">
          Una disminución entre dos conteos no equivale necesariamente a consumo: podría incluir ajustes o movimientos no registrados.
          Los traslados registrados se descuentan del origen al enviarse y se suman al destino al recibirse, sin contarlos como consumo.
        </p>
      </section>
    </div>
  </main>
  `
})
export class TendenciasInventarioComponent implements OnInit {
  plazas: CatalogoItem[] = [];
  stock: StockActual[] = [];
  puntos: PuntoConteo[] = [];
  plazaId: number | null = null;
  productoId: number | null = null;
  cargando = false;
  error = '';

  constructor(private readonly api: InventarioApiService, private readonly http: HttpClient,
    public readonly auth: AuthService, private readonly cdr: ChangeDetectorRef) {}

  esSupervisor(): boolean { return this.auth.tieneRol('SUPERVISOR'); }
  productos(): StockActual[] { return this.stock.filter(s => s.plazaId === this.plazaId); }
  ultimo(): PuntoConteo | null { return this.puntos.length ? this.puntos[this.puntos.length - 1] : null; }
  variacion(): number | null {
    const n = this.puntos.length;
    return n < 2 ? null : Number((Number(this.puntos[n - 1].cantidad) - Number(this.puntos[n - 2].cantidad)).toFixed(2));
  }
  altura(cantidad: number): number {
    const max = Math.max(1, ...this.puntos.map(p => Number(p.cantidad)));
    return Math.max(2, (Number(cantidad) / max) * 85);
  }
  anchoGrafico(): number { return Math.max(400, this.puntos.length * 84); }

  async ngOnInit(): Promise<void> {
    this.plazaId = this.auth.usuario()?.plazaId ?? null;
    this.cargando = true;
    try {
      const filtro = this.esSupervisor() ? null : this.plazaId;
      const [plazas, stock] = await Promise.all([
        firstValueFrom(this.api.catalogo('plazas')),
        firstValueFrom(this.api.stock({ plazaId: filtro }))
      ]);
      this.plazas = plazas; this.stock = stock;
      if (this.plazaId === null) this.plazaId = plazas[0]?.id ?? null;
      this.cambiarPlaza();
    } catch (e: any) { this.error = this.errorApi(e); this.cargando = false; }
    this.cdr.detectChanges();
  }
  cambiarPlaza(): void {
    if (!this.productos().some(p => p.productoId === this.productoId)) {
      this.productoId = this.productos()[0]?.productoId ?? null;
    }
    void this.cargarPuntos();
  }
  async cargarPuntos(): Promise<void> {
    this.puntos = [];
    if (!this.plazaId || !this.productoId) { this.cargando = false; this.cdr.detectChanges(); return; }
    this.cargando = true; this.error = '';
    try {
      const params = new HttpParams().set('plazaId', String(this.plazaId)).set('productoId', String(this.productoId));
      this.puntos = await firstValueFrom(this.http.get<PuntoConteo[]>(
        `${environment.apiUrl}/inventario/stock/tendencia`, { params }));
    } catch (e: any) { this.error = this.errorApi(e); }
    finally { this.cargando = false; this.cdr.detectChanges(); }
  }
  private errorApi(e: any): string {
    return e?.error?.message || e?.error?.detail || e?.error?.error || 'No se pudo cargar el gráfico.';
  }
}
