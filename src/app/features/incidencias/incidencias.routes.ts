import { Routes } from '@angular/router';
import { moduleGuard, roleGuard } from '../../core/auth/guards';

export const INCIDENCIAS_ROUTES: Routes = [
  {
    path: 'incidencias/nueva',
    canActivate: [
      moduleGuard('INCIDENCIAS'),
      roleGuard('SUPERVISOR', 'CONTROLADOR', 'OPERADOR')
    ],
    loadComponent: () =>
      import('./pages/nueva/incidencia-nueva.component')
        .then(m => m.IncidenciaNuevaComponent)
  },
  {
    path: 'incidencias/historial',
    canActivate: [
      moduleGuard('INCIDENCIAS'),
      roleGuard('SUPERVISOR', 'CONTROLADOR', 'OPERADOR')
    ],
    loadComponent: () =>
      import('./pages/historial/incidencia-historial.component')
        .then(m => m.IncidenciaHistorialComponent)
  }
];
