import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  PrediccionAsistenciaRequest,
  PrediccionAsistenciaResponse,
  ProyeccionFinMesResponse
} from './prediccion-asistencia.models';

@Injectable({ providedIn: 'root' })
export class PrediccionAsistenciaApiService {
  private readonly http = inject(HttpClient);

  proyectarFinMes(plazaId: number, turnoId: number | null): Observable<ProyeccionFinMesResponse> {
    let params = new HttpParams().set('plazaId', String(plazaId));
    if (turnoId !== null) params = params.set('turnoId', String(turnoId));
    return this.http.get<ProyeccionFinMesResponse>(
      `${environment.apiUrl}/dashboard/asistencia/proyeccion-fin-mes`,
      { params }
    );
  }

  predecir(request: PrediccionAsistenciaRequest): Observable<PrediccionAsistenciaResponse> {
    return this.http.post<PrediccionAsistenciaResponse>(
      `${environment.apiUrl}/dashboard/asistencia/predecir`,
      request
    );
  }
}
