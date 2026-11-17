import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { PermutaDetalle, ResumenPermutas } from '../models/permutas.models';

@Injectable({ providedIn: 'root' })
export class PermutasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl + '/permutas';

  agente(codigo: number) {
    return this.http.get<{ codigo: number; nombre: string }>(this.base + '/agentes/' + codigo);
  }

  delTurno(plazaId: number, turnoId: number, fecha: string) {
    const params = new HttpParams()
      .set('plazaId', plazaId)
      .set('turnoId', turnoId)
      .set('fecha', fecha);
    return this.http.get<PermutaDetalle[]>(this.base + '/turno', { params });
  }

  listarPaginado(filtros: {
    inicio?: string; fin?: string; plazaId?: number | null;
    turnoId?: number | null; codigo?: number | null
  }, pagina: number, tamano: number) {
    let params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    if (filtros.inicio) params = params.set('inicio', filtros.inicio);
    if (filtros.fin) params = params.set('fin', filtros.fin);
    if (filtros.plazaId != null) params = params.set('plazaId', filtros.plazaId);
    if (filtros.turnoId != null) params = params.set('turnoId', filtros.turnoId);
    if (filtros.codigo != null) params = params.set('codigo', filtros.codigo);
    return this.http.get<{
      registros: PermutaDetalle[]; total: number; pagina: number;
      tamano: number; totalPaginas: number
    }>(this.base + '/pagina', { params });
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

  exportarExcel(
    filtros: { inicio?: string; fin?: string; plazaId?: number | null;
               turnoId?: number | null; codigo?: number | null },
    anio: number
  ) {
    let params = new HttpParams().set('anio', anio);
    if (filtros.inicio) params = params.set('inicio', filtros.inicio);
    if (filtros.fin) params = params.set('fin', filtros.fin);
    if (filtros.plazaId != null) params = params.set('plazaId', filtros.plazaId);
    if (filtros.turnoId != null) params = params.set('turnoId', filtros.turnoId);
    if (filtros.codigo != null) params = params.set('codigo', filtros.codigo);
    return this.http.get(this.base + '/exportar', { params, responseType: 'blob' });
  }

  dashboard(mes: string) {
    return this.http.get<ResumenPermutas>(this.base + '/dashboard', {
      params: new HttpParams().set('mes', mes)
    });
  }
}
