export interface PersonalInvermetOpcion {
  id: number;
  codigo: number;
  nombreCompleto: string;
  puesto: string;
  plazaCodigo: string | null;
}

export interface PreguntaInvermet {
  numero: number;
  pregunta: string;
  quienRespondio: string;
  respuesta: string;
}
export interface FotoInvermet {
  id: number;
  urlArchivo: string;
}
export interface VisitaInvermetRequest {
  plazaId: number;
  controlador: string;
  supervisor: string;
  fecha: string;
  horaInicio: string;
  horaFinal: string;
  casetasEnPlaza: number;
  casetasAbiertas: number;
  datoVisita1: string;
  datoVisita2: string;
  observaciones: string;
  preguntas: PreguntaInvermet[];
}
export interface VisitaInvermet extends VisitaInvermetRequest {
  id: number;
  plazaCodigo: string;
  duracionMinutos: number;
  fotos: FotoInvermet[];
}
