import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Plaza, Turno } from '../../asistencia/models/asistencia.models';
import { PrediccionAsistenciaApiService } from './prediccion-asistencia-api.service';
import { PrediccionAsistenciaResponse, ProyeccionFinMesResponse } from './prediccion-asistencia.models';

@Component({
  selector: 'app-prediccion-asistencia',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prediccion-asistencia.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrediccionAsistenciaComponent implements OnInit {
  readonly plazas = input.required<Plaza[]>();
  readonly turnos = input.required<Turno[]>();
  readonly plazaInicial = input<number | null>(null);

  private readonly api = inject(PrediccionAsistenciaApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly plazaId = signal<number | null>(null);
  readonly turnoId = signal<number | null>(null);
  readonly fecha = signal(this.fechaLocal(1));
  readonly programados = signal('');
  readonly cargando = signal(false);
  readonly mensajeError = signal('');
  readonly resultado = signal<PrediccionAsistenciaResponse | null>(null);

  readonly turnoProyeccionId = signal<number | null>(null);
  readonly cargandoMes = signal(false);
  readonly errorMes = signal('');
  readonly proyeccion = signal<ProyeccionFinMesResponse | null>(null);

  readonly diasProyectados = computed(() => {
    const resumen = new Map<string, { fecha: string; programados: number; ausencias: number; cobertura: number }>();
    for (const fila of this.proyeccion()?.detalle ?? []) {
      if (fila.estado !== 'PROYECTADO' || fila.programados === null ||
          fila.ausenciasEstimadas === null || fila.coberturaEstimada === null) continue;
      const actual = resumen.get(fila.fecha) ?? {
        fecha: fila.fecha, programados: 0, ausencias: 0, cobertura: 0
      };
      actual.programados += fila.programados;
      actual.ausencias += fila.ausenciasEstimadas;
      actual.cobertura += fila.coberturaEstimada;
      resumen.set(fila.fecha, actual);
    }
    return [...resumen.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  });

  readonly hoy = this.fechaLocal(0);
  readonly coberturaPorcentaje = computed(() => {
    const dato = this.resultado();
    if (!dato || dato.programados === 0) return 0;
    return Math.max(0, Math.min(100,
      Math.round(dato.coberturaEstimada * 100 / dato.programados)));
  });

  readonly disponible = computed(() => {
    const p = this.programados().trim();
    const cantidad = Number(p);
    return !this.cargando()
      && this.plazaId() !== null
      && this.turnoId() !== null
      && this.fecha() >= this.hoy
      && /^\d+$/.test(p)
      && Number.isSafeInteger(cantidad)
      && cantidad > 0;
  });

  ngOnInit(): void {
    this.plazaId.set(
      this.plazaInicial() ?? this.plazas().find(plaza => plaza.activo)?.id ?? null
    );
    this.turnoId.set(this.turnos().find(turno => turno.codigo.trim() === 'B')?.id
      ?? this.turnos()[0]?.id ?? null);
  }

  cambiarPlaza(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.plazaId.set(value ? Number(value) : null);
    this.limpiarResultado();
    this.limpiarProyeccion();
  }

  cambiarTurno(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.turnoId.set(value ? Number(value) : null);
    this.limpiarResultado();
  }

  cambiarFecha(event: Event): void {
    this.fecha.set((event.target as HTMLInputElement).value);
    this.limpiarResultado();
  }

  cambiarProgramados(event: Event): void {
    this.programados.set((event.target as HTMLInputElement).value);
    this.limpiarResultado();
  }

  consultar(): void {
    if (!this.disponible()) {
      this.mensajeError.set('Selecciona plaza, turno, una fecha futura y una cantidad válida de programados.');
      return;
    }
    const plazaId = this.plazaId();
    const turnoId = this.turnoId();
    if (plazaId === null || turnoId === null) return;

    this.cargando.set(true);
    this.mensajeError.set('');
    this.resultado.set(null);

    this.api.predecir({
      plazaId,
      turnoId,
      fecha: this.fecha(),
      programados: Number(this.programados())
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: respuesta => {
          this.resultado.set(respuesta);
          this.cargando.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.mensajeError.set(
            error.status === 503
              ? 'El servicio de predicciones no está disponible. Verifica que SIGO-ML esté activo y configurado en SIGO-BACK.'
              : error.status === 404
                ? 'La API configurada no incluye todavía el endpoint de predicciones. Comprueba que Angular apunte a tu SIGO-BACK local.'
                : error.status === 401 || error.status === 403
                  ? 'Tu sesión no permite consultar predicciones. Inicia sesión con un rol autorizado.'
                  : 'No fue posible obtener la predicción. Intenta nuevamente.'
          );
          this.cargando.set(false);
        }
      });
  }

  cambiarTurnoProyeccion(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.turnoProyeccionId.set(value ? Number(value) : null);
    this.limpiarProyeccion();
  }

  proyectarHastaFinMes(): void {
    const plazaId = this.plazaId();
    if (plazaId === null || this.cargandoMes()) {
      this.errorMes.set('Selecciona una plaza para consultar la programación restante del mes.');
      return;
    }
    this.cargandoMes.set(true);
    this.errorMes.set('');
    this.proyeccion.set(null);

    this.api.proyectarFinMes(plazaId, this.turnoProyeccionId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: respuesta => {
          this.proyeccion.set(respuesta);
          this.cargandoMes.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMes.set(
            error.status === 503
              ? 'SIGO-ML no está disponible. Revisa la conexión configurada en SIGO-BACK.'
              : error.status === 404
                ? 'SIGO-BACK aún no tiene el endpoint de proyección mensual. Actualiza el backend.'
                : error.status === 401 || error.status === 403
                  ? 'Esta consulta requiere acceso de Supervisor o Controlador.'
                  : 'No se pudo generar la proyección. Intenta nuevamente.'
          );
          this.cargandoMes.set(false);
        }
      });
  }

  private limpiarProyeccion(): void {
    this.proyeccion.set(null);
    this.errorMes.set('');
  }

  private limpiarResultado(): void {
    this.resultado.set(null);
    this.mensajeError.set('');
  }

  private fechaLocal(diasDesdeHoy: number): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + diasDesdeHoy);
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
