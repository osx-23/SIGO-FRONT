import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject
} from '@angular/core';

import {
  GrupoProgramacion
} from '../../models/programacion.models';

import {
  ProgramacionSecuenciaState
} from '../../state/programacion-secuencia.state';

export interface GrupoProgramacionVista {
  codigo: GrupoProgramacion;
  nombre: string;
}

@Component({
  selector: 'app-programacion-resumen-secuencias',
  standalone: true,
  templateUrl: './programacion-resumen-secuencias.component.html',
  styleUrl:
    '../../pages/supervisor/programacion-supervisor.component.css'
})
export class ProgramacionResumenSecuenciasComponent {
  private readonly secuencias =
    inject(ProgramacionSecuenciaState);

  @Input({ required: true })
  grupos: GrupoProgramacionVista[] = [];

  @Input({ required: true })
  sinSecuencia = 0;

  @Output()
  readonly abrirPendientes =
    new EventEmitter<void>();

  cantidad(
    grupo: GrupoProgramacion
  ): number {
    return this.secuencias.cantidad(
      grupo
    );
  }
}
