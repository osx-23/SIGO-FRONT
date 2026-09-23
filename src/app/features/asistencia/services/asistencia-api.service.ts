import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

import {
  AsistenciaRequest,
  AsistenciaResponse,
  AsistenciaUpdateRequest,
  AusenciaMotivo,
  DashboardPunto,
  EvidenciaResponse,
  MotivoAusencia,
  Plaza,
  ResumenAsistencia,
  Trabajador,
  Turno
} from '../models/asistencia.models';

@Injectable({
  providedIn: 'root'
})
export class AsistenciaApiService {

  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /*
   * =========================================================
   * CATÁLOGOS GENERALES
   * =========================================================
   */

  getCatalogos(): Observable<{
    plazas: Plaza[];
    turnos: Turno[];
    motivos: MotivoAusencia[];
  }> {

    return forkJoin({
      plazas: this.getPlazas(),
      turnos: this.getTurnos(),
      motivos: this.getMotivos()
    });
  }

  /*
   * =========================================================
   * PLAZAS
   * =========================================================
   */

  getPlazas(): Observable<Plaza[]> {

    return this.http.get<Plaza[]>(
      `${this.api}/plazas`
    );
  }

  /*
   * =========================================================
   * TURNOS
   * =========================================================
   */

  getTurnos(): Observable<Turno[]> {

    return this.http.get<Turno[]>(
      `${this.api}/turnos`
    );
  }

  /*
   * =========================================================
   * MOTIVOS DE AUSENCIA
   * =========================================================
   */

  getMotivos(): Observable<MotivoAusencia[]> {

    return this.http.get<MotivoAusencia[]>(
      `${this.api}/motivos-ausencia`
    );
  }

  /*
   * =========================================================
   * TRABAJADORES
   * =========================================================
   */

  getTrabajadores(
    puesto?: string
  ): Observable<Trabajador[]> {

    let params = new HttpParams();

    if (puesto) {
      params = params.set('puesto', puesto);
    }

    return this.http.get<Trabajador[]>(
      `${this.api}/trabajadores`,
      { params }
    );
  }

  /*
   * =========================================================
   * AGENTES POR PLAZA
   * =========================================================
   */

  getAgentesPorPlaza(
    plazaId: number
  ): Observable<Trabajador[]> {

    const params =
      new HttpParams()
        .set('plazaId', plazaId.toString());

    return this.http.get<Trabajador[]>(
      `${this.api}/trabajadores/agentes`,
      { params }
    );
  }

  /*
   * =========================================================
   * CONTROLADORES POR PLAZA
   * =========================================================
   */

  getControladoresPorPlaza(
    plazaId: number
  ): Observable<Trabajador[]> {

    const params =
      new HttpParams()
        .set('plazaId', plazaId.toString());

    return this.http.get<Trabajador[]>(
      `${this.api}/trabajadores/controladores`,
      { params }
    );
  }

  /*
   * =========================================================
   * REGISTRAR ASISTENCIA
   * =========================================================
   */

  registrarAsistencia(
    request: AsistenciaRequest
  ): Observable<AsistenciaResponse> {

    return this.http.post<AsistenciaResponse>(
      `${this.api}/asistencias`,
      request
    );
  }

  /*
   * =========================================================
   * ACTUALIZAR ASISTENCIA
   * =========================================================
   */

  actualizarAsistencia(
    id: number,
    request: AsistenciaUpdateRequest
  ): Observable<AsistenciaResponse> {

    return this.http.put<AsistenciaResponse>(
      `${this.api}/asistencias/${id}`,
      request
    );
  }

  /*
   * =========================================================
   * SUBIR EVIDENCIA
   * =========================================================
   */

  subirEvidencia(
    asistenciaId: number,
    file: File,
    tipo?:
      | 'CALENTAMIENTO'
      | 'INICIO_TURNO'
      | 'TAPONES_AUDITIVOS'
  ): Observable<EvidenciaResponse> {

    const formData = new FormData();

    formData.append(
      'file',
      file
    );

    if (tipo) {

      formData.append(
        'tipo',
        tipo
      );
    }

    return this.http.post<EvidenciaResponse>(
      `${this.api}/asistencias/${asistenciaId}/evidencias`,
      formData
    );
  }

  /*
   * =========================================================
   * ELIMINAR EVIDENCIA
   * =========================================================
   */

  eliminarEvidencia(
    asistenciaId: number,
    evidenciaId: number
  ): Observable<void> {

    return this.http.delete<void>(
      `${this.api}/asistencias/${asistenciaId}/evidencias/${evidenciaId}`
    );
  }

  /*
   * =========================================================
   * LISTAR ASISTENCIAS
   * =========================================================
   *
   * Se conserva porque historial y otros módulos lo utilizan.
   *
   * EL DASHBOARD YA NO DEBE UTILIZAR ESTE MÉTODO.
   */

  listarAsistencias(
    inicio?: string,
    fin?: string,
    plazaId?: number | null
  ): Observable<AsistenciaResponse[]> {

    let params = new HttpParams();

    if (inicio) {
      params = params.set('inicio', inicio);
    }

    if (fin) {
      params = params.set('fin', fin);
    }

    if (
      plazaId !== null &&
      plazaId !== undefined
    ) {

      params = params.set(
        'plazaId',
        plazaId.toString()
      );
    }

    return this.http.get<AsistenciaResponse[]>(
      `${this.api}/asistencias`,
      { params }
    );
  }

  /*
   * =========================================================
   * OBTENER ASISTENCIA
   * =========================================================
   */

  obtenerAsistencia(
    id: number
  ): Observable<AsistenciaResponse> {

    return this.http.get<AsistenciaResponse>(
      `${this.api}/asistencias/${id}`
    );
  }

  /*
   * =========================================================
   * DASHBOARD - RESUMEN
   * =========================================================
   */

  getResumen(
    inicio: string,
    fin: string,
    plazaId?: number | null,
    turnoId?: number | null
  ): Observable<ResumenAsistencia> {

    let params =
      new HttpParams()
        .set('inicio', inicio)
        .set('fin', fin);

    params =
      this.agregarFiltrosDashboard(
        params,
        plazaId,
        turnoId
      );

    return this.http.get<ResumenAsistencia>(
      `${this.api}/dashboard/asistencia/resumen`,
      { params }
    );
  }

  /*
   * =========================================================
   * DASHBOARD - DIARIO
   * =========================================================
   */

  getDiario(
    anio: number,
    mes: number,
    plazaId?: number | null,
    turnoId?: number | null
  ): Observable<DashboardPunto[]> {

    let params =
      new HttpParams()
        .set('anio', anio.toString())
        .set('mes', mes.toString());

    params =
      this.agregarFiltrosDashboard(
        params,
        plazaId,
        turnoId
      );

    return this.http.get<DashboardPunto[]>(
      `${this.api}/dashboard/asistencia/diario`,
      { params }
    );
  }

  /*
   * =========================================================
   * DASHBOARD - ANUAL
   * =========================================================
   */

  getAnual(
    anio: number,
    plazaId?: number | null,
    turnoId?: number | null
  ): Observable<DashboardPunto[]> {

    let params =
      new HttpParams()
        .set('anio', anio.toString());

    params =
      this.agregarFiltrosDashboard(
        params,
        plazaId,
        turnoId
      );

    return this.http.get<DashboardPunto[]>(
      `${this.api}/dashboard/asistencia/anual`,
      { params }
    );
  }

  /*
   * =========================================================
   * DASHBOARD - AUSENCIAS POR MOTIVO
   * =========================================================
   */

  getAusenciasMotivo(
    anio: number,
    mes?: number,
    plazaId?: number | null,
    turnoId?: number | null
  ): Observable<AusenciaMotivo[]> {

    let params =
      new HttpParams()
        .set('anio', anio.toString());

    if (mes !== undefined) {

      params =
        params.set(
          'mes',
          mes.toString()
        );
    }

    params =
      this.agregarFiltrosDashboard(
        params,
        plazaId,
        turnoId
      );

    return this.http.get<AusenciaMotivo[]>(
      `${this.api}/dashboard/asistencia/ausencias-motivo`,
      { params }
    );
  }

  /*
   * =========================================================
   * FILTROS DASHBOARD
   * =========================================================
   *
   * Centralizamos plazaId y turnoId para no repetir
   * la misma lógica en cada método.
   */

  private agregarFiltrosDashboard(
    params: HttpParams,
    plazaId?: number | null,
    turnoId?: number | null
  ): HttpParams {

    if (
      plazaId !== null &&
      plazaId !== undefined
    ) {

      params =
        params.set(
          'plazaId',
          plazaId.toString()
        );
    }

    if (
      turnoId !== null &&
      turnoId !== undefined
    ) {

      params =
        params.set(
          'turnoId',
          turnoId.toString()
        );
    }

    return params;
  }
}