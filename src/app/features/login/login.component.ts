import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit, OnDestroy {
  codigo: number | null = null;
  password = '';

  readonly loading = signal(false);
  readonly error = signal('');
  readonly mostrarPassword = signal(false);
  readonly segundosRestantes = signal(0);

  private readonly prefijoBloqueo = 'sigo_login_bloqueo:';
  private codigoBloqueado: number | null = null;
  private bloqueoHasta = 0;
  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.restaurarBloqueo();
    this.temporizador = setInterval(() => this.actualizarContador(), 1000);
  }

  ngOnDestroy(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  alternarPassword(): void {
    this.mostrarPassword.update(value => !value);
  }

  alCambiarCodigo(): void {
    this.error.set('');
    this.restaurarBloqueo();
  }

  bloqueado(): boolean {
    return this.codigoBloqueado !== null
      && this.codigoBloqueado === this.codigoActual()
      && this.segundosRestantes() > 0;
  }

  minutosRestantes(): number {
    return Math.ceil(this.segundosRestantes() / 60);
  }

  tiempoRestante(): string {
    const segundos = this.segundosRestantes();
    const minutos = Math.floor(segundos / 60);
    return `${String(minutos).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
  }

  async entrar(): Promise<void> {
    this.actualizarContador();
    if (this.loading() || this.bloqueado()) return;

    const codigo = this.codigoActual();
    if (codigo === null || !this.password) {
      this.error.set('Ingresa tu código y contraseña.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await this.auth.login(codigo, this.password);
      this.eliminarBloqueoGuardado(codigo);
      this.codigoBloqueado = null;
      this.bloqueoHasta = 0;
      this.segundosRestantes.set(0);

      await this.router.navigateByUrl(
        this.auth.rutaInicio(),
        { replaceUrl: true }
      );
    } catch (e: any) {
      const segundos = Number(e?.error?.retryAfterSeconds);
      if (e?.status === 429 && Number.isFinite(segundos) && segundos > 0) {
        this.iniciarBloqueo(codigo, segundos);
        this.error.set('');
      } else {
        this.error.set(
          e?.error?.message ?? 'No se pudo iniciar sesión.'
        );
      }
    } finally {
      this.loading.set(false);
    }
  }

  private codigoActual(): number | null {
    const valor = Number(this.codigo);
    return this.codigo === null || !Number.isSafeInteger(valor) || valor <= 0
      ? null : valor;
  }

  private iniciarBloqueo(codigo: number, segundos: number): void {
    this.codigoBloqueado = codigo;
    this.bloqueoHasta = Date.now() + Math.ceil(segundos) * 1000;

    try {
      localStorage.setItem(
        this.prefijoBloqueo + codigo, String(this.bloqueoHasta)
      );
    } catch {
      // El contador sigue activo en esta pestaña aunque no haya almacenamiento.
    }

    this.actualizarContador();
  }

  private restaurarBloqueo(): void {
    this.codigoBloqueado = null;
    this.bloqueoHasta = 0;
    this.segundosRestantes.set(0);

    const codigo = this.codigoActual();
    if (codigo === null) return;

    try {
      const hasta = Number(localStorage.getItem(this.prefijoBloqueo + codigo));
      const ahora = Date.now();
      if (!Number.isFinite(hasta) || hasta <= ahora || hasta > ahora + 901_000) {
        this.eliminarBloqueoGuardado(codigo);
        return;
      }

      this.codigoBloqueado = codigo;
      this.bloqueoHasta = hasta;
      this.actualizarContador();
    } catch {
      // El navegador puede limitar el almacenamiento local.
    }
  }

  private actualizarContador(): void {
    if (this.codigoBloqueado === null) return;

    const segundos = Math.max(0, Math.ceil((this.bloqueoHasta - Date.now()) / 1000));
    this.segundosRestantes.set(segundos);

    if (segundos === 0) {
      this.eliminarBloqueoGuardado(this.codigoBloqueado);
      this.codigoBloqueado = null;
      this.bloqueoHasta = 0;
    }
  }

  private eliminarBloqueoGuardado(codigo: number): void {
    try {
      localStorage.removeItem(this.prefijoBloqueo + codigo);
    } catch {
      // La falta de almacenamiento no impide iniciar sesión.
    }
  }
}
