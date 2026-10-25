import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  finalize,
  forkJoin,
  switchMap
} from 'rxjs';

import {
  AuthService
} from '../../../../core/auth/auth.service';

import {
  CoberturaUbicacion,
  EstadoProgramacion,
  GrupoProgramacion,
  Plaza,
  ProgramacionDia,
  ResumenTrabajador,
  SecuenciaAgente,
  TipoUbicacion,
  TrabajadorResumen,
  Ubicacion,
  GeneradorCasetasPropuesta,
  ConflictoCasetaPropuesta,
  CalidadGeneracionCasetas,
  TipoPeriodoCaseta,
  CasetaConfiguracion,
  GrupoFlujoCaseta,
  RestriccionCaseta
} from '../../models/programacion.models';

import {
  ProgramacionApiService,
  VistaPreviaDistribucionExcel,
  ExtraccionCasetasExcelJson,
  VistaPreviaTurnosCasetasExcel
} from '../../data-access/programacion-api.service';

import {
  Router
} from '@angular/router';

/** Revisión explícita del Excel; nada de esto escribe en PostgreSQL. */
interface FilaRevisionCasetaExcel {
  programacionId: number;
  codigoTrabajador: number;
  trabajador: string;
  fecha: string;
  turno: EstadoProgramacion;
  casetaActual: string;
  casetaExcel: string;
  ubicacionActualId: number | null;
  ubicacionExcelId: number | null;
  puedeUsarExcel: boolean;
  opcion: 'PENDIENTE' | 'CONSERVAR' | 'EXCEL' | 'MANUAL';
  ubicacionManualId: number | null;
  motivo: string;
  origen: 'EXCEL' | 'OCUPANTE';
}
interface ConflictoCasetaExcel {
  fecha: string;
  turno: string;
  caseta: string;
  programacionId: number;
  codigo: number;
  trabajador: string;
}
interface GrupoConflictoCasetaExcel {
  fecha: string;
  turno: string;
  caseta: string;
  ocupantes: ConflictoCasetaExcel[];
}

@Component({
  selector: 'app-distribucion-controlador',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl:
    './distribucion-controlador.component.html',
  styleUrl:
    './distribucion-controlador.component.css'
})
export class DistribucionControladorComponent
  implements OnInit {

  private readonly api =
    inject(ProgramacionApiService);

  readonly auth =
    inject(AuthService);

  @ViewChild('tablaSuperior')
  private tablaSuperior?: ElementRef<HTMLDivElement>;

  @ViewChild('tablaCasetas')
  private tablaCasetas?: ElementRef<HTMLDivElement>;

  private readonly cdr =
    inject(ChangeDetectorRef);

  private readonly router =
    inject(Router);

  plazas: Plaza[] = [];

  plazaId: number | null = null;

  anio =
    new Date().getFullYear();

  mes =
    new Date().getMonth() + 1;

  dias: number[] = [];

  agentes:
    TrabajadorResumen[] = [];

  secuencias:
    SecuenciaAgente[] = [];

  readonly gruposProgramacion:
    GrupoProgramacion[] = [
      'SECUENCIA_1',
      'SECUENCIA_2',
      'SECUENCIA_3',
      'SECUENCIA_4',
      'PART_TIME'
    ];

  ubicaciones:
    Ubicacion[] = [];

  programaciones:
    ProgramacionDia[] = [];

  cobertura:
    CoberturaUbicacion[] = [];

  resumen:
    ResumenTrabajador | null = null;

  modalDetalleAgenteAbierto =
    false;

  seleccionado:
    number | null = null;

  busqueda = '';

  filtroSemana = 1;

  cargando = false;

  cargandoCobertura = false;

  cargandoResumen = false;

  guardando = false;

  totalAsignacionesGuardando = 0;

  exportandoJson = false;

  modalReportePdfAbierto = false;

  modoReportePdf:
    'MES' | 'RANGO' =
    'MES';

  reportePdfDesde = '';

  reportePdfHasta = '';

  generandoReportePdf = false;

  generandoReporteMatrizPdf = false;

  generandoReporteExcel = false;

  filasRevisionCasetasExcel: FilaRevisionCasetaExcel[] = [];
  observacionesRevisionCasetasExcel: string[] = [];
  conflictosRevisionCasetasExcel: GrupoConflictoCasetaExcel[] = [];
  coincidenciasCasetasExcel = 0;
  celdasCasetasExcel = 0;

  importandoExcel = false;
  vistaPreviaImportacion: VistaPreviaDistribucionExcel | null = null;
  vistaPreviaTurnosCasetas: VistaPreviaTurnosCasetasExcel | null = null;
  leyendoTurnosCasetas = false;
  archivoExcelEnRevision: File | null = null;
  plazaExcelEnRevision: number | null = null;
  anioExcelEnRevision = 0;
  mesExcelEnRevision = 0;
  guardandoTurnosExcel = false;
  filtroEstadoRevisionExcel = 'REVISAR';
  filtroTrabajadorRevisionExcel = '';
  semanaRevisionExcel = 0;

  get turnosPendientesExcel(): number {
    const vista = this.vistaPreviaTurnosCasetas;
    if (!vista) return 0;
    // El archivo confirmado manda también sobre descansos D/DM/V/COM/LIC.
    // ACTUALIZAR incluye limpiar una caseta heredada en estado no operativo.
    return vista.propuestas.filter(p =>
      p.accion === 'CREAR' || p.accion === 'ACTUALIZAR'
    ).length;
  }

  get filasRevisionExcel() {
    const vista = this.vistaPreviaTurnosCasetas;
    if (!vista) return [];
    const nombre = this.filtroTrabajadorRevisionExcel.trim().toLowerCase();
    return vista.propuestas.filter(p => {
      if (this.filtroEstadoRevisionExcel !== 'TODOS' && p.accion !== this.filtroEstadoRevisionExcel) return false;
      if (nombre && !`${p.codigoTrabajador} ${p.trabajador}`.toLowerCase().includes(nombre)) return false;
      if (this.semanaRevisionExcel) {
        const semana = Math.ceil(Number(p.fecha.slice(8, 10)) / 7);
        if (semana !== this.semanaRevisionExcel) return false;
      }
      return true;
    }).slice(0, 100);
  }


  errorReportePdf = '';

  error = '';

  mensaje = '';

  modalUbicacionesAbierto = false;

  modalRestriccionesAbierto = false;

  cargandoRestriccionesModal = false;

  busquedaAgenteRestriccion = '';

  configPlazaId: number | null = null;

  ubicacionesConfiguracion: Ubicacion[] = [];

  casetasGeneradorConfiguracion:
    CasetaConfiguracion[] = [];

  restriccionesCasetaConfiguracion:
    RestriccionCaseta[] = [];

  agentesRestriccionConfiguracion:
    TrabajadorResumen[] = [];

  nuevaRestriccionAgenteId:
    number | null = null;

  nuevaRestriccionUbicacionId:
    number | null = null;

  nuevaRestriccionMotivo = '';

  readonly casetasRestriccionSeleccionadas =
    new Set<number>();

  cargandoConfiguracion = false;

  guardandoFlujoUbicacionId:
    number | null = null;

  guardandoRestriccionConfiguracion =
    false;

  eliminandoRestriccionId:
    number | null = null;

  guardandoUbicacion = false;

  procesandoUbicacionId: number | null = null;

  ubicacionEditandoId: number | null = null;

  ubicacionCodigo = '';

  ubicacionNombre = '';

  ubicacionTipo: TipoUbicacion = 'VIA';

  ubicacionOrden: number | null = null;

  ubicacionPermiteTurnoA = true;

  ubicacionPermiteTurnoB = true;

  ubicacionPermiteTurnoC = true;

  filtroTurnoCobertura:
    'TODOS' | 'A' | 'B' | 'C' =
    'TODOS';

  errorConfiguracion = '';

  mensajeConfiguracion = '';

  conflictoVisible = false;

  generadorAbierto = false;

  generadorPeriodo: TipoPeriodoCaseta =
    'SEMANA';

  generadorSemana = 1;

  generandoDistribucion = false;

  errorGenerador = '';

  mensajeGenerador = '';

  modalResultadoDistribucionAbierto =
    false;

  tipoResultadoDistribucion:
    'success' | 'error' =
    'success';

  tituloResultadoDistribucion = '';

  mensajeResultadoDistribucion = '';

  observacionesResultadoDistribucion:
    ConflictoCasetaPropuesta[] = [];

  guardadoForzadoDisponible =
    false;

  /**
   * Observaciones activas por celda de programación.
   * Se mantienen aunque se cierre el modal de resultado.
   */
  readonly observacionesPorProgramacion =
    new Map<number, string>();

  modalCambiosPendientesAbierto =
    false;

  mensajeSalidaPendiente =
    '';

  private resolverSalidaPendiente:
    ((valor: boolean) => void) | null =
    null;

  propuestaGenerador:
    GeneradorCasetasPropuesta | null =
    null;

  ultimaCalidadGeneracion:
    CalidadGeneracionCasetas | null =
    null;

  conflictoInfo: {
    ubicacion: string;
    fecha: string;
    turno: EstadoProgramacion | null;
    agente: string;
  } | null = null;

  readonly asignaciones =
    new Map<number, number>();

  /**
   * Copia exacta de la última distribución confirmada por backend.
   * Se usa para saber si una celda realmente cambió.
   */
  readonly asignacionesGuardadas =
    new Map<number, number>();

  readonly cambios =
    new Map<number, number | null>();

  tieneObservacion(
    programacionTurnoId: number
  ): boolean {

    return this.observacionesPorProgramacion
      .has(
        programacionTurnoId
      );
  }


  mensajeObservacion(
    programacionTurnoId: number
  ): string {

    return (
      this.observacionesPorProgramacion
        .get(
          programacionTurnoId
        ) ??
      ''
    );
  }


  get esSupervisor(): boolean {

    return this.auth
      .tieneRol(
        'SUPERVISOR'
      );
  }


  get puedeGenerarDistribucion(): boolean {

    return (
      this.auth.tieneRol(
        'SUPERVISOR'
      ) ||
      this.auth.tieneRol(
        'CONTROLADOR'
      )
    );
  }

  get agentesRestriccionFiltrados(): TrabajadorResumen[] {

    const query =
      this.busquedaAgenteRestriccion
        .trim()
        .toLowerCase();

    if (!query) {
      return this.agentesRestriccionConfiguracion;
    }

    return this.agentesRestriccionConfiguracion
      .filter(
        agente =>
          `${agente.codigo} ${agente.nombreCompleto}`
            .toLowerCase()
            .includes(query)
      );
  }


  get casetasRestriccionDisponibles(): Ubicacion[] {

    return this.ubicacionesConfiguracion
      .filter(
        ubicacion =>
          ubicacion.activo
      )
      .sort(
        (a, b) => {
          const tipoOrden =
            (
              a.tipo === 'VIA'
                ? 0
                : a.tipo === 'AUXILIAR'
                  ? 1
                  : 2
            ) -
            (
              b.tipo === 'VIA'
                ? 0
                : b.tipo === 'AUXILIAR'
                  ? 1
                  : 2
            );

          if (tipoOrden !== 0) {
            return tipoOrden;
          }

          return (
            (a.orden ?? Number.MAX_SAFE_INTEGER) -
            (b.orden ?? Number.MAX_SAFE_INTEGER)
          ) || a.codigo.localeCompare(
            b.codigo,
            'es'
          );
        }
      );
  }

  get cantidadCasetasRestriccionSeleccionadas(): number {
    return this.casetasRestriccionSeleccionadas.size;
  }

  get restriccionesAgenteSeleccionado(): RestriccionCaseta[] {

    if (!this.nuevaRestriccionAgenteId) {
      return [];
    }

    return this.restriccionesCasetaConfiguracion
      .filter(
        restriccion =>
          restriccion.trabajadorId ===
            this.nuevaRestriccionAgenteId &&
          restriccion.activo
      );
  }


  get agenteSeleccionado(): TrabajadorResumen | null {

    if (!this.seleccionado) {
      return null;
    }

    return (
      this.agentes.find(
        agente =>
          agente.id ===
            this.seleccionado
      ) ??
      null
    );
  }


  get frecuenciaCasetasAgenteSeleccionado(): {
    ubicacionId: number;
    codigo: string;
    nombre: string;
    tipo: TipoUbicacion;
    veces: number;
  }[] {

    if (!this.seleccionado) {
      return [];
    }

    const conteos =
      new Map<number, number>();

    for (
      const programacion
      of this.programaciones
    ) {
      if (
        programacion.trabajadorId !==
          this.seleccionado ||
        !this.esOperativo(
          programacion.estado
        )
      ) {
        continue;
      }

      const ubicacionId =
        this.asignacion(
          programacion.programacionId
        );

      if (!ubicacionId) {
        continue;
      }

      conteos.set(
        ubicacionId,
        (
          conteos.get(
            ubicacionId
          ) ??
          0
        ) + 1
      );
    }

    return [...conteos.entries()]
      .map(
        ([ubicacionId, veces]) => {
          const ubicacion =
            this.ubicaciones.find(
              item =>
                item.id ===
                  ubicacionId
            );

          return {
            ubicacionId,
            codigo:
              ubicacion?.codigo ??
              String(
                ubicacionId
              ),
            nombre:
              ubicacion?.nombre ??
              'Ubicación',
            tipo:
              ubicacion?.tipo ??
              'VIA',
            veces
          };
        }
      )
      .sort(
        (a, b) =>
          b.veces -
            a.veces ||
          a.codigo.localeCompare(
            b.codigo,
            'es'
          )
      );
  }


  get totalAsignacionesAgenteSeleccionado(): number {

    return this.frecuenciaCasetasAgenteSeleccionado
      .reduce(
        (total, item) =>
          total + item.veces,
        0
      );
  }


  get totalCasetasDistintasAgenteSeleccionado(): number {

    return this.frecuenciaCasetasAgenteSeleccionado
      .length;
  }


  get mesInput(): string {

    return (
      `${this.anio}-` +
      `${String(
        this.mes
      ).padStart(
        2,
        '0'
      )}`
    );
  }

  ngOnInit(): void {

    if (
      this.esSupervisor
    ) {

      this.cargarPlazas();

    }
    else {

      this.plazaId =
        this.auth
          .usuario()
          ?.plazaId ??
        null;

      if (
        this.plazaId
      ) {

        this.cargar();

      }
      else {

        this.error =
          'Tu usuario no tiene una plaza asignada.';

        this.cdr.detectChanges();

      }

    }
  }

  cargarPlazas(): void {

    this.api
      .getPlazas()
      .subscribe({

        next: (
          plazas
        ) => {

          this.plazas =
            [...plazas];

          this.plazaId =
            plazas.find(
              p =>
                p.codigo ===
                'P4'
            )?.id ??
            plazas[0]?.id ??
            null;

          this.cdr.detectChanges();

          if (
            this.plazaId
          ) {

            this.cargar();

          }

        },

        error: (
          e
        ) => {

          this.error =
            this.mensajeError(
              e,
              'No se pudieron cargar las plazas.'
            );

          this.cdr.detectChanges();

        }

      });
  }

  async cambiarMes(
    value: string
  ): Promise<void> {

    if (
      !value
    ) {
      return;
    }

    const [
      anio,
      mes
    ] =
      value
        .split('-')
        .map(Number);

    if (
      anio === this.anio &&
      mes === this.mes
    ) {
      return;
    }

    const continuar =
      await this.confirmarSalidaConCambios(
        'cambiar de mes'
      );

    if (
      !continuar
    ) {
      return;
    }

    this.anio =
      anio;

    this.mes =
      mes;

    this.filtroSemana = 1;

    this.cargar();
  }

  async cambiarPlaza(
    nuevaPlazaId: number | null
  ): Promise<void> {

    if (
      nuevaPlazaId === this.plazaId
    ) {
      return;
    }

    const continuar =
      await this.confirmarSalidaConCambios(
        'cambiar de plaza'
      );

    if (
      !continuar
    ) {
      return;
    }

    this.plazaId =
      nuevaPlazaId;

    this.cargar();
  }


  tieneCambiosPendientes(): boolean {

    return (
      this.cambios.size > 0
    );
  }


  mensajeCambiosPendientes(
    accion = 'salir de este módulo'
  ): string {

    const total =
      this.cambios.size;

    return (
      `Tienes ${total} asignación(es) de caseta sin guardar. ` +
      `Si decides ${accion}, esos cambios se perderán. ` +
      '¿Deseas continuar sin guardar?'
    );
  }


  confirmarSalidaConCambios(
    accion = 'salir de este módulo'
  ): Promise<boolean> {

    if (
      !this.tieneCambiosPendientes()
    ) {
      return Promise.resolve(
        true
      );
    }

    if (
      this.resolverSalidaPendiente
    ) {
      return Promise.resolve(
        false
      );
    }

    this.mensajeSalidaPendiente =
      this.mensajeCambiosPendientes(
        accion
      );

    this.modalCambiosPendientesAbierto =
      true;

    this.cdr.detectChanges();

    return new Promise<boolean>(
      resolve => {
        this.resolverSalidaPendiente =
          resolve;
      }
    );
  }


  cancelarSalidaConCambios(): void {

    const resolver =
      this.resolverSalidaPendiente;

    this.resolverSalidaPendiente =
      null;

    this.modalCambiosPendientesAbierto =
      false;

    this.mensajeSalidaPendiente =
      '';

    this.cdr.detectChanges();

    resolver?.(
      false
    );
  }


  continuarSalidaSinGuardar(): void {

    const resolver =
      this.resolverSalidaPendiente;

    this.resolverSalidaPendiente =
      null;

    this.modalCambiosPendientesAbierto =
      false;

    this.mensajeSalidaPendiente =
      '';

    this.cdr.detectChanges();

    resolver?.(
      true
    );
  }


  @HostListener(
    'window:beforeunload',
    ['$event']
  )
  protegerSalidaNavegador(
    event: BeforeUnloadEvent
  ): void {

    if (
      !this.tieneCambiosPendientes()
    ) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
  }


  get agentesFiltrados(): TrabajadorResumen[] {
    return this.agentesFiltradosBase();
  }


  get semanasDisponibles(): number[] {

    const totalSemanas =
      Math.ceil(
        this.dias.length / 7
      );

    return Array.from(
      { length: totalSemanas },
      (_, index) => index + 1
    );
  }

  get diasVisibles(): number[] {

    if (this.filtroSemana === 0) {
      return this.dias;
    }

    const inicio =
      (this.filtroSemana - 1) * 7;

    return this.dias.slice(
      inicio,
      inicio + 7
    );
  }

  get rangoSemanaTexto(): string {

    if (!this.diasVisibles.length) {
      return '';
    }

    const primero =
      this.diasVisibles[0];

    const ultimo =
      this.diasVisibles[
        this.diasVisibles.length - 1
      ];

    const formato =
      new Intl.DateTimeFormat(
        'es-PE',
        {
          day: '2-digit',
          month: 'short'
        }
      );

    return (
      `${formato.format(new Date(this.anio, this.mes - 1, primero))} - ` +
      `${formato.format(new Date(this.anio, this.mes - 1, ultimo))}`
    );
  }

  cambiarSemana(semana: number): void {

    this.filtroSemana =
      semana;

    this.ajustarSeleccionVisible();

    queueMicrotask(() => {
      if (this.tablaSuperior?.nativeElement) {
        this.tablaSuperior.nativeElement.scrollLeft = 0;
      }
      if (this.tablaCasetas?.nativeElement) {
        this.tablaCasetas.nativeElement.scrollLeft = 0;
      }
    });

    this.cdr.detectChanges();
  }

  get ubicacionesCobertura(): Ubicacion[] {

    return this.ubicaciones
      .filter(
        ubicacion =>
          this.filtroTurnoCobertura === 'TODOS' ||
          this.ubicacionHabilitadaParaTurno(
            ubicacion,
            this.filtroTurnoCobertura
          )
      );
  }

  cambiarFiltroTurnoCobertura(
    turno: 'TODOS' | 'A' | 'B' | 'C'
  ): void {

    this.filtroTurnoCobertura =
      turno;

    this.cdr.detectChanges();
  }

  coberturaCantidad(
    ubicacionId: number,
    dia: number
  ): number {

    const fecha =
      this.fecha(dia);

    const ubicacion =
      this.ubicaciones
        .find(
          item =>
            item.id === ubicacionId
        );

    if (!ubicacion) {
      return 0;
    }

    return this.programaciones
      .filter(
        p =>
          p.fecha === fecha &&
          this.esOperativo(p.estado)
      )
      .filter(
        p =>
          this.filtroTurnoCobertura === 'TODOS' ||
          p.estado === this.filtroTurnoCobertura
      )
      .filter(
        p =>
          this.ubicacionHabilitadaParaTurno(
            ubicacion,
            p.estado
          )
      )
      .filter(
        p =>
          this.asignacion(p.programacionId) === ubicacionId
      )
      .length;
  }

  coberturaEstado(
    ubicacionId: number,
    dia: number
  ): 'complete' | 'partial' | 'missing' | 'inactive' {

    const cantidad =
      this.coberturaCantidad(
        ubicacionId,
        dia
      );

    const fecha =
      this.fecha(dia);

    const ubicacion =
      this.ubicaciones
        .find(
          item =>
            item.id === ubicacionId
        );

    if (!ubicacion) {
      return 'inactive';
    }

    const turnosOperativos =
      new Set(
        this.programaciones
          .filter(
            p =>
              p.fecha === fecha &&
              this.esOperativo(p.estado)
          )
          .filter(
            p =>
              this.filtroTurnoCobertura === 'TODOS' ||
              p.estado === this.filtroTurnoCobertura
          )
          .filter(
            p =>
              this.ubicacionHabilitadaParaTurno(
                ubicacion,
                p.estado
              )
          )
          .map(p => p.estado)
      );

    if (turnosOperativos.size === 0) {
      return 'inactive';
    }

    const esperado =
      turnosOperativos.size;

    if (cantidad <= 0) {
      return 'missing';
    }

    if (cantidad >= esperado) {
      return 'complete';
    }

    return 'partial';
  }

  private agentesFiltradosBase(): TrabajadorResumen[] {

    const query =
      this.busqueda
        .trim()
        .toLowerCase();

    const agentePorId =
      new Map<number, TrabajadorResumen>(
        this.agentes.map(
          agente => [agente.id, agente]
        )
      );

    const resultado: TrabajadorResumen[] = [];

    for (const grupo of this.gruposProgramacion) {

      const registros =
        this.secuencias
          .filter(
            secuencia =>
              secuencia.grupo === grupo
          )
          .sort(
            (a, b) =>
              (a.orden ?? Number.MAX_SAFE_INTEGER) -
              (b.orden ?? Number.MAX_SAFE_INTEGER)
          );

      for (const registro of registros) {

        const agente =
          agentePorId.get(
            registro.agenteId
          );

        if (!agente) {
          continue;
        }

        if (
          query &&
          !(
            `${agente.codigo} ${agente.nombreCompleto}`
          )
            .toLowerCase()
            .includes(query)
        ) {
          continue;
        }

        resultado.push(agente);
      }
    }

    return resultado;
  }

  private ajustarSeleccionVisible(): void {

    const visibles =
      this.agentesFiltrados;

    if (!visibles.length) {
      this.seleccionado = null;
      this.resumen = null;
      return;
    }

    if (
      !this.seleccionado ||
      !visibles.some(a => a.id === this.seleccionado)
    ) {
      this.seleccionado =
        visibles[0].id;

      this.resumen =
        null;
    }
  }

  cargar(): void {

    if (
      !this.plazaId
    ) {
      return;
    }

    this.cargando =
      true;

    this.error =
      '';

    this.mensaje =
      '';

    this.resumen =
      null;

    /*
     * Al cambiar plaza/mes ya no debemos conservar métricas de una
     * generación anterior, porque pertenecerían a otro contexto.
     */
    this.ultimaCalidadGeneracion =
      null;

    this.propuestaGenerador =
      null;

    this.observacionesPorProgramacion
      .clear();

    this.conflictoVisible =
      false;

    this.conflictoInfo =
      null;

    this.dias =
      Array.from(
        {
          length:
            new Date(
              this.anio,
              this.mes,
              0
            ).getDate()
        },
        (
          _,
          index
        ) =>
          index + 1
      );

    this.cdr.detectChanges();

    forkJoin({

      agentes:
        this.api
          .getAgentes(
            this.plazaId
          ),

      turnos:
        this.api
          .getTurnos(
            this.plazaId,
            this.anio,
            this.mes
          ),

      secuencias:
        this.api
          .getSecuencias(
            this.plazaId
          ),

      ubicaciones:
        this.api
          .getUbicaciones(
            this.plazaId
          ),

      distribucion:
        this.api
          .getDistribucion(
            this.plazaId,
            this.anio,
            this.mes
          )

    })
      .pipe(

        finalize(() => {

          this.cargando =
            false;

          this.cdr.detectChanges();

        })

      )
      .subscribe({

        next: (
          resultado
        ) => {

          this.agentes =
            [
              ...resultado.agentes
            ];

          this.programaciones =
            [
              ...resultado.turnos
            ];

          this.secuencias =
            [
              ...resultado.secuencias
            ];

          this.ubicaciones =
            [
              ...resultado.ubicaciones
            ];

          this.asignaciones
            .clear();

          this.asignacionesGuardadas
            .clear();

          this.cambios
            .clear();

          for (
            const distribucion
            of resultado.distribucion
          ) {

            this.asignaciones
              .set(
                distribucion
                  .programacionTurnoId,

                distribucion
                  .ubicacionId
              );

            this.asignacionesGuardadas
              .set(
                distribucion
                  .programacionTurnoId,

                distribucion
                  .ubicacionId
              );

          }

          const agentesOrdenados =
            this.agentesFiltrados;

          if (
            agentesOrdenados.length &&
            (
              !this.seleccionado ||
              !agentesOrdenados.some(
                agente =>
                  agente.id ===
                    this.seleccionado
              )
            )
          ) {

            this.seleccionado =
              agentesOrdenados[0]
                .id;

          }

          this.cdr.detectChanges();

          this.cargarCobertura();

          if (
            this.seleccionado
          ) {

            this.cargarResumen(
              this.seleccionado
            );

          }

        },

        error: (
          e
        ) => {

          console.error(
            'Error cargando distribución:',
            e
          );

          this.error =
            this.mensajeError(
              e,
              'No se pudo cargar la distribución.'
            );

          this.cdr.detectChanges();

        }

      });
  }

  /** Single Excel entry point: both formats, first shifts then casetas. */
  previsualizarTurnosCasetasExcel(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    this.descartarImportacionExcel();
    if (!archivo || !this.plazaId || this.cargando || this.guardando) return;
    if (this.cambios.size > 0) {
      this.error = 'Guarda o descarta los cambios pendientes antes de importar otro Excel.';
      this.cdr.detectChanges();
      return;
    }
    if (!archivo.name.toLowerCase().endsWith('.xlsx') || archivo.size > 2 * 1024 * 1024) {
      this.error = 'Selecciona un Excel .xlsx de máximo 2 MB.';
      this.cdr.detectChanges();
      return;
    }
    this.archivoExcelEnRevision = archivo;
    this.plazaExcelEnRevision = this.plazaId;
    this.anioExcelEnRevision = this.anio;
    this.mesExcelEnRevision = this.mes;
    this.filtroEstadoRevisionExcel = 'REVISAR';
    this.filtroTrabajadorRevisionExcel = '';
    this.semanaRevisionExcel = 0;
    this.leyendoTurnosCasetas = true;
    this.api.previsualizarExcelTurnosCasetas(this.plazaId, archivo, this.anio, this.mes)
      .pipe(finalize(() => {
        this.leyendoTurnosCasetas = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: previa => {
          this.vistaPreviaTurnosCasetas = previa;
          this.mensaje = 'Excel leído. Revisa primero los turnos; no se ha guardado nada.';
          this.cdr.detectChanges();
        },
        error: e => {
          this.error = this.mensajeError(e, 'No se pudo leer el Excel mensual o semanal.');
          this.archivoExcelEnRevision = null;
          this.cdr.detectChanges();
        }
      });
  }

  private validarContextoExcel(): boolean {
    if (!this.archivoExcelEnRevision || !this.plazaId ||
        this.plazaId !== this.plazaExcelEnRevision ||
        this.anio !== this.anioExcelEnRevision || this.mes !== this.mesExcelEnRevision ||
        this.cambios.size > 0) {
      this.error = 'Cambió la plaza, el periodo o hay cambios pendientes. Vuelve a importar el archivo.';
      this.cdr.detectChanges();
      return false;
    }
    return true;
  }

  confirmarTurnosImportacionExcel(): void {
    if (!this.vistaPreviaTurnosCasetas || !this.validarContextoExcel() ||
        !this.esSupervisor || this.guardandoTurnosExcel) return;

    const pendientes = this.vistaPreviaTurnosCasetas.propuestas.filter(p =>
      p.accion === 'CREAR' || p.accion === 'ACTUALIZAR'
    );
    if (!pendientes.length) {
      this.continuarACasetasExcel();
      return;
    }
    if (this.vistaPreviaTurnosCasetas.revisar > 0) {
      this.error = 'El Excel tiene turnos por revisar. Resuelve primero las observaciones antes de guardar.';
      this.cdr.detectChanges();
      return;
    }
    if (!window.confirm(
      `El Excel reemplazará ${pendientes.length} programaciones anteriores de SIGO (A/B/C/D/DM/V/COM/LIC). Los cambios manuales hechos antes en esas celdas se sobrescribirán. ¿Confirmas?`
    )) return;

    const plazaId = this.plazaId!;
    const anio = this.anio;
    const mes = this.mes;
    let turnosGuardados = false;
    this.guardandoTurnosExcel = true;
    this.error = '';

    // La vista previa es de solo lectura. Guardamos únicamente los cambios
    // revisados mediante el caso de uso normal, con permisos de supervisor.
    forkJoin({
      agentes: this.api.getAgentes(plazaId),
      controladores: this.api.getControladores(plazaId)
    }).pipe(
      switchMap(({ agentes, controladores }) => {
        const porCodigo = new Map<number, number>();
        for (const trabajador of [...agentes, ...controladores]) {
          if (trabajador.activo === false) continue;
          const previo = porCodigo.get(trabajador.codigo);
          if (previo !== undefined && previo !== trabajador.id) {
            throw new Error(`Código duplicado en la plaza: ${trabajador.codigo}. Revisa los trabajadores.`);
          }
          porCodigo.set(trabajador.codigo, trabajador.id);
        }

        const estados = new Set<EstadoProgramacion>(['A', 'B', 'C', 'D', 'V', 'COM', 'DM', 'LIC']);
        const revisados = new Set<string>();
        const programaciones: { trabajadorId: number; fecha: string; estado: EstadoProgramacion }[] = [];

        for (const propuesta of pendientes) {
          const trabajadorId = porCodigo.get(propuesta.codigoTrabajador);
          const estado = propuesta.turnoExcel as EstadoProgramacion | null;
          if (!trabajadorId || !estado || !estados.has(estado)) {
            throw new Error(`Revisa el turno de ${propuesta.codigoTrabajador} (${propuesta.fecha}): no hay trabajador activo o estado válido.`);
          }
          const clave = `${trabajadorId}|${propuesta.fecha}`;
          if (revisados.has(clave)) {
            throw new Error(`El Excel tiene registros repetidos para ${propuesta.codigoTrabajador} (${propuesta.fecha}).`);
          }
          revisados.add(clave);
          programaciones.push({ trabajadorId, fecha: propuesta.fecha, estado });
        }
        return this.api.guardarTurnos({ plazaId, programaciones });
      }),
      switchMap(() => {
        turnosGuardados = true;
        // Evita mostrar turnos/casetas anteriores a la confirmación.
        return forkJoin({
          turnos: this.api.getTurnos(plazaId, anio, mes),
          distribucion: this.api.getDistribucion(plazaId, anio, mes)
        });
      }),
      finalize(() => {
        this.guardandoTurnosExcel = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: ({ turnos, distribucion }) => {
        this.programaciones = turnos;
        this.asignaciones.clear();
        this.asignacionesGuardadas.clear();
        for (const item of distribucion) {
          this.asignaciones.set(item.programacionTurnoId, item.ubicacionId);
          this.asignacionesGuardadas.set(item.programacionTurnoId, item.ubicacionId);
        }
        this.mensaje = `Turnos procesados: ${pendientes.length}. Ahora revisa las casetas.`;
        this.continuarACasetasExcel();
      },
      error: e => {
        this.error = turnosGuardados
          ? 'Los turnos se guardaron, pero no se pudieron actualizar los datos de la pantalla. Recarga la plaza antes de continuar con las casetas.'
          : e instanceof Error ? e.message
          : this.mensajeError(e, 'No se pudieron guardar los turnos. No se importaron casetas.');
        this.cdr.detectChanges();
      }
    });
  }

  continuarACasetasExcel(): void {
    if (!this.validarContextoExcel() || this.importandoExcel) return;
    this.importandoExcel = true;
    this.error = '';
    this.api.previsualizarExcelDistribucion(this.plazaId!, this.archivoExcelEnRevision!, this.anio, this.mes)
      .pipe(finalize(() => {
        this.importandoExcel = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: previa => {
          this.vistaPreviaTurnosCasetas = null;
          this.vistaPreviaImportacion = previa;
          if (!previa.valido) {
            this.error = `Hay ${previa.errores.length} conflictos que deben corregirse antes de guardar casetas.`;
          } else {
            this.mensaje = `${previa.cambios.length} casetas pendientes y ${previa.omitidos.length} omitidas. Revisa antes de confirmar.`;
          }
          this.cdr.detectChanges();
        },
        error: e => {
          this.error = this.mensajeError(e, 'No se pudo analizar las casetas del Excel.');
          this.cdr.detectChanges();
        }
      });
  }

  /** Los cambios del Excel se deciden en la pantalla, no durante la lectura. */
  previsualizarCasetasJsonDesdeExcel(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    this.descartarImportacionExcel();
    if (!archivo || !this.plazaId || this.cargando || this.guardando) return;
    if (this.cambios.size) {
      this.error = 'Guarda o descarta los cambios pendientes antes de importar Excel.';
      this.cdr.detectChanges();
      return;
    }
    if (!archivo.name.toLowerCase().endsWith('.xlsx') || archivo.size > 2 * 1024 * 1024) {
      this.error = 'Selecciona un Excel .xlsx de máximo 2 MB.';
      this.cdr.detectChanges();
      return;
    }
    this.resumenImportacionParcialCasetas = null;
    this.archivoExcelEnRevision = archivo;
    this.plazaExcelEnRevision = this.plazaId;
    this.anioExcelEnRevision = this.anio;
    this.mesExcelEnRevision = this.mes;
    this.importandoExcel = true;
    this.error = '';
    this.mensaje = '';
    this.api.extraerCasetasExcelJson(this.plazaId, archivo, this.anio, this.mes)
      .subscribe({
        next: datos => {
          this.api.previsualizarCasetasJson(datos)
            .pipe(finalize(() => {
              this.importandoExcel = false;
              this.cdr.detectChanges();
            }))
            .subscribe({
              next: previa => {
                // El backend verifica la plaza y los registros. Su lista de conflictos
                // no se aplica a ciegas: el supervisor los resuelve en la matriz.
                this.vistaPreviaImportacion = previa;
                this.vistaPreviaTurnosCasetas = null;
                this.prepararRevisionCasetasExcel(datos);
                this.error = '';
                this.mensaje = 'Excel extraído por Apache POI y validado como JSON. Revisa las diferencias; no se ha guardado nada.';
                this.cdr.detectChanges();
              },
              error: e => {
                this.error = this.mensajeError(e, 'No se pudo validar el JSON de casetas.');
                this.cdr.detectChanges();
              }
            });
        },
        error: e => {
          this.importandoExcel = false;
          this.error = this.mensajeError(e, 'No se pudo extraer el Excel con Apache POI.');
          this.cdr.detectChanges();
        }
      });
  }

  private codigoCasetaExcel(valor: string | null): string {
    if (valor === null) return '';
    const limpio = valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    const auxiliar = /^AUX(?:ILIAR)?\s*-?\s*(\d+)$/.exec(limpio);
    return auxiliar ? `AUX ${auxiliar[1]}` : limpio;
  }

  private prepararRevisionCasetasExcel(datos: ExtraccionCasetasExcelJson): void {
    this.filasRevisionCasetasExcel = [];
    this.observacionesRevisionCasetasExcel = [];
    this.coincidenciasCasetasExcel = 0;
    this.celdasCasetasExcel = datos.registros.length;

    const turnos = new Map<string, ProgramacionDia>();
    for (const p of this.programaciones) {
      turnos.set(`${p.codigoTrabajador}|${p.fecha}`, p);
    }
    const activos = new Set(this.agentes.filter(a => a.activo !== false).map(a => a.codigo));
    const ubicacionesPorCodigo = new Map(this.ubicaciones.filter(u => u.activo)
      .map(u => [this.codigoCasetaExcel(u.codigo), u] as const));
    const agrupados = new Map<string, typeof datos.registros>();
    for (const registro of datos.registros) {
      const llave = `${registro.codigoTrabajador}|${registro.fecha}`;
      const grupo = agrupados.get(llave) ?? [];
      grupo.push(registro);
      agrupados.set(llave, grupo);
    }

    for (const [llave, grupo] of agrupados) {
      const registro = grupo[0];
      const p = turnos.get(llave);
      const referencia = `Código ${registro.codigoTrabajador} · ${registro.fecha}`;
      if (!activos.has(registro.codigoTrabajador)) {
        this.observacionesRevisionCasetasExcel.push(`${referencia}: trabajador no activo en la plaza; omitido.`);
        continue;
      }
      if (!p) {
        this.observacionesRevisionCasetasExcel.push(`${referencia}: sin programación registrada en SIGO; omitido.`);
        continue;
      }
      const turnoOperativo = ['A', 'B', 'C'].includes(p.estado);
      if (!turnoOperativo && registro.caseta !== null) {
        this.observacionesRevisionCasetasExcel.push(`${referencia}: SIGO tiene turno ${p.estado}. No se cambia el turno ni se asigna caseta.`);
        continue;
      }

      const actualId = this.asignacionesGuardadas.get(p.programacionId) ?? null;
      const actual = this.ubicaciones.find(u => u.id === actualId);
      const codigo = this.codigoCasetaExcel(registro.caseta);
      const ubicacion = registro.caseta === null ? null : (ubicacionesPorCodigo.get(codigo) ?? null);
      const casetaExiste = registro.caseta === null || !!ubicacion;
      const permitida = registro.caseta === null || (!!ubicacion && this.ubicacionHabilitadaParaTurno(ubicacion, p.estado));
      const turnoDistinto = !!registro.turnoExcel && registro.turnoExcel !== p.estado;
      const repetido = grupo.length > 1;
      const misma = casetaExiste && permitida && !turnoDistinto && !repetido && actualId === (ubicacion?.id ?? null);
      if (misma) {
        this.coincidenciasCasetasExcel++;
        continue;
      }

      const motivos: string[] = [];
      if (repetido) motivos.push(`El trabajador aparece ${grupo.length} veces en la misma fecha (${grupo.map(r => r.caseta ?? 'Sin asignar').join(', ')}); escoge explícitamente la ubicación correcta.`);
      if (!casetaExiste) motivos.push('La caseta indicada en Excel no existe o no está activa; selecciona otra ubicación.');
      if (!permitida && casetaExiste) motivos.push(`La caseta del Excel no está habilitada para el turno ${p.estado}.`);
      if (turnoDistinto) motivos.push(`El color del Excel indica turno ${registro.turnoExcel}, pero SIGO registra ${p.estado}; no se cambiará el turno.`);
      if (actualId !== null && actualId !== (ubicacion?.id ?? null)) motivos.push('La caseta existente es distinta. Es necesario decidir qué asignación conservar.');
      const propuestaSegura = casetaExiste && permitida;
      this.filasRevisionCasetasExcel.push({
        programacionId: p.programacionId,
        codigoTrabajador: p.codigoTrabajador,
        trabajador: p.nombreTrabajador,
        fecha: p.fecha,
        turno: p.estado,
        casetaActual: actual?.codigo ?? 'Sin asignar',
        casetaExcel: registro.caseta === null ? 'Sin asignar' : registro.caseta,
        ubicacionActualId: actualId,
        ubicacionExcelId: ubicacion?.id ?? null,
        puedeUsarExcel: propuestaSegura,
        opcion: (actualId === null && propuestaSegura && !repetido && !turnoDistinto) ? 'EXCEL' : 'PENDIENTE',
        ubicacionManualId: actualId,
        motivo: motivos.join(' '),
        origen: 'EXCEL'
      });
    }

    // Dos solicitudes de la misma fecha/turno/ubicación nunca se aceptan sin decisión.
    const pedidos = new Map<string, FilaRevisionCasetaExcel[]>();
    for (const fila of this.filasRevisionCasetasExcel) {
      if (!fila.puedeUsarExcel || fila.ubicacionExcelId === null) continue;
      const llave = `${fila.fecha}|${fila.turno}|${fila.ubicacionExcelId}`;
      const grupo = pedidos.get(llave) ?? [];
      grupo.push(fila);
      pedidos.set(llave, grupo);
    }
    for (const grupo of pedidos.values()) {
      if (grupo.length < 2) continue;
      for (const fila of grupo) {
        fila.opcion = 'PENDIENTE';
        fila.motivo += ' La misma caseta fue solicitada por varios trabajadores en el Excel.';
      }
    }
    this.actualizarConflictosCasetasExcel();
  }

  get pendientesRevisionCasetasExcel(): number {
    return this.filasRevisionCasetasExcel.filter(f => f.opcion === 'PENDIENTE').length;
  }

  get cambiosRevisionCasetasExcel(): number {
    return this.filasRevisionCasetasExcel.filter(f =>
      this.ubicacionResueltaExcel(f) !== f.ubicacionActualId && f.opcion !== 'PENDIENTE'
    ).length;
  }

  private ubicacionResueltaExcel(fila: FilaRevisionCasetaExcel): number | null {
    if (fila.opcion === 'EXCEL') return fila.ubicacionExcelId;
    if (fila.opcion === 'MANUAL') return fila.ubicacionManualId;
    return fila.ubicacionActualId;
  }

  resolverFilaCasetaExcel(fila: FilaRevisionCasetaExcel, opcion: string): void {
    if (!['PENDIENTE', 'CONSERVAR', 'EXCEL', 'MANUAL'].includes(opcion)) return;
    if (opcion === 'EXCEL' && !fila.puedeUsarExcel) return;
    fila.opcion = opcion as FilaRevisionCasetaExcel['opcion'];
    this.actualizarConflictosCasetasExcel();
    this.error = '';
    this.cdr.detectChanges();
  }

  /** Acciones masivas explícitas; nunca sobreescriben ni guardan silenciosamente. */
  resolverPendientesCasetasExcel(opcion: 'CONSERVAR' | 'EXCEL'): void {
    for (const fila of this.filasRevisionCasetasExcel) {
      if (fila.opcion !== 'PENDIENTE') continue;
      if (opcion === 'EXCEL' && !fila.puedeUsarExcel) continue;
      fila.opcion = opcion;
    }
    this.actualizarConflictosCasetasExcel();
    this.error = '';
    this.cdr.detectChanges();
  }

  seleccionarCasetaManualExcel(fila: FilaRevisionCasetaExcel, valor: string): void {
    fila.ubicacionManualId = valor === 'NINGUNA' ? null : Number(valor);
    fila.opcion = 'MANUAL';
    this.actualizarConflictosCasetasExcel();
    this.error = '';
    this.cdr.detectChanges();
  }

  /** Incluir a un ocupante no mencionado en el Excel, solo si el controlador lo elige. */
  revisarOcupanteCasetaExcel(programacionId: number): void {
    if (this.filasRevisionCasetasExcel.some(f => f.programacionId === programacionId)) return;
    const p = this.programaciones.find(x => x.programacionId === programacionId);
    if (!p) return;
    const actualId = this.asignacionesGuardadas.get(programacionId) ?? null;
    const actual = this.ubicaciones.find(u => u.id === actualId);
    this.filasRevisionCasetasExcel.push({
      programacionId,
      codigoTrabajador: p.codigoTrabajador,
      trabajador: p.nombreTrabajador,
      fecha: p.fecha,
      turno: p.estado,
      casetaActual: actual?.codigo ?? 'Sin asignar',
      casetaExcel: 'No incluido en Excel',
      ubicacionActualId: actualId,
      ubicacionExcelId: null,
      puedeUsarExcel: false,
      opcion: 'PENDIENTE',
      ubicacionManualId: actualId,
      motivo: 'Esta caseta ya está ocupada. Decide si conservarla, liberarla o asignar otra ubicación; no se quitará automáticamente.',
      origen: 'OCUPANTE'
    });
    this.actualizarConflictosCasetasExcel();
    this.cdr.detectChanges();
  }

  tieneFilaRevisionCasetaExcel(programacionId: number): boolean {
    return this.filasRevisionCasetasExcel.some(f => f.programacionId === programacionId);
  }

  private actualizarConflictosCasetasExcel(): void {
    const plan = new Map<number, number>(this.asignacionesGuardadas);
    const afectados = new Set<number>();
    for (const fila of this.filasRevisionCasetasExcel) {
      if (fila.opcion !== 'EXCEL' && fila.opcion !== 'MANUAL') continue;
      const destino = this.ubicacionResueltaExcel(fila);
      if (destino !== fila.ubicacionActualId) afectados.add(fila.programacionId);
      if (destino === null) plan.delete(fila.programacionId);
      else plan.set(fila.programacionId, destino);
    }
    const grupos = new Map<string, ConflictoCasetaExcel[]>();
    const ubicaciones = new Map(this.ubicaciones.map(u => [u.id, u] as const));
    for (const p of this.programaciones) {
      if (!['A', 'B', 'C'].includes(p.estado)) continue;
      const ubicacionId = plan.get(p.programacionId);
      if (ubicacionId === undefined) continue;
      const lugar = ubicaciones.get(ubicacionId);
      if (!lugar) continue;
      const llave = `${p.fecha}|${p.estado}|${ubicacionId}`;
      const lista = grupos.get(llave) ?? [];
      lista.push({ fecha: p.fecha, turno: p.estado, caseta: lugar.codigo,
        programacionId: p.programacionId, codigo: p.codigoTrabajador, trabajador: p.nombreTrabajador });
      grupos.set(llave, lista);
    }
    this.conflictosRevisionCasetasExcel = [];
    for (const lista of grupos.values()) {
      if (lista.length < 2 || !lista.some(a => afectados.has(a.programacionId))) continue;
      this.conflictosRevisionCasetasExcel.push({
        fecha: lista[0].fecha,
        turno: lista[0].turno,
        caseta: lista[0].caseta,
        ocupantes: lista
      });
    }
    this.loteSeguroCasetasExcel = this.construirLoteSeguroCasetasExcel();
  }


  previsualizarImportacionExcel(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    this.vistaPreviaImportacion = null;
    this.vistaPreviaTurnosCasetas = null;
    if (!archivo) return;
    if (!this.plazaId || this.cargando || this.guardando) return;
    if (this.cambios.size > 0) {
      this.error = 'Guarda o descarta primero los cambios pendientes antes de importar Excel.';
      this.cdr.detectChanges();
      return;
    }
    if (!archivo.name.toLowerCase().endsWith('.xlsx') || archivo.size > 2 * 1024 * 1024) {
      this.error = 'Selecciona un archivo .xlsx de máximo 2 MB.';
      this.cdr.detectChanges();
      return;
    }
    this.importandoExcel = true;
    this.error = '';
    this.mensaje = '';
    this.api.previsualizarExcelDistribucion(this.plazaId, archivo, this.anio, this.mes)
      .pipe(finalize(() => {
        this.importandoExcel = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: previa => {
          this.vistaPreviaImportacion = previa;
          if (!previa.valido) {
            this.error = `El Excel contiene ${previa.errores.length} error(es). Corrígelos antes de aplicar.`;
          } else {
            this.mensaje = `Excel leído: ${previa.cambios.length} cambios propuestos. No se guardó nada.`;
          }
          this.cdr.detectChanges();
        },
        error: e => {
          this.error = this.mensajeError(e,
            'No se pudo importar el Excel. Revisa el formato y el mes seleccionado.');
          this.cdr.detectChanges();
        }
      });
  }

  /** Aplica únicamente las decisiones validadas: nunca guarda en la base de datos. */
  /**
   * Calcula un subconjunto seguro, SIN alterar la matriz ni la base de datos.
   * Se validan todas las propuestas elegidas juntas (incluidos intercambios),
   * y se excluyen iterativamente las que producen ocupaciones duplicadas.
   */
  private construirLoteSeguroCasetasExcel(): {
    propuestas: Array<{ id: number; ubicacionId: number | null }>;
    pendientes: string[];
    excluidas: string[];
  } {
    const candidatas = new Map<number, { id: number; ubicacionId: number | null }>();
    const pendientes: string[] = [];
    const excluidas: string[] = [];
    const programacionesPorId = new Map(this.programaciones.map(p => [p.programacionId, p] as const));
    const ubicacionesPorId = new Map(this.ubicaciones.map(u => [u.id, u] as const));
    const referencias = new Map<number, string>();

    for (const fila of this.filasRevisionCasetasExcel) {
      const referencia = `${fila.fecha} · ${fila.turno} · Código ${fila.codigoTrabajador}`;
      referencias.set(fila.programacionId, referencia);
      if (fila.opcion === 'PENDIENTE') {
        pendientes.push(`${referencia}: SIGO ${fila.casetaActual}, Excel ${fila.casetaExcel}; falta una decisión del controlador.`);
        continue;
      }
      if (fila.opcion === 'CONSERVAR') continue;
      if (fila.opcion === 'EXCEL' && !fila.puedeUsarExcel) {
        excluidas.push(`${referencia}: el valor del Excel no es una caseta válida para este turno.`);
        continue;
      }
      const destino = this.ubicacionResueltaExcel(fila);
      if (destino === fila.ubicacionActualId) continue;
      const p = programacionesPorId.get(fila.programacionId);
      if (!p || p.codigoTrabajador !== fila.codigoTrabajador || p.fecha !== fila.fecha || p.estado !== fila.turno) {
        excluidas.push(`${referencia}: la programación cambió respecto de la vista previa.`);
        continue;
      }
      if (destino !== null) {
        const ubicacion = ubicacionesPorId.get(destino);
        if (!ubicacion || !ubicacion.activo || !['A', 'B', 'C'].includes(p.estado) ||
            !this.ubicacionHabilitadaParaTurno(ubicacion, p.estado)) {
          excluidas.push(`${referencia}: la caseta seleccionada no existe, no está activa o no admite el turno.`);
          continue;
        }
      }
      candidatas.set(fila.programacionId, { id: fila.programacionId, ubicacionId: destino });
    }

    // Es importante calcular el resultado CONJUNTO. Por ejemplo, un intercambio
    // 101 ↔ 102 es válido si ambos movimientos fueron elegidos explícitamente.
    // Si una propuesta falla, volvemos a calcular con su ocupación original,
    // porque eso podría bloquear una segunda propuesta que dependía de ella.
    let cambio: boolean;
    do {
      cambio = false;
      const plan = new Map<number, number>(this.asignacionesGuardadas);
      for (const propuesta of candidatas.values()) {
        if (propuesta.ubicacionId === null) plan.delete(propuesta.id);
        else plan.set(propuesta.id, propuesta.ubicacionId);
      }
      const ocupantes = new Map<string, number[]>();
      for (const p of this.programaciones) {
        if (!['A', 'B', 'C'].includes(p.estado)) continue;
        const ubicacionId = plan.get(p.programacionId);
        if (ubicacionId === undefined) continue;
        const clave = `${p.fecha}|${p.estado}|${ubicacionId}`;
        const lista = ocupantes.get(clave) ?? [];
        lista.push(p.programacionId);
        ocupantes.set(clave, lista);
      }
      const descartar = new Set<number>();
      for (const [clave, ids] of ocupantes) {
        if (ids.length < 2) continue;
        for (const id of ids) {
          if (!candidatas.has(id)) continue;
          descartar.add(id);
        }
        // Las colisiones preexistentes que no implican ningún cambio del lote
        // no se resuelven ni se alteran silenciosamente en esta importación.
        if (ids.some(id => candidatas.has(id))) {
          const involucrados = ids.map(id => programacionesPorId.get(id)?.codigoTrabajador ?? id);
          for (const id of ids) {
            if (!candidatas.has(id)) continue;
            excluidas.push(`${referencias.get(id) ?? 'Programación ' + id}: caseta duplicada ` +
              `(${clave.replace(/\|/g, ' · ')}), códigos ${involucrados.join(' y ')}; no se aplicó esta propuesta.`);
          }
        }
      }
      for (const id of descartar) {
        if (candidatas.delete(id)) cambio = true;
      }
    } while (cambio);

    return { propuestas: [...candidatas.values()], pendientes, excluidas };
  }

  loteSeguroCasetasExcel: {
    propuestas: Array<{ id: number; ubicacionId: number | null }>;
    pendientes: string[];
    excluidas: string[];
  } = { propuestas: [], pendientes: [], excluidas: [] };

  /** Información persistente en la interfaz hasta confirmar el guardado. */
  resumenImportacionParcialCasetas: {
    aplicadas: number;
    pendientes: number;
    excluidas: number;
    detalle: string[];
  } | null = null;

  /** Aplica SOLO las casetas seguras al borrador, previo aviso si queda algo fuera. */
  aplicarImportacionExcel(): void {
    if (!this.vistaPreviaImportacion || !this.plazaId || this.cargando || this.guardando ||
        this.cambios.size > 0) return;
    if (this.plazaExcelEnRevision !== this.plazaId ||
        this.anioExcelEnRevision !== this.anio || this.mesExcelEnRevision !== this.mes) {
      this.error = 'Cambiaste de plaza o mes. Importa el Excel nuevamente.';
      this.cdr.detectChanges();
      return;
    }
    const lote = this.construirLoteSeguroCasetasExcel();
    if (!lote.propuestas.length) {
      this.error = 'No hay asignaciones seguras por aplicar. Revisa las decisiones o las casetas duplicadas.';
      this.cdr.detectChanges();
      return;
    }
    if (lote.pendientes.length || lote.excluidas.length) {
      const aceptar = window.confirm(
        `IMPORTACIÓN PARCIAL DE CASETAS\n\n` +
        `Cambios válidos que pasarán a la tabla: ${lote.propuestas.length}\n` +
        `Decisiones pendientes (NO se aplican): ${lote.pendientes.length}\n` +
        `Asignaciones excluidas por validación (NO se aplican): ${lote.excluidas.length}\n\n` +
        `Ningún cambio se guardará aún en PostgreSQL.\n` +
        `Las casetas no aplicadas conservarán su valor actual en SIGO.\n\n` +
        `¿Deseas aplicar solo los cambios válidos al borrador mensual?`
      );
      if (!aceptar) return;
    }
    const originales = new Map(this.asignaciones);
    const pendientesOriginales = new Map(this.cambios);
    for (const propuesta of lote.propuestas) {
      this.cambiar(propuesta.id, propuesta.ubicacionId);
      if ((this.asignaciones.get(propuesta.id) ?? null) !== propuesta.ubicacionId) {
        this.asignaciones.clear();
        for (const [id, valor] of originales) this.asignaciones.set(id, valor);
        this.cambios.clear();
        for (const [id, valor] of pendientesOriginales) this.cambios.set(id, valor);
        this.error = 'No se aplicó ningún cambio: una asignación no pudo incorporarse al borrador.';
        this.cdr.detectChanges();
        return;
      }
    }
    const pendientes = lote.pendientes.length;
    const excluidas = lote.excluidas.length;
    const detalle = [...lote.pendientes, ...lote.excluidas];
    const aplicadas = lote.propuestas.length;
    this.descartarImportacionExcel();
    this.resumenImportacionParcialCasetas = { aplicadas, pendientes, excluidas, detalle };
    this.mensaje = `Se aplicaron ${aplicadas} asignaciones al borrador. ` +
      `${pendientes} decisiones pendientes y ${excluidas} propuestas excluidas conservaron sus casetas anteriores. ` +
      'Revisa la matriz antes de Guardar cambios.';
    this.error = '';
    this.cdr.detectChanges();
  }

  descartarImportacionExcel(): void {
    this.filasRevisionCasetasExcel = [];
    this.observacionesRevisionCasetasExcel = [];
    this.conflictosRevisionCasetasExcel = [];
    this.coincidenciasCasetasExcel = 0;
    this.celdasCasetasExcel = 0;
    this.vistaPreviaImportacion = null;
    this.vistaPreviaTurnosCasetas = null;
    this.archivoExcelEnRevision = null;
    this.plazaExcelEnRevision = null;
    this.error = '';
    this.mensaje = '';
    this.cdr.detectChanges();
  }


  exportarReporteExcel(): void {
    if (!this.plazaId || !this.diasVisibles.length) {
      this.error = 'Selecciona una plaza y un periodo válido para exportar Excel.';
      this.cdr.detectChanges();
      return;
    }
    if (this.cambios.size > 0) {
      this.error = 'Guarda primero las asignaciones pendientes antes de exportar Excel.';
      this.cdr.detectChanges();
      return;
    }
    if (this.generandoReporteExcel) return;

    // El mismo rango exacto que utiliza el botón "Exportar PDF".
    const desde = this.fecha(this.diasVisibles[0]);
    const hasta = this.fecha(this.diasVisibles[this.diasVisibles.length - 1]);
    const plazaId = this.plazaId;
    const plazaCodigo = this.plazas.find(p => p.id === plazaId)?.codigo
      ?? this.auth.usuario()?.plaza ?? 'plaza';

    this.generandoReporteExcel = true;
    this.error = '';
    this.mensaje = '';
    this.cdr.detectChanges();

    this.api.getReporteDistribucionPlazaExcel(plazaId, desde, hasta)
      .pipe(finalize(() => {
        this.generandoReporteExcel = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `distribucion-${plazaCodigo}-${desde}-${hasta}.xlsx`;
          document.body.appendChild(enlace);
          enlace.click();
          enlace.remove();
          URL.revokeObjectURL(url);
          this.mensaje = this.filtroSemana === 0
            ? 'Excel mensual de distribución generado correctamente.'
            : 'Excel de la semana visible generado correctamente.';
          this.cdr.detectChanges();
        },
        error: e => {
          this.error = this.mensajeError(e,
            'No se pudo generar el Excel de distribución.');
          this.cdr.detectChanges();
        }
      });
  }

  exportarReporteMatrizPdf(): void {

    if (
      !this.plazaId ||
      !this.diasVisibles.length
    ) {
      this.error =
        'Selecciona una plaza y un periodo válido para exportar el PDF.';

      this.cdr.detectChanges();

      return;
    }

    if (
      this.cambios.size > 0
    ) {
      this.error =
        'Guarda primero las asignaciones pendientes antes de exportar el PDF.';

      this.cdr.detectChanges();

      return;
    }

    if (
      this.generandoReporteMatrizPdf
    ) {
      return;
    }

    const primerDia =
      this.diasVisibles[0];

    const ultimoDia =
      this.diasVisibles[
        this.diasVisibles.length - 1
      ];

    const desde =
      this.fecha(
        primerDia
      );

    const hasta =
      this.fecha(
        ultimoDia
      );

    this.generandoReporteMatrizPdf =
      true;

    this.error =
      '';

    this.mensaje =
      '';

    this.cdr.detectChanges();

    this.api
      .getReporteDistribucionPlazaPdf(
        this.plazaId,
        desde,
        hasta
      )
      .pipe(
        finalize(
          () => {
            this.generandoReporteMatrizPdf =
              false;

            this.cdr.detectChanges();
          }
        )
      )
      .subscribe({
        next: blob => {
          const plaza =
            this.plazas
              .find(
                item =>
                  item.id ===
                  this.plazaId
              );

          const plazaCodigo =
            plaza?.codigo ??
            this.auth.usuario()?.plaza ??
            'plaza';

          const url =
            URL.createObjectURL(
              blob
            );

          const enlace =
            document.createElement(
              'a'
            );

          enlace.href =
            url;

          enlace.download =
            `distribucion-${plazaCodigo}-${desde}-${hasta}.pdf`;

          document.body
            .appendChild(
              enlace
            );

          enlace.click();

          enlace.remove();

          URL.revokeObjectURL(
            url
          );

          this.mensaje =
            this.filtroSemana === 0
              ? 'PDF mensual de distribución generado correctamente.'
              : 'PDF de la semana visible generado correctamente.';

          this.cdr.detectChanges();
        },

        error: e => {
          this.error =
            this.mensajeError(
              e,
              'No se pudo generar el PDF de distribución.'
            );

          this.cdr.detectChanges();
        }
      });
  }


  abrirReportePdf(): void {

    if (
      !this.seleccionado
    ) {
      this.error =
        'Selecciona primero un agente para generar su reporte PDF.';
      this.cdr.detectChanges();
      return;
    }

    if (
      this.cambios.size > 0
    ) {
      this.error =
        'Guarda primero las asignaciones pendientes antes de generar el PDF.';
      this.cdr.detectChanges();
      return;
    }

    this.modalDetalleAgenteAbierto =
      false;

    this.modoReportePdf =
      'MES';

    this.configurarFechasMesReporte();

    this.errorReportePdf =
      '';

    this.modalReportePdfAbierto =
      true;

    this.cdr.detectChanges();
  }


  cerrarReportePdf(): void {

    if (
      this.generandoReportePdf
    ) {
      return;
    }

    this.modalReportePdfAbierto =
      false;

    this.errorReportePdf =
      '';

    this.cdr.detectChanges();
  }


  cambiarModoReportePdf(
    modo: 'MES' | 'RANGO'
  ): void {

    this.modoReportePdf =
      modo;

    this.errorReportePdf =
      '';

    if (
      modo === 'MES'
    ) {
      this.configurarFechasMesReporte();
    }

    this.cdr.detectChanges();
  }


  private configurarFechasMesReporte(): void {

    const ultimoDia =
      new Date(
        this.anio,
        this.mes,
        0
      )
        .getDate();

    this.reportePdfDesde =
      `${this.anio}-${String(
        this.mes
      ).padStart(
        2,
        '0'
      )}-01`;

    this.reportePdfHasta =
      `${this.anio}-${String(
        this.mes
      ).padStart(
        2,
        '0'
      )}-${String(
        ultimoDia
      ).padStart(
        2,
        '0'
      )}`;
  }


  generarReportePdf(): void {

    if (
      !this.seleccionado
    ) {
      return;
    }

    if (
      this.cambios.size > 0
    ) {
      this.errorReportePdf =
        'Hay asignaciones sin guardar. Guarda los cambios antes de generar el PDF.';
      this.cdr.detectChanges();
      return;
    }

    if (
      !this.reportePdfDesde ||
      !this.reportePdfHasta
    ) {
      this.errorReportePdf =
        'Selecciona la fecha desde y la fecha hasta.';
      this.cdr.detectChanges();
      return;
    }

    if (
      this.reportePdfDesde >
        this.reportePdfHasta
    ) {
      this.errorReportePdf =
        'La fecha desde no puede ser posterior a la fecha hasta.';
      this.cdr.detectChanges();
      return;
    }

    this.generandoReportePdf =
      true;

    this.errorReportePdf =
      '';

    this.cdr.detectChanges();

    const trabajadorId =
      this.seleccionado;

    this.api
      .getReporteDistribucionTrabajadorPdf(
        trabajadorId,
        this.reportePdfDesde,
        this.reportePdfHasta
      )
      .pipe(
        finalize(() => {
          this.generandoReportePdf =
            false;

          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: blob => {
          const agente =
            this.agenteSeleccionado;

          const codigo =
            agente?.codigo ??
            trabajadorId;

          const url =
            URL.createObjectURL(
              blob
            );

          const enlace =
            document.createElement(
              'a'
            );

          enlace.href =
            url;

          enlace.download =
            `distribucion-${codigo}-${this.reportePdfDesde}-${this.reportePdfHasta}.pdf`;

          document.body
            .appendChild(
              enlace
            );

          enlace.click();

          enlace.remove();

          URL.revokeObjectURL(
            url
          );

          this.modalReportePdfAbierto =
            false;

          this.mensaje =
            'Reporte PDF generado correctamente.';

          this.cdr.detectChanges();
        },

        error: e => {
          this.errorReportePdf =
            this.mensajeError(
              e,
              'No se pudo generar el reporte PDF.'
            );

          this.cdr.detectChanges();
        }
      });
  }


  cargarCobertura(): void {

    if (
      !this.plazaId
    ) {
      return;
    }

    this.cargandoCobertura =
      true;

    this.api
      .getCobertura(
        this.plazaId,
        this.anio,
        this.mes
      )
      .pipe(

        finalize(() => {

          this.cargandoCobertura =
            false;

          this.cdr.detectChanges();

        })

      )
      .subscribe({

        next: (
          cobertura
        ) => {

          this.cobertura =
            [...cobertura];

          this.cdr.detectChanges();

        },

        error: (
          e
        ) => {

          console.error(
            'Error cargando cobertura:',
            e
          );

          this.cobertura =
            [];

          this.cdr.detectChanges();

        }

      });
  }

  cargarResumen(
    trabajadorId: number
  ): void {

    this.cargandoResumen =
      true;

    this.api
      .getResumenTrabajador(
        trabajadorId,
        this.anio,
        this.mes
      )
      .pipe(

        finalize(() => {

          this.cargandoResumen =
            false;

          this.cdr.detectChanges();

        })

      )
      .subscribe({

        next: (
          resumen
        ) => {

          this.resumen =
            resumen;

          this.cdr.detectChanges();

        },

        error: (
          e
        ) => {

          console.error(
            'Error cargando resumen:',
            e
          );

          this.resumen =
            null;

          this.cdr.detectChanges();

        }

      });
  }

  programacion(
    agenteId: number,
    dia: number
  ): ProgramacionDia | null {

    const fecha =
      this.fecha(
        dia
      );

    return (
      this.programaciones
        .find(
          programacion =>

            programacion
              .trabajadorId ===
              agenteId &&

            programacion
              .fecha ===
              fecha
        ) ??
      null
    );
  }

  asignacion(
    programacionId: number
  ): number | null {

    return (
      this.asignaciones
        .get(
          programacionId
        ) ??
      null
    );
  }

  cambiar(
    programacionId: number,
    ubicacionId: number | null
  ): void {

    const valorGuardado =
      this.asignacionesGuardadas
        .get(
          programacionId
        ) ??
      null;

    /*
     * "Sin asignar" es un estado válido.
     *
     * - Si la celda nunca estuvo guardada, volver a "-" simplemente
     *   descarta el cambio pendiente.
     * - Si la celda tenía una caseta guardada, registramos null para
     *   que backend elimine esa asignación al pulsar Guardar cambios.
     */
    if (
      ubicacionId === null ||
      ubicacionId === undefined
    ) {
      this.error =
        '';

      this.asignaciones
        .delete(
          programacionId
        );

      if (
        valorGuardado ===
          null
      ) {
        this.cambios
          .delete(
            programacionId
          );
      }
      else {
        this.cambios
          .set(
            programacionId,
            null
          );
      }

      this.observacionesPorProgramacion
        .delete(
          programacionId
        );

      this.cdr.detectChanges();
      return;
    }

    const nuevaUbicacionId =
      Number(
        ubicacionId
      );

    const programacionActual =
      this.programaciones
        .find(
          p =>
            p.programacionId ===
            programacionId
        );

    if (
      !programacionActual
    ) {
      return;
    }

    const ubicacionNueva =
      this.ubicaciones
        .find(
          ubicacion =>
            ubicacion.id ===
            nuevaUbicacionId
        );

    /*
     * En edición manual solo validamos que la caseta exista, esté activa
     * y pueda usarse en ese turno. Las reglas globales se validan al guardar.
     */
    if (
      !ubicacionNueva ||
      !ubicacionNueva.activo ||
      !this.ubicacionHabilitadaParaTurno(
        ubicacionNueva,
        programacionActual.estado
      )
    ) {
      this.error =
        'La caseta seleccionada no está disponible para este turno.';

      this.cdr.detectChanges();
      return;
    }

    this.error =
      '';

    this.asignaciones
      .set(
        programacionId,
        nuevaUbicacionId
      );

    if (
      valorGuardado ===
        nuevaUbicacionId
    ) {
      this.cambios
        .delete(
          programacionId
        );
    }
    else {
      this.cambios
        .set(
          programacionId,
          nuevaUbicacionId
        );
    }

    this.observacionesPorProgramacion
      .delete(
        programacionId
      );

    this.cdr.detectChanges();
  }


  cerrarConflicto(): void {

    this.conflictoVisible =
      false;

    this.conflictoInfo =
      null;

    this.cdr.detectChanges();
  }

  private validarMatrizAntesDeGuardar(): string | null {

    const ubicacionPorId =
      new Map(
        this.ubicaciones
          .map(
            ubicacion => [
              ubicacion.id,
              ubicacion
            ] as const
          )
      );

    const programacionPorAgenteFecha =
      new Map<string, ProgramacionDia>();

    for (
      const programacion
      of this.programaciones
    ) {
      if (
        !this.esOperativo(
          programacion.estado
        )
      ) {
        continue;
      }

      programacionPorAgenteFecha.set(
        `${programacion.trabajadorId}|${programacion.fecha}`,
        programacion
      );
    }

    for (
      const actual
      of this.programaciones
    ) {
      if (
        !this.esOperativo(
          actual.estado
        )
      ) {
        continue;
      }

      const ubicacionActualId =
        this.asignacion(
          actual.programacionId
        );

      if (
        !ubicacionActualId
      ) {
        continue;
      }

      const ubicacionActual =
        ubicacionPorId.get(
          ubicacionActualId
        );

      if (
        !ubicacionActual
      ) {
        continue;
      }

      const anterior =
        programacionPorAgenteFecha.get(
          `${actual.trabajadorId}|${this.fechaAnterior(actual.fecha)}`
        );

      if (
        !anterior
      ) {
        continue;
      }

      const ubicacionAnteriorId =
        this.asignacion(
          anterior.programacionId
        );

      if (
        !ubicacionAnteriorId
      ) {
        continue;
      }

      const ubicacionAnterior =
        ubicacionPorId.get(
          ubicacionAnteriorId
        );

      if (
        !ubicacionAnterior
      ) {
        continue;
      }

      const actualEsAuxiliarOApoyo =
        ubicacionActual.tipo ===
          'AUXILIAR' ||
        ubicacionActual.tipo ===
          'APOYO';

      const anteriorEsAuxiliarOApoyo =
        ubicacionAnterior.tipo ===
          'AUXILIAR' ||
        ubicacionAnterior.tipo ===
          'APOYO';

      if (
        actualEsAuxiliarOApoyo &&
        anteriorEsAuxiliarOApoyo
      ) {
        const agente =
          this.agentes.find(
            item =>
              item.id ===
                actual.trabajadorId
          );

        return (
          `${agente?.nombreCompleto ?? actual.nombreTrabajador} tiene dos días seguidos en AUXILIAR/APOYO: ` +
          `${this.fechaAnterior(actual.fecha)} = ${ubicacionAnterior.codigo} y ` +
          `${actual.fecha} = ${ubicacionActual.codigo}. Cambia una de esas dos asignaciones por una VIA.`
        );
      }

      if (
        anterior.estado ===
          actual.estado &&
        ubicacionAnteriorId ===
          ubicacionActualId
      ) {
        return (
          `${actual.nombreTrabajador} repite la caseta ${ubicacionActual.codigo} ` +
          `en días consecutivos manteniendo el turno ${actual.estado}: ` +
          `${anterior.fecha} y ${actual.fecha}.`
        );
      }
    }

    return null;
  }


  guardar(
    forzar = false
  ): void {

    if (
      !this.plazaId ||
      this.cambios.size ===
        0
    ) {
      return;
    }

    const errorMatriz =
      this.validarMatrizAntesDeGuardar();

    if (
      errorMatriz &&
      !forzar
    ) {
      this.error =
        errorMatriz;

      this.tipoResultadoDistribucion =
        'error';

      this.tituloResultadoDistribucion =
        'La distribución incumple una regla';

      this.mensajeResultadoDistribucion =
        errorMatriz +
        ' Puedes corregir la asignación o guardarla de todos modos como una excepción operativa.';

      this.observacionesResultadoDistribucion =
        [];

      this.guardadoForzadoDisponible =
        true;

      this.modalResultadoDistribucionAbierto =
        true;

      this.cdr.detectChanges();
      return;
    }

    if (this.resumenImportacionParcialCasetas &&
        (this.resumenImportacionParcialCasetas.pendientes > 0 ||
         this.resumenImportacionParcialCasetas.excluidas > 0)) {
      const resumen = this.resumenImportacionParcialCasetas;
      const aceptar = window.confirm(
        `ATENCIÓN: GUARDADO DE UN LOTE INCOMPLETO\n\n` +
        `Cambios actualmente pendientes en la matriz: ${this.cambios.size}\n` +
        `Decisiones que no ingresaron en el lote importado: ${resumen.pendientes}\n` +
        `Asignaciones excluidas de la importación: ${resumen.excluidas}\n\n` +
        `Los casos no importados conservaron su valor en SIGO (salvo si tú los editaste después).\n` +
        `Se guardarán solamente los cambios presentes en la matriz.\n` +
        `¿Confirmas expresamente guardar este borrador parcial?`
      );
      if (!aceptar) return;
    }
    this.guardadoForzadoDisponible =
      false;

    /*
     * Guardado parcial:
     * enviamos únicamente las celdas que el usuario modificó.
     *
     * De esta forma se pueden confirmar solo los días que ya están
     * definidos y dejar el resto del mes sin caseta hasta que se
     * actualice la programación de personal.
     *
     * ubicacionId = null significa "Sin asignar" y permite retirar una
     * asignación que ya existía en base de datos.
     */
    const cambiosEnviados =
      new Map(
        this.cambios
      );

    const distribuciones =
      [...cambiosEnviados.entries()]
        .map(
          ([
            programacionTurnoId,
            ubicacionId
          ]) => ({
            programacionTurnoId,
            ubicacionId,
            observacion:
              null
          })
        );

    this.guardando =
      true;

    this.totalAsignacionesGuardando =
      distribuciones.length;

    this.error =
      '';

    this.mensaje =
      '';

    this.modalResultadoDistribucionAbierto =
      false;

    this.cdr.detectChanges();

    this.api
      .guardarDistribucion({

        plazaId:
          this.plazaId,

        distribuciones,

        forzar

      })
      .pipe(

        finalize(() => {

          this.guardando =
            false;

          this.totalAsignacionesGuardando =
            0;

          this.cdr.detectChanges();

        })

      )
      .subscribe({

        next: (
          guardadas
        ) => {
          this.resumenImportacionParcialCasetas = null;

          /*
           * Aplicamos también las desasignaciones, que no aparecen en la
           * respuesta porque ya no existe un registro de distribución.
           */
          for (
            const [
              programacionTurnoId,
              ubicacionId
            ]
            of cambiosEnviados
          ) {
            if (
              ubicacionId ===
                null
            ) {
              this.asignaciones
                .delete(
                  programacionTurnoId
                );

              this.asignacionesGuardadas
                .delete(
                  programacionTurnoId
                );
            }
            else {
              this.asignaciones
                .set(
                  programacionTurnoId,
                  ubicacionId
                );

              this.asignacionesGuardadas
                .set(
                  programacionTurnoId,
                  ubicacionId
                );
            }
          }

          for (
            const item
            of guardadas
          ) {
            this.asignaciones
              .set(
                item.programacionTurnoId,
                item.ubicacionId
              );

            this.asignacionesGuardadas
              .set(
                item.programacionTurnoId,
                item.ubicacionId
              );
          }

          /*
           * Quitamos solo los cambios incluidos en esta petición.
           * Si en el futuro la UI permite editar mientras se guarda,
           * un cambio posterior no se perderá.
           */
          for (
            const [
              programacionTurnoId,
              valorEnviado
            ]
            of cambiosEnviados
          ) {
            if (
              this.cambios.has(
                programacionTurnoId
              ) &&
              this.cambios.get(
                programacionTurnoId
              ) ===
                valorEnviado
            ) {
              this.cambios
                .delete(
                  programacionTurnoId
                );
            }
          }

          const totalCambios =
            cambiosEnviados.size;

          const totalSinAsignar =
            [...cambiosEnviados.values()]
              .filter(
                ubicacionId =>
                  ubicacionId ===
                    null
              )
              .length;

          const totalAsignadas =
            totalCambios -
            totalSinAsignar;

          this.mensaje =
            forzar
              ? 'Cambios guardados como excepción operativa.'
              : 'Cambios de distribución guardados correctamente.';

          this.guardadoForzadoDisponible =
            false;

          this.tipoResultadoDistribucion =
            'success';

          this.tituloResultadoDistribucion =
            forzar
              ? 'Cambios guardados de todos modos'
              : 'Cambios guardados';

          const detalleGuardado =
            totalSinAsignar > 0
              ? `Se guardaron ${totalCambios} cambio(s): ${totalAsignadas} asignación(es) y ${totalSinAsignar} celda(s) quedaron sin caseta.`
              : `Se guardaron ${totalCambios} asignación(es).`;

          this.mensajeResultadoDistribucion =
            forzar
              ? `${detalleGuardado} El guardado fue forzado y puede incumplir reglas operativas de distribución.`
              : `${detalleGuardado} Los demás días pueden permanecer sin caseta y completarse después.`;

          this.observacionesResultadoDistribucion =
            [];

          this.observacionesPorProgramacion
            .clear();

          this.modalResultadoDistribucionAbierto =
            true;

          this.cdr.detectChanges();

        },

        error: (
          e
        ) => {

          console.error(
            'Error guardando distribución:',
            e
          );

          this.error =
            this.mensajeError(
              e,
              'No se pudo guardar la distribución.'
            );

          this.tipoResultadoDistribucion =
            'error';

          this.guardadoForzadoDisponible =
            !forzar;

          this.tituloResultadoDistribucion =
            forzar
              ? 'No se pudo guardar la excepción'
              : 'La distribución incumple una regla';

          this.mensajeResultadoDistribucion =
            forzar
              ? this.error
              : this.error +
                ' Puedes corregir la asignación o intentar guardarla de todos modos.';

          this.observacionesResultadoDistribucion =
            [];

          this.modalResultadoDistribucionAbierto =
            true;

          this.cdr.detectChanges();

        }

      });
  }


  exportarJsonDiagnostico(): void {

    if (
      !this.plazaId ||
      this.exportandoJson
    ) {
      return;
    }

    this.exportandoJson =
      true;

    this.error =
      '';

    this.mensaje =
      '';

    const plazaId =
      this.plazaId;

    const mesAnteriorFecha =
      new Date(
        this.anio,
        this.mes - 2,
        1
      );

    const anioAnterior =
      mesAnteriorFecha
        .getFullYear();

    const mesAnterior =
      mesAnteriorFecha
        .getMonth() + 1;

    forkJoin({
      configuracion:
        this.api
          .getConfiguracionGeneradorCasetas(
            plazaId
          ),
      casetas:
        this.api
          .getCasetasGenerador(
            plazaId
          ),
      restricciones:
        this.api
          .getRestriccionesCasetas(
            plazaId
          ),
      distribucionAnterior:
        this.api
          .getDistribucion(
            plazaId,
            anioAnterior,
            mesAnterior
          )
    })
      .pipe(
        finalize(() => {

          this.exportandoJson =
            false;

          this.cdr.detectChanges();

        })
      )
      .subscribe({

        next: (
          contexto
        ) => {

          const plaza =
            this.plazas
              .find(
                item =>
                  item.id ===
                  plazaId
              ) ??
            null;

          const ubicacionPorId =
            new Map(
              this.ubicaciones
                .map(
                  item => [
                    item.id,
                    item
                  ] as const
                )
            );

          const casetaPorId =
            new Map(
              contexto.casetas
                .map(
                  item => [
                    item.ubicacionId,
                    item
                  ] as const
                )
            );

          const agentePorId =
            new Map(
              this.agentes
                .map(
                  item => [
                    item.id,
                    item
                  ] as const
                )
            );

          const flujoPermiteAlternanciaTipo = (
            grupo: GrupoFlujoCaseta,
            turno: EstadoProgramacion
          ): boolean => {

            if (
              grupo ===
                'SIN_CLASIFICAR' ||
              turno === 'C'
            ) {
              return false;
            }

            const delFlujo =
              this.ubicaciones
                .filter(
                  ubicacion =>
                    ubicacion.activo &&
                    (
                      casetaPorId
                        .get(
                          ubicacion.id
                        )
                        ?.grupoFlujo ??
                      'SIN_CLASIFICAR'
                    ) === grupo
                );

            const tieneVia =
              delFlujo.some(
                ubicacion =>
                  ubicacion.tipo ===
                    'VIA'
              );

            const tieneAuxiliar =
              delFlujo.some(
                ubicacion =>
                  ubicacion.tipo ===
                    'AUXILIAR' &&
                  this.ubicacionHabilitadaParaTurno(
                    ubicacion,
                    turno
                  )
              );

            return (
              tieneVia &&
              tieneAuxiliar
            );
          };

          type HistorialFlujo = {
            fecha: string;
            ubicacionId: number;
            ubicacionCodigo: string;
            tipo: TipoUbicacion | null;
          };

          const ultimaPorAgenteFlujo =
            new Map<
              string,
              HistorialFlujo
            >();

          const historialAnterior =
            [...contexto.distribucionAnterior]
              .sort(
                (a, b) =>
                  a.fecha.localeCompare(
                    b.fecha
                  )
              );

          for (
            const item of
            historialAnterior
          ) {

            const caseta =
              casetaPorId.get(
                item.ubicacionId
              );

            const grupo =
              caseta?.grupoFlujo ??
              'SIN_CLASIFICAR';

            if (
              grupo ===
              'SIN_CLASIFICAR'
            ) {
              continue;
            }

            ultimaPorAgenteFlujo
              .set(
                `${item.trabajadorId}|${grupo}`,
                {
                  fecha:
                    item.fecha,
                  ubicacionId:
                    item.ubicacionId,
                  ubicacionCodigo:
                    item.ubicacionCodigo,
                  tipo:
                    item.ubicacionTipo ??
                    ubicacionPorId
                      .get(
                        item.ubicacionId
                      )
                      ?.tipo ??
                    null
                }
              );
          }

          const programacionesOperativas =
            this.programaciones
              .filter(
                item =>
                  this.esOperativo(
                    item.estado
                  )
              )
              .sort(
                (a, b) =>
                  a.fecha.localeCompare(
                    b.fecha
                  ) ||
                  a.estado.localeCompare(
                    b.estado
                  ) ||
                  a.codigoTrabajador -
                    b.codigoTrabajador
              );

          const asignaciones:
            Array<Record<string, unknown>> =
            [];

          const conflictos:
            Array<Record<string, unknown>> =
            [];

          const resumenTurnos =
            new Map<
              string,
              {
                fecha: string;
                turno: EstadoProgramacion;
                programados: number;
                asignados: number;
                sinAsignar: number;
                vias: number;
                auxiliares: number;
                apoyos: number;
                ubicacionesUsadas: string[];
                ubicacionesLibres: string[];
                duplicidades: string[];
                alertas: string[];
              }
            >();

          const obtenerResumen = (
            fecha: string,
            turno: EstadoProgramacion
          ) => {

            const key =
              `${fecha}|${turno}`;

            const existente =
              resumenTurnos
                .get(
                  key
                );

            if (
              existente
            ) {
              return existente;
            }

            const ubicacionesElegibles =
              this.ubicaciones
                .filter(
                  ubicacion =>
                    ubicacion.activo &&
                    (
                      turno !== 'C' ||
                      ubicacion.tipo ===
                        'VIA'
                    )
                )
                .map(
                  ubicacion =>
                    ubicacion.codigo
                );

            const creado = {
              fecha,
              turno,
              programados: 0,
              asignados: 0,
              sinAsignar: 0,
              vias: 0,
              auxiliares: 0,
              apoyos: 0,
              ubicacionesUsadas:
                [] as string[],
              ubicacionesLibres:
                ubicacionesElegibles,
              duplicidades:
                [] as string[],
              alertas:
                [] as string[]
            };

            resumenTurnos
              .set(
                key,
                creado
              );

            return creado;
          };

          const ocupacion =
            new Map<
              string,
              Map<number, number>
            >();

          for (
            const programacion of
            programacionesOperativas
          ) {

            const resumen =
              obtenerResumen(
                programacion.fecha,
                programacion.estado
              );

            resumen.programados++;

            const ubicacionId =
              this.asignacion(
                programacion.programacionId
              );

            if (
              !ubicacionId
            ) {

              resumen.sinAsignar++;

              conflictos.push({
                tipo:
                  'AGENTE_SIN_CASETA',
                programacionTurnoId:
                  programacion.programacionId,
                fecha:
                  programacion.fecha,
                turno:
                  programacion.estado,
                trabajadorId:
                  programacion.trabajadorId,
                codigoTrabajador:
                  programacion.codigoTrabajador,
                trabajador:
                  programacion.nombreTrabajador
              });

              continue;
            }

            const ubicacion =
              ubicacionPorId
                .get(
                  ubicacionId
                );

            const caseta =
              casetaPorId
                .get(
                  ubicacionId
                );

            const grupo =
              caseta?.grupoFlujo ??
              'SIN_CLASIFICAR';

            const historialKey =
              `${programacion.trabajadorId}|${grupo}`;

            const ultimaMismoFlujo =
              grupo ===
                'SIN_CLASIFICAR'
                ? null
                : (
                    ultimaPorAgenteFlujo
                      .get(
                        historialKey
                      ) ??
                    null
                  );

            const excepciones:
              string[] =
              [];

            if (
              ubicacion &&
              !this.ubicacionHabilitadaParaTurno(
                ubicacion,
                programacion.estado
              )
            ) {
              excepciones.push(
                'UBICACION_NO_HABILITADA_PARA_TURNO'
              );
            }

            if (
              ubicacion?.tipo ===
              'APOYO'
            ) {
              excepciones.push(
                'USO_DE_APOYO'
              );
            }

            if (
              flujoPermiteAlternanciaTipo(
                grupo,
                programacion.estado
              ) &&
              ultimaMismoFlujo &&
              ubicacion &&
              (
                ubicacion.tipo ===
                  'VIA' ||
                ubicacion.tipo ===
                  'AUXILIAR'
              ) &&
              ultimaMismoFlujo.tipo ===
                ubicacion.tipo
            ) {
              excepciones.push(
                'REPETICION_TIPO_EN_MISMO_FLUJO'
              );
            }

            const restriccion =
              contexto.restricciones
                .find(
                  item =>
                    item.activo &&
                    item.trabajadorId ===
                      programacion.trabajadorId &&
                    item.ubicacionId ===
                      ubicacionId
                );

            if (
              restriccion
            ) {
              excepciones.push(
                'CASETA_RESTRINGIDA_PARA_AGENTE'
              );
            }

            const agente =
              agentePorId.get(
                programacion.trabajadorId
              );

            asignaciones.push({
              programacionTurnoId:
                programacion.programacionId,
              fecha:
                programacion.fecha,
              turno:
                programacion.estado,
              agente: {
                id:
                  programacion.trabajadorId,
                codigo:
                  programacion.codigoTrabajador,
                nombre:
                  programacion.nombreTrabajador,
                grupo:
                  this.secuencias
                    .find(
                      secuencia =>
                        secuencia.agenteId ===
                          programacion.trabajadorId
                    )
                    ?.grupo ??
                  null,
                orden:
                  this.secuencias
                    .find(
                      secuencia =>
                        secuencia.agenteId ===
                          programacion.trabajadorId
                    )
                    ?.orden ??
                  null,
                activo:
                  agente?.activo ??
                  null
              },
              ubicacion: {
                id:
                  ubicacionId,
                codigo:
                  ubicacion?.codigo ??
                  null,
                nombre:
                  ubicacion?.nombre ??
                  null,
                tipo:
                  ubicacion?.tipo ??
                  null,
                orden:
                  ubicacion?.orden ??
                  null,
                activo:
                  ubicacion?.activo ??
                  null,
                habilitadaParaTurno:
                  ubicacion
                    ? this.ubicacionHabilitadaParaTurno(
                        ubicacion,
                        programacion.estado
                      )
                    : null
              },
              flujo:
                grupo,
              ultimaAsignacionMismoFlujo:
                ultimaMismoFlujo,
              cambioPendiente:
                this.cambios.has(
                  programacion.programacionId
                ),
              restriccionAplicable:
                restriccion
                  ? {
                      id:
                        restriccion.id,
                      motivo:
                        restriccion.motivo
                    }
                  : null,
              excepcionesDetectadas:
                excepciones
            });

            resumen.asignados++;

            if (
              ubicacion
            ) {

              switch (
                ubicacion.tipo
              ) {
                case 'VIA':
                  resumen.vias++;
                  break;

                case 'AUXILIAR':
                  resumen.auxiliares++;
                  break;

                case 'APOYO':
                  resumen.apoyos++;
                  break;
              }

              if (
                !resumen
                  .ubicacionesUsadas
                  .includes(
                    ubicacion.codigo
                  )
              ) {
                resumen
                  .ubicacionesUsadas
                  .push(
                    ubicacion.codigo
                  );
              }

              resumen
                .ubicacionesLibres =
                resumen
                  .ubicacionesLibres
                  .filter(
                    codigo =>
                      codigo !==
                        ubicacion.codigo
                  );

              const turnoKey =
                `${programacion.fecha}|${programacion.estado}`;

              const porUbicacion =
                ocupacion.get(
                  turnoKey
                ) ??
                new Map<number, number>();

              const cantidad =
                (
                  porUbicacion.get(
                    ubicacionId
                  ) ??
                  0
                ) + 1;

              porUbicacion.set(
                ubicacionId,
                cantidad
              );

              ocupacion.set(
                turnoKey,
                porUbicacion
              );

              if (
                cantidad > 1
              ) {
                resumen
                  .duplicidades
                  .push(
                    ubicacion.codigo
                  );
              }
            }

            if (
              grupo !==
              'SIN_CLASIFICAR' &&
              ubicacion
            ) {
              ultimaPorAgenteFlujo
                .set(
                  historialKey,
                  {
                    fecha:
                      programacion.fecha,
                    ubicacionId,
                    ubicacionCodigo:
                      ubicacion.codigo,
                    tipo:
                      ubicacion.tipo
                  }
                );
            }
          }

          const auxiliaresActivos =
            this.ubicaciones
              .filter(
                item =>
                  item.activo &&
                  item.tipo ===
                    'AUXILIAR'
              )
              .length;

          for (
            const resumen of
            resumenTurnos
              .values()
          ) {

            if (
              resumen.sinAsignar > 0 &&
              resumen
                .ubicacionesLibres
                .length > 0
            ) {
              resumen.alertas.push(
                'HAY_PERSONAL_SIN_ASIGNAR_Y_UBICACIONES_LIBRES'
              );
            }

            if (
              resumen
                .duplicidades
                .length > 0
            ) {
              resumen.alertas.push(
                'CASETA_DUPLICADA_EN_MISMO_TURNO'
              );
            }

            if (
              resumen.apoyos > 0 &&
              resumen.auxiliares <
                auxiliaresActivos
            ) {
              resumen.alertas.push(
                'APOYO_USADO_ANTES_DE_COMPLETAR_AUXILIARES'
              );
            }

            resumen.ubicacionesUsadas =
              [
                ...new Set(
                  resumen.ubicacionesUsadas
                )
              ].sort();

            resumen.ubicacionesLibres =
              [
                ...new Set(
                  resumen.ubicacionesLibres
                )
              ].sort();

            resumen.duplicidades =
              [
                ...new Set(
                  resumen.duplicidades
                )
              ].sort();
          }

          const payload = {
            versionDiagnostico:
              2,
            origen:
              '/programacion/distribucion',
            exportadoEn:
              new Date()
                .toISOString(),
            plaza: {
              id:
                plazaId,
              codigo:
                plaza?.codigo ??
                null,
              descripcion:
                plaza?.descripcion ??
                null
            },
            periodo: {
              anio:
                this.anio,
              mes:
                this.mes,
              semanaVisible:
                this.filtroSemana,
              rangoSemanaVisible:
                this.rangoSemanaTexto
            },
            estadoPantalla: {
              cambiosPendientes:
                this.cambios.size,
              incluyeCambiosNoGuardados:
                true,
              propuestaGeneradorDisponible:
                this.ultimaCalidadGeneracion !==
                null,
              calidadGeneracion:
                this.ultimaCalidadGeneracion,
              conflictosGenerador:
                this.propuestaGenerador
                  ?.conflictos ??
                []
            },
            reglasGenerales:
              contexto.configuracion,
            catalogoCasetas:
              this.ubicaciones
                .map(
                  ubicacion => {

                    const caseta =
                      casetaPorId.get(
                        ubicacion.id
                      );

                    return {
                      id:
                        ubicacion.id,
                      codigo:
                        ubicacion.codigo,
                      nombre:
                        ubicacion.nombre,
                      tipo:
                        ubicacion.tipo,
                      orden:
                        ubicacion.orden,
                      activo:
                        ubicacion.activo,
                      permiteTurnoA:
                        ubicacion.permiteTurnoA,
                      permiteTurnoB:
                        ubicacion.permiteTurnoB,
                      permiteTurnoC:
                        ubicacion.permiteTurnoC,
                      grupoFlujo:
                        caseta
                          ?.grupoFlujo ??
                        'SIN_CLASIFICAR',
                      maxSemana:
                        caseta
                          ?.maxSemana ??
                        null,
                      maxMes:
                        caseta
                          ?.maxMes ??
                        null
                    };
                  }
                )
                .sort(
                  (a, b) =>
                    (
                      a.orden ??
                      Number
                        .MAX_SAFE_INTEGER
                    ) -
                    (
                      b.orden ??
                      Number
                        .MAX_SAFE_INTEGER
                    ) ||
                    a.codigo.localeCompare(
                      b.codigo
                    )
                ),
            restricciones:
              contexto.restricciones,
            resumenTurnos:
              [
                ...resumenTurnos
                  .values()
              ]
                .sort(
                  (a, b) =>
                    a.fecha.localeCompare(
                      b.fecha
                    ) ||
                    a.turno.localeCompare(
                      b.turno
                    )
                ),
            asignaciones,
            conflictos,
            notasDiagnostico: [
              'Las asignaciones reflejan exactamente el estado actual de la tabla, incluidos cambios no guardados.',
              'El historial del mismo flujo incorpora el mes anterior guardado y luego la distribución actual.',
              'El puntaje y la fase exacta ESTRICTA/FLEXIBLE/REPARACION solo están disponibles cuando el backend los devuelve en la propuesta generada.'
            ]
          };

          const contenido =
            JSON.stringify(
              payload,
              null,
              2
            );

          const blob =
            new Blob(
              [
                contenido
              ],
              {
                type:
                  'application/json;charset=utf-8'
              }
            );

          const url =
            URL.createObjectURL(
              blob
            );

          const enlace =
            document
              .createElement(
                'a'
              );

          const plazaArchivo =
            (
              plaza?.codigo ??
              `plaza-${plazaId}`
            )
              .replace(
                /[^a-zA-Z0-9_-]/g,
                '-'
              );

          enlace.href =
            url;

          enlace.download =
            `diagnostico-distribucion-${plazaArchivo}-${this.anio}-${String(
              this.mes
            ).padStart(
              2,
              '0'
            )}.json`;

          document.body
            .appendChild(
              enlace
            );

          enlace.click();

          enlace.remove();

          URL.revokeObjectURL(
            url
          );

          this.mensaje =
            'JSON de diagnóstico exportado correctamente.';

          this.cdr.detectChanges();

        },

        error: (
          e
        ) => {

          this.error =
            this.mensajeError(
              e,
              'No se pudo preparar el JSON de diagnóstico.'
            );

          this.cdr.detectChanges();

        }

      });
  }


  abrirGeneradorDistribucion(): void {

    if (
      !this.puedeGenerarDistribucion ||
      !this.plazaId
    ) {
      return;
    }

    this.generadorAbierto =
      true;

    this.errorGenerador =
      '';

    this.mensajeGenerador =
      '';

    this.propuestaGenerador =
      null;

    this.cdr.detectChanges();
  }


  cerrarGeneradorDistribucion(): void {

    if (
      this.generandoDistribucion
    ) {
      return;
    }

    this.generadorAbierto =
      false;

    this.errorGenerador =
      '';

    this.mensajeGenerador =
      '';

    this.propuestaGenerador =
      null;

    this.cdr.detectChanges();
  }


  cambiarPeriodoGenerador(
    periodo: TipoPeriodoCaseta
  ): void {

    this.generadorPeriodo =
      periodo;

    this.propuestaGenerador =
      null;

    this.errorGenerador =
      '';

    this.mensajeGenerador =
      '';

    this.cdr.detectChanges();
  }


  generarYCargarDistribucion(): void {

    if (
      !this.puedeGenerarDistribucion ||
      !this.plazaId
    ) {
      return;
    }

    this.generandoDistribucion =
      true;

    /*
     * Cerramos el formulario y dejamos únicamente el modal de carga.
     */
    this.generadorAbierto =
      false;

    this.modalResultadoDistribucionAbierto =
      false;

    this.observacionesResultadoDistribucion =
      [];

    this.errorGenerador =
      '';

    this.mensajeGenerador =
      '';

    this.propuestaGenerador =
      null;

    this.ultimaCalidadGeneracion =
      null;

    /*
     * Pintamos inmediatamente el modal de carga antes de iniciar
     * la petición, evitando que la UI parezca congelada.
     */
    this.cdr.detectChanges();

    this.api
      .generarPropuestaCasetas({
        plazaId:
          this.plazaId,

        anio:
          this.anio,

        mes:
          this.mes,

        periodo:
          this.generadorPeriodo,

        semana:
          this.generadorPeriodo ===
            'SEMANA'
              ? this.generadorSemana
              : null
      })
      .pipe(

        finalize(() => {

          this.generandoDistribucion =
            false;

          this.cdr.detectChanges();

        })

      )
      .subscribe({

        next: (
          propuesta
        ) => {

          this.propuestaGenerador =
            propuesta;

          this.observacionesResultadoDistribucion =
            [
              ...propuesta.conflictos
            ];

          this.observacionesPorProgramacion
            .clear();

          for (
            const conflicto
            of propuesta.conflictos
          ) {
            const mensajeAnterior =
              this.observacionesPorProgramacion
                .get(
                  conflicto.programacionTurnoId
                );

            this.observacionesPorProgramacion
              .set(
                conflicto.programacionTurnoId,
                mensajeAnterior
                  ? `${mensajeAnterior}\n• ${conflicto.mensaje}`
                  : conflicto.mensaje
              );
          }

          this.ultimaCalidadGeneracion =
            propuesta.calidad ??
            null;

          for (
            const item
            of propuesta.asignaciones
          ) {

            this.asignaciones
              .set(
                item.programacionTurnoId,
                item.ubicacionId
              );

            const valorGuardado =
              this.asignacionesGuardadas
                .get(
                  item.programacionTurnoId
                ) ??
              null;

            if (
              valorGuardado ===
                item.ubicacionId
            ) {
              this.cambios
                .delete(
                  item.programacionTurnoId
                );
            }
            else {
              this.cambios
                .set(
                  item.programacionTurnoId,
                  item.ubicacionId
                );
            }

          }

          const total =
            propuesta.asignaciones
              .length;

          if (
            propuesta.conflictos.length
          ) {

            this.mensajeGenerador =
              `Se cargaron ${total} asignaciones en la tabla y quedaron ${propuesta.conflictos.length} observación(es).`;

          }
          else {

            this.mensajeGenerador =
              propuesta.calidad
                ? `Se cargaron ${total} asignaciones. Calidad ${propuesta.calidad.puntuacion}/100 · ${propuesta.calidad.solucionesEvaluadas} solución(es) evaluada(s). Revisa el resultado y pulsa Guardar distribución.`
                : `Se cargaron ${total} asignaciones en la tabla. Revisa el resultado y pulsa Guardar distribución.`;

          }

          this.mensaje =
            'Distribución generada y cargada en la tabla. Aún no se ha guardado.';

          this.generandoDistribucion =
            false;

          this.tipoResultadoDistribucion =
            'success';

          this.tituloResultadoDistribucion =
            'Asignación de casetas generada';

          this.mensajeResultadoDistribucion =
            propuesta.conflictos.length > 0
              ? `Se cargaron ${total} asignaciones y quedaron ${propuesta.conflictos.length} observación(es) para revisar antes de guardar.`
              : propuesta.calidad
                ? `Se cargaron ${total} asignaciones correctamente. Calidad ${propuesta.calidad.puntuacion}/100. Revisa la tabla antes de guardar.`
                : `Se cargaron ${total} asignaciones correctamente. Revisa la tabla antes de guardar.`;

          this.modalResultadoDistribucionAbierto =
            true;

          this.cdr.detectChanges();

        },

        error: (
          e
        ) => {

          this.errorGenerador =
            this.mensajeError(
              e,
              'No se pudo generar la distribución.'
            );

          this.generandoDistribucion =
            false;

          this.observacionesResultadoDistribucion =
            [];

          this.observacionesPorProgramacion
            .clear();

          this.tipoResultadoDistribucion =
            'error';

          this.tituloResultadoDistribucion =
            'Error al generar la asignación';

          this.mensajeResultadoDistribucion =
            this.errorGenerador;

          this.modalResultadoDistribucionAbierto =
            true;

          this.cdr.detectChanges();

        }

      });
  }


  cerrarResultadoDistribucion(): void {

    this.modalResultadoDistribucionAbierto =
      false;

    this.guardadoForzadoDisponible =
      false;

    this.tituloResultadoDistribucion =
      '';

    this.mensajeResultadoDistribucion =
      '';

    this.observacionesResultadoDistribucion =
      [];

    this.cdr.detectChanges();
  }


  abrirConfiguracionGenerador(): void {

    this.generadorAbierto =
      false;

    this.router
      .navigate([
        '/programacion/generador-casetas'
      ]);
  }


  abrirConfiguracionUbicaciones(): void {

    if (
      !this.esSupervisor
    ) {
      return;
    }

    this.modalUbicacionesAbierto =
      true;

    this.configPlazaId =
      this.plazaId ??
      this.plazas[0]?.id ??
      null;

    this.errorConfiguracion =
      '';

    this.mensajeConfiguracion =
      '';

    this.resetFormularioUbicacion();
    this.resetFormularioRestriccionConfiguracion();

    this.cdr.detectChanges();

    this.cargarConfiguracionUbicaciones();
  }


  cerrarConfiguracionUbicaciones(): void {

    if (
      this.guardandoUbicacion ||
      this.procesandoUbicacionId !== null
    ) {
      return;
    }

    this.modalUbicacionesAbierto =
      false;

    this.errorConfiguracion =
      '';

    this.mensajeConfiguracion =
      '';

    this.resetFormularioUbicacion();
    this.resetFormularioRestriccionConfiguracion();

    this.cdr.detectChanges();
  }


  cambiarPlazaConfiguracion(
    plazaId: number | null
  ): void {

    this.configPlazaId =
      plazaId === null ||
      plazaId === undefined
        ? null
        : Number(plazaId);

    this.errorConfiguracion =
      '';

    this.mensajeConfiguracion =
      '';

    this.resetFormularioUbicacion();
    this.resetFormularioRestriccionConfiguracion();

    this.cargarConfiguracionUbicaciones();
  }


  cargarConfiguracionUbicaciones(): void {

    if (
      !this.configPlazaId ||
      !this.modalUbicacionesAbierto
    ) {
      this.ubicacionesConfiguracion = [];
      this.casetasGeneradorConfiguracion = [];
      this.restriccionesCasetaConfiguracion = [];
      this.agentesRestriccionConfiguracion = [];
      return;
    }

    this.cargandoConfiguracion =
      true;

    forkJoin({
      ubicaciones:
        this.api.getUbicacionesConfiguracion(
          this.configPlazaId
        ),
      casetas:
        this.api.getCasetasGenerador(
          this.configPlazaId
        ),
      restricciones:
        this.api.getRestriccionesCasetas(
          this.configPlazaId
        ),
      agentes:
        this.api.getAgentes(
          this.configPlazaId
        )
    })
      .pipe(
        finalize(() => {
          this.cargandoConfiguracion =
            false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resultado) => {
          this.ubicacionesConfiguracion =
            [...resultado.ubicaciones];

          this.casetasGeneradorConfiguracion =
            [...resultado.casetas];

          this.restriccionesCasetaConfiguracion =
            [...resultado.restricciones];

          this.agentesRestriccionConfiguracion =
            [...resultado.agentes];

          this.cdr.detectChanges();
        },
        error: (e) => {
          this.ubicacionesConfiguracion = [];
          this.casetasGeneradorConfiguracion = [];
          this.restriccionesCasetaConfiguracion = [];
          this.agentesRestriccionConfiguracion = [];

          this.errorConfiguracion =
            this.mensajeError(
              e,
              'No se pudo cargar la configuración completa de casetas.'
            );

          this.cdr.detectChanges();
        }
      });
  }


  configuracionFlujoUbicacion(
    ubicacionId: number
  ): CasetaConfiguracion | null {

    return (
      this.casetasGeneradorConfiguracion
        .find(
          item =>
            item.ubicacionId === ubicacionId
        ) ??
      null
    );
  }


  guardarGrupoFlujoUbicacion(
    ubicacionId: number,
    grupoFlujo: GrupoFlujoCaseta
  ): void {

    if (
      !this.configPlazaId ||
      this.guardandoFlujoUbicacionId !== null
    ) {
      return;
    }

    const actual =
      this.configuracionFlujoUbicacion(
        ubicacionId
      );

    this.guardandoFlujoUbicacionId =
      ubicacionId;

    this.errorConfiguracion = '';
    this.mensajeConfiguracion = '';

    this.api
      .guardarCasetaGenerador(
        ubicacionId,
        {
          plazaId: this.configPlazaId,
          grupoFlujo,
          maxSemana:
            actual?.maxSemana ?? null,
          maxMes:
            actual?.maxMes ?? null
        }
      )
      .pipe(
        finalize(() => {
          this.guardandoFlujoUbicacionId =
            null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (guardada) => {

          const index =
            this.casetasGeneradorConfiguracion
              .findIndex(
                item =>
                  item.ubicacionId ===
                  guardada.ubicacionId
              );

          if (index >= 0) {
            this.casetasGeneradorConfiguracion = [
              ...this.casetasGeneradorConfiguracion
                .slice(0, index),
              guardada,
              ...this.casetasGeneradorConfiguracion
                .slice(index + 1)
            ];
          }
          else {
            this.casetasGeneradorConfiguracion = [
              ...this.casetasGeneradorConfiguracion,
              guardada
            ];
          }

          this.mensajeConfiguracion =
            `Flujo de ${guardada.codigo} actualizado.`;

          this.cdr.detectChanges();
        },
        error: (e) => {
          this.errorConfiguracion =
            this.mensajeError(
              e,
              'No se pudo actualizar el nivel de flujo.'
            );

          this.cdr.detectChanges();
        }
      });
  }


  abrirModalRestriccionesAgentes(): void {

    if (
      !this.esSupervisor ||
      !this.plazaId
    ) {
      return;
    }

    this.configPlazaId =
      this.plazaId;

    this.modalRestriccionesAbierto =
      true;

    this.busquedaAgenteRestriccion =
      '';

    this.errorConfiguracion =
      '';

    this.mensajeConfiguracion =
      '';

    this.resetFormularioRestriccionConfiguracion();

    this.cargarContextoRestricciones();

    this.cdr.detectChanges();
  }


  private cargarContextoRestricciones(): void {

    if (
      !this.configPlazaId
    ) {
      return;
    }

    this.cargandoRestriccionesModal =
      true;

    forkJoin({
      ubicaciones:
        this.api.getUbicacionesConfiguracion(
          this.configPlazaId
        ),
      restricciones:
        this.api.getRestriccionesCasetas(
          this.configPlazaId
        ),
      agentes:
        this.api.getAgentes(
          this.configPlazaId
        )
    })
      .pipe(
        finalize(() => {
          this.cargandoRestriccionesModal =
            false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resultado) => {

          this.ubicacionesConfiguracion =
            [...resultado.ubicaciones];

          this.restriccionesCasetaConfiguracion =
            [...resultado.restricciones];

          this.agentesRestriccionConfiguracion =
            [...resultado.agentes];

          this.cdr.detectChanges();
        },
        error: (e) => {
          this.errorConfiguracion =
            this.mensajeError(
              e,
              'No se pudieron cargar los datos para las restricciones.'
            );

          this.cdr.detectChanges();
        }
      });
  }


  cerrarModalRestriccionesAgentes(): void {

    if (
      this.guardandoRestriccionConfiguracion ||
      this.eliminandoRestriccionId !== null
    ) {
      return;
    }

    this.modalRestriccionesAbierto =
      false;

    this.busquedaAgenteRestriccion =
      '';

    this.resetFormularioRestriccionConfiguracion();

    this.cdr.detectChanges();
  }


  seleccionarAgenteRestriccion(
    agenteId: number
  ): void {

    this.nuevaRestriccionAgenteId =
      agenteId;

    this.casetasRestriccionSeleccionadas
      .clear();

    for (
      const restriccion
      of this.restriccionesCasetaConfiguracion
    ) {
      if (
        restriccion.activo &&
        restriccion.trabajadorId ===
          agenteId
      ) {
        this.casetasRestriccionSeleccionadas
          .add(
            restriccion.ubicacionId
          );
      }
    }

    this.errorConfiguracion =
      '';

    this.mensajeConfiguracion =
      '';

    this.cdr.detectChanges();
  }


  casetaRestriccionSeleccionada(
    ubicacionId: number
  ): boolean {

    return this.casetasRestriccionSeleccionadas
      .has(
        ubicacionId
      );
  }


  alternarCasetaRestriccion(
    ubicacionId: number,
    seleccionada: boolean
  ): void {

    if (
      !this.nuevaRestriccionAgenteId ||
      this.guardandoRestriccionConfiguracion
    ) {
      return;
    }

    if (seleccionada) {
      this.casetasRestriccionSeleccionadas
        .add(
          ubicacionId
        );
    }
    else {
      this.casetasRestriccionSeleccionadas
        .delete(
          ubicacionId
        );
    }

    this.cdr.detectChanges();
  }


  guardarRestriccionesAgenteConfiguracion(): void {

    if (
      !this.configPlazaId ||
      !this.nuevaRestriccionAgenteId
    ) {
      this.errorConfiguracion =
        'Selecciona primero un agente.';
      return;
    }

    const existentes =
      this.restriccionesCasetaConfiguracion
        .filter(
          restriccion =>
            restriccion.activo &&
            restriccion.trabajadorId ===
              this.nuevaRestriccionAgenteId
        );

    const existentesPorUbicacion =
      new Map(
        existentes.map(
          restriccion => [
            restriccion.ubicacionId,
            restriccion
          ]
        )
      );

    const nuevas =
      [...this.casetasRestriccionSeleccionadas]
        .filter(
          ubicacionId =>
            !existentesPorUbicacion.has(
              ubicacionId
            )
        );

    const eliminadas =
      existentes.filter(
        restriccion =>
          !this.casetasRestriccionSeleccionadas
            .has(
              restriccion.ubicacionId
            )
      );

    if (
      nuevas.length === 0 &&
      eliminadas.length === 0
    ) {
      this.mensajeConfiguracion =
        'No hay cambios pendientes en las restricciones de este agente.';
      this.errorConfiguracion =
        '';
      this.cdr.detectChanges();
      return;
    }

    this.guardandoRestriccionConfiguracion =
      true;

    this.errorConfiguracion =
      '';

    this.mensajeConfiguracion =
      '';

    const operaciones = [
      ...nuevas.map(
        ubicacionId =>
          this.api.guardarRestriccionCaseta({
            plazaId:
              this.configPlazaId!,
            trabajadorId:
              this.nuevaRestriccionAgenteId!,
            ubicacionId,
            motivo:
              this.nuevaRestriccionMotivo
                .trim() || null,
            activo:
              true
          })
      ),
      ...eliminadas.map(
        restriccion =>
          this.api.eliminarRestriccionCaseta(
            restriccion.id
          )
      )
    ];

    forkJoin(
      operaciones
    )
      .subscribe({
        next: () => {
          this.api
            .getRestriccionesCasetas(
              this.configPlazaId!
            )
            .pipe(
              finalize(() => {
                this.guardandoRestriccionConfiguracion =
                  false;
                this.cdr.detectChanges();
              })
            )
            .subscribe({
              next: restricciones => {
                this.restriccionesCasetaConfiguracion =
                  [...restricciones];

                const agenteId =
                  this.nuevaRestriccionAgenteId!;

                this.seleccionarAgenteRestriccion(
                  agenteId
                );

                this.nuevaRestriccionMotivo =
                  '';

                this.mensajeConfiguracion =
                  `Restricciones actualizadas: ${nuevas.length} agregada(s) y ${eliminadas.length} quitada(s).`;

                this.cdr.detectChanges();
              },
              error: e => {
                this.errorConfiguracion =
                  this.mensajeError(
                    e,
                    'Los cambios se guardaron, pero no se pudo refrescar la lista.'
                  );

                this.cdr.detectChanges();
              }
            });
        },
        error: e => {
          this.guardandoRestriccionConfiguracion =
            false;

          this.errorConfiguracion =
            this.mensajeError(
              e,
              'No se pudieron guardar todas las restricciones.'
            );

          this.cdr.detectChanges();
        }
      });
  }


  agregarRestriccionCasetaConfiguracion(): void {

    if (
      !this.configPlazaId ||
      !this.nuevaRestriccionAgenteId ||
      !this.nuevaRestriccionUbicacionId
    ) {
      this.errorConfiguracion =
        'Selecciona un agente y una caseta restringida.';
      return;
    }

    this.guardandoRestriccionConfiguracion =
      true;

    this.errorConfiguracion = '';
    this.mensajeConfiguracion = '';

    this.api
      .guardarRestriccionCaseta({
        plazaId:
          this.configPlazaId,
        trabajadorId:
          this.nuevaRestriccionAgenteId,
        ubicacionId:
          this.nuevaRestriccionUbicacionId,
        motivo:
          this.nuevaRestriccionMotivo
            .trim() || null,
        activo:
          true
      })
      .pipe(
        finalize(() => {
          this.guardandoRestriccionConfiguracion =
            false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {

          this.api
            .getRestriccionesCasetas(
              this.configPlazaId!
            )
            .subscribe({
              next: (restricciones) => {
                this.restriccionesCasetaConfiguracion =
                  [...restricciones];

                this.resetFormularioRestriccionConfiguracion();

                this.mensajeConfiguracion =
                  'Restricción agregada correctamente.';

                this.cdr.detectChanges();
              },
              error: (e) => {
                this.errorConfiguracion =
                  this.mensajeError(
                    e,
                    'La restricción se guardó, pero no se pudo refrescar la lista.'
                  );

                this.cdr.detectChanges();
              }
            });
        },
        error: (e) => {
          this.errorConfiguracion =
            this.mensajeError(
              e,
              'No se pudo guardar la restricción.'
            );

          this.cdr.detectChanges();
        }
      });
  }


  eliminarRestriccionCasetaConfiguracion(
    restriccion: RestriccionCaseta
  ): void {

    if (
      this.eliminandoRestriccionId !== null
    ) {
      return;
    }

    this.eliminandoRestriccionId =
      restriccion.id;

    this.errorConfiguracion = '';
    this.mensajeConfiguracion = '';

    this.api
      .eliminarRestriccionCaseta(
        restriccion.id
      )
      .pipe(
        finalize(() => {
          this.eliminandoRestriccionId =
            null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.restriccionesCasetaConfiguracion =
            this.restriccionesCasetaConfiguracion
              .filter(
                item =>
                  item.id !==
                  restriccion.id
              );

          this.mensajeConfiguracion =
            'Restricción eliminada.';

          this.cdr.detectChanges();
        },
        error: (e) => {
          this.errorConfiguracion =
            this.mensajeError(
              e,
              'No se pudo eliminar la restricción.'
            );

          this.cdr.detectChanges();
        }
      });
  }


  private resetFormularioRestriccionConfiguracion(): void {

    this.nuevaRestriccionAgenteId =
      null;

    this.nuevaRestriccionUbicacionId =
      null;

    this.casetasRestriccionSeleccionadas
      .clear();

    this.nuevaRestriccionMotivo =
      '';
  }


  editarUbicacion(
    ubicacion: Ubicacion
  ): void {

    this.ubicacionEditandoId =
      ubicacion.id;

    this.ubicacionCodigo =
      ubicacion.codigo;

    this.ubicacionNombre =
      ubicacion.nombre;

    this.ubicacionTipo =
      ubicacion.tipo;

    this.ubicacionOrden =
      ubicacion.orden;

    this.ubicacionPermiteTurnoA =
      ubicacion.permiteTurnoA !== false;

    this.ubicacionPermiteTurnoB =
      ubicacion.permiteTurnoB !== false;

    this.ubicacionPermiteTurnoC =
      ubicacion.permiteTurnoC !== false;

    this.errorConfiguracion =
      '';

    this.mensajeConfiguracion =
      '';

    this.cdr.detectChanges();
  }


  cancelarEdicionUbicacion(): void {

    this.resetFormularioUbicacion();
    this.errorConfiguracion = '';
    this.mensajeConfiguracion = '';
    this.cdr.detectChanges();
  }


  guardarUbicacionConfiguracion(): void {

    if (
      !this.configPlazaId
    ) {
      this.errorConfiguracion =
        'Selecciona una plaza.';
      return;
    }

    const codigo =
      this.ubicacionCodigo
        .trim();

    const nombre =
      this.ubicacionNombre
        .trim();

    if (
      !codigo ||
      !nombre
    ) {
      this.errorConfiguracion =
        'Código y nombre son obligatorios.';
      return;
    }

    const orden =
      this.ubicacionOrden !== null &&
      Number(this.ubicacionOrden) > 0
        ? Number(this.ubicacionOrden)
        : null;

    const request = {
      plazaId: this.configPlazaId,
      codigo,
      nombre,
      tipo: this.ubicacionTipo,
      orden,
      permiteTurnoA:
        this.ubicacionPermiteTurnoA,
      permiteTurnoB:
        this.ubicacionPermiteTurnoB,
      permiteTurnoC:
        this.ubicacionPermiteTurnoC
    };

    this.guardandoUbicacion =
      true;

    this.errorConfiguracion =
      '';

    this.mensajeConfiguracion =
      '';

    const operacion =
      this.ubicacionEditandoId !== null
        ? this.api.actualizarUbicacion(
            this.ubicacionEditandoId,
            request
          )
        : this.api.crearUbicacion(
            request
          );

    operacion
      .pipe(
        finalize(() => {
          this.guardandoUbicacion =
            false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          const editando =
            this.ubicacionEditandoId !== null;

          this.resetFormularioUbicacion();

          this.mensajeConfiguracion =
            editando
              ? 'Caseta actualizada correctamente.'
              : 'Caseta añadida correctamente.';

          this.cargarConfiguracionUbicaciones();
          this.refrescarUbicacionesActivas();
          this.cdr.detectChanges();
        },
        error: (e) => {
          this.errorConfiguracion =
            this.mensajeError(
              e,
              'No se pudo guardar la caseta.'
            );
          this.cdr.detectChanges();
        }
      });
  }


  cambiarEstadoUbicacionConfiguracion(
    ubicacion: Ubicacion
  ): void {

    const nuevoEstado =
      !ubicacion.activo;

    if (
      !nuevoEstado &&
      [...this.cambios.values()]
        .some(
          ubicacionId =>
            ubicacionId ===
              ubicacion.id
        )
    ) {
      this.errorConfiguracion =
        'Primero guarda o cambia las asignaciones pendientes que usan esta caseta.';
      return;
    }

    this.procesandoUbicacionId =
      ubicacion.id;

    this.errorConfiguracion =
      '';

    this.mensajeConfiguracion =
      '';

    this.api
      .cambiarEstadoUbicacion(
        ubicacion.id,
        nuevoEstado
      )
      .pipe(
        finalize(() => {
          this.procesandoUbicacionId =
            null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.mensajeConfiguracion =
            nuevoEstado
              ? 'Caseta activada correctamente.'
              : 'Caseta desactivada. El historial se conserva.';

          if (
            this.ubicacionEditandoId ===
              ubicacion.id
          ) {
            this.resetFormularioUbicacion();
          }

          this.cargarConfiguracionUbicaciones();
          this.refrescarUbicacionesActivas();
          this.cdr.detectChanges();
        },
        error: (e) => {
          this.errorConfiguracion =
            this.mensajeError(
              e,
              'No se pudo cambiar el estado de la caseta.'
            );
          this.cdr.detectChanges();
        }
      });
  }


  private resetFormularioUbicacion(): void {

    this.ubicacionEditandoId =
      null;

    this.ubicacionCodigo =
      '';

    this.ubicacionNombre =
      '';

    this.ubicacionTipo =
      'VIA';

    this.ubicacionOrden =
      null;

    this.ubicacionPermiteTurnoA =
      true;

    this.ubicacionPermiteTurnoB =
      true;

    this.ubicacionPermiteTurnoC =
      true;
  }


  private refrescarUbicacionesActivas(): void {

    if (
      !this.plazaId ||
      this.plazaId !==
        this.configPlazaId
    ) {
      return;
    }

    this.api
      .getUbicaciones(
        this.plazaId
      )
      .subscribe({
        next: (activas) => {

          const activasPorId =
            new Set(
              activas.map(
                ubicacion =>
                  ubicacion.id
              )
            );

          const usadas =
            new Set(
              this.asignaciones.values()
            );

          const historicas =
            this.ubicaciones
              .filter(
                ubicacion =>
                  usadas.has(
                    ubicacion.id
                  ) &&
                  !activasPorId.has(
                    ubicacion.id
                  )
              )
              .map(
                ubicacion => ({
                  ...ubicacion,
                  activo: false
                })
              );

          this.ubicaciones =
            [
              ...activas,
              ...historicas
            ]
              .sort(
                (a, b) =>
                  (a.orden - b.orden) ||
                  a.codigo.localeCompare(
                    b.codigo
                  )
              );

          this.cargarCobertura();
          this.cdr.detectChanges();
        },
        error: (e) => {
          console.error(
            'Error refrescando ubicaciones:',
            e
          );
        }
      });
  }


  seleccionar(
    trabajadorId: number
  ): void {

    this.seleccionado =
      trabajadorId;

    this.resumen =
      null;

    this.modalDetalleAgenteAbierto =
      true;

    this.cdr.detectChanges();
  }


  cerrarDetalleAgente(): void {

    this.modalDetalleAgenteAbierto =
      false;

    this.cdr.detectChanges();
  }

  count(
    ubicacion:
      CoberturaUbicacion,
    dia: number
  ): number {

    return (
      ubicacion
        .porDia[
          this.fecha(
            dia
          )
        ] ??
      0
    );
  }

  ubicacionesParaTurno(
    estado: EstadoProgramacion | null,
    programacionId: number
  ): Ubicacion[] {

    const actual =
      this.asignacion(programacionId);

    return this.ubicaciones
      .filter(
        ubicacion =>
          this.ubicacionHabilitadaParaTurno(
            ubicacion,
            estado
          ) ||
          ubicacion.id === actual
      );
  }

  ubicacionHabilitadaParaTurno(
    ubicacion: Ubicacion,
    estado: EstadoProgramacion | null
  ): boolean {

    if (estado === 'A') {
      return ubicacion.permiteTurnoA !== false;
    }

    if (estado === 'B') {
      return ubicacion.permiteTurnoB !== false;
    }

    if (estado === 'C') {
      return ubicacion.permiteTurnoC !== false;
    }

    return false;
  }

  private cumpleOrdenSecuencial(
    ubicacion: Ubicacion,
    programacion: ProgramacionDia
  ): boolean {

    if (ubicacion.tipo === 'VIA') {
      return true;
    }

    if (
      ubicacion.tipo === 'AUXILIAR'
    ) {

      const viasPendientes =
        this.ubicaciones
          .filter(
            item =>
              item.activo &&
              item.tipo === 'VIA' &&
              this.ubicacionHabilitadaParaTurno(
                item,
                programacion.estado
              )
          )
          .some(
            via =>
              !this.programaciones
                .some(
                  otra =>
                    otra.fecha === programacion.fecha &&
                    otra.estado === programacion.estado &&
                    this.asignacion(
                      otra.programacionId
                    ) === via.id
                )
          );

      if (viasPendientes) {
        return false;
      }
    }

    const anteriores =
      this.ubicaciones
        .filter(
          item =>
            item.activo &&
            item.tipo !== 'VIA' &&
            item.orden < ubicacion.orden &&
            this.ubicacionHabilitadaParaTurno(
              item,
              programacion.estado
            )
        )
        .sort(
          (a, b) =>
            a.orden - b.orden
        );

    return anteriores.every(
      anterior =>
        this.programaciones
          .some(
            otra =>
              otra.fecha === programacion.fecha &&
              otra.estado === programacion.estado &&
              this.asignacion(
                otra.programacionId
              ) === anterior.id
          )
    );
  }

  esOperativo(
    estado:
      EstadoProgramacion | null
  ): boolean {

    return (
      estado ===
        'A' ||
      estado ===
        'B' ||
      estado ===
        'C'
    );
  }

  claseEstado(
    estado:
      EstadoProgramacion | null
  ): string {

    return estado
      ? `estado-${estado.toLowerCase()}`
      : '';
  }

  sincronizarScroll(
    origen: 'superior' | 'casetas'
  ): void {

    const fuente =
      origen === 'superior'
        ? this.tablaSuperior?.nativeElement
        : this.tablaCasetas?.nativeElement;

    const destino =
      origen === 'superior'
        ? this.tablaCasetas?.nativeElement
        : this.tablaSuperior?.nativeElement;

    if (!fuente || !destino) {
      return;
    }

    if (
      Math.abs(
        destino.scrollLeft - fuente.scrollLeft
      ) > 1
    ) {
      destino.scrollLeft = fuente.scrollLeft;
    }
  }

  codigoUbicacion(
    ubicacionId: number | null
  ): string {

    if (
      ubicacionId === null ||
      ubicacionId === undefined
    ) {
      return '—';
    }

    return (
      this.ubicaciones
        .find(
          ubicacion =>
            ubicacion.id === ubicacionId
        )
        ?.codigo ??
      '—'
    );
  }

  diaSemana(
    dia: number
  ): string {

    const fecha =
      new Date(
        this.anio,
        this.mes - 1,
        dia
      );

    const nombres = [
      'DOM',
      'LUN',
      'MAR',
      'MIÉ',
      'JUE',
      'VIE',
      'SÁB'
    ];

    return nombres[
      fecha.getDay()
    ];
  }


  private fechaAnterior(
    fecha: string
  ): string {

    const [
      anio,
      mes,
      dia
    ] =
      fecha
        .split('-')
        .map(Number);

    const anterior =
      new Date(
        anio,
        mes - 1,
        dia - 1
      );

    return (
      `${anterior.getFullYear()}-` +
      `${String(
        anterior.getMonth() + 1
      ).padStart(
        2,
        '0'
      )}-` +
      `${String(
        anterior.getDate()
      ).padStart(
        2,
        '0'
      )}`
    );
  }


  private fecha(
    dia: number
  ): string {

    return (
      `${this.anio}-` +
      `${String(
        this.mes
      ).padStart(
        2,
        '0'
      )}-` +
      `${String(
        dia
      ).padStart(
        2,
        '0'
      )}`
    );
  }

  private formatearFecha(
    fecha: string
  ): string {

    const [
      anio,
      mes,
      dia
    ] =
      fecha
        .split('-')
        .map(Number);

    return new Intl
      .DateTimeFormat(
        'es-PE',
        {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }
      )
      .format(
        new Date(
          anio,
          mes - 1,
          dia
        )
      );
  }

  private mensajeError(
    error: any,
    fallback: string
  ): string {

    return (
      error?.error?.detail ??
      error?.error?.message ??
      fallback
    );
  }
}