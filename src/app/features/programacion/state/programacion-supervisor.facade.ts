import { inject, Injectable } from '@angular/core';
import { ProgramacionApiService } from '../data-access/programacion-api.service';
import {
  AgenteProgramacionExcepcionRequest,
  AsignarSecuenciaRequest,
  GrupoLiderRequest,
  GuardarOrdenSecuenciaRequest,
  GuardarProgramacionRequest
} from '../models/programacion.models';
import {
  GenerarProgramacionRequest
} from '../data-access/programacion-api.service';

@Injectable({ providedIn: 'root' })
export class ProgramacionSupervisorFacade {
  private readonly api = inject(ProgramacionApiService);

  getPlazas() {
    return this.api.getPlazas();
  }

  getAgentes(plazaId: number) {
    return this.api.getAgentes(plazaId);
  }

  getContexto(
    plazaId: number,
    anio: number,
    mes: number
  ) {
    return this.api.getContexto(
      plazaId,
      anio,
      mes
    );
  }

  getControladores(plazaId: number) {
    return this.api.getControladores(plazaId);
  }

  getTurnos(
    plazaId: number,
    anio: number,
    mes: number
  ) {
    return this.api.getTurnos(
      plazaId,
      anio,
      mes
    );
  }

  guardarTurnos(
    request: GuardarProgramacionRequest
  ) {
    return this.api.guardarTurnos(request);
  }

  generarPropuesta(
    request: GenerarProgramacionRequest
  ) {
    return this.api.generarPropuesta(request);
  }

  getGrupos(plazaId: number) {
    return this.api.getGrupos(plazaId);
  }

  asignarLider(
    request: GrupoLiderRequest
  ) {
    return this.api.asignarLider(request);
  }

  getSecuencias(plazaId: number) {
    return this.api.getSecuencias(plazaId);
  }

  asignarSecuencia(
    request: AsignarSecuenciaRequest
  ) {
    return this.api.asignarSecuencia(request);
  }

  guardarOrdenSecuencia(
    request: GuardarOrdenSecuenciaRequest
  ) {
    return this.api.guardarOrdenSecuencia(request);
  }

  getExcepciones(plazaId: number) {
    return this.api.getExcepciones(plazaId);
  }

  guardarExcepcion(
    request: AgenteProgramacionExcepcionRequest
  ) {
    return this.api.guardarExcepcion(request);
  }

  desactivarExcepcion(
    trabajadorId: number,
    plazaId: number
  ) {
    return this.api.desactivarExcepcion(
      trabajadorId,
      plazaId
    );
  }
}
