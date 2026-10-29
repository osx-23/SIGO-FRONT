import { inject, Injectable } from '@angular/core';
import { forkJoin, map } from 'rxjs';
import { ProgramacionApiService } from '../data-access/programacion-api.service';
import { TrabajadorResumen } from '../models/programacion.models';
import {
  ProgramacionSupervisorFacade
} from './programacion-supervisor.facade';

@Injectable()
export class ProgramacionCargaFacade {
  private readonly facade =
    inject(ProgramacionSupervisorFacade);
  private readonly api = inject(ProgramacionApiService);

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
        ),
      traslados: this.api.getTraslados(plazaId, anio, mes)
    }).pipe(
      map(
        ({
          contexto,
          controladores,
          traslados
        }) => {
          const llegadas = traslados
            .filter(t => t.estado === 'PROGRAMADO' && t.plazaDestinoId === plazaId)
            .map(t => ({
              id: t.trabajadorId,
              codigo: t.codigo,
              nombreCompleto: t.trabajador,
              puesto: { id: 0, nombre: t.puesto },
              plaza: { id: t.plazaOrigenId, codigo: t.plazaOrigenCodigo }
            } as TrabajadorResumen));
          const combinar = (existentes: TrabajadorResumen[], nuevos: TrabajadorResumen[]) =>
            [...new Map([...existentes, ...nuevos].map(t => [t.id, t])).values()];
          return {
            ...contexto,
            controladores: combinar(controladores,
              llegadas.filter(t => t.puesto?.nombre?.startsWith('Controlador'))),
            agentes: combinar(contexto.agentes,
              llegadas.filter(t => !t.puesto?.nombre?.startsWith('Controlador'))),
            traslados
          };
        }
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
