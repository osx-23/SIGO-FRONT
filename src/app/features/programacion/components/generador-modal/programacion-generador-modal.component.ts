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
  ProgramacionGeneradorState
} from '../../state/programacion-generador.state';

@Component({
  selector: 'app-programacion-generador-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './programacion-generador-modal.component.html',
  styleUrl:
    '../../pages/supervisor/programacion-supervisor.component.css'
})
export class ProgramacionGeneradorModalComponent {
  readonly generador =
    inject(ProgramacionGeneradorState);

  @Input({ required: true })
  agentes: TrabajadorResumen[] = [];

  @Input({ required: true })
  nombreMes = '';

  @Input({ required: true })
  anio = new Date().getFullYear();

  @Input({ required: true })
  mes = new Date().getMonth() + 1;

  @Output()
  readonly generar =
    new EventEmitter<void>();

  cerrar(): void {
    this.generador.cerrar();
  }

  agregarDiaEspecial(): void {
    this.generador.agregarDiaEspecial(
      this.fechaBase()
    );
  }

  quitarDiaEspecial(
    index: number
  ): void {
    this.generador.quitarDiaEspecial(
      index
    );
  }

  agregarNovedad(): void {
    const error =
      this.generador.agregarNovedad(
        this.agentes[0],
        this.fechaBase()
      );

    if (error) {
      return;
    }
  }

  quitarNovedad(
    index: number
  ): void {
    this.generador.quitarNovedad(
      index
    );
  }

  solicitarGeneracion(): void {
    this.generar.emit();
  }

  private fechaBase(): string {
    return (
      `${this.anio}-` +
      `${String(this.mes).padStart(2, '0')}-01`
    );
  }
}
