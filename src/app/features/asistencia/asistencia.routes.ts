import { Routes } from '@angular/router';
import { moduleGuard, roleGuard } from '../../core/auth/guards';

export const ASISTENCIA_ROUTES: Routes = [
  {
    path: 'asistencia/registrar',
    canActivate: [
      moduleGuard('ASISTENCIA'),
      roleGuard('SUPERVISOR', 'CONTROLADOR')
    ],
    loadComponent: () =>
      import('./pages/registrar/asistencia-form.component')
        .then(m => m.AsistenciaFormComponent)
  },
  {
    path: 'asistencia/historial',
    canActivate: [
      moduleGuard('ASISTENCIA'),
      roleGuard('SUPERVISOR', 'CONTROLADOR')
    ],
    loadComponent: () =>
      import('./pages/historial/asistencia-history.component')
        .then(m => m.AsistenciaHistoryComponent)
  },
  {
    path: 'asistencia/historial/editar/:id',
    canActivate: [
      moduleGuard('ASISTENCIA'),
      roleGuard('SUPERVISOR', 'CONTROLADOR')
    ],
    loadComponent: () =>
      import('./pages/editar/asistencia-edit.component')
        .then(m => m.AsistenciaEditComponent)
  }
];
