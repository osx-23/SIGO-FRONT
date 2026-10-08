import { inject, Injectable } from '@angular/core';
import { forkJoin, map } from 'rxjs';
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
      contexto:
        this.facade.getContexto(
          plazaId,
          anio,
          mes
        ),
      controladores:
        this.facade.getControladores(
          plazaId
        )
    }).pipe(
      map(
        ({
          contexto,
          controladores
        }) => ({
          ...contexto,
          controladores
        })
      )
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
