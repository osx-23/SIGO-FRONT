import { inject, Injectable } from '@angular/core';

import {
  GrupoLider,
  TrabajadorResumen
} from '../models/programacion.models';

import {
  ProgramacionSupervisorFacade
} from './programacion-supervisor.facade';

@Injectable()
export class ProgramacionLiderFacade {
  private readonly facade =
    inject(ProgramacionSupervisorFacade);

  cargar(
    plazaId: number
  ) {
    return import('rxjs').then(() => null);
  }

  asignar(
    plazaId: number,
    agenteId: number,
    controladorId: number,
    fechaInicio: string
  ) {
    return this.facade.asignarLider({
      agenteId,
      controladorId,
      plazaId,
      fechaInicio
    });
  }

  construirSeleccion(
    agentes: readonly TrabajadorResumen[],
    grupos: readonly GrupoLider[]
  ): Record<number, number | null> {
    const porAgente =
      new Map<number, number>();

    for (const grupo of grupos) {
      if (grupo.activo) {
        porAgente.set(
          grupo.agenteId,
          grupo.controladorId
        );
      }
    }

    return Object.fromEntries(
      agentes.map(
        agente => [
          agente.id,
          porAgente.get(
            agente.id
          ) ?? null
        ]
      )
    );
  }

  reemplazarGrupo(
    grupos: readonly GrupoLider[],
    grupo: GrupoLider
  ): GrupoLider[] {
    return [
      ...grupos.filter(
        actual =>
          actual.agenteId !==
          grupo.agenteId
      ),
      grupo
    ];
  }
}
