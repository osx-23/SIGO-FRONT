import { inject, Injectable } from '@angular/core';
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
    return this.facade.getContexto(
      plazaId,
      anio,
      mes
    );
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
