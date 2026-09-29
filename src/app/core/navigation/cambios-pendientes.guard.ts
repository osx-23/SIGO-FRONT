import {
  CanDeactivateFn
} from '@angular/router';

export interface ProtegeCambiosPendientes {
  tieneCambiosPendientes(): boolean;
  mensajeCambiosPendientes(): string;
}

export const cambiosPendientesGuard:
  CanDeactivateFn<ProtegeCambiosPendientes> =
    (
      componente
    ) => {

      if (
        !componente
          .tieneCambiosPendientes()
      ) {
        return true;
      }

      return window.confirm(
        componente
          .mensajeCambiosPendientes()
      );
    };
