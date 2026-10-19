import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  esModuloSigo,
  LoginResponse,
  ModuloSigo,
  RolSistema,
  UsuarioSesion
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'sigo_token';
  private readonly userKey = 'sigo_usuario';

  readonly usuario = signal<UsuarioSesion | null>(this.readUser());

  constructor(private readonly http: HttpClient) {}

  async login(codigo: number, password: string): Promise<LoginResponse> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(
        `${environment.apiUrl}/auth/login`,
        { codigo, password }
      )
    );

    localStorage.setItem(this.tokenKey, response.token);

    const usuario = this.normalizarUsuario({
      ...response.usuario,
      requiereCambioPassword:
        response.requiereCambioPassword ??
        response.usuario.requiereCambioPassword ??
        false
    });

    this.persistirUsuario(usuario);

    return {
      ...response,
      usuario
    };
  }

  async restore(): Promise<UsuarioSesion | null> {
    if (!this.token()) {
      return null;
    }

    try {
      const response = await firstValueFrom(
        this.http.get<UsuarioSesion>(
          `${environment.apiUrl}/auth/me`
        )
      );

      const previo = this.usuario();

      const usuario = this.normalizarUsuario({
        ...response,
        requiereCambioPassword:
          response.requiereCambioPassword ??
          previo?.requiereCambioPassword ??
          false
      });

      this.persistirUsuario(usuario);
      return usuario;
    } catch {
      this.logout();
      return null;
    }
  }

  async cambiarPassword(
    passwordActual: string,
    passwordNueva: string
  ): Promise<void> {
    await firstValueFrom(
      this.http.put<void>(
        `${environment.apiUrl}/auth/change-password`,
        { passwordActual, passwordNueva }
      )
    );

    const actual = this.usuario();

    if (actual) {
      this.persistirUsuario({
        ...actual,
        requiereCambioPassword: false
      });
    }
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.usuario.set(null);
  }

  token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  estaLogueado(): boolean {
    return Boolean(this.token());
  }

  tieneRol(...roles: readonly RolSistema[]): boolean {
    const rol = this.usuario()?.rol;
    return rol ? roles.includes(rol) : false;
  }

  tieneModulo(modulo: ModuloSigo): boolean {
    return this.usuario()?.modulos.includes(modulo) ?? false;
  }

  requiereCambio(): boolean {
    return this.usuario()?.requiereCambioPassword === true;
  }

  /**
   * Selecciona una pantalla de entrada que cumpla con rol y módulo habilitado.
   * La navegación nunca debe asumir que todos tienen acceso a Dashboard.
   */
  rutaInicio(): string {
    if (!this.estaLogueado()) return '/login';
    if (this.requiereCambio()) return '/cambiar-password';

    if (this.tieneRol('OPERADOR')) {
      if (this.tieneModulo('MI_HORARIO')) return '/programacion/mi-horario';
      if (this.tieneModulo('RELEVOS')) return '/relevos/nuevo';
      if (this.tieneModulo('INVENTARIO')) return '/inventario/nuevo';
      if (this.tieneModulo('INCIDENCIAS')) return '/incidencias/nueva';
      return '/acceso-pendiente';
    }

    if (this.tieneRol('SUPERVISOR', 'CONTROLADOR')) {
      if (this.tieneModulo('DASHBOARD')) return '/dashboard';
      if (this.tieneModulo('MI_HORARIO')) return '/programacion/mi-horario';
      if (this.tieneModulo('ASISTENCIA')) return '/asistencia/registrar';
      if (this.tieneModulo('DISTRIBUCION')) return '/programacion/distribucion';
      if (this.tieneRol('SUPERVISOR') && this.tieneModulo('PROGRAMACION')) {
        return '/programacion/turnos';
      }
      if (this.tieneModulo('RELEVOS')) return '/relevos/nuevo';
      if (this.tieneModulo('INVENTARIO')) return '/inventario/nuevo';
      if (this.tieneModulo('INCIDENCIAS')) return '/incidencias/nueva';
      if (this.tieneModulo('ADMIN_PRODUCTOS')) return '/inventario/productos';
      if (this.tieneRol('SUPERVISOR') && this.tieneModulo('TRABAJADORES')) {
        return '/usuarios/contrasenas';
      }
    }

    return '/acceso-pendiente';
  }

  private persistirUsuario(usuario: UsuarioSesion): void {
    localStorage.setItem(
      this.userKey,
      JSON.stringify(usuario)
    );
    this.usuario.set(usuario);
  }

  private readUser(): UsuarioSesion | null {
    try {
      const raw = localStorage.getItem(this.userKey);

      if (!raw) {
        return null;
      }

      return this.normalizarUsuario(
        JSON.parse(raw) as UsuarioSesion
      );
    } catch {
      return null;
    }
  }

  private normalizarUsuario(
    usuario: UsuarioSesion
  ): UsuarioSesion {
    const modulos = Array.isArray(usuario.modulos)
      ? usuario.modulos.filter(
          (modulo): modulo is ModuloSigo =>
            typeof modulo === 'string' &&
            esModuloSigo(modulo)
        )
      : [];

    return {
      ...usuario,
      trabajadorId:
        usuario.trabajadorId ??
        usuario.id,
      modulos: [...new Set(modulos)]
    };
  }
}
