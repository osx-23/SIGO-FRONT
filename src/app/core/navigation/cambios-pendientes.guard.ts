import {
  CanDeactivateFn
} from '@angular/router';

export interface ProtegeCambiosPendientes {
  tieneCambiosPendientes(): boolean;
  confirmarSalidaConCambios(): Promise<boolean>;
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

      return componente
        .confirmarSalidaConCambios();
    };
