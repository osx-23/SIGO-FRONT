import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ElementoRelevo,
  EvidenciaRelevoResponse,
  RelevoRequest,
  RelevoResponse,
  RelevoSesion,
  Via
} from '../models/relevo.models';

@Injectable({ providedIn: 'root' })
export class RelevoApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getVias(plazaId: number): Observable<Via[]> {
    const params = new HttpParams().set('plazaId', plazaId.toString());
    return this.http.get<Via[]>(`${this.api}/vias`, { params });
  }

  getElementos(): Observable<ElementoRelevo[]> {
    return this.http.get<ElementoRelevo[]>(`${this.api}/relevos/elementos`);
  }

  sesionActual(): Observable<RelevoSesion | null> {
    return this.http.get<RelevoSesion | null>(`${this.api}/relevos/sesiones/actual`);
  }

  iniciarSesion(plazaId: number, turnoId: number): Observable<RelevoSesion> {
    return this.http.post<RelevoSesion>(`${this.api}/relevos/sesiones`, { plazaId, turnoId });
  }

  guardarAvanceSesion(id: number, borrador: string): Observable<RelevoSesion> {
    return this.http.put<RelevoSesion>(`${this.api}/relevos/sesiones/${id}/borrador`, { borrador });
  }

  finalizarSesion(id: number, request: RelevoRequest): Observable<RelevoSesion> {
    return this.http.post<RelevoSesion>(`${this.api}/relevos/sesiones/${id}/finalizar`, request);
  }

  anularSesion(id: number): Observable<RelevoSesion> {
    return this.http.post<RelevoSesion>(`${this.api}/relevos/sesiones/${id}/anular`, {});
  }

  registrar(request: RelevoRequest): Observable<RelevoResponse> {
    return this.http.post<RelevoResponse>(`${this.api}/relevos`, request);
  }

  actualizar(id: number, request: RelevoRequest): Observable<RelevoResponse> {
    return this.http.put<RelevoResponse>(`${this.api}/relevos/${id}`, request);
  }

  listar(inicio?: string, fin?: string): Observable<RelevoResponse[]> {
    let params = new HttpParams();
    if (inicio) params = params.set('inicio', inicio);
    if (fin) params = params.set('fin', fin);
    return this.http.get<RelevoResponse[]>(`${this.api}/relevos`, { params });
  }

  obtener(id: number): Observable<RelevoResponse> {
    return this.http.get<RelevoResponse>(`${this.api}/relevos/${id}`);
  }

  subirEvidenciaChecklist(checklistId: number, file: File): Observable<EvidenciaRelevoResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<EvidenciaRelevoResponse>(`${this.api}/relevos/checklist/${checklistId}/evidencias`, formData);
  }

  eliminarEvidenciaChecklist(checklistId: number, evidenciaId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/relevos/checklist/${checklistId}/evidencias/${evidenciaId}`);
  }

  subirEvidenciaVia(relevoViaId: number, file: File): Observable<EvidenciaRelevoResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<EvidenciaRelevoResponse>(`${this.api}/relevos/vias/${relevoViaId}/evidencias`, formData);
  }

  eliminarEvidenciaVia(relevoViaId: number, evidenciaId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/relevos/vias/${relevoViaId}/evidencias/${evidenciaId}`);
  }
}
