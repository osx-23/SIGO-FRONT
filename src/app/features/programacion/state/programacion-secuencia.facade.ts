import { inject, Injectable } from '@angular/core';

import {
  GrupoProgramacion,
  SecuenciaAgente
} from '../models/programacion.models';

import {
  ProgramacionSupervisorFacade
} from './programacion-supervisor.facade';

@Injectable()
export class ProgramacionSecuenciaFacade {
  private readonly facade =
    inject(ProgramacionSupervisorFacade);

  asignar(
    plazaId: number,
    agenteId: number,
    grupo: GrupoProgramacion
  ) {
    return this.facade.asignarSecuencia({
      agenteId,
      plazaId,
      grupo
    });
  }

  guardarOrden(
    plazaId: number,
    grupo: GrupoProgramacion,
    integrantes: readonly SecuenciaAgente[]
  ) {
    return this.facade.guardarOrdenSecuencia({
      plazaId,
      grupo,
      agentes:
        integrantes.map(
          (integrante, index) => ({
            agenteId:
              integrante.agenteId,
            orden:
              index + 1
          })
        )
    });
  }

  reemplazarRegistro(
    secuencias: readonly SecuenciaAgente[],
    registro: SecuenciaAgente
  ): SecuenciaAgente[] {
    return [
      ...secuencias.filter(
        secuencia =>
          secuencia.agenteId !==
          registro.agenteId
      ),
      registro
    ];
  }

  aplicarOrden(
    secuencias: readonly SecuenciaAgente[],
    grupo: GrupoProgramacion,
    integrantes: readonly SecuenciaAgente[]
  ): SecuenciaAgente[] {
    const ordenPorAgente =
      new Map<number, number>();

    integrantes.forEach(
      (integrante, index) => {
        ordenPorAgente.set(
          integrante.agenteId,
          index + 1
        );
      }
    );

    return secuencias.map(
      registro => {
        if (
          registro.grupo !== grupo
        ) {
          return registro;
        }

        const orden =
          ordenPorAgente.get(
            registro.agenteId
          );

        return orden === undefined
          ? registro
          : {
              ...registro,
              orden
            };
      }
    );
  }

  ordenarGrupo(
    secuencias: readonly SecuenciaAgente[],
    grupo: GrupoProgramacion
  ): SecuenciaAgente[] {
    return secuencias
      .filter(
        secuencia =>
          secuencia.grupo === grupo
      )
      .sort(
        (a, b) =>
          (
            a.orden ??
            Number.MAX_SAFE_INTEGER
          ) -
          (
            b.orden ??
            Number.MAX_SAFE_INTEGER
          )
      );
  }
}
