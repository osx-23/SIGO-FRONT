import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { AgenteProgramadoPermuta, PermutaDetalle, ResumenPermutas } from '../models/permutas.models';

@Injectable({ providedIn: 'root' })
export class PermutasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl + '/permutas';

  agente(codigo: number, fecha: string) {
    return this.http.get<AgenteProgramadoPermuta>(this.base + '/agentes/' + codigo, {
      params: new HttpParams().set('fecha', fecha)
    });
  }

  candidatos(plazaId: number, turnoId: number, fecha: string) {
    const params = new HttpParams()
      .set('plazaId', plazaId)
      .set('turnoId', turnoId)
      .set('fecha', fecha);
    return this.http.get<AgenteProgramadoPermuta[]>(this.base + '/candidatos', { params });
  }

  delTurno(plazaId: number, turnoId: number, fecha: string) {
    const params = new HttpParams()
      .set('plazaId', plazaId)
      .set('turnoId', turnoId)
      .set('fecha', fecha);
    return this.http.get<PermutaDetalle[]>(this.base + '/turno', { params });
  }

  listar(filtros: { inicio?: string; fin?: string; plazaId?: number | null;
                    turnoId?: number | null; codigo?: number | null }) {
    let params = new HttpParams();
    if (filtros.inicio) params = params.set('inicio', filtros.inicio);
    if (filtros.fin) params = params.set('fin', filtros.fin);
    if (filtros.plazaId != null) params = params.set('plazaId', filtros.plazaId);
    if (filtros.turnoId != null) params = params.set('turnoId', filtros.turnoId);
    if (filtros.codigo != null) params = params.set('codigo', filtros.codigo);
    return this.http.get<PermutaDetalle[]>(this.base, { params });
  }

  dashboard(mes: string) {
    return this.http.get<ResumenPermutas>(this.base + '/dashboard', {
      params: new HttpParams().set('mes', mes)
    });
  }
}
