import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Plaza, Turno } from '../../models/asistencia.models';
import { PermutaDetalle, PermutaRequest } from '../../models/permutas.models';
import { PermutasApiService } from '../../services/permutas-api.service';

/** Correcciones independientes del guardado general de asistencia. */
@Component({
  selector: 'app-asistencia-permutas-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asistencia-permutas-editor.component.html'
})
export class AsistenciaPermutasEditorComponent implements OnChanges {
  private readonly api = inject(PermutasApiService);

  @Input({ required: true }) asistenciaId = 0;
  @Input({ required: true }) plazaId = 0;
  @Input({ required: true }) turnoId = 0;
  @Input({ required: true }) fecha = '';
  @Input() plazas: Plaza[] = [];
  @Input() turnos: Turno[] = [];

  readonly registros = signal<PermutaDetalle[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly abierto = signal(false);
  readonly anulacionPendiente = signal<PermutaDetalle | null>(null);

  editarId: number | null = null;
  nombreSolicitante = '';
  nombreAceptante = '';
  formulario: PermutaRequest = this.vacio();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asistenciaId'] || changes['fecha'] ||
        changes['plazaId'] || changes['turnoId']) {
      this.cancelar();
      this.cargar();
    }
  }

  private vacio(): PermutaRequest {
    return {
      codigoSolicitante: 0,
      fechaSolicitante: this.fecha || '',
      turnoSolicitanteId: this.turnoId || 0,
      plazaSolicitanteId: this.plazaId || 0,
      codigoAceptante: 0,
      fechaAceptante: this.fecha || '',
      turnoAceptanteId: 0,
      plazaAceptanteId: this.plazaId || 0
    };
  }

  cargar(): void {
    if (!this.asistenciaId) return;
    const id = this.asistenciaId;
    this.cargando.set(true);
    this.error.set('');
    this.api.deAsistencia(id).subscribe({
      next: registros => {
        if (this.asistenciaId !== id) return;
        this.registros.set(registros);
        this.cargando.set(false);
      },
      error: err => {
        if (this.asistenciaId !== id) return;
        this.error.set('No se pudieron consultar las permutas. ' + this.errorMessage(err));
        this.cargando.set(false);
      }
    });
  }

  nueva(): void {
    this.error.set('');
    this.success.set('');
    this.editarId = null;
    this.formulario = this.vacio();
    this.nombreSolicitante = '';
    this.nombreAceptante = '';
    this.abierto.set(true);
  }

  editar(registro: PermutaDetalle): void {
    this.error.set('');
    this.success.set('');
    this.editarId = registro.id;
    this.formulario = {
      codigoSolicitante: registro.codigoSolicitante,
      fechaSolicitante: registro.fechaSolicitante,
      turnoSolicitanteId: registro.turnoSolicitanteId,
      plazaSolicitanteId: registro.plazaSolicitanteId,
      codigoAceptante: registro.codigoAceptante,
      fechaAceptante: registro.fechaAceptante,
      turnoAceptanteId: registro.turnoAceptanteId,
      plazaAceptanteId: registro.plazaAceptanteId
    };
    this.nombreSolicitante = registro.nombreSolicitante || '';
    this.nombreAceptante = registro.nombreAceptante || '';
    this.abierto.set(true);
  }

  cancelar(): void {
    this.abierto.set(false);
    this.editarId = null;
    this.anulacionPendiente.set(null);
  }

  consultarNombre(lado: 'solicitante' | 'aceptante'): void {
    const codigo = Number(lado === 'solicitante'
      ? this.formulario.codigoSolicitante : this.formulario.codigoAceptante);
    if (lado === 'solicitante') this.nombreSolicitante = '';
    else this.nombreAceptante = '';
    if (!Number.isInteger(codigo) || codigo <= 0) return;
    this.api.agente(codigo).subscribe({
      next: agente => {
        const actual = Number(lado === 'solicitante'
          ? this.formulario.codigoSolicitante : this.formulario.codigoAceptante);
        if (actual !== codigo) return;
        if (lado === 'solicitante') this.nombreSolicitante = agente.nombre;
        else this.nombreAceptante = agente.nombre;
      },
      error: () => {
        this.error.set('No se encontró un agente de recaudación activo con código ' + codigo);
      }
    });
  }

  private validar(): boolean {
    const p = this.formulario;
    if (!Number.isInteger(Number(p.codigoSolicitante)) || Number(p.codigoSolicitante) <= 0 ||
        !Number.isInteger(Number(p.codigoAceptante)) || Number(p.codigoAceptante) <= 0 ||
        !p.fechaSolicitante || !p.fechaAceptante ||
        !p.turnoSolicitanteId || !p.turnoAceptanteId ||
        !p.plazaSolicitanteId || !p.plazaAceptanteId) {
      this.error.set('Completa los códigos, las plazas, los turnos y ambas fechas.');
      return false;
    }
    if (Number(p.codigoSolicitante) === Number(p.codigoAceptante)) {
      this.error.set('El solicitante y el aceptante deben ser personas distintas.');
      return false;
    }
    if (p.fechaSolicitante === p.fechaAceptante &&
        Number(p.plazaSolicitanteId) === Number(p.plazaAceptanteId) &&
        Number(p.turnoSolicitanteId) === Number(p.turnoAceptanteId)) {
      this.error.set('Las jornadas originales deben ser distintas.');
      return false;
    }
    if (this.editarId === null) {
      const corresponde = (
        Number(p.plazaSolicitanteId) === this.plazaId &&
        Number(p.turnoSolicitanteId) === this.turnoId &&
        p.fechaSolicitante === this.fecha
      ) || (
        Number(p.plazaAceptanteId) === this.plazaId &&
        Number(p.turnoAceptanteId) === this.turnoId &&
        p.fechaAceptante === this.fecha
      );
      if (!corresponde) {
        this.error.set('Al agregar una permuta, una de las jornadas debe coincidir con esta asistencia.');
        return false;
      }
    }
    return true;
  }

  guardar(): void {
    if (this.guardando() || !this.validar()) return;
    const p = this.formulario;
    const request: PermutaRequest = {
      codigoSolicitante: Number(p.codigoSolicitante),
      fechaSolicitante: p.fechaSolicitante,
      turnoSolicitanteId: Number(p.turnoSolicitanteId),
      plazaSolicitanteId: Number(p.plazaSolicitanteId),
      codigoAceptante: Number(p.codigoAceptante),
      fechaAceptante: p.fechaAceptante,
      turnoAceptanteId: Number(p.turnoAceptanteId),
      plazaAceptanteId: Number(p.plazaAceptanteId)
    };
    const corrigiendo = this.editarId !== null;
    this.guardando.set(true);
    this.error.set('');
    const operacion = corrigiendo
      ? this.api.actualizar(this.editarId!, request)
      : this.api.agregarEnAsistencia(this.asistenciaId, request);
    operacion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cancelar();
        this.success.set(corrigiendo ? 'Permuta corregida correctamente.' : 'Permuta agregada correctamente.');
        this.cargar();
      },
      error: err => {
        this.guardando.set(false);
        this.error.set(this.errorMessage(err));
      }
    });
  }

  solicitarAnulacion(registro: PermutaDetalle): void {
    this.error.set('');
    this.anulacionPendiente.set(registro);
  }

  cancelarAnulacion(): void {
    this.anulacionPendiente.set(null);
  }

  confirmarAnulacion(): void {
    const registro = this.anulacionPendiente();
    if (!registro || this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');
    this.api.anular(registro.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cancelarAnulacion();
        if (this.editarId === registro.id) this.cancelar();
        this.success.set('Permuta anulada. Ya no aparecerá en los reportes ni en los gráficos.');
        this.cargar();
      },
      error: err => {
        this.guardando.set(false);
        this.cancelarAnulacion();
        this.error.set(this.errorMessage(err));
      }
    });
  }

  private errorMessage(err: unknown): string {
    const x = err as { error?: { message?: string; detail?: string } | string };
    if (typeof x?.error === 'string') return x.error;
    return x?.error?.message || x?.error?.detail || 'No fue posible completar la operación.';
  }
}
