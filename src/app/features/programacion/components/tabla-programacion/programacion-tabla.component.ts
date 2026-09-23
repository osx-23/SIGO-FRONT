import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  EstadoProgramacion,
  GrupoLider,
  GrupoProgramacion,
  TrabajadorResumen
} from '../../models/programacion.models';

import {
  ProgramacionSecuenciaState
} from '../../state/programacion-secuencia.state';

import {
  ProgramacionExcepcionState
} from '../../state/programacion-excepcion.state';

import {
  ProgramacionGeneradorState
} from '../../state/programacion-generador.state';

export interface CambioSecuenciaEvent {
  agenteId: number;
  grupo: GrupoProgramacion;
}

export interface CambioTurnoEvent {
  agenteId: number;
  dia: number;
  estado: EstadoProgramacion | null;
}

@Component({
  selector: 'app-programacion-tabla',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './programacion-tabla.component.html',
  styleUrl:
    '../../pages/supervisor/programacion-supervisor.component.css'
})
export class ProgramacionTablaComponent {
  readonly secuencias =
    inject(ProgramacionSecuenciaState);

  readonly excepciones =
    inject(ProgramacionExcepcionState);

  readonly generador =
    inject(ProgramacionGeneradorState);

  @Input({ required: true })
  plazaId: number | null = null;

  @Input({ required: true })
  agentes: TrabajadorResumen[] = [];

  @Input({ required: true })
  agentesSinSecuencia = 0;

  @Input({ required: true })
  dias: number[] = [];

  @Input({ required: true })
  estados: EstadoProgramacion[] = [];

  @Input({ required: true })
  anio = new Date().getFullYear();

  @Input({ required: true })
  mes = new Date().getMonth() + 1;

  @Input({ required: true })
  gruposProgramacion: {
    codigo: GrupoProgramacion;
    nombre: string;
  }[] = [];

  @Input({ required: true })
  grupos: GrupoLider[] = [];

  @Input({ required: true })
  controladores: TrabajadorResumen[] = [];

  @Input({ required: true })
  matrix!: Map<string, EstadoProgramacion | null>;

  @Input({ required: true })
  agentesProcesando!: Set<number>;

  @Input()
  guardandoOrden = false;

  @Input()
  mostrarDetalles = true;

  @Input()
  diaSeleccionado: number | null = null;

  @Output()
  readonly abrirGenerador =
    new EventEmitter<void>();

  @Output()
  readonly abrirPendientes =
    new EventEmitter<void>();

  @Output()
  readonly abrirExcepciones =
    new EventEmitter<void>();

  @Output()
  readonly alternarDetalles =
    new EventEmitter<void>();

  @Output()
  readonly diaSeleccionadoChange =
    new EventEmitter<number>();

  @Output()
  readonly secuenciaChange =
    new EventEmitter<CambioSecuenciaEvent>();

  @Output()
  readonly subirAgente =
    new EventEmitter<CambioSecuenciaEvent>();

  @Output()
  readonly bajarAgente =
    new EventEmitter<CambioSecuenciaEvent>();

  @Output()
  readonly turnoChange =
    new EventEmitter<CambioTurnoEvent>();

  seleccionarDia(
    dia: number
  ): void {
    this.diaSeleccionadoChange.emit(
      dia
    );
  }

  cambiarSecuencia(
    agenteId: number,
    grupo: GrupoProgramacion | null
  ): void {
    if (!grupo) {
      return;
    }

    this.secuenciaChange.emit({
      agenteId,
      grupo
    });
  }

  subir(
    grupo: GrupoProgramacion,
    agenteId: number
  ): void {
    this.subirAgente.emit({
      agenteId,
      grupo
    });
  }

  bajar(
    grupo: GrupoProgramacion,
    agenteId: number
  ): void {
    this.bajarAgente.emit({
      agenteId,
      grupo
    });
  }

  cambiarEstado(
    agenteId: number,
    dia: number,
    estado: EstadoProgramacion | null
  ): void {
    this.turnoChange.emit({
      agenteId,
      dia,
      estado
    });
  }

  estado(
    agenteId: number,
    dia: number
  ): EstadoProgramacion | null {
    return (
      this.matrix.get(
        this.key(
          agenteId,
          dia
        )
      ) ??
      null
    );
  }

  cantidadTurnoDia(
    estado: 'A' | 'B' | 'C'
  ): number {
    if (!this.diaSeleccionado) {
      return 0;
    }

    let total = 0;

    for (const agente of this.agentes) {
      if (
        this.estado(
          agente.id,
          this.diaSeleccionado
        ) === estado
      ) {
        total++;
      }
    }

    return total;
  }

  totalTurnosDia(): number {
    return (
      this.cantidadTurnoDia('A') +
      this.cantidadTurnoDia('B') +
      this.cantidadTurnoDia('C')
    );
  }

  nombreDiaSeleccionado(): string {
    if (!this.diaSeleccionado) {
      return '';
    }

    const fecha =
      new Date(
        this.anio,
        this.mes - 1,
        this.diaSeleccionado
      );

    return new Intl.DateTimeFormat(
      'es-PE',
      {
        weekday: 'long',
        day: '2-digit',
        month: 'long'
      }
    ).format(fecha);
  }

  diaSemana(
    dia: number
  ): string {
    const fecha =
      new Date(
        this.anio,
        this.mes - 1,
        dia
      );

    const diasSemana = [
      'Dom',
      'Lun',
      'Mar',
      'Mié',
      'Jue',
      'Vie',
      'Sáb'
    ];

    return diasSemana[
      fecha.getDay()
    ];
  }

  codigoLider(
    agenteId: number
  ): string {
    const lider =
      this.liderDeAgente(
        agenteId
      );

    return lider?.codigo
      ? String(lider.codigo)
      : '-';
  }

  nombreLider(
    agenteId: number
  ): string {
    return (
      this.liderDeAgente(
        agenteId
      )?.nombreCompleto ??
      'Sin líder'
    );
  }

  claseEstado(
    estado: EstadoProgramacion | null
  ): string {
    return estado
      ? `estado-${estado.toLowerCase()}`
      : '';
  }

  estaProcesandoAgente(
    agenteId: number
  ): boolean {
    return this.agentesProcesando.has(
      agenteId
    );
  }

  private liderDeAgente(
    agenteId: number
  ): TrabajadorResumen | null {
    const grupo =
      this.grupos.find(
        actual =>
          actual.activo &&
          actual.agenteId === agenteId
      );

    if (!grupo) {
      return null;
    }

    return (
      this.controladores.find(
        controlador =>
          controlador.id ===
          grupo.controladorId
      ) ??
      null
    );
  }

  private key(
    trabajadorId: number,
    dia: number
  ): string {
    return `${trabajadorId}-${dia}`;
  }
}
