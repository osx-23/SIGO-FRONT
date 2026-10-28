import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type TipoControlOperativo = 'REPORTE' | 'MEDICION';
export type EstadoControlOperativo = 'REGISTRADO' | 'EN_OBSERVACION' | 'ATENDIDO';

export interface ControlOperativoInput {
  plazaId: number;
  turnoId: number;
  responsableId: number;
  viaId: number | null;
  tipo: TipoControlOperativo;
  fecha: string;
  hora: string;
  situacion: string;
  ingreso: string;
  incidente: string;
  colaMetros: number | null;
  descripcion: string;
  estado: EstadoControlOperativo;
}
export interface ControlOperativoReporte extends ControlOperativoInput {
  id: number;
  plazaCodigo: string;
  turnoCodigo: string;
  viaNumero: number | null;
  registradoPorId: number;
  registradoPor: string;
  responsableNombre: string;
  creadoEn: string;
  actualizadoEn: string;
}
export interface ControlOperativoResponsable {
  id: number;
  nombreCompleto: string;
}

export interface ControlOperativoEvidencia {
  id: number;
  reporteId: number;
  categoria: string;
  urlArchivo: string;
  creadoEn: string;
}

@Injectable({ providedIn: 'root' })
export class ControlOperativoApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl + '/incidencias/control-operativo';

  listar(filtros: { plazaId?: number | null; tipo?: string; inicio?: string; fin?: string } = {})
      : Observable<ControlOperativoReporte[]> {
    let params = new HttpParams();
    if (filtros.plazaId) params = params.set('plazaId', filtros.plazaId);
    if (filtros.tipo) params = params.set('tipo', filtros.tipo);
    if (filtros.inicio) params = params.set('inicio', filtros.inicio);
    if (filtros.fin) params = params.set('fin', filtros.fin);
    return this.http.get<ControlOperativoReporte[]>(this.base, { params });
  }

  responsables(): Observable<ControlOperativoResponsable[]> {
    return this.http.get<ControlOperativoResponsable[]>(this.base + '/responsables');
  }

  crear(payload: ControlOperativoInput): Observable<ControlOperativoReporte> {
    return this.http.post<ControlOperativoReporte>(this.base, payload);
  }
  actualizar(id: number, payload: ControlOperativoInput): Observable<ControlOperativoReporte> {
    return this.http.put<ControlOperativoReporte>(this.base + '/' + id, payload);
  }
  evidencias(id: number): Observable<ControlOperativoEvidencia[]> {
    return this.http.get<ControlOperativoEvidencia[]>(this.base + '/' + id + '/evidencias');
  }
  subirEvidencia(id: number, file: File, categoria: string): Observable<ControlOperativoEvidencia> {
    const data = new FormData();
    data.append('file', file);
    data.append('categoria', categoria);
    return this.http.post<ControlOperativoEvidencia>(this.base + '/' + id + '/evidencias', data);
  }
  eliminarEvidencia(id: number, evidenciaId: number): Observable<void> {
    return this.http.delete<void>(this.base + '/' + id + '/evidencias/' + evidenciaId);
  }
}
