import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import {
  finalize,
  forkJoin
} from 'rxjs';

import {
  AgenteProgramacionExcepcion,
  EstadoProgramacion,
  GrupoLider,
  GrupoProgramacion,
  Plaza,
  SecuenciaAgente,
  TrabajadorResumen
} from '../../models/programacion.models';

import {
  CoberturaDiaPropuesta,
  ConflictoProgramacionPropuesta,
  DiaEspecialProgramacionRequest,
  NovedadProgramacionRequest,
  ProgramacionApiService,
  ProgramacionPropuestaResponse
} from '../../services/programacion-api.service';


@Component({
  selector: 'app-programacion-supervisor',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl:
    './programacion-supervisor.component.html',

  styleUrl:
    './programacion-supervisor.component.css',

  changeDetection:
    ChangeDetectionStrategy.OnPush
})
export class ProgramacionSupervisorComponent
  implements OnInit {

  /*
   * ============================================================
   * DEPENDENCIAS
   * ============================================================
   */

  private readonly api =
    inject(ProgramacionApiService);

  private readonly cdr =
    inject(ChangeDetectorRef);


  /*
   * ============================================================
   * DATOS GENERALES
   * ============================================================
   */

  plazas: Plaza[] = [];

  agentes: TrabajadorResumen[] = [];

  controladores: TrabajadorResumen[] = [];

  grupos: GrupoLider[] = [];

  secuencias: SecuenciaAgente[] = [];


  /*
   * ============================================================
   * FILTROS
   * ============================================================
   */

  plazaId: number | null = null;

  anio =
    new Date().getFullYear();

  mes =
    new Date().getMonth() + 1;

  dias: number[] = [];

  busqueda = '';


  /*
   * ============================================================
   * ESTADOS DE CARGA
   * ============================================================
   */

  cargando = false;

  cargandoLideres = false;

  cargandoSecuencias = false;

  guardando = false;

  guardandoOrden = false;

  error = '';

  mensaje = '';


  /*
   * ============================================================
   * GENERADOR DE PROPUESTA
   * ============================================================
   */

  modalGeneradorAbierto = false;
  generandoPropuesta = false;

  coberturaNormal = { a: 7, b: 7, c: 3 };
  coberturaDomingo = { a: 6, b: 7, c: 3 };

  diasEspeciales: DiaEspecialProgramacionRequest[] = [];
  novedadesGenerador: NovedadProgramacionRequest[] = [];

  propuestaCobertura: CoberturaDiaPropuesta[] = [];
  propuestaConflictos: ConflictoProgramacionPropuesta[] = [];
  ultimaPropuesta: ProgramacionPropuestaResponse | null = null;


  /*
   * Agentes que actualmente están siendo modificados.
   *
   * Nos permite desactivar temporalmente
   * controles específicos sin bloquear toda la pantalla.
   */
  agentesProcesando =
    new Set<number>();


  /*
   * ============================================================
   * ESTADOS DE PROGRAMACIÓN
   * ============================================================
   */

  readonly estados:
    EstadoProgramacion[] = [
      'A',
      'B',
      'C',
      'D',
      'V',
      'COM',
      'DM',
      'LIC'
    ];


  /*
   * ============================================================
   * SECUENCIAS
   * ============================================================
   */

  mostrarDetalles = true;

  diaSeleccionado: number | null = null;

  resumenDia = { A: 0, B: 0, C: 0, total: 0 };

  agentesProgramadosLista: TrabajadorResumen[] = [];

  private readonly grupoPorAgente =
    new Map<number, GrupoProgramacion>();

  private readonly posicionPorAgente =
    new Map<number, number>();

  private readonly liderPorAgente =
    new Map<number, TrabajadorResumen>();

  private readonly agentePorId = new Map<number, TrabajadorResumen>();
  private readonly puedeSubirPorAgente = new Map<number, boolean>();
  private readonly puedeBajarPorAgente = new Map<number, boolean>();
  private readonly cantidadPorGrupo = new Map<GrupoProgramacion, number>();

  readonly excepcionPorAgente =
    new Map<number, AgenteProgramacionExcepcion>();

  modalExcepcionAbierto = false;
  agenteExcepcion: TrabajadorResumen | null = null;
  excepcionPermiteA = true;
  excepcionPermiteB = true;
  excepcionPermiteC = true;
  excepcionMotivo = '';
  excepcionColor = '#FFF3B0';
  guardandoExcepcion = false;
  busquedaAgenteExcepcion = '';
  coloresExcepcionRecientes: string[] = [];
  private readonly claveColoresExcepcion = 'sigo_programacion_colores_excepcion_recientes';

  modalConfirmarGuardadoAbierto = false;
  modalConfirmacionAccionAbierto = false;
  tituloConfirmacionAccion = 'Cambio registrado';
  mensajeConfirmacionAccion = '';

  modalSinSecuenciaAbierto = false;
  modalLideresAbierto = false;

  modalAdvertenciaTurnoAbierto = false;
  advertenciaTurno: {
    agenteId: number;
    dia: number;
    estado: 'A' | 'B' | 'C';
    nombreAgente: string;
    codigoAgente: number | string;
    recomendados: string;
    motivo: string;
  } | null = null;


  readonly gruposProgramacion: {
    codigo: GrupoProgramacion;
    nombre: string;
  }[] = [

    {
      codigo: 'SECUENCIA_1',
      nombre: 'Secuencia 1'
    },

    {
      codigo: 'SECUENCIA_2',
      nombre: 'Secuencia 2'
    },

    {
      codigo: 'SECUENCIA_3',
      nombre: 'Secuencia 3'
    },

    {
      codigo: 'SECUENCIA_4',
      nombre: 'Secuencia 4'
    },

    {
      codigo: 'PART_TIME',
      nombre: 'Part Time'
    }

  ];


  /*
   * ============================================================
   * MATRIZ DE PROGRAMACIÓN
   * ============================================================
   */

  readonly matrix =
    new Map<
      string,
      EstadoProgramacion | null
    >();


  /*
   * Solo contiene las celdas
   * modificadas por el usuario.
   */
  readonly cambios =
    new Map<
      string,
      EstadoProgramacion
    >();


  /*
   * ============================================================
   * LÍDERES
   * ============================================================
   */

  liderSeleccionado:
    Record<
      number,
      number | null
    > = {};


  /*
   * ============================================================
   * GETTERS
   * ============================================================
   */

  get mesInput(): string {

    return (
      `${this.anio}-` +
      `${String(this.mes).padStart(
        2,
        '0'
      )}`
    );
  }


  /*
   * Agentes que todavía no
   * tienen una secuencia asignada.
   */
  get agentesSinSecuencia():
    TrabajadorResumen[] {

    const asignados =
      new Set(
        this.secuencias
          .filter(
            s =>
              s.grupo !== null
          )
          .map(
            s =>
              s.agenteId
          )
      );


    let resultado =
      this.agentes
        .filter(
          agente =>
            !asignados.has(
              agente.id
            )
        );


    const query =
      this.busqueda
        .trim()
        .toLowerCase();


    if (
      query
    ) {

      resultado =
        resultado.filter(
          agente =>
            this.coincideBusqueda(
              agente,
              query
            )
        );

    }


    return resultado
      .sort(
        (
          a,
          b
        ) =>
          a.nombreCompleto
            .localeCompare(
              b.nombreCompleto,
              'es'
            )
      );
  }


  /*
   * ============================================================
   * INIT
   * ============================================================
   */

  ngOnInit(): void {

    this.cargarPlazas();
  }


  /*
   * ============================================================
   * PLAZAS
   * ============================================================
   */

  cargarPlazas(): void {

    this.error = '';

    this.api
      .getPlazas()
      .subscribe({

        next: (
          plazas
        ) => {

          this.plazas =
            [...plazas];


          /*
           * En SIGO-TEST comenzamos
           * con P4 cuando existe.
           */
          this.plazaId =
            plazas.find(
              p =>
                p.codigo === 'P4'
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


  /*
   * ============================================================
   * CAMBIO DE MES
   * ============================================================
   */

  cambiarMes(
    value: string
  ): void {

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


    this.anio =
      anio;

    this.mes =
      mes;


    this.cargar();
  }


  /*
   * ============================================================
   * CARGA PRINCIPAL
   * ============================================================
   */

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

    this.ultimaPropuesta = null;
    this.propuestaCobertura = [];
    this.propuestaConflictos = [];


    this.diaSeleccionado = null;
    this.resumenDia = { A: 0, B: 0, C: 0, total: 0 };

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


    /*
     * Cargamos juntos solamente
     * los datos necesarios para
     * construir la programación.
     *
     * Los líderes se cargan después
     * y no bloquean la tabla.
     */
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

      excepciones:
        this.api
          .getExcepciones(
            this.plazaId
          )

    })
      .pipe(

        finalize(
          () => {

            this.cargando =
              false;

            this.cdr.detectChanges();

          }
        )

      )
      .subscribe({

        next: (
          resultado
        ) => {

          this.agentes =
            [
              ...resultado.agentes
            ];


          this.secuencias =
            [
              ...resultado.secuencias
            ];

          this.excepcionPorAgente.clear();
          for (const excepcion of resultado.excepciones) {
            if (excepcion.activo) {
              this.excepcionPorAgente.set(excepcion.trabajadorId, excepcion);
            }
          }

          this.reconstruirCacheSecuencias();

          this.matrix.clear();

          this.cambios.clear();


          /*
           * Construimos la matriz
           * de turnos.
           */
          for (
            const turno
            of resultado.turnos
          ) {

            const dia =
              this.diaDeFecha(
                turno.fecha
              );


            this.matrix.set(

              this.key(
                turno.trabajadorId,
                dia
              ),

              turno.estado

            );

          }


          /*
           * Inicializamos selección
           * de líderes.
           */
          this.liderSeleccionado = {};


          for (
            const agente
            of this.agentes
          ) {

            this.liderSeleccionado[
              agente.id
            ] = null;

          }


          /*
           * La programación ya puede
           * mostrarse en este punto.
           */
          this.cdr.detectChanges();

          /*
           * Precarga de líderes en segundo plano.
           * No bloquea la tabla principal y deja listo el modal.
           */
          this.cargarLideres();
},

        error: (
          e
        ) => {

          console.error(
            'Error cargando programación:',
            e
          );


          this.error =
            this.mensajeError(
              e,
              'No se pudo cargar la programación.'
            );


          this.cdr.detectChanges();

        }

      });
  }


  /*
   * ============================================================
   * RECARGAR SOLO SECUENCIAS
   * ============================================================
   */

  recargarSecuencias(): void {

    if (
      !this.plazaId
    ) {
      return;
    }


    this.cargandoSecuencias =
      true;


    this.api
      .getSecuencias(
        this.plazaId
      )
      .pipe(

        finalize(
          () => {

            this.cargandoSecuencias =
              false;

            this.cdr.detectChanges();

          }
        )

      )
      .subscribe({

        next: (
          secuencias
        ) => {

          this.secuencias =
            [...secuencias];

          this.reconstruirCacheSecuencias();
          this.cdr.detectChanges();

        },

        error: (
          e
        ) => {

          this.error =
            this.mensajeError(
              e,
              'No se pudieron actualizar las secuencias.'
            );

          this.cdr.detectChanges();

        }

      });
  }


  /*
   * ============================================================
   * LÍDERES
   * ============================================================
   */

  cargarLideres(): void {

    if (
      !this.plazaId
    ) {
      return;
    }


    this.cargandoLideres =
      true;


    forkJoin({

      controladores:
        this.api
          .getControladores(
            this.plazaId
          ),

      grupos:
        this.api
          .getGrupos(
            this.plazaId
          )

    })
      .pipe(

        finalize(
          () => {

            this.cargandoLideres =
              false;

            this.cdr.detectChanges();

          }
        )

      )
      .subscribe({

        next: (
          resultado
        ) => {

          this.controladores =
            [
              ...resultado.controladores
            ];


          this.grupos =
            [
              ...resultado.grupos
            ];

          this.reconstruirCacheLideres();

          const liderSeleccionadoPorAgente = new Map<number, number>();

          for (const grupo of this.grupos) {
            if (grupo.activo) {
              liderSeleccionadoPorAgente.set(grupo.agenteId, grupo.controladorId);
            }
          }

          for (const agente of this.agentes) {
            this.liderSeleccionado[agente.id] =
              liderSeleccionadoPorAgente.get(agente.id) ?? null;
          }


          this.cdr.detectChanges();

        },

        error: (
          e
        ) => {

          console.error(
            'Error cargando líderes:',
            e
          );


          this.error =
            this.mensajeError(
              e,
              'La programación cargó, pero no se pudieron cargar los líderes.'
            );


          this.cdr.detectChanges();

        }

      });
  }


  /*
   * ============================================================
   * AGENTES POR SECUENCIA
   * ============================================================
   */

  agentesDeGrupo(
    grupo:
      GrupoProgramacion
  ): TrabajadorResumen[] {

    const query =
      this.busqueda
        .trim()
        .toLowerCase();


    const registros =
      this.secuencias
        .filter(
          s =>
            s.grupo ===
              grupo
        )
        .sort(
          (
            a,
            b
          ) =>
            (
              a.orden ??
              Number.MAX_SAFE_INTEGER
            )
            -
            (
              b.orden ??
              Number.MAX_SAFE_INTEGER
            )
        );


    const agentes =
      registros
        .map(
          registro =>
            this.agentes.find(
              agente =>
                agente.id ===
                  registro.agenteId
            )
        )
        .filter(
          (
            agente
          ):
            agente is TrabajadorResumen =>
              !!agente
        );


    if (
      !query
    ) {

      return agentes;

    }


    return agentes.filter(
      agente =>
        this.coincideBusqueda(
          agente,
          query
        )
    );
  }


  /*
   * Todos los agentes con secuencia en una sola lista.
   * Mantiene el orden de los grupos definido en
   * gruposProgramacion y, dentro de cada grupo,
   * respeta el campo orden guardado en backend.
   */
  agentesProgramados(): TrabajadorResumen[] {
    return this.agentesProgramadosLista;
  }


  cambiarBusqueda(valor: string): void {
    this.busqueda = valor;
    this.reconstruirCacheSecuencias();
  }


  grupoDeAgente(
    agenteId: number
  ): GrupoProgramacion | null {
    return this.grupoPorAgente.get(agenteId) ?? null;
  }


  /*
   * Devuelve los registros
   * completos del grupo respetando
   * el orden guardado.
   */
  secuenciasDeGrupo(
    grupo:
      GrupoProgramacion
  ): SecuenciaAgente[] {

    return this.secuencias
      .filter(
        s =>
          s.grupo ===
            grupo
      )
      .sort(
        (
          a,
          b
        ) =>
          (
            a.orden ??
            Number.MAX_SAFE_INTEGER
          )
          -
          (
            b.orden ??
            Number.MAX_SAFE_INTEGER
          )
      );
  }


  /*
   * ============================================================
   * CAMBIAR SECUENCIA
   * ============================================================
   */

  cambiarSecuencia(
    agenteId: number,
    grupo:
      GrupoProgramacion
  ): void {

    if (
      !this.plazaId ||
      !grupo
    ) {
      return;
    }


    if (
      this.agentesProcesando.has(
        agenteId
      )
    ) {
      return;
    }


    const anterior =
      this.secuencias.find(
        s =>
          s.agenteId ===
            agenteId
      );


    /*
     * Si ya está en la secuencia
     * seleccionada, no hacemos nada.
     */
    if (
      anterior?.grupo ===
        grupo
    ) {
      return;
    }


    this.agentesProcesando.add(
      agenteId
    );


    this.error =
      '';

    this.mensaje =
      '';


    this.cdr.detectChanges();


    this.api
      .asignarSecuencia({

        agenteId,

        plazaId:
          this.plazaId,

        grupo

      })
      .pipe(

        finalize(
          () => {

            this.agentesProcesando.delete(
              agenteId
            );

            this.cdr.detectChanges();

          }
        )

      )
      .subscribe({

        next: (
          registro
        ) => {

          /*
           * Reemplazamos localmente
           * el registro del agente.
           */
          const restantes =
            this.secuencias
              .filter(
                s =>
                  s.agenteId !==
                    agenteId
              );


          this.secuencias = [
            ...restantes,
            registro
          ];

          this.reconstruirCacheSecuencias();
          // La respuesta ya se aplicó localmente; evitamos otro GET /secuencias.
          const agente =
            this.agentes.find(
              a =>
                a.id ===
                  agenteId
            );


          this.mensaje =
            agente
              ? `${agente.nombreCompleto} fue movido a ${this.nombreGrupo(grupo)}.`
              : `Agente movido a ${this.nombreGrupo(grupo)}.`;

          this.mostrarConfirmacionAccion(
            agente
              ? `${agente.nombreCompleto} fue asignado correctamente a ${this.nombreGrupo(grupo)}.`
              : `El agente fue asignado correctamente a ${this.nombreGrupo(grupo)}.`,
            'Secuencia actualizada'
          );

        },

        error: (
          e
        ) => {

          console.error(
            'Error cambiando secuencia:',
            e
          );


          this.error =
            this.mensajeError(
              e,
              'No se pudo cambiar la secuencia.'
            );


          this.cdr.detectChanges();

        }

      });
  }


  /*
   * ============================================================
   * SUBIR INTEGRANTE
   * ============================================================
   */

  subir(
    grupo:
      GrupoProgramacion,

    agenteId: number
  ): void {

    if (
      this.guardandoOrden
    ) {
      return;
    }


    const integrantes =
      this.secuenciasDeGrupo(
        grupo
      );


    const indice =
      integrantes.findIndex(
        integrante =>
          integrante.agenteId ===
            agenteId
      );


    if (
      indice <= 0
    ) {
      return;
    }


    [
      integrantes[indice - 1],
      integrantes[indice]
    ] = [
      integrantes[indice],
      integrantes[indice - 1]
    ];


    this.guardarNuevoOrden(
      grupo,
      integrantes
    );
  }


  /*
   * ============================================================
   * BAJAR INTEGRANTE
   * ============================================================
   */

  bajar(
    grupo:
      GrupoProgramacion,

    agenteId: number
  ): void {

    if (
      this.guardandoOrden
    ) {
      return;
    }


    const integrantes =
      this.secuenciasDeGrupo(
        grupo
      );


    const indice =
      integrantes.findIndex(
        integrante =>
          integrante.agenteId ===
            agenteId
      );


    if (
      indice < 0 ||
      indice >=
        integrantes.length - 1
    ) {
      return;
    }


    [
      integrantes[indice],
      integrantes[indice + 1]
    ] = [
      integrantes[indice + 1],
      integrantes[indice]
    ];


    this.guardarNuevoOrden(
      grupo,
      integrantes
    );
  }


  /*
   * ============================================================
   * GUARDAR ORDEN
   * ============================================================
   */

  private guardarNuevoOrden(
    grupo:
      GrupoProgramacion,

    integrantes:
      SecuenciaAgente[]
  ): void {

    if (
      !this.plazaId
    ) {
      return;
    }


    this.guardandoOrden =
      true;

    this.error =
      '';

    this.mensaje =
      '';


    const request = {

      plazaId:
        this.plazaId,

      grupo,

      agentes:
        integrantes.map(
          (
            integrante,
            index
          ) => ({

            agenteId:
              integrante.agenteId,

            orden:
              index + 1

          })
        )

    };


    this.api
      .guardarOrdenSecuencia(
        request
      )
      .pipe(

        finalize(
          () => {

            this.guardandoOrden =
              false;

            this.cdr.detectChanges();

          }
        )

      )
      .subscribe({

        next: () => {

          /*
           * Actualizamos localmente
           * las posiciones del grupo.
           */
          const ordenPorAgente =
            new Map<
              number,
              number
            >();


          integrantes.forEach(
            (
              integrante,
              index
            ) => {

              ordenPorAgente.set(
                integrante.agenteId,
                index + 1
              );

            }
          );


          this.secuencias =
            this.secuencias
              .map(
                registro => {

                  if (
                    registro.grupo !==
                      grupo
                  ) {

                    return registro;

                  }


                  const nuevoOrden =
                    ordenPorAgente.get(
                      registro.agenteId
                    );


                  if (
                    nuevoOrden ===
                      undefined
                  ) {

                    return registro;

                  }


                  return {

                    ...registro,

                    orden:
                      nuevoOrden

                  };

                }
              );

          this.reconstruirCacheSecuencias();

          this.mensaje =
            `Orden de ${this.nombreGrupo(grupo)} actualizado.`;

          this.cdr.detectChanges();

        },

        error: (
          e
        ) => {

          console.error(
            'Error guardando orden:',
            e
          );


          this.error =
            this.mensajeError(
              e,
              'No se pudo actualizar el orden de la secuencia.'
            );


          /*
           * Si falla el backend,
           * volvemos a leer el orden
           * real guardado.
           */
          this.recargarSecuencias();

          this.cdr.detectChanges();

        }

      });
  }


  /*
   * ============================================================
   * GENERAR PROPUESTA AUTOMÁTICA
   * ============================================================
   */

  abrirGenerador(): void {
    if (!this.plazaId || this.generandoPropuesta) {
      return;
    }

    this.error = '';
    this.mensaje = '';
    this.modalGeneradorAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarGenerador(): void {
    if (this.generandoPropuesta) {
      return;
    }

    this.modalGeneradorAbierto = false;
    this.cdr.detectChanges();
  }

  agregarDiaEspecial(): void {
    const fechaBase = this.fecha(1);

    this.diasEspeciales = [
      ...this.diasEspeciales,
      {
        fecha: fechaBase,
        descripcion: '',
        a: this.coberturaDomingo.a,
        b: this.coberturaDomingo.b,
        c: this.coberturaDomingo.c
      }
    ];

    this.cdr.detectChanges();
  }

  quitarDiaEspecial(index: number): void {
    this.diasEspeciales = this.diasEspeciales.filter((_, i) => i !== index);
    this.cdr.detectChanges();
  }

  agregarNovedadGenerador(): void {
    const agente = this.agentesProgramadosLista[0] ?? this.agentes[0];

    if (!agente) {
      this.error = 'No hay agentes disponibles para registrar una novedad.';
      return;
    }

    this.novedadesGenerador = [
      ...this.novedadesGenerador,
      {
        trabajadorId: agente.id,
        desde: this.fecha(1),
        hasta: this.fecha(1),
        estado: 'V',
        observacion: ''
      }
    ];

    this.cdr.detectChanges();
  }

  quitarNovedadGenerador(index: number): void {
    this.novedadesGenerador = this.novedadesGenerador.filter((_, i) => i !== index);
    this.cdr.detectChanges();
  }

  generarPropuesta(): void {
    if (!this.plazaId || this.generandoPropuesta) {
      return;
    }

    const errorValidacion = this.validarConfiguracionGenerador();
    if (errorValidacion) {
      this.error = errorValidacion;
      this.cdr.detectChanges();
      return;
    }

    this.generandoPropuesta = true;
    this.error = '';
    this.mensaje = '';

    this.api.generarPropuesta({
      plazaId: this.plazaId,
      anio: this.anio,
      mes: this.mes,
      coberturaNormal: { ...this.coberturaNormal },
      coberturaDomingo: { ...this.coberturaDomingo },
      diasEspeciales: this.diasEspeciales.map(dia => ({
        ...dia,
        descripcion: dia.descripcion?.trim() || null
      })),
      novedades: this.novedadesGenerador.map(novedad => ({
        ...novedad,
        observacion: novedad.observacion?.trim() || null
      }))
    })
      .pipe(
        finalize(() => {
          this.generandoPropuesta = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: propuesta => {
          this.aplicarPropuesta(propuesta);
          this.modalGeneradorAbierto = false;
          this.mensaje = 'Propuesta generada. Revísala y edítala antes de guardar.';
          this.cdr.detectChanges();
        },
        error: e => {
          console.error('Error generando propuesta:', e);
          this.error = this.mensajeError(
            e,
            'No se pudo generar la propuesta de programación.'
          );
          this.cdr.detectChanges();
        }
      });
  }

  private aplicarPropuesta(propuesta: ProgramacionPropuestaResponse): void {
    this.ultimaPropuesta = propuesta;
    this.propuestaCobertura = [...propuesta.cobertura];
    this.propuestaConflictos = [...propuesta.conflictos];

    for (const agente of propuesta.agentes) {
      for (const diaPropuesta of agente.dias) {
        const dia = this.diaDeFecha(diaPropuesta.fecha);
        const key = this.key(agente.trabajadorId, dia);

        this.matrix.set(key, diaPropuesta.estado);
        this.cambios.set(key, diaPropuesta.estado);
      }
    }

    if (this.diaSeleccionado) {
      this.recalcularResumenDia();
    }
  }

  private validarConfiguracionGenerador(): string | null {
    const coberturas = [this.coberturaNormal, this.coberturaDomingo];

    if (coberturas.some(c => [c.a, c.b, c.c].some(valor => valor < 0 || !Number.isInteger(valor)))) {
      return 'Las coberturas A, B y C deben ser números enteros mayores o iguales a 0.';
    }

    const prefijoMes = `${this.anio}-${String(this.mes).padStart(2, '0')}-`;

    if (this.diasEspeciales.some(d => !d.fecha?.startsWith(prefijoMes))) {
      return 'Todos los días especiales deben pertenecer al mes seleccionado.';
    }

    if (this.novedadesGenerador.some(n => !n.trabajadorId || !n.desde || !n.hasta || n.hasta < n.desde)) {
      return 'Revisa las novedades: agente y rango de fechas son obligatorios.';
    }

    return null;
  }

  diasPropuestaConDeficit(): number {
    return this.propuestaCobertura.filter(
      dia => dia.deficitA > 0 || dia.deficitB > 0 || dia.deficitC > 0
    ).length;
  }

  diasPropuestaConExceso(): number {
    return this.propuestaCobertura.filter(
      dia => dia.excesoA > 0 || dia.excesoB > 0 || dia.excesoC > 0
    ).length;
  }

  conflictosVisibles(): ConflictoProgramacionPropuesta[] {
    return this.propuestaConflictos.slice(0, 8);
  }


  /*
   * ============================================================
   * PROGRAMACIÓN MENSUAL
   * ============================================================
   */

  estado(
    agenteId: number,
    dia: number
  ): EstadoProgramacion | null {

    return (
      this.matrix.get(
        this.key(
          agenteId,
          dia
        )
      ) ??
      null
    );
  }


  cambiarEstado(
    agenteId: number,
    dia: number,
    estado: EstadoProgramacion | null
  ): void {

    if (!estado) {
      return;
    }

    if (
      (estado === 'A' || estado === 'B' || estado === 'C') &&
      !this.turnoRecomendado(agenteId, estado)
    ) {
      const excepcion = this.excepcionPorAgente.get(agenteId);
      const agente = this.agentePorId.get(agenteId);

      this.advertenciaTurno = {
        agenteId,
        dia,
        estado,
        nombreAgente: agente?.nombreCompleto ?? 'Agente',
        codigoAgente: agente?.codigo ?? '-',
        recomendados: this.turnosRecomendados(agenteId),
        motivo: excepcion?.motivo?.trim() || 'Sin observación registrada.'
      };
      this.modalAdvertenciaTurnoAbierto = true;
      this.cdr.detectChanges();
      return;
    }

    this.aplicarCambioEstado(agenteId, dia, estado);
  }

  cancelarAdvertenciaTurno(): void {
    this.modalAdvertenciaTurnoAbierto = false;
    this.advertenciaTurno = null;
    this.cdr.detectChanges();
  }

  confirmarAdvertenciaTurno(): void {
    const pendiente = this.advertenciaTurno;
    if (!pendiente) {
      return;
    }

    this.modalAdvertenciaTurnoAbierto = false;
    this.advertenciaTurno = null;
    this.aplicarCambioEstado(
      pendiente.agenteId,
      pendiente.dia,
      pendiente.estado
    );
  }

  private aplicarCambioEstado(
    agenteId: number,
    dia: number,
    estado: EstadoProgramacion
  ): void {
    const key = this.key(agenteId, dia);

    this.matrix.set(key, estado);
    this.cambios.set(key, estado);

    if (this.diaSeleccionado === dia) {
      this.recalcularResumenDia();
    }

    this.cdr.detectChanges();
  }


  seleccionarDia(dia: number): void {
    this.diaSeleccionado = dia;
    this.recalcularResumenDia();
  }

  cantidadTurnoDia(estado: 'A' | 'B' | 'C'): number {
    return this.resumenDia[estado];
  }

  totalTurnosDia(): number {
    return this.resumenDia.total;
  }

  nombreDiaSeleccionado(): string {
    if (!this.diaSeleccionado) {
      return '';
    }
    const fecha = new Date(this.anio, this.mes - 1, this.diaSeleccionado);
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(fecha);
  }


  excepcionDeAgente(agenteId: number): AgenteProgramacionExcepcion | null {
    return this.excepcionPorAgente.get(agenteId) ?? null;
  }

  tieneExcepcion(agenteId: number): boolean {
    return this.excepcionPorAgente.has(agenteId);
  }

  colorExcepcion(agenteId: number): string {
    return this.excepcionPorAgente.get(agenteId)?.color ?? 'transparent';
  }

  colorExcepcionSuave(agenteId: number): string {
    const color = this.excepcionPorAgente.get(agenteId)?.color;
    return color ? this.hexARgba(color, 0.18) : 'transparent';
  }

  colorPreviewSuave(): string {
    return this.hexARgba(this.excepcionColor, 0.18);
  }

  private hexARgba(hex: string, alpha: number): string {
    const limpio = hex.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return 'transparent';
    const r = parseInt(limpio.slice(0, 2), 16);
    const g = parseInt(limpio.slice(2, 4), 16);
    const b = parseInt(limpio.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  agentesParaExcepcion(): TrabajadorResumen[] {
    const q = this.busquedaAgenteExcepcion.trim().toLowerCase();
    if (!q) return this.agentes;
    return this.agentes.filter(a =>
      String(a.codigo).toLowerCase().includes(q) ||
      a.nombreCompleto.toLowerCase().includes(q)
    );
  }

  abrirModalExcepcion(): void {
    this.cargarColoresExcepcionRecientes();
    this.busquedaAgenteExcepcion = '';
    this.agenteExcepcion = null;
    this.excepcionPermiteA = true;
    this.excepcionPermiteB = true;
    this.excepcionPermiteC = true;
    this.excepcionMotivo = '';
    this.excepcionColor = '#FFF3B0';
    this.modalExcepcionAbierto = true;
  }

  seleccionarAgenteExcepcion(agente: TrabajadorResumen): void {
    this.abrirExcepcion(agente);
  }

  turnosRecomendados(agenteId: number): string {
    const e = this.excepcionPorAgente.get(agenteId);
    if (!e) return 'A, B y C';
    return [e.permiteA ? 'A' : '', e.permiteB ? 'B' : '', e.permiteC ? 'C' : '']
      .filter(Boolean)
      .join(', ');
  }

  turnoRecomendado(agenteId: number, estado: 'A' | 'B' | 'C'): boolean {
    const e = this.excepcionPorAgente.get(agenteId);
    if (!e) return true;
    if (estado === 'A') return e.permiteA;
    if (estado === 'B') return e.permiteB;
    return e.permiteC;
  }

  abrirExcepcion(agente: TrabajadorResumen): void {
    this.cargarColoresExcepcionRecientes();
    const actual = this.excepcionPorAgente.get(agente.id);
    this.agenteExcepcion = agente;
    this.excepcionPermiteA = actual?.permiteA ?? true;
    this.excepcionPermiteB = actual?.permiteB ?? true;
    this.excepcionPermiteC = actual?.permiteC ?? true;
    this.excepcionMotivo = actual?.motivo ?? '';
    this.excepcionColor = actual?.color ?? '#FFF3B0';
    this.modalExcepcionAbierto = true;
  }

  seleccionarColorExcepcion(color: string): void {
    this.excepcionColor = color;
  }

  private cargarColoresExcepcionRecientes(): void {
    try {
      const guardados = JSON.parse(localStorage.getItem(this.claveColoresExcepcion) ?? '[]');
      this.coloresExcepcionRecientes = Array.isArray(guardados)
        ? guardados.filter((color): color is string => typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)).slice(0, 8)
        : [];
    } catch {
      this.coloresExcepcionRecientes = [];
    }
  }

  private registrarColorExcepcionReciente(color: string): void {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    const normalizado = color.toUpperCase();
    const nuevos = [
      normalizado,
      ...this.coloresExcepcionRecientes.filter(c => c.toUpperCase() !== normalizado)
    ].slice(0, 8);

    this.coloresExcepcionRecientes = nuevos;
    try {
      localStorage.setItem(this.claveColoresExcepcion, JSON.stringify(nuevos));
    } catch {
      // Si el navegador bloquea localStorage, la selección sigue funcionando en esta sesión.
    }
  }

  cerrarExcepcion(): void {
    if (this.guardandoExcepcion) return;
    this.modalExcepcionAbierto = false;
    this.agenteExcepcion = null;
  }

  guardarExcepcion(): void {
    if (!this.plazaId || !this.agenteExcepcion || this.guardandoExcepcion) return;
    if (!this.excepcionPermiteA && !this.excepcionPermiteB && !this.excepcionPermiteC) {
      this.error = 'Selecciona al menos un turno recomendado: A, B o C.';
      return;
    }

    this.guardandoExcepcion = true;
    this.error = '';
    this.api.guardarExcepcion({
      trabajadorId: this.agenteExcepcion.id,
      plazaId: this.plazaId,
      permiteA: this.excepcionPermiteA,
      permiteB: this.excepcionPermiteB,
      permiteC: this.excepcionPermiteC,
      motivo: this.excepcionMotivo.trim() || null,
      color: this.excepcionColor,
      activo: true
    }).pipe(finalize(() => {
      this.guardandoExcepcion = false;
      this.cdr.detectChanges();
    })).subscribe({
      next: excepcion => {
        this.registrarColorExcepcionReciente(excepcion.color);
        this.excepcionPorAgente.set(excepcion.trabajadorId, excepcion);
        this.mensaje = 'Excepción del agente guardada correctamente.';
        this.modalExcepcionAbierto = false;
        this.agenteExcepcion = null;
        this.cdr.detectChanges();
      },
      error: e => {
        this.error = this.mensajeError(e, 'No se pudo guardar la excepción.');
        this.cdr.detectChanges();
      }
    });
  }

  quitarExcepcion(): void {
    if (!this.plazaId || !this.agenteExcepcion || this.guardandoExcepcion) return;
    if (!window.confirm(`¿Quitar la excepción de ${this.agenteExcepcion.nombreCompleto}?`)) return;

    const agenteId = this.agenteExcepcion.id;
    this.guardandoExcepcion = true;
    this.error = '';
    this.api.desactivarExcepcion(agenteId, this.plazaId)
      .pipe(finalize(() => {
        this.guardandoExcepcion = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.excepcionPorAgente.delete(agenteId);
          this.mensaje = 'Excepción eliminada correctamente.';
          this.modalExcepcionAbierto = false;
          this.agenteExcepcion = null;
          this.cdr.detectChanges();
        },
        error: e => {
          this.error = this.mensajeError(e, 'No se pudo eliminar la excepción.');
          this.cdr.detectChanges();
        }
      });
  }


  /*
   * ============================================================
   * GUARDAR TURNOS
   * ============================================================
   */

  guardar(): void {
    if (!this.plazaId || this.cambios.size === 0 || this.guardando) {
      return;
    }

    this.modalConfirmarGuardadoAbierto = true;
    this.cdr.detectChanges();
  }

  private mostrarConfirmacionAccion(mensaje: string, titulo = 'Cambio registrado'): void {
    this.tituloConfirmacionAccion = titulo;
    this.mensajeConfirmacionAccion = mensaje;
    this.modalConfirmacionAccionAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarConfirmacionAccion(): void {
    this.modalConfirmacionAccionAbierto = false;
    this.mensajeConfirmacionAccion = '';
    this.cdr.detectChanges();
  }

  cancelarGuardar(): void {
    this.modalConfirmarGuardadoAbierto = false;
    this.cdr.detectChanges();
  }

  confirmarGuardar(): void {
    this.modalConfirmarGuardadoAbierto = false;
    this.ejecutarGuardar();
  }

  abrirSinSecuencia(): void {
    this.modalSinSecuenciaAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarSinSecuencia(): void {
    this.modalSinSecuenciaAbierto = false;
    this.cdr.detectChanges();
  }

  abrirLideres(): void {
    this.modalLideresAbierto = true;

    // Fallback: si por algún motivo la precarga todavía no se inició o falló,
    // intentamos cargar aquí.
    if (!this.cargandoLideres && this.controladores.length === 0 && this.grupos.length === 0) {
      this.cargarLideres();
    }

    this.cdr.detectChanges();
  }

  cerrarLideres(): void {
    this.modalLideresAbierto = false;
    this.cdr.detectChanges();
  }

  private ejecutarGuardar(): void {

    if (
      !this.plazaId ||
      this.cambios.size === 0
    ) {
      return;
    }


    const programaciones =
      [
        ...this.cambios.entries()
      ]
        .map(
          (
            [
              key,
              estado
            ]
          ) => {

            const [
              trabajadorId,
              dia
            ] =
              key
                .split('-')
                .map(Number);


            return {

              trabajadorId,

              fecha:
                this.fecha(
                  dia
                ),

              estado

            };

          }
        );


    this.guardando =
      true;

    this.error =
      '';

    this.mensaje =
      '';


    this.api
      .guardarTurnos({

        plazaId:
          this.plazaId,

        programaciones

      })
      .pipe(

        finalize(
          () => {

            this.guardando =
              false;

            this.cdr.detectChanges();

          }
        )

      )
      .subscribe({

        next: (
          turnosGuardados
        ) => {

          for (
            const turno
            of turnosGuardados
          ) {

            const dia =
              this.diaDeFecha(
                turno.fecha
              );


            this.matrix.set(

              this.key(
                turno.trabajadorId,
                dia
              ),

              turno.estado

            );

          }


          this.cambios.clear();


          this.mensaje =
            'Programación guardada correctamente.';


          this.mostrarConfirmacionAccion(
              'Los cambios de la programación fueron guardados correctamente.',
              'Programación guardada'
            );

            this.cdr.detectChanges();

        },

        error: (
          e
        ) => {

          console.error(
            'Error guardando programación:',
            e
          );


          this.error =
            this.mensajeError(
              e,
              'No se pudo guardar la programación.'
            );


          this.cdr.detectChanges();

        }

      });
  }


  /*
   * ============================================================
   * GUARDAR LÍDER
   * ============================================================
   */

  guardarLider(
    agente:
      TrabajadorResumen
  ): void {

    if (
      !this.plazaId
    ) {
      return;
    }


    const controladorId =
      this.liderSeleccionado[
        agente.id
      ];


    if (
      !controladorId
    ) {

      this.error =
        'Selecciona un controlador para el agente.';

      this.cdr.detectChanges();

      return;
    }


    this.error =
      '';

    this.mensaje =
      '';


    this.api
      .asignarLider({

        agenteId:
          agente.id,

        controladorId,

        plazaId:
          this.plazaId,

        fechaInicio:
          this.hoy()

      })
      .subscribe({

        next: (
          grupo
        ) => {

          this.grupos =
            this.grupos
              .filter(
                actual =>
                  actual.agenteId !==
                    agente.id
              );


          this.grupos.push(
            grupo
          );

          this.reconstruirCacheLideres();

          this.liderSeleccionado[
            agente.id
          ] =
            grupo.controladorId;


          this.mensaje =
            `Líder actualizado para ${agente.nombreCompleto}.`;


          this.mostrarConfirmacionAccion(
              `${agente.nombreCompleto}: líder actualizado correctamente.`,
              'Líder actualizado'
            );

            this.cdr.detectChanges();

        },

        error: (
          e
        ) => {

          console.error(
            'Error actualizando líder:',
            e
          );


          this.error =
            this.mensajeError(
              e,
              'No se pudo actualizar el líder.'
            );


          this.cdr.detectChanges();

        }

      });
  }


  /*
   * ============================================================
   * HELPERS VISUALES
   * ============================================================
   */

  diaSemana(
    dia: number
  ): string {

    const fecha =
      new Date(
        this.anio,
        this.mes - 1,
        dia
      );

    const diasSemana = [
      'Dom',
      'Lun',
      'Mar',
      'Mié',
      'Jue',
      'Vie',
      'Sáb'
    ];

    return diasSemana[
      fecha.getDay()
    ];
  }


  liderDeAgente(
    agenteId: number
  ): TrabajadorResumen | null {
    return this.liderPorAgente.get(agenteId) ?? null;
  }


  codigoLider(
    agenteId: number
  ): string {

    const lider =
      this.liderDeAgente(
        agenteId
      );

    return lider?.codigo
      ? String(lider.codigo)
      : '-';
  }


  nombreLider(
    agenteId: number
  ): string {

    const lider =
      this.liderDeAgente(
        agenteId
      );

    return (
      lider?.nombreCompleto ??
      'Sin líder'
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


  nombreGrupo(
    grupo:
      GrupoProgramacion
  ): string {

    return (
      this.gruposProgramacion
        .find(
          item =>
            item.codigo ===
              grupo
        )
        ?.nombre ??
      grupo
    );
  }


  cantidadGrupo(
    grupo: GrupoProgramacion
  ): number {
    return this.cantidadPorGrupo.get(grupo) ?? 0;
  }


  estaProcesandoAgente(
    agenteId: number
  ): boolean {

    return this.agentesProcesando
      .has(
        agenteId
      );
  }


  posicionEnGrupo(
    agenteId: number
  ): number {
    return this.posicionPorAgente.get(agenteId) ?? 0;
  }


  alternarDetalles(): void {
    this.mostrarDetalles = !this.mostrarDetalles;
  }


  puedeSubir(
    grupo: GrupoProgramacion,
    agenteId: number
  ): boolean {
    return this.grupoPorAgente.get(agenteId) === grupo &&
      (this.puedeSubirPorAgente.get(agenteId) ?? false);
  }


  puedeBajar(
    grupo: GrupoProgramacion,
    agenteId: number
  ): boolean {
    return this.grupoPorAgente.get(agenteId) === grupo &&
      (this.puedeBajarPorAgente.get(agenteId) ?? false);
  }


  nombreMes(): string {

    const texto =
      new Intl.DateTimeFormat(
        'es-PE',
        {
          month: 'long',
          year: 'numeric'
        }
      )
        .format(
          new Date(
            this.anio,
            this.mes - 1,
            1
          )
        );


    return (
      texto
        .charAt(0)
        .toUpperCase()
      +
      texto.slice(1)
    );
  }


  /*
   * ============================================================
   * BÚSQUEDA
   * ============================================================
   */

  private recalcularResumenDia(): void {
    if (!this.diaSeleccionado) {
      this.resumenDia = { A: 0, B: 0, C: 0, total: 0 };
      return;
    }

    let A = 0;
    let B = 0;
    let C = 0;

    for (const agente of this.agentesProgramadosLista) {
      const estado = this.matrix.get(this.key(agente.id, this.diaSeleccionado));
      if (estado === 'A') A++;
      else if (estado === 'B') B++;
      else if (estado === 'C') C++;
    }

    this.resumenDia = { A, B, C, total: A + B + C };
  }


  private reconstruirCacheSecuencias(): void {
    this.grupoPorAgente.clear();
    this.posicionPorAgente.clear();
    this.puedeSubirPorAgente.clear();
    this.puedeBajarPorAgente.clear();
    this.agentePorId.clear();
    this.cantidadPorGrupo.clear();

    for (const agente of this.agentes) {
      this.agentePorId.set(agente.id, agente);
    }

    const secuenciasPorGrupo = new Map<GrupoProgramacion, SecuenciaAgente[]>();
    for (const grupo of this.gruposProgramacion) {
      secuenciasPorGrupo.set(grupo.codigo, []);
    }

    for (const secuencia of this.secuencias) {
      if (!secuencia.grupo) continue;

      secuenciasPorGrupo.get(secuencia.grupo)?.push(secuencia);
      this.cantidadPorGrupo.set(
        secuencia.grupo,
        (this.cantidadPorGrupo.get(secuencia.grupo) ?? 0) + 1
      );
    }

    const query = this.busqueda.trim().toLowerCase();
    const resultado: TrabajadorResumen[] = [];

    for (const grupo of this.gruposProgramacion) {
      const registros = secuenciasPorGrupo.get(grupo.codigo) ?? [];
      registros.sort((a, b) =>
        (a.orden ?? Number.MAX_SAFE_INTEGER) -
        (b.orden ?? Number.MAX_SAFE_INTEGER)
      );

      registros.forEach((registro, index) => {
        this.grupoPorAgente.set(registro.agenteId, grupo.codigo);
        this.posicionPorAgente.set(registro.agenteId, index + 1);
        this.puedeSubirPorAgente.set(registro.agenteId, index > 0);
        this.puedeBajarPorAgente.set(registro.agenteId, index < registros.length - 1);

        const agente = this.agentePorId.get(registro.agenteId);
        if (agente && (!query || this.coincideBusqueda(agente, query))) {
          resultado.push(agente);
        }
      });
    }

    this.agentesProgramadosLista = resultado;
    if (this.diaSeleccionado) {
      this.recalcularResumenDia();
    }
  }



  private reconstruirCacheLideres(): void {
    this.liderPorAgente.clear();

    const controladorPorId = new Map(
      this.controladores.map(controlador => [controlador.id, controlador] as const)
    );

    for (const grupo of this.grupos) {
      if (!grupo.activo) {
        continue;
      }
      const lider = controladorPorId.get(grupo.controladorId);
      if (lider) {
        this.liderPorAgente.set(grupo.agenteId, lider);
      }
    }
  }


  private coincideBusqueda(
    agente:
      TrabajadorResumen,

    query: string
  ): boolean {

    return (
      `${agente.codigo} ` +
      `${agente.nombreCompleto}`
    )
      .toLowerCase()
      .includes(
        query
      );
  }


  /*
   * ============================================================
   * FECHAS / KEYS
   * ============================================================
   */

  private key(
    trabajadorId: number,
    dia: number
  ): string {

    return (
      `${trabajadorId}-` +
      `${dia}`
    );
  }


  private diaDeFecha(
    fecha: string
  ): number {

    return Number(
      fecha.slice(
        8,
        10
      )
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


  private hoy(): string {

    const fecha =
      new Date();


    return (
      `${fecha.getFullYear()}-` +
      `${String(
        fecha.getMonth() + 1
      ).padStart(
        2,
        '0'
      )}-` +
      `${String(
        fecha.getDate()
      ).padStart(
        2,
        '0'
      )}`
    );
  }


  /*
   * ============================================================
   * ERRORES
   * ============================================================
   */

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