import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FotoInvermet, VisitaInvermet, VisitaInvermetRequest } from '../models/visita-invermet.models';

@Injectable({ providedIn: 'root' })
export class VisitaInvermetApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl + '/incidencias/visitas-invermet';

  registrar(data: VisitaInvermetRequest): Observable<VisitaInvermet> {
    return this.http.post<VisitaInvermet>(this.base, data);
  }
  listar(inicio: string, fin: string, plazaId: number | null): Observable<VisitaInvermet[]> {
    let params = new HttpParams().set('inicio', inicio).set('fin', fin);
    if (plazaId != null) params = params.set('plazaId', plazaId);
    return this.http.get<VisitaInvermet[]>(this.base, { params });
  }
  obtener(id: number): Observable<VisitaInvermet> {
    return this.http.get<VisitaInvermet>(this.base + '/' + id);
  }
  subirFoto(id: number, foto: File): Observable<FotoInvermet> {
    const payload = new FormData();
    payload.append('file', foto, foto.name);
    return this.http.post<FotoInvermet>(this.base + '/' + id + '/fotos', payload);
  }
  descargarExcel(id: number): Observable<Blob> {
    return this.http.get(this.base + '/' + id + '/excel', { responseType: 'blob' });
  }
}
