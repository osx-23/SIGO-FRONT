import { inject, Injectable } from '@angular/core';
import { forkJoin } from 'rxjs';

import {
  ProgramacionSupervisorFacade
} from './programacion-supervisor.facade';

@Injectable()
export class ProgramacionCargaFacade {
  private readonly facade =
    inject(ProgramacionSupervisorFacade);

  cargarPrincipal(
    plazaId: number,
    anio: number,
    mes: number
  ) {
    return forkJoin({
      agentes:
        this.facade.getAgentes(
          plazaId
        ),
      turnos:
        this.facade.getTurnos(
          plazaId,
          anio,
          mes
        ),
      secuencias:
        this.facade.getSecuencias(
          plazaId
        ),
      excepciones:
        this.facade.getExcepciones(
          plazaId
        )
    });
  }

  cargarLideres(
    plazaId: number
  ) {
    return forkJoin({
      controladores:
        this.facade.getControladores(
          plazaId
        ),
      grupos:
        this.facade.getGrupos(
          plazaId
        )
    });
  }

  cargarPlazas() {
    return this.facade.getPlazas();
  }

  recargarSecuencias(
    plazaId: number
  ) {
    return this.facade.getSecuencias(
      plazaId
    );
  }
}
