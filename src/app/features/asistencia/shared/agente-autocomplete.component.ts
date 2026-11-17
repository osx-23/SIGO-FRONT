import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, OnChanges, SimpleChanges, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Trabajador } from '../models/asistencia.models';

/** Buscador de agentes integrado con formularios reactivos o ngModel. */
@Component({
  selector: 'app-agente-autocomplete',
  standalone: true,
  imports: [CommonModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AgenteAutocompleteComponent), multi: true }],
  template: `
    <div class="relative">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
        class="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>
      </svg>
      <input type="text" role="combobox" [id]="inputId" [value]="texto" [disabled]="bloqueado"
        autocomplete="off" spellcheck="false" [placeholder]="placeholder"
        [attr.aria-label]="etiqueta" aria-autocomplete="list" [attr.aria-controls]="listaId"
        [attr.aria-expanded]="abierto && !bloqueado"
        [attr.aria-activedescendant]="abierto && sugerencias.length ? opcionId(activo) : null"
        (input)="escribir($event)" (focus)="enfocar()" (keydown)="tecla($event)" (blur)="salir()"
        class="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-10 text-sm font-medium
               text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100
               disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"/>
      @if (texto && !bloqueado) {
        <button type="button" (mousedown)="$event.preventDefault()" (click)="limpiar()"
          aria-label="Limpiar búsqueda o agente seleccionado"
          class="absolute right-2 top-1.5 rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-100">×</button>
      }
      @if (abierto && !bloqueado) {
        <div role="listbox" [id]="listaId" [attr.aria-label]="'Resultados de ' + etiqueta"
          class="absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border
                 border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
          @if (cargando) {
            <p class="p-3 text-sm text-slate-500" role="status">Cargando agentes…</p>
          } @else if (!texto.trim()) {
            <p class="p-3 text-sm text-slate-500">Escribe un código o nombre para buscar.</p>
          } @else if (!sugerencias.length) {
            <p class="p-3 text-sm text-slate-500" role="status">No se encontraron coincidencias.</p>
          } @else {
            @for (agente of sugerencias; track agente.id; let i = $index) {
              <button type="button" role="option" [id]="opcionId(i)"
                [attr.aria-selected]="agente.id === elegido"
                (mousedown)="$event.preventDefault()" (mouseenter)="activo=i"
                (click)="seleccionar(agente)"
                [class.bg-blue-50]="i === activo"
                class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5
                       text-left hover:bg-blue-50">
                <span class="min-w-0">
                  <span class="block truncate text-sm font-semibold text-slate-900">{{ agente.nombreCompleto }}</span>
                  <span class="block text-xs text-slate-500">Código {{ agente.codigo }}</span>
                </span>
                @if (mostrarPlaza) {
                  <span class="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                    {{ agente.plaza?.codigo || 'Sin plaza' }}
                  </span>
                }
              </button>
            }
            @if (totalCoincidencias > sugerencias.length) {
              <p class="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                {{ totalCoincidencias }} coincidencias. Escribe más para afinar la búsqueda.
              </p>
            }
          }
        </div>
      }
    </div>
  `
})
export class AgenteAutocompleteComponent implements ControlValueAccessor, OnChanges {
  private static contador = 0;
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly inputId = 'agente-autocomplete-' + ++AgenteAutocompleteComponent.contador;
  readonly listaId = this.inputId + '-lista';

  @Input() agentes: Trabajador[] = [];
  @Input() mostrarPlaza = false;
  @Input() cargando = false;
  @Input() disabled = false;
  @Input() etiqueta = 'Buscar agente ausente por código o nombre';
  @Input() placeholder = 'Buscar por código o nombre…';

  texto = '';
  abierto = false;
  activo = 0;
  elegido: number | null = null;
  private disabledControl = false;
  private emitir: (valor: number | null) => void = () => {};
  private tocado: () => void = () => {};

  get bloqueado(): boolean { return this.disabled || this.disabledControl; }

  private normalizar(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private mostrar(agente: Trabajador): string {
    return agente.codigo + ' · ' + agente.nombreCompleto +
      (this.mostrarPlaza ? ' (' + (agente.plaza?.codigo ?? 'Sin plaza') + ')' : '');
  }

  private buscar(): Trabajador[] {
    const q = this.normalizar(this.texto);
    if (!q) return [];
    const puntos = (a: Trabajador): number => {
      const codigo = String(a.codigo);
      const nombre = this.normalizar(a.nombreCompleto);
      return codigo === q ? 0 : codigo.startsWith(q) ? 1 : nombre.startsWith(q) ? 2
        : nombre.split(' ').some(p => p.startsWith(q)) ? 3 : 4;
    };
    return this.agentes.filter(a => String(a.codigo).includes(q) ||
      this.normalizar(this.mostrar(a)).includes(q))
      .sort((a, b) => puntos(a) - puntos(b) ||
        a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
  }

  get totalCoincidencias(): number { return this.buscar().length; }
  get sugerencias(): Trabajador[] { return this.buscar().slice(0, 8); }
  opcionId(i: number): string { return this.listaId + '-' + i; }

  writeValue(valor: number | null): void {
    const id = Number(valor);
    this.elegido = id > 0 && Number.isFinite(id) ? id : null;
    if (this.elegido === null) this.texto = '';
    else this.sincronizar();
  }
  registerOnChange(fn: (valor: number | null) => void): void { this.emitir = fn; }
  registerOnTouched(fn: () => void): void { this.tocado = fn; }
  setDisabledState(disabled: boolean): void {
    this.disabledControl = disabled;
    if (disabled) this.abierto = false;
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['agentes'] || changes['mostrarPlaza']) this.sincronizar();
    if (this.bloqueado) this.abierto = false;
  }
  private sincronizar(): void {
    if (this.elegido === null) return;
    const actual = this.agentes.find(a => a.id === this.elegido);
    if (actual) this.texto = this.mostrar(actual);
  }
  enfocar(): void {
    if (this.bloqueado) return;
    this.abierto = true;
    this.activo = 0;
  }
  escribir(event: Event): void {
    this.texto = (event.target as HTMLInputElement).value;
    if (this.elegido !== null) { this.elegido = null; this.emitir(null); }
    this.abierto = true;
    this.activo = 0;
  }
  seleccionar(a: Trabajador): void {
    this.elegido = a.id;
    this.texto = this.mostrar(a);
    this.emitir(a.id);
    this.tocado();
    this.abierto = false;
  }
  limpiar(): void {
    this.elegido = null;
    this.texto = '';
    this.emitir(null);
    this.tocado();
    this.abierto = true;
    this.activo = 0;
  }
  tecla(event: KeyboardEvent): void {
    if (this.bloqueado) return;
    if (event.key === 'Escape' || event.key === 'Tab') { this.abierto = false; return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.abierto = true;
      const n = this.sugerencias.length;
      if (n) this.activo = (this.activo + (event.key === 'ArrowDown' ? 1 : -1) + n) % n;
      return;
    }
    if (event.key === 'Enter' && this.abierto && this.sugerencias.length) {
      event.preventDefault();
      this.seleccionar(this.sugerencias[Math.min(this.activo, this.sugerencias.length - 1)]);
    }
  }
  salir(): void { this.tocado(); this.abierto = false; }
  @HostListener('document:mousedown', ['$event'])
  fuera(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.abierto = false;
  }
}
