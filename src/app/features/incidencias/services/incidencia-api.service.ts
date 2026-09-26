import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EstadoIncidencia,
  EvidenciaIncidencia,
  IncidenciaRequest,
  IncidenciaResponse,
  TipoIncidencia,
  ViaIncidencia
} from '../models/incidencia.models';

@Injectable({ providedIn: 'root' })
export class IncidenciaApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getTipos(): Observable<TipoIncidencia[]> {
    return this.http.get<TipoIncidencia[]>(`${this.api}/incidencias/tipos`);
  }

  getVias(plazaId: number): Observable<ViaIncidencia[]> {
    const params = new HttpParams().set('plazaId', plazaId.toString());
    return this.http.get<ViaIncidencia[]>(`${this.api}/vias`, { params });
  }

  registrar(request: IncidenciaRequest): Observable<IncidenciaResponse> {
    return this.http.post<IncidenciaResponse>(`${this.api}/incidencias`, request);
  }

  subirEvidencia(id: number, file: File): Observable<EvidenciaIncidencia> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<EvidenciaIncidencia>(
      `${this.api}/incidencias/${id}/evidencias`,
      formData
    );
  }

  listar(
    inicio?: string,
    fin?: string,
    plazaId?: number | null,
    estado?: EstadoIncidencia | null
  ): Observable<IncidenciaResponse[]> {
    let params = new HttpParams();
    if (inicio) params = params.set('inicio', inicio);
    if (fin) params = params.set('fin', fin);
    if (plazaId !== null && plazaId !== undefined) params = params.set('plazaId', plazaId.toString());
    if (estado) params = params.set('estado', estado);
    return this.http.get<IncidenciaResponse[]>(`${this.api}/incidencias`, { params });
  }

  atender(id: number): Observable<IncidenciaResponse> {
    return this.http.patch<IncidenciaResponse>(
      `${this.api}/incidencias/${id}/atender`,
      {}
    );
  }

  pendientesCount(): Observable<{ cantidad: number }> {
    return this.http.get<{ cantidad: number }>(
      `${this.api}/incidencias/pendientes/count`
    );
  }
}
