import { Routes } from '@angular/router';
import { moduleGuard, roleGuard } from '../../core/auth/guards';

export const PROGRAMACION_ROUTES: Routes = [
  {
    path: 'programacion/turnos',
    canActivate: [
      moduleGuard('PROGRAMACION'),
      roleGuard('SUPERVISOR')
    ],
    loadComponent: () =>
      import('./pages/supervisor/programacion-supervisor.component')
        .then(m => m.ProgramacionSupervisorComponent)
  },
  {
    path: 'programacion/distribucion',
    canActivate: [
      moduleGuard('DISTRIBUCION'),
      roleGuard('SUPERVISOR', 'CONTROLADOR')
    ],
    loadComponent: () =>
      import('./pages/controlador/distribucion-controlador.component')
        .then(m => m.DistribucionControladorComponent)
  },
  {
    path: 'programacion/mi-horario',
    canActivate: [
      moduleGuard('MI_HORARIO'),
      roleGuard('SUPERVISOR', 'CONTROLADOR', 'OPERADOR')
    ],
    loadComponent: () =>
      import('./pages/agente/mi-horario.component')
        .then(m => m.MiHorarioComponent)
  }
];
