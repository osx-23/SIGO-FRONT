import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';

import {
  AusenciaMotivo,
  DashboardPunto,
  Plaza,
  ResumenAsistencia,
  Turno
} from '../asistencia/models/asistencia.models';

import {
  AsistenciaApiService
} from '../asistencia/services/asistencia-api.service';

type PeriodoVista =
  | 'SEMANA'
  | 'MES'
  | 'ANIO';

interface ChartPoint {
  label: string;
  presentes: number | null;
  programados: number | null;
  ausentes: number;
  porcentaje: number;
}

interface MotivoDetalle {
  motivo: string;
  total: number;
  porcentaje: number;
  offset: number;
  color: string;
}

interface ResumenLocal {
  registros: number;
  presentes: number;
  programados: number;
  ausentes: number;
  porcentaje: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {

  private readonly api =
    inject(AsistenciaApiService);

  readonly auth =
    inject(AuthService);

  /*
   * ============================================================
   * ESTADO GENERAL
   * ============================================================
   */

  readonly loading =
    signal(true);

  readonly loadingAnio =
    signal(true);

  readonly error =
    signal('');

  readonly errorAnio =
    signal('');

  readonly ultimaActualizacion =
    signal<Date | null>(null);

  /*
   * ============================================================
   * CATÁLOGOS
   * ============================================================
   */

  readonly plazas =
    signal<Plaza[]>([]);

  readonly turnos =
    signal<Turno[]>([]);

  /*
   * ============================================================
   * DATOS AGREGADOS
   * ============================================================
   */

  readonly puntosDiarios =
    signal<DashboardPunto[]>([]);

  readonly puntosAnuales =
    signal<DashboardPunto[]>([]);

  readonly resumenMes =
    signal<ResumenLocal>(
      this.resumenVacio()
    );

  readonly resumenAnio =
    signal<ResumenLocal>(
      this.resumenVacio()
    );

  readonly resumenSemana =
    signal<ResumenLocal>(
      this.resumenVacio()
    );

  /*
   * ============================================================
   * ANALÍTICA POR TURNO
   * ============================================================
   */

  readonly resumenTurnoAnual =
    signal<ResumenLocal>(
      this.resumenVacio()
    );

  readonly resumenTurnoMes =
    signal<ResumenLocal>(
      this.resumenVacio()
    );

  readonly resumenTurnoMesAnterior =
    signal<ResumenLocal>(
      this.resumenVacio()
    );

  readonly motivosRaw =
    signal<AusenciaMotivo[]>([]);

  /*
   * ============================================================
   * FILTROS
   * ============================================================
   */

  private readonly ahora =
    new Date();

  readonly anio =
    signal(
      this.ahora.getFullYear()
    );

  readonly mes =
    signal(
      this.ahora.getMonth() + 1
    );

  readonly semana =
    signal(
      Math.min(
        5,
        Math.ceil(
          this.ahora.getDate() / 7
        )
      )
    );

  readonly periodoVista =
    signal<PeriodoVista>('MES');

  readonly plazaId =
    signal<number | null>(null);

  /*
   * Filtro principal.
   *
   * Afecta:
   * - gráfico
   * - resumen
   * - KPIs
   */
  readonly turnoId =
    signal<number | null>(null);

  /*
   * Filtro independiente para:
   * - asistencia por turno
   * - motivos
   */
  readonly turnoAnaliticaId =
    signal<number | null>(null);

  readonly puntoHover =
    signal<number | null>(null);

  /*
   * ============================================================
   * CONFIGURACIÓN
   * ============================================================
   */

  private readonly motivoColores = [
    '#2563eb',
    '#7c3aed',
    '#06b6d4',
    '#f59e0b',
    '#ef4444',
    '#10b981',
    '#ec4899',
    '#8b5cf6',
    '#14b8a6',
    '#f97316',
    '#84cc16',
    '#0ea5e9'
  ];

  readonly meses = [
    {
      id: 1,
      nombre: 'Enero',
      corto: 'Ene'
    },
    {
      id: 2,
      nombre: 'Febrero',
      corto: 'Feb'
    },
    {
      id: 3,
      nombre: 'Marzo',
      corto: 'Mar'
    },
    {
      id: 4,
      nombre: 'Abril',
      corto: 'Abr'
    },
    {
      id: 5,
      nombre: 'Mayo',
      corto: 'May'
    },
    {
      id: 6,
      nombre: 'Junio',
      corto: 'Jun'
    },
    {
      id: 7,
      nombre: 'Julio',
      corto: 'Jul'
    },
    {
      id: 8,
      nombre: 'Agosto',
      corto: 'Ago'
    },
    {
      id: 9,
      nombre: 'Septiembre',
      corto: 'Sep'
    },
    {
      id: 10,
      nombre: 'Octubre',
      corto: 'Oct'
    },
    {
      id: 11,
      nombre: 'Noviembre',
      corto: 'Nov'
    },
    {
      id: 12,
      nombre: 'Diciembre',
      corto: 'Dic'
    }
  ];

  readonly anios =
    Array.from(
      {
        length: 7
      },
      (_, i) =>
        this.ahora.getFullYear() - i
    );

  readonly semanas = [
    1,
    2,
    3,
    4,
    5
  ];

  readonly yTicks = [
    1,
    0.75,
    0.5,
    0.25,
    0
  ];

  /*
   * ============================================================
   * PERMISOS
   * ============================================================
   */

  readonly esSupervisor =
    computed(() =>
      this.auth.tieneRol(
        'SUPERVISOR'
      )
    );

  readonly puedeFiltrarTodasLasPlazas =
    computed(() =>
      this.auth.tieneRol(
        'SUPERVISOR',
        'CONTROLADOR'
      )
    );

  readonly plazaBloqueada =
    computed(() =>
      !this.puedeFiltrarTodasLasPlazas() &&
      !!this.auth.usuario()?.plazaId
    );

  /*
   * ============================================================
   * TEXTOS
   * ============================================================
   */

  readonly nombreMes =
    computed(() =>
      this.meses.find(
        x => x.id === this.mes()
      )?.nombre ?? 'Mes'
    );

  readonly nombreMesAnterior =
    computed(() => {

      const mes =
        this.mes() === 1
          ? 12
          : this.mes() - 1;

      return this.meses.find(
        x => x.id === mes
      )?.nombre ?? 'Mes anterior';
    });

  readonly anioMesAnterior =
    computed(() =>
      this.mes() === 1
        ? this.anio() - 1
        : this.anio()
    );

  readonly plazaSeleccionada =
    computed(() => {

      if (!this.plazaId()) {
        return 'Todas las plazas';
      }

      return (
        this.plazas()
          .find(
            x =>
              x.id === this.plazaId()
          )
          ?.codigo ??
        this.auth.usuario()?.plaza ??
        'Plaza'
      );
    });

  /*
   * ============================================================
   * RESUMEN DEL PERÍODO ACTUAL
   * ============================================================
   */

  readonly resumenPeriodo =
    computed<ResumenLocal>(() => {

      switch (
        this.periodoVista()
      ) {

        case 'SEMANA':
          return this.resumenSemana();

        case 'ANIO':
          return this.resumenAnio();

        default:
          return this.resumenMes();
      }
    });

  readonly totalRegistros =
    computed(() =>
      this.resumenPeriodo()
        .registros
    );

  readonly totalProgramados =
    computed(() =>
      this.resumenPeriodo()
        .programados
    );

  readonly totalPresentes =
    computed(() =>
      this.resumenPeriodo()
        .presentes
    );

  readonly totalAusencias =
    computed(() =>
      this.resumenPeriodo()
        .ausentes
    );

  readonly asistenciaPromedio =
    computed(() =>
      this.resumenPeriodo()
        .porcentaje
    );

  readonly asistenciaPromedioAnual =
    computed(() =>
      this.resumenAnio()
        .porcentaje
    );

  readonly variacionVsAnual =
    computed(() => {

      const actual =
        this.asistenciaPromedio();

      const anual =
        this.asistenciaPromedioAnual();

      if (!anual) {
        return 0;
      }

      return Math.round(
        (
          actual -
          anual
        ) * 10
      ) / 10;
    });

  /*
   * ============================================================
   * PERÍODO
   * ============================================================
   */

  readonly diasPeriodo =
    computed(() => {

      if (
        this.periodoVista() ===
        'ANIO'
      ) {
        return 12;
      }

      if (
        this.periodoVista() ===
        'SEMANA'
      ) {

        const rango =
          this.weekRange();

        const inicio =
          Number(
            rango.inicio.slice(
              8,
              10
            )
          );

        const fin =
          Number(
            rango.fin.slice(
              8,
              10
            )
          );

        return Math.max(
          0,
          fin - inicio + 1
        );
      }

      return new Date(
        this.anio(),
        this.mes(),
        0
      ).getDate();
    });

  readonly tituloPeriodo =
    computed(() => {

      if (
        this.periodoVista() ===
        'SEMANA'
      ) {

        return (
          `Semana ${this.semana()}` +
          ` · ${this.nombreMes()}` +
          ` ${this.anio()}`
        );
      }

      if (
        this.periodoVista() ===
        'ANIO'
      ) {

        return `Año ${this.anio()}`;
      }

      return (
        `${this.nombreMes()} ` +
        `${this.anio()}`
      );
    });

  readonly subtituloGrafica =
    computed(() => {

      if (
        this.periodoVista() ===
        'ANIO'
      ) {

        return (
          'Comparativa mensual de ' +
          'personal presente y programado.'
        );
      }

      if (
        this.periodoVista() ===
        'SEMANA'
      ) {

        return (
          'Comparativa diaria dentro ' +
          'de la semana seleccionada.'
        );
      }

      return (
        'Comparativa diaria dentro ' +
        'del mes seleccionado.'
      );
    });

  /*
   * ============================================================
   * GRÁFICO
   * ============================================================
   */

  readonly chartPoints =
    computed<ChartPoint[]>(() => {

      if (
        this.periodoVista() ===
        'ANIO'
      ) {

        return this.puntosAnio();
      }

      if (
        this.periodoVista() ===
        'SEMANA'
      ) {

        return this.puntosSemana();
      }

      return this.puntosMes();
    });

  readonly chartMax =
    computed(() => {

      const valores =
        this.chartPoints()
          .flatMap(
            p => [
              p.presentes ?? 0,
              p.programados ?? 0
            ]
          );

      const max =
        Math.max(
          ...valores,
          1
        );

      return (
        Math.ceil(
          max / 10
        ) * 10
      );
    });

  /*
   * ============================================================
   * ANALÍTICA POR TURNO
   * ============================================================
   */

  readonly turnoAnalitica =
    computed(() => {

      const id =
        this.turnoAnaliticaId();

      if (!id) {
        return null;
      }

      return (
        this.turnos()
          .find(
            t => t.id === id
          ) ?? null
      );
    });

  readonly promedioTurnoAnual =
    computed(() =>
      this.resumenTurnoAnual()
        .porcentaje
    );

  readonly promedioTurnoMes =
    computed(() =>
      this.resumenTurnoMes()
        .porcentaje
    );

  readonly promedioTurnoMesAnterior =
    computed(() =>
      this.resumenTurnoMesAnterior()
        .porcentaje
    );

  readonly registrosTurnoAnual =
    computed(() =>
      this.resumenTurnoAnual()
        .registros
    );

  readonly registrosTurnoMes =
    computed(() =>
      this.resumenTurnoMes()
        .registros
    );

  readonly registrosTurnoMesAnterior =
    computed(() =>
      this.resumenTurnoMesAnterior()
        .registros
    );

  /*
   * ============================================================
   * MOTIVOS
   * ============================================================
   */

  readonly motivos =
    computed<MotivoDetalle[]>(() => {

      const items =
        this.motivosRaw()
          .map(
            item => ({
              motivo:
                this.motivoNombre(
                  item
                ),
              total:
                this.motivoTotal(
                  item
                )
            })
          )
          .filter(
            item =>
              item.total > 0
          )
          .sort(
            (a, b) =>
              b.total -
                a.total ||
              a.motivo.localeCompare(
                b.motivo
              )
          );

      const total =
        items.reduce(
          (
            suma,
            item
          ) =>
            suma +
            item.total,
          0
        );

      let offset = 0;

      return items.map(
        (
          item,
          index
        ) => {

          const porcentaje =
            total
              ? Math.round(
                  (
                    item.total /
                    total
                  ) * 1000
                ) / 10
              : 0;

          const resultado:
            MotivoDetalle = {

            ...item,

            porcentaje,

            offset,

            color:
              this.motivoColores[
                index %
                this.motivoColores
                  .length
              ]
          };

          offset +=
            porcentaje;

          return resultado;
        }
      );
    });

  readonly totalMotivos =
    computed(() =>
      this.motivos()
        .reduce(
          (
            suma,
            item
          ) =>
            suma +
            item.total,
          0
        )
    );

  /*
   * ============================================================
   * INICIO
   * ============================================================
   */

  ngOnInit(): void {

    const usuario =
      this.auth.usuario();

    if (
      !this.puedeFiltrarTodasLasPlazas() &&
      usuario?.plazaId
    ) {

      this.plazaId.set(
        usuario.plazaId
      );
    }

    this.cargarInicial();
  }

  /*
   * ============================================================
   * CAMBIO DE PERÍODO
   * ============================================================
   */

  setPeriodo(
    periodo: PeriodoVista
  ): void {

    this.periodoVista.set(
      periodo
    );

    this.puntoHover.set(
      null
    );

    if (
      periodo ===
      'SEMANA'
    ) {

      this.cargarResumenSemana();
    }

    this.cargarMotivos();
  }

  setPuntoHover(
    index: number | null
  ): void {

    this.puntoHover.set(
      index
    );
  }

  /*
   * ============================================================
   * EVENTOS
   * ============================================================
   */

  onAnioChange(
    event: Event
  ): void {

    this.anio.set(
      +(
        event.target as
          HTMLSelectElement
      ).value
    );

    this.cargarDashboard();
  }

  onMesChange(
    event: Event
  ): void {

    this.mes.set(
      +(
        event.target as
          HTMLSelectElement
      ).value
    );

    this.semana.set(1);

    this.cargarDashboard();
  }

  onSemanaChange(
    event: Event
  ): void {

    this.semana.set(
      +(
        event.target as
          HTMLSelectElement
      ).value
    );

    this.cargarResumenSemana();

    if (
      this.periodoVista() ===
      'SEMANA'
    ) {

      this.cargarMotivos();
    }
  }

  onPlazaChange(
    event: Event
  ): void {

    if (
      this.plazaBloqueada()
    ) {
      return;
    }

    const valor =
      (
        event.target as
          HTMLSelectElement
      ).value;

    this.plazaId.set(
      valor
        ? +valor
        : null
    );

    this.cargarDashboard();
  }

  onTurnoChange(
    event: Event
  ): void {

    const valor =
      (
        event.target as
          HTMLSelectElement
      ).value;

    this.turnoId.set(
      valor
        ? +valor
        : null
    );

    /*
     * El turno principal afecta
     * los KPIs y el gráfico.
     */
    this.cargarDatosPrincipales();
  }

  onTurnoAnaliticaChange(
    event: Event
  ): void {

    const valor =
      (
        event.target as
          HTMLSelectElement
      ).value;

    this.turnoAnaliticaId.set(
      valor
        ? +valor
        : null
    );

    /*
     * Solo recargamos el bloque
     * de analítica.
     */
    this.cargarAnalitica();
  }

  actualizar(): void {

    this.cargarDashboard();
  }

  /*
   * ============================================================
   * CARGA INICIAL
   * ============================================================
   */

  private cargarInicial(): void {

    this.loading.set(true);
    this.error.set('');

    forkJoin({

      plazas:
        this.api.getPlazas(),

      turnos:
        this.api.getTurnos()

    }).subscribe({

      next: ({
        plazas,
        turnos
      }) => {

        const activas =
          plazas.filter(
            p => p.activo
          );

        this.plazas.set(
          this.plazaBloqueada()
            ? activas.filter(
                p =>
                  p.id ===
                  this.plazaId()
              )
            : activas
        );

        this.turnos.set(
          turnos
        );

        /*
         * Catálogos listos.
         * Ahora cargamos únicamente
         * información agregada.
         */
        this.cargarDashboard();
      },

      error: error =>
        this.handleError(
          error
        )
    });
  }

  /*
   * ============================================================
   * DASHBOARD COMPLETO
   * ============================================================
   */

  private cargarDashboard(): void {

    this.loading.set(true);
    this.loadingAnio.set(true);

    this.error.set('');
    this.errorAnio.set('');

    /*
     * Principal y analítica se
     * consultan independientemente.
     */
    this.cargarDatosPrincipales();
    this.cargarAnalitica();
  }

  /*
   * ============================================================
   * DATOS PRINCIPALES
   * ============================================================
   */

  private cargarDatosPrincipales(): void {

    this.loading.set(true);
    this.loadingAnio.set(true);

    const mes =
      this.mesRange();

    const anio =
      this.yearRange();

    const plazaId =
      this.plazaId();

    const turnoId =
      this.turnoId();

    forkJoin({

      diario:
        this.api.getDiario(
          this.anio(),
          this.mes(),
          plazaId,
          turnoId
        ),

      anual:
        this.api.getAnual(
          this.anio(),
          plazaId,
          turnoId
        ),

      resumenMes:
        this.api.getResumen(
          mes.inicio,
          mes.fin,
          plazaId,
          turnoId
        ),

      resumenAnio:
        this.api.getResumen(
          anio.inicio,
          anio.fin,
          plazaId,
          turnoId
        )

    }).subscribe({

      next: ({
        diario,
        anual,
        resumenMes,
        resumenAnio
      }) => {

        this.puntosDiarios.set(
          diario
        );

        this.puntosAnuales.set(
          anual
        );

        this.resumenMes.set(
          this.convertirResumen(
            resumenMes
          )
        );

        this.resumenAnio.set(
          this.convertirResumen(
            resumenAnio
          )
        );

        this.loading.set(false);
        this.loadingAnio.set(false);

        this.ultimaActualizacion.set(
          new Date()
        );

        /*
         * Semana se calcula mediante
         * una consulta de resumen pequeña.
         */
        this.cargarResumenSemana();
      },

      error: error => {

        this.loadingAnio.set(
          false
        );

        this.handleError(
          error
        );
      }
    });
  }

  /*
   * ============================================================
   * RESUMEN SEMANAL
   * ============================================================
   */

  private cargarResumenSemana(): void {

    const rango =
      this.weekRange();

    this.api.getResumen(
      rango.inicio,
      rango.fin,
      this.plazaId(),
      this.turnoId()
    ).subscribe({

      next: resumen => {

        this.resumenSemana.set(
          this.convertirResumen(
            resumen
          )
        );
      },

      error: error => {

        const x =
          error as any;

        this.error.set(
          x?.error?.message ??
          x?.message ??
          'No se pudo cargar el resumen semanal.'
        );
      }
    });
  }

  /*
   * ============================================================
   * ANALÍTICA POR TURNO
   * ============================================================
   */

  private cargarAnalitica(): void {

    const mesActual =
      this.mesRange();

    const anioActual =
      this.yearRange();

    const mesAnterior =
      this.previousMonthRange();

    const plazaId =
      this.plazaId();

    const turnoId =
      this.turnoAnaliticaId();

    forkJoin({

      anual:
        this.api.getResumen(
          anioActual.inicio,
          anioActual.fin,
          plazaId,
          turnoId
        ),

      mes:
        this.api.getResumen(
          mesActual.inicio,
          mesActual.fin,
          plazaId,
          turnoId
        ),

      anterior:
        this.api.getResumen(
          mesAnterior.inicio,
          mesAnterior.fin,
          plazaId,
          turnoId
        )

    }).subscribe({

      next: ({
        anual,
        mes,
        anterior
      }) => {

        this.resumenTurnoAnual.set(
          this.convertirResumen(
            anual
          )
        );

        this.resumenTurnoMes.set(
          this.convertirResumen(
            mes
          )
        );

        this.resumenTurnoMesAnterior.set(
          this.convertirResumen(
            anterior
          )
        );

        this.cargarMotivos();
      },

      error: error => {

        const x =
          error as any;

        this.errorAnio.set(
          x?.error?.message ??
          x?.message ??
          'No se pudo cargar la analítica por turno.'
        );
      }
    });
  }

  /*
   * ============================================================
   * MOTIVOS
   * ============================================================
   */

  private cargarMotivos(): void {

    /*
     * Con los endpoints actuales:
     *
     * MES / SEMANA:
     * motivos del mes seleccionado.
     *
     * AÑO:
     * motivos de todo el año.
     *
     * Ya no descargamos AsistenciaResponse[]
     * con sus ausencias.
     */

    const mes =
      this.periodoVista() ===
      'ANIO'
        ? undefined
        : this.mes();

    this.api.getAusenciasMotivo(
      this.anio(),
      mes,
      this.plazaId(),
      this.turnoAnaliticaId()
    ).subscribe({

      next: motivos => {

        this.motivosRaw.set(
          motivos
        );
      },

      error: error => {

        const x =
          error as any;

        this.errorAnio.set(
          x?.error?.message ??
          x?.message ??
          'No se pudieron cargar los motivos de ausencia.'
        );
      }
    });
  }

  /*
   * ============================================================
   * PUNTOS DEL MES
   * ============================================================
   */

  private puntosMes():
    ChartPoint[] {

    const ultimoDia =
      new Date(
        this.anio(),
        this.mes(),
        0
      ).getDate();

    const mapa =
      this.crearMapaPuntos(
        this.puntosDiarios()
      );

    return Array.from(
      {
        length: ultimoDia
      },
      (_, index) => {

        const dia =
          index + 1;

        return this.crearChartPoint(
          String(dia),
          mapa.get(dia)
        );
      }
    );
  }

  /*
   * ============================================================
   * PUNTOS DE SEMANA
   * ============================================================
   */

  private puntosSemana():
    ChartPoint[] {

    const rango =
      this.weekDayRange();

    const mapa =
      this.crearMapaPuntos(
        this.puntosDiarios()
      );

    const cantidad =
      Math.max(
        0,
        rango.fin -
        rango.inicio +
        1
      );

    return Array.from(
      {
        length: cantidad
      },
      (_, index) => {

        const dia =
          rango.inicio +
          index;

        return this.crearChartPoint(
          String(dia),
          mapa.get(dia)
        );
      }
    );
  }

  /*
   * ============================================================
   * PUNTOS DEL AÑO
   * ============================================================
   */

  private puntosAnio():
    ChartPoint[] {

    const mapa =
      this.crearMapaPuntos(
        this.puntosAnuales()
      );

    return this.meses.map(
      mes =>
        this.crearChartPoint(
          mes.corto,
          mapa.get(
            mes.id
          )
        )
    );
  }

  /*
   * ============================================================
   * MAPA DE PUNTOS
   * ============================================================
   */

  private crearMapaPuntos(
    puntos: DashboardPunto[]
  ): Map<number, DashboardPunto> {

    const mapa =
      new Map<
        number,
        DashboardPunto
      >();

    for (
      const punto of puntos
    ) {

      const clave =
        this.puntoPeriodo(
          punto
        );

      if (clave > 0) {

        mapa.set(
          clave,
          punto
        );
      }
    }

    return mapa;
  }

  private crearChartPoint(
    label: string,
    punto:
      DashboardPunto |
      undefined
  ): ChartPoint {

    if (!punto) {

      return {
        label,
        presentes: null,
        programados: null,
        ausentes: 0,
        porcentaje: 0
      };
    }

    const presentes =
      this.puntoPresentes(
        punto
      );

    const programados =
      this.puntoProgramados(
        punto
      );

    return {

      label,

      presentes,

      programados,

      ausentes:
        Math.max(
          0,
          programados -
          presentes
        ),

      porcentaje:
        this.puntoPorcentaje(
          punto
        )
    };
  }

  /*
   * ============================================================
   * COMPATIBILIDAD DTO DASHBOARD
   * ============================================================
   *
   * Normalmente DashboardPunto será:
   *
   * {
   *   periodo,
   *   presentes,
   *   programados,
   *   porcentaje
   * }
   *
   * Dejamos compatibilidad con nombres alternativos
   * para evitar problemas si el DTO TS tiene "dia"
   * o "mes".
   */

  private puntoPeriodo(
    punto: DashboardPunto
  ): number {

    const p =
      punto as any;

    return Number(
      p.periodo ??
      p.indice ??
      p.dia ??
      p.mes ??
      0
    );
  }

  private puntoPresentes(
    punto: DashboardPunto
  ): number {

    return Number(
      (punto as any)
        .presentes ??
      0
    );
  }

  private puntoProgramados(
    punto: DashboardPunto
  ): number {

    return Number(
      (punto as any)
        .programados ??
      0
    );
  }

  private puntoPorcentaje(
    punto: DashboardPunto
  ): number {

    return Number(
      (punto as any)
        .porcentaje ??
      0
    );
  }

  /*
   * ============================================================
   * COMPATIBILIDAD RESUMEN
   * ============================================================
   */

  private convertirResumen(
    resumen:
      ResumenAsistencia
  ): ResumenLocal {

    const r =
      resumen as any;

    return {

      registros:
        Number(
          r.registros ??
          r.totalRegistros ??
          0
        ),

      presentes:
        Number(
          r.presentes ??
          r.totalPresentes ??
          0
        ),

      programados:
        Number(
          r.programados ??
          r.totalProgramados ??
          0
        ),

      ausentes:
        Number(
          r.ausentes ??
          r.totalAusentes ??
          r.totalAusencias ??
          0
        ),

      porcentaje:
        Number(
          r.porcentajeGeneral ??
          r.porcentaje ??
          r.porcentajeAsistencia ??
          0
        )
    };
  }

  private resumenVacio():
    ResumenLocal {

    return {
      registros: 0,
      presentes: 0,
      programados: 0,
      ausentes: 0,
      porcentaje: 0
    };
  }

  /*
   * ============================================================
   * COMPATIBILIDAD MOTIVOS
   * ============================================================
   */

  private motivoNombre(
    motivo: AusenciaMotivo
  ): string {

    const m =
      motivo as any;

    return String(
      m.motivo ??
      m.nombre ??
      'Sin motivo'
    );
  }

  private motivoTotal(
    motivo: AusenciaMotivo
  ): number {

    const m =
      motivo as any;

    return Number(
      m.total ??
      m.cantidad ??
      0
    );
  }

  /*
   * ============================================================
   * RANGOS
   * ============================================================
   */

  private mesRange(): {
    inicio: string;
    fin: string;
  } {

    return this.monthRange(
      this.anio(),
      this.mes()
    );
  }

  private yearRange(): {
    inicio: string;
    fin: string;
  } {

    return {
      inicio:
        `${this.anio()}-01-01`,

      fin:
        `${this.anio()}-12-31`
    };
  }

  private previousMonthRange(): {
    inicio: string;
    fin: string;
  } {

    let anio =
      this.anio();

    let mes =
      this.mes() - 1;

    if (mes === 0) {

      mes = 12;
      anio--;
    }

    return this.monthRange(
      anio,
      mes
    );
  }

  private monthRange(
    anio: number,
    mes: number
  ): {
    inicio: string;
    fin: string;
  } {

    const ultimoDia =
      new Date(
        anio,
        mes,
        0
      ).getDate();

    const mesTexto =
      String(mes)
        .padStart(
          2,
          '0'
        );

    return {

      inicio:
        `${anio}-${mesTexto}-01`,

      fin:
        `${anio}-${mesTexto}-` +
        String(
          ultimoDia
        ).padStart(
          2,
          '0'
        )
    };
  }

  private weekDayRange(): {
    inicio: number;
    fin: number;
  } {

    const inicio =
      (
        this.semana() -
        1
      ) * 7 + 1;

    const ultimoDia =
      new Date(
        this.anio(),
        this.mes(),
        0
      ).getDate();

    const fin =
      Math.min(
        inicio + 6,
        ultimoDia
      );

    return {
      inicio,
      fin
    };
  }

  private weekRange(): {
    inicio: string;
    fin: string;
  } {

    const rango =
      this.weekDayRange();

    const mes =
      String(
        this.mes()
      ).padStart(
        2,
        '0'
      );

    return {

      inicio:
        `${this.anio()}-${mes}-` +
        String(
          rango.inicio
        ).padStart(
          2,
          '0'
        ),

      fin:
        `${this.anio()}-${mes}-` +
        String(
          rango.fin
        ).padStart(
          2,
          '0'
        )
    };
  }

  /*
   * ============================================================
   * SVG
   * ============================================================
   */

  chartX(
    index: number,
    total: number
  ): number {

    const left = 54;
    const width = 926;

    if (total <= 1) {

      return (
        left +
        width / 2
      );
    }

    return (
      left +
      index *
      width /
      (
        total - 1
      )
    );
  }

  chartY(
    value: number
  ): number {

    const max =
      this.chartMax();

    return (
      238 -
      (
        Math.max(
          0,
          Math.min(
            max,
            value
          )
        ) /
        max
      ) *
      220
    );
  }

  chartTickValue(
    factor: number
  ): number {

    return Math.round(
      this.chartMax() *
      factor
    );
  }

  tooltipX(
    index: number,
    total: number
  ): number {

    const x =
      this.chartX(
        index,
        total
      );

    return x > 790
      ? x - 168
      : x + 14;
  }

  linePath(
    points: ChartPoint[],
    key:
      | 'presentes'
      | 'programados'
  ): string {

    const valores =
      points
        .map(
          (
            point,
            index
          ) => {

            if (
              point[key] ===
              null
            ) {

              return null;
            }

            return (
              `${this.chartX(
                index,
                points.length
              )},` +
              `${this.chartY(
                point[key]!
              )}`
            );
          }
        )
        .filter(
          (
            value
          ): value is string =>
            value !== null
        );

    return valores.length
      ? `M ${valores.join(' L ')}`
      : '';
  }

  areaPath(
    points: ChartPoint[],
    key:
      | 'presentes'
      | 'programados'
  ): string {

    const valores =
      points
        .map(
          (
            point,
            index
          ) => {

            if (
              point[key] ===
              null
            ) {

              return null;
            }

            return {

              x:
                this.chartX(
                  index,
                  points.length
                ),

              y:
                this.chartY(
                  point[key]!
                )
            };
          }
        )
        .filter(
          (
            value
          ): value is {
            x: number;
            y: number;
          } =>
            value !== null
        );

    if (!valores.length) {
      return '';
    }

    return (
      `M ${valores[0].x},238 ` +
      `L ${valores
        .map(
          value =>
            `${value.x},${value.y}`
        )
        .join(' L ')} ` +
      `L ${valores[
        valores.length - 1
      ].x},238 Z`
    );
  }

  gaugeDash(
    value: number
  ): string {

    return (
      `${Math.max(
        0,
        Math.min(
          100,
          value
        )
      )} 100`
    );
  }

  /*
   * ============================================================
   * ERROR
   * ============================================================
   */

  private handleError(
    error: unknown
  ): void {

    this.loading.set(false);
    this.loadingAnio.set(false);

    const e =
      error as any;

    this.error.set(
      e?.error?.message ??
      e?.message ??
      'No se pudo cargar el dashboard.'
    );
  }
}