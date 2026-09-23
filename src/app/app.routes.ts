import { Routes } from '@angular/router';
import { authGuard, moduleGuard, passwordChangedGuard } from './core/auth/guards';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { ASISTENCIA_ROUTES } from './features/asistencia/asistencia.routes';
import { INVENTARIO_ROUTES } from './features/inventario/inventario.routes';
import { PROGRAMACION_ROUTES } from './features/programacion/programacion.routes';
import { RELEVOS_ROUTES } from './features/relevos/relevos.routes';
import { USUARIOS_ROUTES } from './features/usuarios/usuarios.routes';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component')
        .then(m => m.LoginComponent)
  },
  {
    path: 'cambiar-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/change-password/change-password.component')
        .then(m => m.ChangePasswordComponent)
  },
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./features/forbidden/forbidden.component')
        .then(m => m.ForbiddenComponent)
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [
      authGuard,
      passwordChangedGuard
    ],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        canActivate: [moduleGuard('DASHBOARD')],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component')
            .then(m => m.DashboardComponent)
      },
      ...PROGRAMACION_ROUTES,
      ...ASISTENCIA_ROUTES,
      ...RELEVOS_ROUTES,
      ...INVENTARIO_ROUTES,
      ...USUARIOS_ROUTES
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
