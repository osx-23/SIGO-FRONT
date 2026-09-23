import { Routes } from '@angular/router';
import { moduleGuard, roleGuard } from '../../core/auth/guards';

export const USUARIOS_ROUTES: Routes = [
  {
    path: 'usuarios/contrasenas',
    canActivate: [
      moduleGuard('TRABAJADORES'),
      roleGuard('SUPERVISOR')
    ],
    loadComponent: () =>
      import('./password-admin/password-admin.component')
        .then(m => m.PasswordAdminComponent)
  }
];
