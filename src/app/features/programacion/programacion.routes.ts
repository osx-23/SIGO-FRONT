import { Routes } from '@angular/router';
import { moduleGuard, roleGuard } from '../../core/auth/guards';
import { cambiosPendientesGuard } from '../../core/navigation/cambios-pendientes.guard';

export const PROGRAMACION_ROUTES: Routes = [
  {
    path: 'programacion/generador-casetas',
    canActivate: [
      moduleGuard('PROGRAMACION'),
      roleGuard('SUPERVISOR')
    ],
    loadComponent: () =>
      import('./pages/generador-casetas/generador-asignacion-casetas.component')
        .then(m => m.GeneradorAsignacionCasetasComponent)
  },
  {
    path: 'programacion/turnos',
    canActivate: [
      moduleGuard('PROGRAMACION'),
      roleGuard('SUPERVISOR')
    ],
    canDeactivate: [
      cambiosPendientesGuard
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
    canDeactivate: [
      cambiosPendientesGuard
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
