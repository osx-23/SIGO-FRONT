import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  PedidoPayload, PedidoDetalle, PedidoLista, SugerenciaPedido, MaterialConsolidado, ConsumoHistorico
} from '../models/pedidos.models';

@Injectable({ providedIn: 'root' })
export class InventarioPedidosApiService {
  private readonly base = environment.apiUrl + '/inventario/pedidos';
  constructor(private readonly http: HttpClient) {}

  sugerencias(plazaId: number, periodo: string) {
    return this.http.get<SugerenciaPedido[]>(this.base + '/sugerencias', {
      params: new HttpParams().set('plazaId', plazaId).set('periodo', periodo)
    });
  }
  listar(plazaId?: number | null, periodo?: string | null) {
    let params = new HttpParams();
    if (plazaId) params = params.set('plazaId', plazaId);
    if (periodo) params = params.set('periodo', periodo);
    return this.http.get<PedidoLista[]>(this.base, { params });
  }
  detalle(id: number) { return this.http.get<PedidoDetalle>(this.base + '/' + id); }
  crear(payload: PedidoPayload) { return this.http.post<PedidoDetalle>(this.base, payload); }
  editar(id: number, payload: PedidoPayload) { return this.http.put<PedidoDetalle>(this.base + '/' + id, payload); }
  enviar(id: number) { return this.http.post<PedidoDetalle>(this.base + '/' + id + '/enviar', {}); }
  aprobar(id: number) { return this.http.post<PedidoDetalle>(this.base + '/' + id + '/aprobar', {}); }
  rechazar(id: number) { return this.http.post<PedidoDetalle>(this.base + '/' + id + '/rechazar', {}); }
  cerrarFaltantes(id: number) { return this.http.post<PedidoDetalle>(this.base + '/' + id + '/cerrar-faltantes', {}); }
  recibir(id: number, claveIdempotencia: string, items: { productoId: number; cantidad: number }[], observacion: string) {
    return this.http.post<PedidoDetalle>(this.base + '/' + id + '/recepciones',
      { claveIdempotencia, items, observacion });
  }
  consolidado(periodo: string) {
    return this.http.get<MaterialConsolidado[]>(this.base + '/consolidado', { params: { periodo } });
  }
  consolidar(periodo: string) {
    return this.http.post<MaterialConsolidado[]>(this.base + '/consolidar', null, { params: { periodo } });
  }
  consumo(plazaId: number) {
    return this.http.get<ConsumoHistorico[]>(this.base + '/consumo', { params: { plazaId } });
  }
}
