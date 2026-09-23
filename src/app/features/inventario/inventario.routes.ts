import { Routes } from '@angular/router';
import { moduleGuard, roleGuard } from '../../core/auth/guards';

export const INVENTARIO_ROUTES: Routes = [
  {
    path: 'inventario/nuevo',
    canActivate: [
      moduleGuard('INVENTARIO'),
      roleGuard('SUPERVISOR', 'CONTROLADOR', 'OPERADOR')
    ],
    loadComponent: () =>
      import('./pages/nuevo-inventario/nuevo-inventario.component')
        .then(m => m.NuevoInventarioComponent)
  },
  {
    path: 'inventario/historial',
    canActivate: [
      moduleGuard('INVENTARIO'),
      roleGuard('SUPERVISOR', 'CONTROLADOR')
    ],
    loadComponent: () =>
      import('./pages/historial/historial.component')
        .then(m => m.HistorialComponent)
  },
  {
    path: 'inventario/stock',
    canActivate: [
      moduleGuard('INVENTARIO'),
      roleGuard('SUPERVISOR', 'CONTROLADOR')
    ],
    loadComponent: () =>
      import('./pages/stock/stock.component')
        .then(m => m.StockComponent)
  },
  {
    path: 'inventario/productos',
    canActivate: [
      moduleGuard('ADMIN_PRODUCTOS'),
      roleGuard('SUPERVISOR', 'CONTROLADOR')
    ],
    loadComponent: () =>
      import('./pages/productos/productos.component')
        .then(m => m.ProductosComponent)
  }
];
