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
  TrabajadorResumen
} from '../../models/programacion.models';

import {
  ProgramacionExcepcionState
} from '../../state/programacion-excepcion.state';

@Component({
  selector: 'app-programacion-excepcion-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './programacion-excepcion-modal.component.html',
  styleUrl:
    '../../pages/supervisor/programacion-supervisor.component.css'
})
export class ProgramacionExcepcionModalComponent {
  readonly excepciones =
    inject(ProgramacionExcepcionState);

  @Input({ required: true })
  agentes: TrabajadorResumen[] = [];

  @Output()
  readonly guardar =
    new EventEmitter<void>();

  @Output()
  readonly quitar =
    new EventEmitter<void>();

  cerrar(): void {
    this.excepciones.cerrar();
  }

  agentesFiltrados(): TrabajadorResumen[] {
    return this.excepciones.filtrarAgentes(
      this.agentes
    );
  }

  seleccionarAgente(
    agente: TrabajadorResumen
  ): void {
    this.excepciones.abrir(
      agente
    );
  }

  tieneExcepcion(
    agenteId: number
  ): boolean {
    return this.excepciones.tiene(
      agenteId
    );
  }

  seleccionarColor(
    color: string
  ): void {
    this.excepciones.seleccionarColor(
      color
    );
  }

  solicitarGuardado(): void {
    this.guardar.emit();
  }

  solicitarEliminacion(): void {
    this.quitar.emit();
  }
}
