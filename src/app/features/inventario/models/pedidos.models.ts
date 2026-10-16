export type EstadoPedido = 'BORRADOR' | 'PENDIENTE' | 'APROBADO' | 'ENVIADO' |
  'PARCIAL' | 'COMPLETADO' | 'CERRADO_FALTANTES' | 'RECHAZADO';

export interface SugerenciaPedido {
  productoId: number;
  producto: string;
  unidadMedida: string;
  stockActual: number;
  stockMinimo: number;
  promedioMensual: number | null;
  sugerido: number | null;
  conHistorico: boolean;
  cantidad: number;
}

export interface ItemPedidoPayload {
  productoId: number;
  cantidad: number;
  sugerida: number | null;
  promedio: number | null;
  stock: number;
}
export interface PedidoPayload {
  plazaId: number;
  periodo: string; // AAAA-MM
  observacion: string;
  items: ItemPedidoPayload[];
}
export interface PedidoLista {
  id: number;
  plazaId: number;
  plaza: string;
  periodo: string;
  estado: EstadoPedido;
  observacion: string | null;
  creadoEn: string;
  totalSolicitado: number;
  totalRecibido: number;
}
export interface ItemPedidoDetalle {
  productoId: number;
  producto: string;
  unidad: string;
  cantidad: number;
  sugerida: number | null;
  promedio: number | null;
  stock: number | null;
  recibida: number;
  pendiente: number;
}
export interface RecepcionPedido {
  id: number;
  fecha: string;
  observacion: string | null;
  recibidoPor: number;
  producto: string;
  productoId: number;
  cantidad: number;
}
export interface PedidoDetalle {
  id: number;
  plazaId: number;
  plaza: string;
  periodo: string;
  estado: EstadoPedido;
  observacion: string | null;
  creadoPor: number;
  aprobadoPor: number | null;
  creadoEn: string;
  aprobadoEn: string | null;
  enviadoEn: string | null;
  items: ItemPedidoDetalle[];
  recepciones: RecepcionPedido[];
}
export interface MaterialConsolidado {
  productoId: number;
  producto: string;
  unidad: string;
  cantidadTotal: number;
  plazas: number;
}
export interface ConsumoHistorico {
  plazaId: number;
  productoId: number;
  producto: string;
  periodo: string;
  consumo: number;
}
