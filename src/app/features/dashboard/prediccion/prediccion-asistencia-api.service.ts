import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  PrediccionAsistenciaRequest,
  PrediccionAsistenciaResponse
} from './prediccion-asistencia.models';

@Injectable({ providedIn: 'root' })
export class PrediccionAsistenciaApiService {
  private readonly http = inject(HttpClient);

  predecir(request: PrediccionAsistenciaRequest): Observable<PrediccionAsistenciaResponse> {
    return this.http.post<PrediccionAsistenciaResponse>(
      `${environment.apiUrl}/dashboard/asistencia/predecir`,
      request
    );
  }
}
