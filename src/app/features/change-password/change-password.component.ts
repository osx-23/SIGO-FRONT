import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './change-password.component.html'
})
export class ChangePasswordComponent {
  actual = '';
  nueva = '';
  confirmar = '';

  readonly error = signal('');
  readonly loading = signal(false);
  readonly mostrarActual = signal(false);
  readonly mostrarNueva = signal(false);
  readonly mostrarConfirmar = signal(false);

  constructor(
    public readonly auth: AuthService,
    private readonly router: Router
  ) {}

  get longitudValida(): boolean {
    return this.nueva.length >= 8 && this.nueva.length <= 72;
  }

  get coincidenciaValida(): boolean {
    return this.confirmar.length > 0 && this.nueva === this.confirmar;
  }

  get puedeGuardar(): boolean {
    return this.actual.length > 0 &&
      this.longitudValida &&
      this.coincidenciaValida &&
      !this.loading();
  }

  limpiarError(): void {
    if (this.error()) this.error.set('');
  }

  alternarCampo(campo: 'actual' | 'nueva' | 'confirmar'): void {
    if (campo === 'actual') this.mostrarActual.update(valor => !valor);
    if (campo === 'nueva') this.mostrarNueva.update(valor => !valor);
    if (campo === 'confirmar') this.mostrarConfirmar.update(valor => !valor);
  }

  async guardar(): Promise<void> {
    if (this.loading()) return;
    this.error.set('');

    if (!this.actual) {
      this.error.set('Ingresa tu contraseña actual para continuar.');
      return;
    }
    if (!this.longitudValida) {
      this.error.set('La contraseña nueva debe tener entre 8 y 72 caracteres.');
      return;
    }
    if (this.nueva !== this.confirmar) {
      this.error.set('Las nuevas contraseñas no coinciden.');
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.cambiarPassword(this.actual, this.nueva);
      this.actual = '';
      this.nueva = '';
      this.confirmar = '';
      await this.router.navigateByUrl('/');
    } catch (e: any) {
      this.error.set(
        e?.error?.message ??
        e?.error?.detail ??
        'No se pudo actualizar la contraseña. Verifica tu contraseña actual e inténtalo de nuevo.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  cerrarSesion(): void {
    if (this.loading()) return;
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
