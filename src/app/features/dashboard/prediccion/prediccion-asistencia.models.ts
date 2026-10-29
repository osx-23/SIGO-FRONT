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
