export interface PermutaRequest {
  codigoSolicitante: number;
  fechaSolicitante: string;
  turnoSolicitanteId: number;
  plazaSolicitanteId: number;
  codigoAceptante: number;
  fechaAceptante: string;
  turnoAceptanteId: number;
  plazaAceptanteId: number;
}

export interface PermutaDetalle {
  id: number;
  plazaSolicitanteId: number;
  plazaSolicitante: string;
  codigoSolicitante: number;
  nombreSolicitante: string;
  turnoSolicitanteId: number;
  turnoSolicitante: string;
  fechaSolicitante: string;
  plazaAceptanteId: number;
  plazaAceptante: string;
  codigoAceptante: number;
  nombreAceptante: string;
  turnoAceptanteId: number;
  turnoAceptante: string;
  fechaAceptante: string;
}

export interface ResumenPermutas {
  total: number;
  porPlaza: { plaza: string; total: number }[];
  topAgentes: { codigo: number; nombre: string; total: number }[];
}

/** Totales anuales por plaza, usando el mes y plaza originales del solicitante. */
export interface ResumenAnualPermutas {
  anio: number;
  total: number;
  plazas: string[];
  meses: {
    mes: number;
    total: number;
    porPlaza: { plaza: string; total: number }[];
  }[];
  totalesPorPlaza: { plaza: string; total: number }[];
  topAgentes: { codigo: number; nombre: string; total: number }[];
}
