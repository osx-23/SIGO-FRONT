export type EstadoIncidencia = 'OBSERVACION' | 'ATENDIDO';

export interface TipoIncidencia {
  id: number;
  nombre: string;
}

export interface ViaIncidencia {
  id: number;
  plazaId?: number;
  numero: number;
  nombre: string | null;
  activa?: boolean;
  orden?: number;
}

export interface IncidenciaRequest {
  plazaId: number;
  turnoId: number;
  tipoId: number;
  viaId: number | null;
  fecha: string;
  hora: string;
  descripcion: string;
}

export interface EvidenciaIncidencia {
  id: number;
  urlArchivo: string;
  publicId: string | null;
  tipo: string;
  fechaCreacion: string | null;
}

export interface IncidenciaResponse {
  id: number;
  plazaId: number;
  plazaCodigo: string;
  turnoId: number;
  turnoCodigo: string;
  registradoPorId: number;
  registradoPorCodigo: number;
  registradoPorNombre: string;
  tipoId: number;
  tipoNombre: string;
  viaId: number | null;
  viaNumero: number | null;
  viaNombre: string | null;
  fecha: string;
  hora: string;
  descripcion: string;
  estado: EstadoIncidencia;
  fechaCreacion: string | null;
  fechaAtendido: string | null;
  evidencias: EvidenciaIncidencia[];
}
