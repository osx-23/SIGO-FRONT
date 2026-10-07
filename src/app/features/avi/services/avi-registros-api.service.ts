import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AviRegistro, AviRegistroFiltros } from '../models/avi-registro.models';

@Injectable({ providedIn: 'root' })
export class AviRegistrosApiService {
  private readonly http = inject(HttpClient);

  listar(filtros: AviRegistroFiltros): Observable<AviRegistro[]> {
    let params = new HttpParams()
      .set('desde', filtros.desde)
      .set('hasta', filtros.hasta);

    if (filtros.plazaId !== null && filtros.plazaId !== undefined) {
      params = params.set('plazaId', String(filtros.plazaId));
    }

    if (filtros.via !== null && filtros.via !== undefined) {
      params = params.set('via', String(filtros.via));
    }

    if (filtros.accion) {
      params = params.set('accion', filtros.accion);
    }

    // El interceptor de SIGO agrega el JWT de la sesión web.
    return this.http.get<AviRegistro[]>(environment.apiUrl + '/avi/registros', { params });
  }
}
