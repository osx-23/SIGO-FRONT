import { Injectable, signal } from '@angular/core';

/**
 * Estado visual temporal para centrar una operación en la pantalla.
 * No altera la ruta ni los datos de la distribución.
 */
@Injectable({ providedIn: 'root' })
export class ModoConcentracionService {
  readonly activo = signal(false);

  activar(): void {
    this.activo.set(true);
  }

  desactivar(): void {
    this.activo.set(false);
  }
}
