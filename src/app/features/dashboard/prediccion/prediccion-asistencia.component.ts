import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Plaza, Turno } from '../../asistencia/models/asistencia.models';
import { PrediccionAsistenciaApiService } from './prediccion-asistencia-api.service';
import { ProyeccionFinMesResponse } from './prediccion-asistencia.models';

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
  readonly turnoProyeccionId = signal<number | null>(null);
  readonly modoGraficoProyeccion = signal<'RESTANTE' | 'MES'>('RESTANTE');
  readonly indiceHoverProyeccion = signal<number | null>(null);
  readonly escalaGraficoProyeccion = [1, 0.75, 0.5, 0.25, 0];
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


  /**
   * La proyección solo contiene fechas futuras. En modo MES se muestran
   * los días anteriores sin puntos, para no presentar predicciones como datos reales.
   */
  readonly puntosGraficoProyeccion = computed(() => {
    const resultado = this.proyeccion();
    if (!resultado) return [] as {
      fecha: string; dia: number; programados: number | null;
      cobertura: number | null; ausencias: number | null;
    }[];

    const desde = this.modoGraficoProyeccion() === 'MES'
      ? 1 : Number(resultado.desde.slice(8, 10));
    const ultimo = Number(resultado.hasta.slice(8, 10));
    const mes = resultado.hasta.slice(0, 7);
    const porFecha = new Map(this.diasProyectados().map(d => [d.fecha, d]));

    return Array.from({ length: Math.max(0, ultimo - desde + 1) }, (_, i) => {
      const dia = desde + i;
      const fecha = `${mes}-${String(dia).padStart(2, '0')}`;
      const dato = porFecha.get(fecha);
      return {
        fecha,
        dia,
        programados: dato?.programados ?? null,
        cobertura: dato?.cobertura ?? null,
        ausencias: dato?.ausencias ?? null
      };
    });
  });

  readonly maximoGraficoProyeccion = computed(() => {
    const maximo = Math.max(0, ...this.puntosGraficoProyeccion().map(p => p.programados ?? 0));
    return Math.max(5, Math.ceil(maximo / 5) * 5);
  });

  readonly periodoGraficoProyeccion = computed(() => {
    const proyeccion = this.proyeccion();
    if (!proyeccion) return '';
    const [anio, mes] = proyeccion.fechaConsulta.split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, 1));
    const periodo = new Intl.DateTimeFormat('es-PE', {
      month: 'long', year: 'numeric', timeZone: 'UTC'
    }).format(fecha);
    return periodo.charAt(0).toUpperCase() + periodo.slice(1);
  });

  ngOnInit(): void {
    this.plazaId.set(
      this.plazaInicial() ?? this.plazas().find(plaza => plaza.activo)?.id ?? null
    );
  }

  cambiarPlaza(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.plazaId.set(value ? Number(value) : null);
    this.limpiarProyeccion();
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
    this.indiceHoverProyeccion.set(null);

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


  cambiarModoGraficoProyeccion(modo: 'RESTANTE' | 'MES'): void {
    this.modoGraficoProyeccion.set(modo);
    this.indiceHoverProyeccion.set(null);
  }

  graficoProyeccionX(indice: number, total: number): number {
    return total <= 1 ? 517 : 54 + indice * 926 / (total - 1);
  }

  graficoProyeccionY(valor: number): number {
    return 238 - Math.max(0, Math.min(this.maximoGraficoProyeccion(), valor))
      * 220 / this.maximoGraficoProyeccion();
  }

  graficoProyeccionTick(factor: number): number {
    return Math.round(this.maximoGraficoProyeccion() * factor);
  }

  graficoProyeccionTooltipX(indice: number, total: number): number {
    const x = this.graficoProyeccionX(indice, total);
    return x > 790 ? x - 182 : x + 14;
  }

  private segmentosGraficoProyeccion(key: 'programados' | 'cobertura'): { x: number; y: number }[][] {
    const puntos = this.puntosGraficoProyeccion();
    const segmentos: { x: number; y: number }[][] = [];
    let actual: { x: number; y: number }[] = [];

    for (let i = 0; i < puntos.length; i++) {
      const valor = puntos[i][key];
      if (valor === null) {
        if (actual.length) segmentos.push(actual);
        actual = [];
        continue;
      }
      actual.push({
        x: this.graficoProyeccionX(i, puntos.length),
        y: this.graficoProyeccionY(valor)
      });
    }
    if (actual.length) segmentos.push(actual);
    return segmentos;
  }

  lineaGraficoProyeccion(key: 'programados' | 'cobertura'): string {
    return this.segmentosGraficoProyeccion(key)
      .map(segmento => 'M ' + segmento.map(p => `${p.x},${p.y}`).join(' L '))
      .join(' ');
  }

  areaGraficoProyeccion(key: 'programados' | 'cobertura'): string {
    return this.segmentosGraficoProyeccion(key)
      .map(segmento => `M ${segmento[0].x},238 L ${segmento
        .map(p => `${p.x},${p.y}`).join(' L ')} L ${segmento[segmento.length - 1].x},238 Z`)
      .join(' ');
  }

  private limpiarProyeccion(): void {
    this.indiceHoverProyeccion.set(null);
    this.proyeccion.set(null);
    this.errorMes.set('');
  }
}
