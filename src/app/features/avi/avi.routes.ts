import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/guards';

export const AVI_ROUTES: Routes = [
  {
    path: 'avi/placas',
    canActivate: [roleGuard('SUPERVISOR', 'CONTROLADOR', 'OPERADOR')],
    loadComponent: () =>
      import('./pages/placas/avi-placas.component')
        .then(m => m.AviPlacasComponent)
  }
];
