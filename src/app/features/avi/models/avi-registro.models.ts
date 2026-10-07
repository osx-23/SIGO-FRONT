export type AviAccion = 'FUGA' | 'DERIVADO';

export interface AviRegistro {
  id: string;
  usuarioId: number;
  usuarioCodigo: number;
  usuarioNombre: string;
  plazaId: number;
  plazaCodigo: string;
  placa: string;
  via: number;
  accion: AviAccion;
  fechaHoraEvento: string;
  fechaHoraRecepcion: string;
  textoReconocido: string | null;
}

export interface AviRegistroFiltros {
  desde: string;
  hasta: string;
  plazaId?: number | null;
  via?: number | null;
  accion?: AviAccion | null;
}
