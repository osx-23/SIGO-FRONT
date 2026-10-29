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

export type EstadoProyeccion = 'PROYECTADO' | 'SIN_PROGRAMACION' | 'YA_REGISTRADO';

export interface DetalleProyeccionFinMes {
  fecha: string;
  turnoId: number;
  turnoCodigo: string;
  estado: EstadoProyeccion;
  programados: number | null;
  ausenciasEstimadas: number | null;
  coberturaEstimada: number | null;
}

export interface ProyeccionFinMesResponse {
  plazaId: number;
  fechaConsulta: string;
  desde: string;
  hasta: string;
  turnosProyectados: number;
  turnosSinProgramacion: number;
  turnosYaRegistrados: number;
  totalProgramados: number;
  totalAusenciasEstimadas: number;
  totalCoberturaEstimada: number;
  detalle: DetalleProyeccionFinMes[];
}
