import { inject, Injectable } from '@angular/core';

import {
  EstadoProgramacion,
  ProgramacionDia
} from '../models/programacion.models';

import {
  ProgramacionSupervisorFacade
} from './programacion-supervisor.facade';

@Injectable()
export class ProgramacionGuardadoFacade {
  private readonly facade =
    inject(ProgramacionSupervisorFacade);

  guardar(
    plazaId: number,
    cambios: ReadonlyMap<string, EstadoProgramacion>,
    anio: number,
    mes: number
  ) {
    return this.facade.guardarTurnos({
      plazaId,
      programaciones:
        [...cambios.entries()]
          .map(
            ([key, estado]) => {
              const [
                trabajadorId,
                dia
              ] =
                key
                  .split('-')
                  .map(Number);

              return {
                trabajadorId,
                fecha:
                  this.fecha(
                    anio,
                    mes,
                    dia
                  ),
                estado
              };
            }
          )
    });
  }

  aplicarResultado(
    matrix: Map<string, EstadoProgramacion | null>,
    turnos: readonly ProgramacionDia[]
  ): void {
    for (const turno of turnos) {
      matrix.set(
        this.key(
          turno.trabajadorId,
          this.diaDeFecha(
            turno.fecha
          )
        ),
        turno.estado
      );
    }
  }

  private fecha(
    anio: number,
    mes: number,
    dia: number
  ): string {
    return (
      `${anio}-` +
      `${String(mes).padStart(2, '0')}-` +
      `${String(dia).padStart(2, '0')}`
    );
  }

  private diaDeFecha(
    fecha: string
  ): number {
    return Number(
      fecha.slice(8, 10)
    );
  }

  private key(
    trabajadorId: number,
    dia: number
  ): string {
    return `${trabajadorId}-${dia}`;
  }
}
