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
