import { Component, signal } from '@angular/core';
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
export class LoginComponent {
  codigo: number | null = null;
  password = '';

  readonly loading = signal(false);
  readonly error = signal('');
  readonly mostrarPassword = signal(false);

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  alternarPassword(): void {
    this.mostrarPassword.update(value => !value);
  }

  async entrar(): Promise<void> {
    if (!this.codigo || !this.password) {
      this.error.set('Ingresa tu código y contraseña.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await this.auth.login(
        this.codigo,
        this.password
      );

      if (this.auth.requiereCambio()) {
        this.router.navigateByUrl('/cambiar-password');
      } else if (this.auth.tieneRol('OPERADOR')) {
        this.router.navigateByUrl('/programacion/mi-horario');
      } else {
        this.router.navigateByUrl('/');
      }
    } catch (e: any) {
      this.error.set(
        e?.error?.message
          ?? 'No se pudo iniciar sesión.'
      );
    } finally {
      this.loading.set(false);
    }
  }
}
