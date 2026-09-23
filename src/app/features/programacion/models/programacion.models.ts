export type EstadoProgramacion='A'|'B'|'C'|'D'|'V'|'COM'|'DM'|'LIC';
export type TipoUbicacion='VIA'|'AUXILIAR'|'APOYO';

export interface Plaza{ id:number; codigo:string; descripcion?:string|null; activo?:boolean; }
export interface TrabajadorResumen{
  id:number; codigo:number; nombreCompleto:string;
  puesto?:{id:number;nombre:string}|null;
  plaza?:{id:number;codigo:string;descripcion?:string|null}|null;
  rolSistema?:'SUPERVISOR'|'CONTROLADOR'|'OPERADOR';
  activo?:boolean;
}
export interface ProgramacionDia{
  programacionId:number; trabajadorId:number; codigoTrabajador:number; nombreTrabajador:string;
  plazaId:number; plazaCodigo:string; fecha:string; estado:EstadoProgramacion;
}
export interface TurnoItemRequest{ trabajadorId:number; fecha:string; estado:EstadoProgramacion; }
export interface GuardarProgramacionRequest{ plazaId:number; programaciones:TurnoItemRequest[]; }
export interface Ubicacion{
  id:number; plazaId:number; codigo:string; nombre:string; tipo:TipoUbicacion;
  viaId:number|null; activo:boolean; orden:number;
}
export interface GuardarUbicacionRequest{
  plazaId:number; codigo:string; nombre:string; tipo:TipoUbicacion; orden:number|null;
}
export interface DistribucionDia{
  distribucionId:number; programacionTurnoId:number; trabajadorId:number; codigoTrabajador:number;
  nombreTrabajador:string; fecha:string; estado:EstadoProgramacion; ubicacionId:number;
  ubicacionCodigo:string; ubicacionNombre:string; ubicacionTipo:TipoUbicacion; observacion?:string|null;
}
export interface DistribucionItemRequest{ programacionTurnoId:number; ubicacionId:number; observacion?:string|null; }
export interface GuardarDistribucionRequest{ plazaId:number; distribuciones:DistribucionItemRequest[]; }
export interface HorarioDia{ fecha:string; estado:EstadoProgramacion|null; ubicacionCodigo:string|null; ubicacionNombre:string|null; }
export interface MiHorario{
  trabajadorId:number; codigo:number; nombre:string; plazaId:number|null; plazaCodigo:string|null;
  lider:string|null; dias:HorarioDia[];
}
export interface GrupoLider{
  id:number; agenteId:number; agenteCodigo:number; agenteNombre:string;
  controladorId:number; controladorCodigo:number; controladorNombre:string;
  plazaId:number; plazaCodigo:string; fechaInicio:string; fechaFin:string|null; activo:boolean;
}
export interface GrupoLiderRequest{ agenteId:number; controladorId:number; plazaId:number; fechaInicio?:string|null; }
export interface ResumenUbicacion{ codigo:string; nombre:string; veces:number; }
export interface ResumenTrabajador{ trabajadorId:number; codigo:number; nombre:string; ubicaciones:ResumenUbicacion[]; }
export interface CoberturaUbicacion{ ubicacionId:number; codigo:string; nombre:string; porDia:Record<string,number>; }

export type GrupoProgramacion =
  | 'SECUENCIA_1'
  | 'SECUENCIA_2'
  | 'SECUENCIA_3'
  | 'SECUENCIA_4'
  | 'PART_TIME';

export interface SecuenciaAgente {
  id: number;
  agenteId: number;
  codigo: number;
  nombre: string;
  plazaId: number;
  plazaCodigo: string;
  grupo: GrupoProgramacion | null;
  orden: number | null;
}

export interface AsignarSecuenciaRequest {
  agenteId: number;
  plazaId: number;
  grupo: GrupoProgramacion;
}

export interface OrdenAgenteRequest {
  agenteId: number;
  orden: number;
}

export interface GuardarOrdenSecuenciaRequest {
  plazaId: number;
  grupo: GrupoProgramacion;
  agentes: OrdenAgenteRequest[];
}

export interface AgenteProgramacionExcepcion {
  id: number;
  trabajadorId: number;
  codigoTrabajador: number;
  nombreTrabajador: string;
  plazaId: number;
  plazaCodigo: string;
  permiteA: boolean;
  permiteB: boolean;
  permiteC: boolean;
  motivo: string | null;
  color: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgenteProgramacionExcepcionRequest {
  trabajadorId: number;
  plazaId: number;
  permiteA: boolean;
  permiteB: boolean;
  permiteC: boolean;
  motivo: string | null;
  color: string;
  activo: boolean;
}
