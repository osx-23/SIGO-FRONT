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
  forkJoin
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
  ProgramacionApiService
} from '../../data-access/programacion-api.service';

import {
  Router
} from '@angular/router';

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

  readonly cambios =
    new Map<number, number>();

  get esSupervisor(): boolean {

    return this.auth
      .tieneRol(
        'SUPERVISOR'
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

    if (
      ubicacionId === null ||
      ubicacionId === undefined
    ) {
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

    if (
      !ubicacionNueva ||
      !this.ubicacionHabilitadaParaTurno(
        ubicacionNueva,
        programacionActual.estado
      )
    ) {
      this.error =
        'La caseta seleccionada no está habilitada para este turno.';
      this.cdr.detectChanges();
      return;
    }

    if (
      !this.cumpleOrdenSecuencial(
        ubicacionNueva,
        programacionActual
      )
    ) {
      this.error =
        ubicacionNueva.tipo === 'AUXILIAR'
          ? `No se puede asignar ${ubicacionNueva.codigo}. Primero deben completarse todas las vías habilitadas del turno ${programacionActual.estado} y luego respetarse el orden de auxiliares.`
          : `No se puede asignar ${ubicacionNueva.codigo}. Primero deben asignarse las ubicaciones auxiliares/apoyo anteriores para el turno ${programacionActual.estado}.`;
      this.cdr.detectChanges();
      return;
    }

    const fechaAnterior =
      this.fechaAnterior(
        programacionActual.fecha
      );

    const programacionCualquierTurnoDiaAnterior =
      this.programaciones
        .find(
          otra =>
            otra.trabajadorId ===
              programacionActual.trabajadorId &&
            otra.fecha ===
              fechaAnterior
        );

    if (
      programacionCualquierTurnoDiaAnterior
    ) {
      const ubicacionAnteriorId =
        this.asignacion(
          programacionCualquierTurnoDiaAnterior
            .programacionId
        );

      const ubicacionAnterior =
        this.ubicaciones
          .find(
            ubicacion =>
              ubicacion.id ===
                ubicacionAnteriorId
          );

      const actualEsApoyoOAuxiliar =
        ubicacionNueva.tipo === 'APOYO' ||
        ubicacionNueva.tipo === 'AUXILIAR';

      const anteriorEsApoyoOAuxiliar =
        ubicacionAnterior?.tipo === 'APOYO' ||
        ubicacionAnterior?.tipo === 'AUXILIAR';

      if (
        actualEsApoyoOAuxiliar &&
        anteriorEsApoyoOAuxiliar
      ) {
        this.error =
          'El agente no puede estar dos días seguidos en una caseta de tipo apoyo o auxiliar.';
        this.cdr.detectChanges();
        return;
      }
    }

    const programacionDiaAnterior =
      this.programaciones
        .find(
          otra =>
            otra.trabajadorId ===
              programacionActual.trabajadorId &&
            otra.fecha ===
              fechaAnterior &&
            otra.estado ===
              programacionActual.estado
        );

    if (
      programacionDiaAnterior &&
      this.asignacion(
        programacionDiaAnterior.programacionId
      ) === nuevaUbicacionId
    ) {
      this.error =
        `No se puede repetir ${ubicacionNueva.codigo}. El agente ya tuvo esa caseta el día anterior en el mismo turno ${programacionActual.estado}.`;
      this.cdr.detectChanges();
      return;
    }

    /*
     * Buscamos si existe otro agente
     * con la misma fecha,
     * mismo turno
     * y misma ubicación.
     */
    const conflicto =
      this.programaciones
        .find(
          otra => {

            if (
              otra.programacionId ===
              programacionActual
                .programacionId
            ) {
              return false;
            }

            if (
              otra.fecha !==
              programacionActual.fecha
            ) {
              return false;
            }

            if (
              otra.estado !==
              programacionActual.estado
            ) {
              return false;
            }

            const ubicacionOtra =
              this.asignaciones
                .get(
                  otra.programacionId
                );

            return (
              ubicacionOtra ===
              nuevaUbicacionId
            );
          }
        );

    if (
      conflicto
    ) {

      const ubicacion =
        this.ubicaciones
          .find(
            u =>
              u.id ===
              nuevaUbicacionId
          );

      this.conflictoInfo = {

        ubicacion:
          ubicacion?.codigo ??
          'Sin código',

        fecha:
          this.formatearFecha(
            programacionActual.fecha
          ),

        turno:
          programacionActual.estado,

        agente:
          conflicto.nombreTrabajador

      };

      this.conflictoVisible =
        true;

      /*
       * Como no actualizamos el Map,
       * al cerrar el modal el select
       * mantiene su valor anterior.
       */
      this.cdr.detectChanges();

      return;
    }

    this.error = '';

    this.asignaciones
      .set(
        programacionId,
        nuevaUbicacionId
      );

    this.cambios
      .set(
        programacionId,
        nuevaUbicacionId
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


  guardar(): void {

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
      errorMatriz
    ) {
      this.error =
        errorMatriz;

      this.tipoResultadoDistribucion =
        'error';

      this.tituloResultadoDistribucion =
        'Revisa la distribución';

      this.mensajeResultadoDistribucion =
        errorMatriz;

      this.observacionesResultadoDistribucion =
        [];

      this.modalResultadoDistribucionAbierto =
        true;

      this.cdr.detectChanges();

      return;
    }

    /*
     * Enviamos la matriz FINAL completa, no solo el delta.
     *
     * Las reglas de distribución dependen de días vecinos y de la ocupación
     * completa de cada turno. Enviar solo "cambios" podía hacer que backend
     * mezclara una fila editada con valores anteriores que seguían en BD.
     */
    const distribuciones =
      this.programaciones
        .filter(
          programacion =>
            this.esOperativo(
              programacion.estado
            )
        )
        .map(
          programacion => ({
            programacionTurnoId:
              programacion.programacionId,

            ubicacionId:
              this.asignacion(
                programacion.programacionId
              ),

            observacion:
              null
          })
        )
        .filter(
          (
            item
          ): item is {
            programacionTurnoId: number;
            ubicacionId: number;
            observacion: null;
          } =>
            item.ubicacionId !== null &&
            item.ubicacionId !== undefined
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

    /*
     * Mostramos el modal de carga antes de iniciar la petición.
     */
    this.cdr.detectChanges();

    this.api
      .guardarDistribucion({

        plazaId:
          this.plazaId,

        distribuciones

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

          for (
            const item
            of guardadas
          ) {

            this.asignaciones
              .set(
                item
                  .programacionTurnoId,

                item
                  .ubicacionId
              );

          }

          const totalGuardado =
            guardadas.length;

          this.cambios
            .clear();

          this.mensaje =
            'Distribución guardada correctamente.';

          this.tipoResultadoDistribucion =
            'success';

          this.tituloResultadoDistribucion =
            'Asignaciones guardadas';

          this.mensajeResultadoDistribucion =
            `Se validó y guardó la distribución final con ${totalGuardado} asignación(es). Los cambios manuales quedaron incluidos.`;

          this.observacionesResultadoDistribucion =
            [];

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

          this.tituloResultadoDistribucion =
            'Error al guardar asignaciones';

          this.mensajeResultadoDistribucion =
            this.error;

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
      !this.esSupervisor ||
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
      !this.esSupervisor ||
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

            this.cambios
              .set(
                item.programacionTurnoId,
                item.ubicacionId
              );

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