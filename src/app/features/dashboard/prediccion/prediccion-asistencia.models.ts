export interface PrediccionAsistenciaRequest {
  plazaId: number;
  turnoId: number;
  fecha: string;
  programados: number;
}

export interface PrediccionAsistenciaResponse extends PrediccionAsistenciaRequest {
  ausenciasEstimadas: number;
  coberturaEstimada: number;
  modelo: string;
  version: string;
  origenDatos: string;
  advertencia: string | null;
}
