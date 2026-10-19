import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-acceso-pendiente',
  standalone: true,
  template: `
    <main class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-xl font-black text-blue-700">
          S
        </div>
        <h1 class="text-2xl font-extrabold text-slate-900">Acceso pendiente</h1>
        <p class="mt-3 text-sm leading-6 text-slate-600">
          Tu sesión está activa, pero aún no tienes una sección habilitada para ingresar.
          Comunícate con tu supervisor para que revise tus permisos en SIGO.
        </p>
        <button type="button" (click)="cerrarSesion()"
          class="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          Cerrar sesión
        </button>
      </section>
    </main>
  `
})
export class AccesoPendienteComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async cerrarSesion(): Promise<void> {
    this.auth.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
