import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AgenteProgramacionExcepcion,
  AgenteProgramacionExcepcionRequest,
  CasetaConfiguracion,
  ConfiguracionAsignacionCaseta,
  GeneradorCasetasPropuesta,
  GenerarCasetasRequest,
  GuardarCasetaConfiguracionRequest,
  GuardarConfiguracionAsignacionCasetaRequest,
  GuardarRestriccionCasetaRequest,
  RestriccionCaseta,
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

export interface ProgramacionContextoResponse {
  agentes: TrabajadorResumen[];
  turnos: ProgramacionDia[];
  secuencias: SecuenciaAgente[];
  excepciones: AgenteProgramacionExcepcion[];
}

export interface ImportacionCasetaCambio {
  programacionTurnoId: number;
  ubicacionId: number | null;
  codigoTrabajador: number;
  trabajador: string;
  fecha: string;
  caseta: string;
}


/** Datos extraídos por Apache POI: se envían mediante POST JSON para validar. */
export interface RegistroCasetaExcelJson {
  codigoTrabajador: number;
  fecha: string;
  caseta: string | null;
  turnoExcel: 'A' | 'B' | 'C' | null;
}
export interface ExtraccionCasetasExcelJson {
  plazaId: number;
  plazaCodigo: string;
  desde: string;
  hasta: string;
  registros: RegistroCasetaExcelJson[];
}

export interface VistaPreviaDistribucionExcel {
  valido: boolean;
  plazaId: number;
  desde: string;
  hasta: string;
  celdasLeidas: number;
  yaAsignadas: number;
  cambios: ImportacionCasetaCambio[];
  errores: string[];
  omitidos: string[];
}

/** Vista previa segura de turnos + casetas. NO existe endpoint de guardado en esta modalidad. */
export interface PropuestaTurnoCasetaExcel {
  codigoTrabajador: number;
  trabajador: string;
  fecha: string;
  valorExcel: string;
  turnoExcel: string | null;
  turnoSigo: string | null;
  casetaSigo: string | null;
  accion: 'CREAR' | 'ACTUALIZAR' | 'COINCIDE' | 'REVISAR';
  detalle: string;
}

export interface VistaPreviaTurnosCasetasExcel {
  desde: string;
  hasta: string;
  leidas: number;
  crear: number;
  actualizar: number;
  coinciden: number;
  revisar: number;
  propuestas: PropuestaTurnoCasetaExcel[];
  advertencias: string[];
}

/** SIGO_IMPORTAR_TURNOS_TEXTO_V1 - lectura literal de los textos de turnos. */
export interface CambioTextoTurnoExcel {
  trabajadorId: number;
  codigoTrabajador: number;
  nombre: string;
  fecha: string;
  anterior: EstadoProgramacion | null;
  nuevo: EstadoProgramacion | null;
}
export interface VistaPreviaTurnosTextoExcel {
  leidos: number;
  coinciden: number;
  cambios: CambioTextoTurnoExcel[];
  errores: string[];
  omitidos: string[];
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

  getContexto(
    plazaId: number,
    anio: number,
    mes: number
  ): Observable<ProgramacionContextoResponse> {
    const params = new HttpParams()
      .set('plazaId', plazaId)
      .set('anio', anio)
      .set('mes', mes);

    return this.http.get<ProgramacionContextoResponse>(
      `${this.api}/programacion/contexto`,
      { params }
    );
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

  /** SIGO_IMPORTAR_TURNOS_TEXTO_V1. Apache POI lee, pero no guarda. */
  previsualizarTextoTurnos(plazaId: number, anio: number, mes: number, archivo: File): Observable<VistaPreviaTurnosTextoExcel> {
    const data = new FormData();
    data.append('archivo', archivo);
    data.append('plazaId', String(plazaId));
    data.append('anio', String(anio));
    data.append('mes', String(mes));
    return this.http.post<VistaPreviaTurnosTextoExcel>(
      `${this.api}/programacion/turnos/importar-excel/vista-previa`,
      data
    );
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

  getReporteDistribucionPlazaPdf(
    plazaId: number,
    desde: string,
    hasta: string
  ): Observable<Blob> {
    const params = new HttpParams()
      .set('plazaId', plazaId)
      .set('desde', desde)
      .set('hasta', hasta);

    return this.http.get(
      `${this.api}/distribucion/reporte-plaza/pdf`,
      {
        params,
        responseType: 'blob'
      }
    );
  }

  previsualizarExcelTurnosCasetas(plazaId: number, archivo: File, anio: number, mes: number): Observable<VistaPreviaTurnosCasetasExcel> {
    const formulario = new FormData();
    formulario.append('archivo', archivo, archivo.name);
    return this.http.post<VistaPreviaTurnosCasetasExcel>(
      `${this.api}/distribucion/importar-excel/turnos/vista-previa`, formulario,
      { params: new HttpParams().set('plazaId', plazaId).set('anio', anio).set('mes', mes) }
    );
  }

  confirmarTurnosExcel(plazaId: number, archivo: File, anio: number, mes: number): Observable<{guardados: number; omitidos: number; mensaje: string}> {
    const formulario = new FormData();
    formulario.append('archivo', archivo, archivo.name);
    return this.http.post<{guardados: number; omitidos: number; mensaje: string}>(
      `${this.api}/distribucion/importar-excel/turnos/confirmar`, formulario,
      { params: new HttpParams().set('plazaId', plazaId).set('anio', anio).set('mes', mes) }
    );
  }

  confirmarCasetasExcel(plazaId: number, archivo: File, anio: number, mes: number): Observable<{guardados: number; omitidos: number; yaAsignadas: number; mensaje: string}> {
    const formulario = new FormData();
    formulario.append('archivo', archivo, archivo.name);
    return this.http.post<{guardados: number; omitidos: number; yaAsignadas: number; mensaje: string}>(
      `${this.api}/distribucion/importar-excel/casetas/confirmar`, formulario,
      { params: new HttpParams().set('plazaId', plazaId).set('anio', anio).set('mes', mes) }
    );
  }

  /** Multipart solo para subir XLSX. Apache POI responde con JSON de las casetas. */
  extraerCasetasExcelJson(plazaId: number, archivo: File, anio: number, mes: number): Observable<ExtraccionCasetasExcelJson> {
    const formulario = new FormData();
    formulario.append('archivo', archivo, archivo.name);
    return this.http.post<ExtraccionCasetasExcelJson>(
      `${this.api}/distribucion/importar-excel/casetas/extraer`, formulario,
      { params: new HttpParams().set('plazaId', plazaId).set('anio', anio).set('mes', mes) }
    );
  }

  /** Segundo POST JSON: valida sin escribir en PostgreSQL. */
  previsualizarCasetasJson(datos: ExtraccionCasetasExcelJson): Observable<VistaPreviaDistribucionExcel> {
    return this.http.post<VistaPreviaDistribucionExcel>(
      `${this.api}/distribucion/importar-excel/casetas/vista-previa-json`, datos
    );
  }

  previsualizarExcelDistribucion(plazaId: number, archivo: File, anio: number, mes: number): Observable<VistaPreviaDistribucionExcel> {
    const formulario = new FormData();
    formulario.append('archivo', archivo, archivo.name);
    return this.http.post<VistaPreviaDistribucionExcel>(
      `${this.api}/distribucion/importar-excel/vista-previa`,
      formulario,
      { params: new HttpParams().set('plazaId', plazaId).set('anio', anio).set('mes', mes) }
    );
  }

  getReporteDistribucionPlazaExcel(
    plazaId: number,
    desde: string,
    hasta: string
  ): Observable<Blob> {
    const params = new HttpParams()
      .set('plazaId', plazaId)
      .set('desde', desde)
      .set('hasta', hasta);

    return this.http.get(
      `${this.api}/distribucion/reporte-plaza/excel`,
      { params, responseType: 'blob' }
    );
  }

  getReporteDistribucionTrabajadorPdf(
    trabajadorId: number,
    desde: string,
    hasta: string
  ): Observable<Blob> {
    const params = new HttpParams()
      .set('desde', desde)
      .set('hasta', hasta);

    return this.http.get(
      `${this.api}/distribucion/reporte-trabajador/${trabajadorId}/pdf`,
      {
        params,
        responseType: 'blob'
      }
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

  getConfiguracionGeneradorCasetas(
    plazaId: number
  ): Observable<ConfiguracionAsignacionCaseta> {
    return this.http.get<ConfiguracionAsignacionCaseta>(
      `${this.api}/distribucion/generador/configuracion`,
      { params: new HttpParams().set('plazaId', plazaId) }
    );
  }

  guardarConfiguracionGeneradorCasetas(
    request: GuardarConfiguracionAsignacionCasetaRequest
  ): Observable<ConfiguracionAsignacionCaseta> {
    return this.http.put<ConfiguracionAsignacionCaseta>(
      `${this.api}/distribucion/generador/configuracion`,
      request
    );
  }

  getCasetasGenerador(
    plazaId: number
  ): Observable<CasetaConfiguracion[]> {
    return this.http.get<CasetaConfiguracion[]>(
      `${this.api}/distribucion/generador/casetas`,
      { params: new HttpParams().set('plazaId', plazaId) }
    );
  }

  guardarCasetaGenerador(
    ubicacionId: number,
    request: GuardarCasetaConfiguracionRequest
  ): Observable<CasetaConfiguracion> {
    return this.http.put<CasetaConfiguracion>(
      `${this.api}/distribucion/generador/casetas/${ubicacionId}`,
      request
    );
  }

  getRestriccionesCasetas(
    plazaId: number
  ): Observable<RestriccionCaseta[]> {
    return this.http.get<RestriccionCaseta[]>(
      `${this.api}/distribucion/generador/restricciones`,
      { params: new HttpParams().set('plazaId', plazaId) }
    );
  }

  guardarRestriccionCaseta(
    request: GuardarRestriccionCasetaRequest
  ): Observable<RestriccionCaseta> {
    return this.http.put<RestriccionCaseta>(
      `${this.api}/distribucion/generador/restricciones`,
      request
    );
  }

  eliminarRestriccionCaseta(
    restriccionId: number
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.api}/distribucion/generador/restricciones/${restriccionId}`
    );
  }

  generarPropuestaCasetas(
    request: GenerarCasetasRequest
  ): Observable<GeneradorCasetasPropuesta> {
    return this.http.post<GeneradorCasetasPropuesta>(
      `${this.api}/distribucion/generador/propuesta`,
      request
    );
  }
}
