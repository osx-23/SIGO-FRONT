export const ROLES_SIGO = [
  'SUPERVISOR',
  'CONTROLADOR',
  'OPERADOR'
] as const;

export type RolSistema = typeof ROLES_SIGO[number];

export const MODULOS_SIGO = [
  'DASHBOARD',
  'RELEVOS',
  'ASISTENCIA',
  'INVENTARIO',
  'ADMIN_PRODUCTOS',
  'TRABAJADORES',
  'CHAT',
  'PROGRAMACION',
  'DISTRIBUCION',
  'MI_HORARIO'
] as const;

export type ModuloSigo = typeof MODULOS_SIGO[number];

export interface UsuarioSesion {
  id: number;
  trabajadorId?: number;
  codigo: number;
  nombre: string;
  rol: RolSistema;
  plazaId: number | null;
  plaza: string | null;
  modulos: ModuloSigo[];
  requiereCambioPassword?: boolean;
}

export interface LoginResponse {
  token: string;
  tipo: string;
  expiresIn: number;
  requiereCambioPassword?: boolean;
  usuario: UsuarioSesion;
}

export function esModuloSigo(value: string): value is ModuloSigo {
  return (MODULOS_SIGO as readonly string[]).includes(value);
}
