import { Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
  // La sesión sobrevive al F5, pero no se guarda permanentemente en localStorage.
  private readonly tokenKey = 'sigo_sesion_token';
  private readonly usuarioKey = 'sigo_sesion_usuario';
  private accessToken: string | null = null;
  private bienvenidaAgentePendiente = false;
  private restauracionPendiente: Promise<UsuarioSesion | null> | null = null;
  readonly usuario = signal<UsuarioSesion | null>(null);

  constructor(private readonly http: HttpClient) {
    try {
      // El almacenamiento de sesión se conserva al recargar la misma pestaña.
      this.accessToken = sessionStorage.getItem(this.tokenKey);
      const perfil = sessionStorage.getItem(this.usuarioKey);
      if (this.accessToken && perfil) {
        const guardado: unknown = JSON.parse(perfil);
        if (this.esUsuarioSesion(guardado)) {
          this.usuario.set(this.normalizarUsuario(guardado));
        }
      }

      // Limpiar cualquier formato antiguo que almacenaba tokens de forma persistente.
      localStorage.removeItem('sigo_token');
      localStorage.removeItem('sigo_usuario');
    } catch {
      // Si el navegador bloquea el almacenamiento, el inicio de sesión en memoria sigue funcionando.
    }
  }

  async login(codigo: number, password: string): Promise<LoginResponse> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(
        `${environment.apiUrl}/auth/login`,
        { codigo, password }
      )
    );

    this.accessToken = response.token;

    const usuario = this.normalizarUsuario({
      ...response.usuario,
      requiereCambioPassword:
        response.requiereCambioPassword ??
        response.usuario.requiereCambioPassword ??
        false
    });

    this.persistirUsuario(usuario);
    this.bienvenidaAgentePendiente = true;

    return {
      ...response,
      usuario
    };
  }

  restore(): Promise<UsuarioSesion | null> {
    const token = this.token();
    if (!token) return Promise.resolve(null);
    if (this.restauracionPendiente) return this.restauracionPendiente;

    // Verifica permisos actuales en el backend antes de la primera navegación.
    // Un fallo transitorio de red no debe borrar una sesión previamente válida.
    this.restauracionPendiente = (async () => {
      try {
        const response = await firstValueFrom(
          this.http.get<UsuarioSesion>(`${environment.apiUrl}/auth/me`)
        );

        if (this.token() !== token) return null;

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
      } catch (error) {
        if (this.token() !== token) return null;
        if (error instanceof HttpErrorResponse &&
            (error.status === 401 || error.status === 403)) {
          this.logout();
          return null;
        }
        // Permite reintentar la conexión sin pedir credenciales por un corte de red.
        return this.usuario();
      } finally {
        this.restauracionPendiente = null;
      }
    })();

    return this.restauracionPendiente;
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

    const codigo = this.usuario()?.codigo;
    this.logout();
    if (codigo == null) {
      throw new Error('Inicia sesión nuevamente con tu nueva contraseña');
    }
    await this.login(codigo, passwordNueva);
  }

  logout(): void {
    this.accessToken = null;
    this.bienvenidaAgentePendiente = false;
    this.usuario.set(null);
    try {
      sessionStorage.removeItem(this.tokenKey);
      sessionStorage.removeItem(this.usuarioKey);
      localStorage.removeItem('sigo_token');
      localStorage.removeItem('sigo_usuario');
    } catch {
      // La sesión en memoria se cierra aunque el almacenamiento no esté disponible.
    }
  }

  /** Se consume una sola vez por inicio de sesión, exclusivamente en Inicio del agente. */
  consumirBienvenidaAgente(): boolean {
    if (!this.tieneRol('OPERADOR') || !this.bienvenidaAgentePendiente) {
      return false;
    }
    this.bienvenidaAgentePendiente = false;
    return true;
  }

  token(): string | null {
    return this.accessToken;
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
      const tieneAccesos = ([
        'MI_HORARIO',
        'INVENTARIO',
        'RELEVOS',
        'INCIDENCIAS'
      ] as const).some(modulo => this.tieneModulo(modulo));
      return tieneAccesos ? '/agente/inicio' : '/acceso-pendiente';
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
    this.usuario.set(usuario);
    if (!this.accessToken) return;

    try {
      sessionStorage.setItem(this.tokenKey, this.accessToken);
      sessionStorage.setItem(this.usuarioKey, JSON.stringify(usuario));
    } catch {
      // El inicio de sesión sigue disponible en memoria si el almacenamiento está bloqueado.
    }
  }

  private esUsuarioSesion(valor: unknown): valor is UsuarioSesion {
    if (!valor || typeof valor !== 'object') return false;
    const usuario = valor as Partial<UsuarioSesion>;
    return typeof usuario.id === 'number' &&
      typeof usuario.codigo === 'number' &&
      typeof usuario.nombre === 'string' &&
      (usuario.rol === 'OPERADOR' ||
       usuario.rol === 'CONTROLADOR' ||
       usuario.rol === 'SUPERVISOR') &&
      Array.isArray(usuario.modulos);
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
