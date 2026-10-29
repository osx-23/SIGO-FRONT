import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProgramacionApiService } from '../../data-access/programacion-api.service';
import { Plaza, TrasladoCandidato, TrasladoPlazaProgramado } from '../../models/programacion.models';

@Component({
  selector: 'app-programacion-traslados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './programacion-traslados.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgramacionTrasladosComponent {
  readonly plazas = input.required<Plaza[]>();
  readonly plazaId = input.required<number | null>();
  readonly anio = input.required<number>();
  readonly mes = input.required<number>();
  readonly bloqueado = input(false);
  readonly modificado = output<void>();

  private readonly api = inject(ProgramacionApiService);
  readonly modal = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  // El componente padre ya carga los traslados junto con la matriz mensual.
  readonly traslados = input<TrasladoPlazaProgramado[]>([]);
  readonly candidatos = signal<TrasladoCandidato[]>([]);
  readonly busqueda = signal('');
  readonly trabajadorId = signal<number | null>(null);
  readonly destinoId = signal<number | null>(null);
  readonly inicio = signal('');
  readonly temporal = signal(false);
  readonly fin = signal('');
  readonly candidatoSeleccionado = computed(() =>
    this.candidatos().find(t => t.id === this.trabajadorId()) ?? null);
  readonly candidatosFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.candidatos()
      .filter(t => !q || `${t.codigo} ${t.nombre} ${t.puesto}`.toLowerCase().includes(q))
      .slice(0, 120);
  });
  readonly trasladosVigentes = computed(() =>
    this.traslados().filter(t => t.estado === 'PROGRAMADO'));

  abrir(): void {
    if (this.bloqueado()) { this.error.set('Guarda los cambios de turnos antes de gestionar traslados.'); return; }
    this.error.set('');
    this.busqueda.set('');
    this.trabajadorId.set(null);
    this.temporal.set(false);
    this.fin.set('');
    this.destinoId.set(this.plazaId());
    const ahora = new Date();
    ahora.setDate(ahora.getDate() + 1);
    this.inicio.set(`${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`);
    this.modal.set(true);
    this.api.getCandidatosTraslado().subscribe({
      next: candidatos => this.candidatos.set(candidatos),
      error: () => this.error.set('No se pudo cargar la lista de trabajadores.')
    });
  }

  guardar(): void {
    const trabajadorId = this.trabajadorId();
    const plazaDestinoId = this.destinoId();
    const inicio = this.inicio();
    const fechaFin = this.temporal() ? this.fin() : null;
    if (!trabajadorId || !plazaDestinoId || !inicio || !this.candidatoSeleccionado()
        || plazaDestinoId === this.candidatoSeleccionado()?.plazaId
        || (this.temporal() && (!fechaFin || fechaFin < inicio))) {
      this.error.set('Selecciona trabajador, plaza diferente y fechas válidas.');
      return;
    }
    if (!confirm('¿Confirmas el traslado? Los turnos existentes se conservarán en la plaza destino y las casetas antiguas se liberarán.')) return;
    this.guardando.set(true);
    this.error.set('');
    this.api.crearTraslado({ trabajadorId, plazaDestinoId, fechaInicio: inicio, fechaFin }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.modal.set(false);
        this.modificado.emit();
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'No se pudo registrar el traslado.');
        this.guardando.set(false);
      }
    });
  }

  cancelar(id: number): void {
    if (this.bloqueado()) { this.error.set('Guarda los turnos pendientes antes de cancelar.'); return; }
    if (!confirm('¿Cancelar este traslado futuro? Se devolverán los turnos a la plaza de origen y se quitarán casetas de destino.')) return;
    this.api.cancelarTraslado(id).subscribe({
      next: () => this.modificado.emit(),
      error: err => this.error.set(err?.error?.message ?? 'No se pudo cancelar el traslado.')
    });
  }

  esFuturo(fecha: string): boolean {
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`;
    return fecha > hoy;
  }
}
