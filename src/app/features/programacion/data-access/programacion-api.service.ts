import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AgenteProgramacionExcepcion,
  AgenteProgramacionExcepcionRequest,
  AsignarSecuenciaRequest,
  CoberturaUbicacion,
  DistribucionDia,
  EstadoProgramacion,
  GrupoLider,
  GrupoLiderRequest,
  GrupoProgramacion,
  GuardarDistribucionRequest,
  GuardarOrdenSecuenciaRequest,
  GuardarUbicacionRequest,
  GuardarProgramacionRequest,
  MiHorario,
  Plaza,
  ProgramacionDia,
  ResumenTrabajador,
  SecuenciaAgente,
  TrabajadorResumen,
  Ubicacion
} from '../models/programacion.models';

export interface CoberturaTurnosRequest {
  a: number;
  b: number;
  c: number;
}

export interface DiaEspecialProgramacionRequest {
  fecha: string;
  descripcion?: string | null;
  a: number;
  b: number;
  c: number;
}

export type EstadoNovedadProgramacion = 'V' | 'COM' | 'DM' | 'LIC';

export interface NovedadProgramacionRequest {
  trabajadorId: number;
  desde: string;
  hasta: string;
  estado: EstadoNovedadProgramacion;
  observacion?: string | null;
}

export interface GenerarProgramacionRequest {
  plazaId: number;
  anio: number;
  mes: number;
  coberturaNormal: CoberturaTurnosRequest;
  coberturaDomingo: CoberturaTurnosRequest;
  diasEspeciales: DiaEspecialProgramacionRequest[];
  novedades: NovedadProgramacionRequest[];
}

export interface ProgramacionDiaPropuesta {
  fecha: string;
  estado: EstadoProgramacion;
  estadoCiclo: EstadoProgramacion;
  origen: string;
  excepcion: boolean;
  observacion: string | null;
}

export interface ProgramacionAgentePropuesta {
  trabajadorId: number;
  codigo: number | string;
  nombre: string;
  grupo: GrupoProgramacion | null;
  orden: number | null;
  partTime: boolean;
  dias: ProgramacionDiaPropuesta[];
}

export interface CoberturaDiaPropuesta {
  fecha: string;
  requeridoA: number;
  requeridoB: number;
  requeridoC: number;
  asignadoA: number;
  asignadoB: number;
  asignadoC: number;
  deficitA: number;
  deficitB: number;
  deficitC: number;
  excesoA: number;
  excesoB: number;
  excesoC: number;
  tipoCobertura: 'NORMAL' | 'DOMINGO' | 'ESPECIAL' | string;
}

export interface ConflictoProgramacionPropuesta {
  tipo: string;
  nivel: string;
  trabajadorId: number | null;
  codigo: number | string | null;
  trabajador: string | null;
  fecha: string | null;
  mensaje: string;
}

export interface ProgramacionPropuestaResponse {
  plazaId: number;
  plazaCodigo: string;
  anio: number;
  mes: number;
  guardado: boolean;
  agentes: ProgramacionAgentePropuesta[];
  cobertura: CoberturaDiaPropuesta[];
  conflictos: ConflictoProgramacionPropuesta[];
}

@Injectable({ providedIn: 'root' })
export class ProgramacionApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getPlazas(): Observable<Plaza[]> {
    return this.http.get<Plaza[]>(`${this.api}/plazas`);
  }

  getAgentes(plazaId: number): Observable<TrabajadorResumen[]> {
    return this.http.get<TrabajadorResumen[]>(`${this.api}/trabajadores/agentes`, {
      params: new HttpParams().set('plazaId', plazaId)
    });
  }

  getControladores(plazaId: number): Observable<TrabajadorResumen[]> {
    return this.http.get<TrabajadorResumen[]>(`${this.api}/trabajadores/controladores`, {
      params: new HttpParams().set('plazaId', plazaId)
    });
  }

  getTurnos(plazaId: number, anio: number, mes: number): Observable<ProgramacionDia[]> {
    const params = new HttpParams()
      .set('plazaId', plazaId)
      .set('anio', anio)
      .set('mes', mes);

    return this.http.get<ProgramacionDia[]>(`${this.api}/programacion/turnos`, { params });
  }

  guardarTurnos(request: GuardarProgramacionRequest): Observable<ProgramacionDia[]> {
    return this.http.put<ProgramacionDia[]>(`${this.api}/programacion/turnos`, request);
  }

  generarPropuesta(request: GenerarProgramacionRequest): Observable<ProgramacionPropuestaResponse> {
    return this.http.post<ProgramacionPropuestaResponse>(
      `${this.api}/programacion/generar-propuesta`,
      request
    );
  }

  getUbicaciones(plazaId: number): Observable<Ubicacion[]> {
    return this.http.get<Ubicacion[]>(`${this.api}/distribucion/ubicaciones`, {
      params: new HttpParams().set('plazaId', plazaId)
    });
  }

  getUbicacionesConfiguracion(plazaId: number): Observable<Ubicacion[]> {
    return this.http.get<Ubicacion[]>(`${this.api}/distribucion/ubicaciones/configuracion`, {
      params: new HttpParams().set('plazaId', plazaId)
    });
  }

  crearUbicacion(request: GuardarUbicacionRequest): Observable<Ubicacion> {
    return this.http.post<Ubicacion>(`${this.api}/distribucion/ubicaciones`, request);
  }

  actualizarUbicacion(ubicacionId: number, request: GuardarUbicacionRequest): Observable<Ubicacion> {
    return this.http.put<Ubicacion>(
      `${this.api}/distribucion/ubicaciones/${ubicacionId}`,
      request
    );
  }

  cambiarEstadoUbicacion(ubicacionId: number, activo: boolean): Observable<Ubicacion> {
    return this.http.patch<Ubicacion>(
      `${this.api}/distribucion/ubicaciones/${ubicacionId}/estado`,
      null,
      { params: new HttpParams().set('activo', activo) }
    );
  }

  getDistribucion(plazaId: number, anio: number, mes: number): Observable<DistribucionDia[]> {
    const params = new HttpParams()
      .set('plazaId', plazaId)
      .set('anio', anio)
      .set('mes', mes);

    return this.http.get<DistribucionDia[]>(`${this.api}/distribucion`, { params });
  }

  guardarDistribucion(request: GuardarDistribucionRequest): Observable<DistribucionDia[]> {
    return this.http.put<DistribucionDia[]>(`${this.api}/distribucion`, request);
  }

  getCobertura(plazaId: number, anio: number, mes: number): Observable<CoberturaUbicacion[]> {
    const params = new HttpParams()
      .set('plazaId', plazaId)
      .set('anio', anio)
      .set('mes', mes);

    return this.http.get<CoberturaUbicacion[]>(`${this.api}/distribucion/cobertura`, { params });
  }

  getResumenTrabajador(trabajadorId: number, anio: number, mes: number): Observable<ResumenTrabajador> {
    const params = new HttpParams().set('anio', anio).set('mes', mes);
    return this.http.get<ResumenTrabajador>(
      `${this.api}/distribucion/resumen-trabajador/${trabajadorId}`,
      { params }
    );
  }

  getMiHorario(desde: string, hasta: string): Observable<MiHorario> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<MiHorario>(`${this.api}/programacion/mi-horario`, { params });
  }

  getGrupos(plazaId: number): Observable<GrupoLider[]> {
    return this.http.get<GrupoLider[]>(`${this.api}/programacion/grupos`, {
      params: new HttpParams().set('plazaId', plazaId)
    });
  }

  asignarLider(request: GrupoLiderRequest): Observable<GrupoLider> {
    return this.http.put<GrupoLider>(`${this.api}/programacion/grupos/lider`, request);
  }

  getSecuencias(plazaId: number): Observable<SecuenciaAgente[]> {
    return this.http.get<SecuenciaAgente[]>(`${this.api}/programacion/secuencias`, {
      params: new HttpParams().set('plazaId', plazaId)
    });
  }

  asignarSecuencia(request: AsignarSecuenciaRequest): Observable<SecuenciaAgente> {
    return this.http.put<SecuenciaAgente>(`${this.api}/programacion/secuencias/asignar`, request);
  }

  guardarOrdenSecuencia(request: GuardarOrdenSecuenciaRequest): Observable<void> {
    return this.http.put<void>(`${this.api}/programacion/secuencias/orden`, request);
  }

  getExcepciones(plazaId: number): Observable<AgenteProgramacionExcepcion[]> {
    return this.http.get<AgenteProgramacionExcepcion[]>(`${this.api}/programacion/excepciones`, {
      params: new HttpParams().set('plazaId', plazaId)
    });
  }

  guardarExcepcion(request: AgenteProgramacionExcepcionRequest): Observable<AgenteProgramacionExcepcion> {
    return this.http.put<AgenteProgramacionExcepcion>(`${this.api}/programacion/excepciones`, request);
  }

  desactivarExcepcion(trabajadorId: number, plazaId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/programacion/excepciones/agente/${trabajadorId}`, {
      params: new HttpParams().set('plazaId', plazaId)
    });
  }
}
