import { Component, Input, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-inventario-section-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3"
         [attr.aria-label]="seccion === 'stock' ? 'Secciones de stock' : 'Secciones de movimientos'">
      @if (seccion === 'stock') {
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          @if (puedeConsultarInventario()) {
            <a class="inventario-subtab simple" routerLink="/inventario/stock" routerLinkActive="is-active"
               [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
              Stock actual
            </a>
            <a class="inventario-subtab simple" routerLink="/inventario/tendencias" routerLinkActive="is-active"
               [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
              Tendencias
            </a>
          }
          @if (puedeAdministrarProductos()) {
            <a class="inventario-subtab simple col-span-2 sm:col-span-1"
               routerLink="/inventario/productos" routerLinkActive="is-active"
               [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
              Administrar productos
            </a>
          }
        </div>
      } @else {
        <div class="grid grid-cols-2 gap-2">
          <a class="inventario-subtab" routerLink="/inventario/historial" routerLinkActive="is-active"
             [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
            <span class="tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="4" width="14" height="17" rx="2"/>
                <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h4"/>
              </svg>
            </span>
            <span class="min-w-0">
              <span class="tab-title">Historial</span>
              <span class="tab-description">Consulta los inventarios registrados</span>
            </span>
          </a>
          <a class="inventario-subtab" routerLink="/inventario/traslados" routerLinkActive="is-active"
             [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
            <span class="tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="7" width="7" height="7" rx="1"/>
                <path d="M14 8h6m-2-2 2 2-2 2M10 18H4m2-2-2 2 2 2"/>
                <rect x="13" y="12" width="7" height="7" rx="1"/>
              </svg>
            </span>
            <span class="min-w-0">
              <span class="tab-title">Traslados entre plazas</span>
              <span class="tab-description">Seguimiento y recepción de materiales</span>
            </span>
          </a>
        </div>
      }
    </nav>
  `,
  styles: [`
    :host { display: block; }
    .inventario-subtab {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 6px;
      min-height: 92px;
      min-width: 0;
      padding: 12px 9px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #fff;
      color: #475569;
      text-align: center;
      text-decoration: none;
      transition: background-color .15s, border-color .15s, color .15s, box-shadow .15s;
    }
    .inventario-subtab:hover:not(.is-active) {
      border-color: #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
    }
    .inventario-subtab.is-active {
      border-color: #2563eb;
      background: #2563eb;
      color: white;
      box-shadow: 0 4px 12px rgba(37,99,235,.14);
    }
    .inventario-subtab:focus-visible {
      outline: 3px solid #93c5fd;
      outline-offset: 2px;
    }
    .tab-icon {
      display: flex;
      width: 33px;
      height: 33px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      background: #eff6ff;
      color: #2563eb;
    }
    .tab-icon svg { width: 19px; height: 19px; }
    .inventario-subtab.is-active .tab-icon { background: rgba(255,255,255,.17); color: white; }
    .tab-title { display: block; font-size: 12px; line-height: 1.35; font-weight: 800; }
    .tab-description { display: block; margin-top: 4px; font-size: 10px; font-weight: 500; line-height: 1.4; opacity: .85; }
    .inventario-subtab.simple { min-height: 52px; font-weight: 750; font-size: 13px; }
    @media (min-width: 640px) {
      .inventario-subtab:not(.simple) {
        min-height: 82px;
        flex-direction: row;
        justify-content: flex-start;
        gap: 12px;
        padding: 14px 16px;
        text-align: left;
      }
      .tab-icon { width: 42px; height: 42px; border-radius: 10px; }
      .tab-icon svg { width: 22px; height: 22px; }
      .tab-title { font-size: 14px; }
      .tab-description { font-size: 11px; }
    }
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
