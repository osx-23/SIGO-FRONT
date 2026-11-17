import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Control compartido para historiales con datos paginados por PostgreSQL. */
@Component({
  selector: 'app-historial-paginacion',
  standalone: true,
  template: `
    <div class="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70
                px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"
         aria-label="Paginación del historial">
      <p class="text-xs sm:text-sm" aria-live="polite">
        Mostrando <strong class="text-slate-900">{{ primero }}</strong>–<strong class="text-slate-900">{{ ultimo }}</strong>
        de <strong class="text-slate-900">{{ totalRegistros }}</strong> registros
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <label class="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
          Por página
          <select [value]="tamano" (change)="cambiarTamano($event)" [disabled]="cargando"
                  aria-label="Registros por página"
                  class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900
                         focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
            <option [value]="10">10</option>
            <option [value]="25">25</option>
            <option [value]="50">50</option>
          </select>
        </label>
        <nav class="flex flex-wrap items-center gap-1" aria-label="Páginas del historial">
          <button type="button" (click)="ir(1)" [disabled]="cargando || pagina <= 1"
                  aria-label="Primera página"
                  class="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700
                         hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40">«</button>
          <button type="button" (click)="ir(pagina - 1)" [disabled]="cargando || pagina <= 1"
                  aria-label="Página anterior"
                  class="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700
                         hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40">‹</button>
          @if (primeraVisible > 1) {
            <span class="px-1 text-slate-400" aria-hidden="true">…</span>
          }
          @for (numero of paginasVisibles; track numero) {
            <button type="button" (click)="ir(numero)" [disabled]="cargando"
                    [attr.aria-label]="'Ir a página ' + numero"
                    [attr.aria-current]="numero === pagina ? 'page' : null"
                    [class]="numero === pagina
                      ? 'min-w-9 rounded-lg border border-blue-600 bg-blue-600 px-2.5 py-2 text-xs font-semibold text-white disabled:opacity-50'
                      : 'min-w-9 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 disabled:opacity-50'">
              {{ numero }}
            </button>
          }
          @if (ultimaVisible < totalPaginas) {
            <span class="px-1 text-slate-400" aria-hidden="true">…</span>
          }
          <button type="button" (click)="ir(pagina + 1)"
                  [disabled]="cargando || pagina >= totalPaginas"
                  aria-label="Página siguiente"
                  class="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700
                         hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40">›</button>
          <button type="button" (click)="ir(totalPaginas)"
                  [disabled]="cargando || pagina >= totalPaginas"
                  aria-label="Última página"
                  class="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700
                         hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40">»</button>
        </nav>
      </div>
    </div>
  `
})
export class HistorialPaginacionComponent {
  @Input() pagina = 1;
  @Input() tamano = 10;
  @Input() totalRegistros = 0;
  @Input() totalPaginas = 0;
  @Input() cargando = false;
  @Output() paginaChange = new EventEmitter<number>();
  @Output() tamanoChange = new EventEmitter<number>();

  get primero(): number {
    return this.totalRegistros ? (this.pagina - 1) * this.tamano + 1 : 0;
  }
  get ultimo(): number {
    return Math.min(this.pagina * this.tamano, this.totalRegistros);
  }
  get primeraVisible(): number {
    return Math.max(1, Math.min(this.pagina - 2, this.totalPaginas - 4));
  }
  get ultimaVisible(): number {
    return Math.min(this.totalPaginas, this.primeraVisible + 4);
  }
  get paginasVisibles(): number[] {
    return Array.from({ length: Math.max(0, this.ultimaVisible - this.primeraVisible + 1) },
      (_, i) => this.primeraVisible + i);
  }
  ir(numero: number): void {
    if (!this.cargando && numero >= 1 && numero <= this.totalPaginas && numero !== this.pagina) {
      this.paginaChange.emit(numero);
    }
  }
  cambiarTamano(evento: Event): void {
    const tamano = Number((evento.target as HTMLSelectElement).value);
    if (!this.cargando && [10, 25, 50].includes(tamano) && tamano !== this.tamano) {
      this.tamanoChange.emit(tamano);
    }
  }
}
