import { Injectable } from '@angular/core';
import {
  GrupoProgramacion,
  SecuenciaAgente,
  TrabajadorResumen
} from '../models/programacion.models';

@Injectable({ providedIn: 'root' })
export class ProgramacionSecuenciaState {
  private readonly grupoPorAgente =
    new Map<number, GrupoProgramacion>();

  private readonly posicionPorAgente =
    new Map<number, number>();

  private readonly agentePorId =
    new Map<number, TrabajadorResumen>();

  private readonly puedeSubirPorAgente =
    new Map<number, boolean>();

  private readonly puedeBajarPorAgente =
    new Map<number, boolean>();

  private readonly cantidadPorGrupo =
    new Map<GrupoProgramacion, number>();

  reconstruir(
    agentes: readonly TrabajadorResumen[],
    secuencias: readonly SecuenciaAgente[],
    grupos: readonly GrupoProgramacion[],
    busqueda: string
  ): TrabajadorResumen[] {
    this.limpiar();

    for (const agente of agentes) {
      this.agentePorId.set(
        agente.id,
        agente
      );
    }

    const secuenciasPorGrupo =
      new Map<GrupoProgramacion, SecuenciaAgente[]>();

    for (const grupo of grupos) {
      secuenciasPorGrupo.set(
        grupo,
        []
      );
    }

    for (const secuencia of secuencias) {
      if (!secuencia.grupo) {
        continue;
      }

      secuenciasPorGrupo
        .get(secuencia.grupo)
        ?.push(secuencia);

      this.cantidadPorGrupo.set(
        secuencia.grupo,
        (this.cantidadPorGrupo.get(secuencia.grupo) ?? 0) + 1
      );
    }

    const query =
      busqueda
        .trim()
        .toLowerCase();

    const resultado: TrabajadorResumen[] = [];

    for (const grupo of grupos) {
      const registros =
        secuenciasPorGrupo.get(grupo) ?? [];

      registros.sort(
        (a, b) =>
          (a.orden ?? Number.MAX_SAFE_INTEGER) -
          (b.orden ?? Number.MAX_SAFE_INTEGER)
      );

      registros.forEach(
        (registro, index) => {
          this.grupoPorAgente.set(
            registro.agenteId,
            grupo
          );

          this.posicionPorAgente.set(
            registro.agenteId,
            index + 1
          );

          this.puedeSubirPorAgente.set(
            registro.agenteId,
            index > 0
          );

          this.puedeBajarPorAgente.set(
            registro.agenteId,
            index < registros.length - 1
          );

          const agente =
            this.agentePorId.get(
              registro.agenteId
            );

          if (
            agente &&
            (
              !query ||
              this.coincideBusqueda(
                agente,
                query
              )
            )
          ) {
            resultado.push(agente);
          }
        }
      );
    }

    return resultado;
  }

  grupoDe(
    agenteId: number
  ): GrupoProgramacion | null {
    return this.grupoPorAgente.get(
      agenteId
    ) ?? null;
  }

  posicionDe(
    agenteId: number
  ): number {
    return this.posicionPorAgente.get(
      agenteId
    ) ?? 0;
  }

  agente(
    agenteId: number
  ): TrabajadorResumen | undefined {
    return this.agentePorId.get(
      agenteId
    );
  }

  cantidad(
    grupo: GrupoProgramacion
  ): number {
    return this.cantidadPorGrupo.get(
      grupo
    ) ?? 0;
  }

  puedeSubir(
    grupo: GrupoProgramacion,
    agenteId: number
  ): boolean {
    return (
      this.grupoDe(agenteId) === grupo &&
      (
        this.puedeSubirPorAgente.get(
          agenteId
        ) ?? false
      )
    );
  }

  puedeBajar(
    grupo: GrupoProgramacion,
    agenteId: number
  ): boolean {
    return (
      this.grupoDe(agenteId) === grupo &&
      (
        this.puedeBajarPorAgente.get(
          agenteId
        ) ?? false
      )
    );
  }

  private limpiar(): void {
    this.grupoPorAgente.clear();
    this.posicionPorAgente.clear();
    this.agentePorId.clear();
    this.puedeSubirPorAgente.clear();
    this.puedeBajarPorAgente.clear();
    this.cantidadPorGrupo.clear();
  }

  private coincideBusqueda(
    agente: TrabajadorResumen,
    query: string
  ): boolean {
    return (
      `${agente.codigo} ${agente.nombreCompleto}`
        .toLowerCase()
        .includes(query)
    );
  }
}
