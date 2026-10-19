import { Component, Input, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-inventario-section-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3"
         [attr.aria-label]="seccion === 'stock' ? 'Pestañas de stock' : 'Pestañas de movimientos'">
      @if (seccion === 'stock') {
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          @if (puedeConsultarInventario()) {
            <a class="inventario-subtab " routerLink="/inventario/stock" routerLinkActive="is-active"
               [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
              Stock actual
            </a>
            <a class="inventario-subtab " routerLink="/inventario/tendencias" routerLinkActive="is-active"
               [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
              Tendencias
            </a>
          }
          @if (puedeAdministrarProductos()) {
            <a class="inventario-subtab col-span-2 sm:col-span-1" routerLink="/inventario/productos" routerLinkActive="is-active"
               [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
              Administrar productos
            </a>
          }
        </div>
      } @else {
        <div class="grid grid-cols-2 gap-2">
          
            <a class="inventario-subtab " routerLink="/inventario/historial" routerLinkActive="is-active"
               [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
              Historial
            </a>
          
            <a class="inventario-subtab " routerLink="/inventario/traslados" routerLinkActive="is-active"
               [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
              Traslados entre plazas
            </a>
        </div>
      }
    </nav>
  `,
  styles: [`
    :host { display: block; }
    .inventario-subtab {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      min-width: 0;
      padding: 10px 12px;
      border-radius: 11px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #475569;
      font-size: 13px;
      font-weight: 750;
      line-height: 1.35;
      text-align: center;
      text-decoration: none;
      transition: background-color 150ms, border-color 150ms, color 150ms, box-shadow 150ms;
    }
    .inventario-subtab:hover:not(.is-active) {
      border-color: #bfdbfe; background: #eff6ff; color: #1d4ed8;
    }
    .inventario-subtab.is-active {
      border-color: #2563eb; background: #2563eb; color: #fff;
      box-shadow: 0 3px 9px rgba(37,99,235,.16);
    }
    .inventario-subtab:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
    @media (max-width: 400px) { .inventario-subtab { font-size: 12px; padding: 10px 8px; } }
  `]
})
export class InventarioSectionTabsComponent {
  @Input({ required: true }) seccion!: 'stock' | 'movimientos';
  private readonly auth = inject(AuthService);

  puedeConsultarInventario(): boolean {
    return this.auth.tieneModulo('INVENTARIO') && this.auth.tieneRol('SUPERVISOR', 'CONTROLADOR');
  }

  puedeAdministrarProductos(): boolean {
    return this.auth.tieneModulo('ADMIN_PRODUCTOS') && this.auth.tieneRol('SUPERVISOR', 'CONTROLADOR');
  }
}
