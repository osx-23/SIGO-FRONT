import { Routes } from '@angular/router';
import { moduleGuard, roleGuard } from '../../core/auth/guards';

export const RELEVOS_ROUTES: Routes = [
  {
    path: 'relevos/nuevo',
    canActivate: [
      moduleGuard('RELEVOS'),
      roleGuard('SUPERVISOR', 'CONTROLADOR', 'OPERADOR')
    ],
    loadComponent: () =>
      import('./pages/nuevo/relevo-nuevo.component')
        .then(m => m.RelevoNuevoComponent)
  },
  {
    path: 'relevos/historial',
    canActivate: [
      moduleGuard('RELEVOS'),
      roleGuard('SUPERVISOR', 'CONTROLADOR', 'OPERADOR')
    ],
    loadComponent: () =>
      import('./pages/historial/relevo-historial.component')
        .then(m => m.RelevoHistorialComponent)
  },
  {
    path: 'relevos/editar/:id',
    canActivate: [
      moduleGuard('RELEVOS'),
      roleGuard('SUPERVISOR', 'CONTROLADOR')
    ],
    loadComponent: () =>
      import('./pages/editar/relevo-editar.component')
        .then(m => m.RelevoEditarComponent)
  },
  {
    path: 'relevos/:id',
    canActivate: [
      moduleGuard('RELEVOS'),
      roleGuard('SUPERVISOR', 'CONTROLADOR', 'OPERADOR')
    ],
    loadComponent: () =>
      import('./pages/detalle/relevo-detalle.component')
        .then(m => m.RelevoDetalleComponent)
  }
];
