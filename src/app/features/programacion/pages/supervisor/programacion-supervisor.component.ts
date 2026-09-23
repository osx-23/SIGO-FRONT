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
  finalize
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
  ProgramacionPropuestaResponse
} from '../../data-access/programacion-api.service';

import {
  ProgramacionSupervisorFacade
} from '../../state/programacion-supervisor.facade';

import {
  ProgramacionSecuenciaState
} from '../../state/programacion-secuencia.state';

import {
  ProgramacionGeneradorState
} from '../../state/programacion-generador.state';

import {
  ProgramacionExcepcionState
} from '../../state/programacion-excepcion.state';

import {
  ProgramacionGeneradorModalComponent
} from '../../components/generador-modal/programacion-generador-modal.component';

import {
  ProgramacionExcepcionModalComponent
} from '../../components/excepcion-modal/programacion-excepcion-modal.component';

import {
  ProgramacionResumenSecuenciasComponent
} from '../../components/resumen-secuencias/programacion-resumen-secuencias.component';

import {
  ProgramacionTablaComponent
} from '../../components/tabla-programacion/programacion-tabla.component';

import {
  ProgramacionCargaFacade
} from '../../state/programacion-carga.facade';

import {
  ProgramacionSecuenciaFacade
} from '../../state/programacion-secuencia.facade';

import {
  ProgramacionGuardadoFacade
} from '../../state/programacion-guardado.facade';

import {
  ProgramacionLiderFacade
} from '../../state/programacion-lider.facade';


@Component({
  selector: 'app-programacion-supervisor',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    ProgramacionGeneradorModalComponent,
    ProgramacionExcepcionModalComponent,
    ProgramacionResumenSecuenciasComponent,
    ProgramacionTablaComponent
  ],

  templateUrl:
    './programacion-supervisor.component.html',

  styleUrl:
    './programacion-supervisor.component.css',

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  providers: [
    ProgramacionSecuenciaState,
    ProgramacionGeneradorState,
    ProgramacionExcepcionState,
    ProgramacionCargaFacade,
    ProgramacionSecuenciaFacade,
    ProgramacionGuardadoFacade,
    ProgramacionLiderFacade
  ]
})
export class ProgramacionSupervisorComponent
  implements OnInit {

  /*
   * ============================================================
   * DEPENDENCIAS
   * ============================================================
   */

  private readonly facade =
    inject(ProgramacionSupervisorFacade);

  private readonly secuenciaState =
    inject(ProgramacionSecuenciaState);

  private readonly cargaFacade =
    inject(ProgramacionCargaFacade);

  private readonly secuenciaFacade =
    inject(ProgramacionSecuenciaFacade);

  private readonly guardadoFacade =
    inject(ProgramacionGuardadoFacade);

  private readonly liderFacade =
    inject(ProgramacionLiderFacade);

  readonly generador =
    inject(ProgramacionGeneradorState);

  readonly excepciones =
    inject(ProgramacionExcepcionState);

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

  agentesProgramadosLista: TrabajadorResumen[] = [];

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

    this.cargaFacade
      .cargarPlazas()
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

    this.generador.limpiarResultado();


    this.diaSeleccionado = null;

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
    this.cargaFacade
      .cargarPrincipal(
        this.plazaId,
        this.anio,
        this.mes
      )
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

          this.excepciones.reemplazar(
            resultado.excepciones
          );

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


    this.cargaFacade
      .recargarSecuencias(
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


    this.liderFacade
      .cargar(
        this.plazaId
      )
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


          this.liderSeleccionado =
            this.liderFacade.construirSeleccion(
              this.agentes,
              this.grupos
            );


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




  /*
   * Devuelve los registros
   * completos del grupo respetando
   * el orden guardado.
   */
  secuenciasDeGrupo(
    grupo: GrupoProgramacion
  ): SecuenciaAgente[] {
    return this.secuenciaFacade.ordenarGrupo(
      this.secuencias,
      grupo
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


    this.secuenciaFacade
      .asignar(
        this.plazaId,
        agenteId,
        grupo
      )
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
          this.secuencias =
            this.secuenciaFacade.reemplazarRegistro(
              this.secuencias,
              registro
            );

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



    this.secuenciaFacade
      .guardarOrden(
        this.plazaId,
        grupo,
        integrantes
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
          this.secuencias =
            this.secuenciaFacade.aplicarOrden(
              this.secuencias,
              grupo,
              integrantes
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
    if (!this.plazaId || this.generador.procesando) {
      return;
    }

    this.error = '';
    this.mensaje = '';
    this.generador.abrir();
    this.cdr.detectChanges();
  }






  generarPropuesta(): void {
    if (!this.plazaId || this.generador.procesando) {
      return;
    }

    const errorValidacion =
      this.generador.validar(
        this.anio,
        this.mes
      );
    if (errorValidacion) {
      this.error = errorValidacion;
      this.cdr.detectChanges();
      return;
    }

    this.generador.procesando = true;
    this.error = '';
    this.mensaje = '';

    this.facade.generarPropuesta(
      this.generador.construirRequest(
        this.plazaId,
        this.anio,
        this.mes
      )
    )
      .pipe(
        finalize(() => {
          this.generador.procesando = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: propuesta => {
          this.aplicarPropuesta(propuesta);
          this.generador.modalAbierto = false;
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

  private aplicarPropuesta(
    propuesta: ProgramacionPropuestaResponse
  ): void {
    const celdas =
      this.generador.aplicarPropuesta(
        propuesta
      );

    for (const celda of celdas) {
      const dia =
        this.diaDeFecha(
          celda.fecha
        );

      const key =
        this.key(
          celda.trabajadorId,
          dia
        );

      this.matrix.set(
        key,
        celda.estado
      );

      this.cambios.set(
        key,
        celda.estado
      );
    }

  }

  diasPropuestaConDeficit(): number {
    return this.generador.diasConDeficit();
  }

  diasPropuestaConExceso(): number {
    return this.generador.diasConExceso();
  }

  conflictosVisibles(): ConflictoProgramacionPropuesta[] {
    return this.generador.conflictosVisibles();
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
      const excepcion = this.excepciones.porAgente.get(agenteId);
      const agente = this.secuenciaState.agente(agenteId);

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

    this.cdr.detectChanges();
  }


  seleccionarDia(dia: number): void {
    this.diaSeleccionado = dia;
    this.cdr.detectChanges();
  }






  tieneExcepcion(
    agenteId: number
  ): boolean {
    return this.excepciones.tiene(
      agenteId
    );
  }

  colorExcepcion(
    agenteId: number
  ): string {
    return this.excepciones.colorDe(
      agenteId
    );
  }

  colorExcepcionSuave(
    agenteId: number
  ): string {
    return this.excepciones.colorSuaveDe(
      agenteId
    );
  }



  abrirModalExcepcion(): void {
    this.excepciones.abrirNueva();
    this.cdr.detectChanges();
  }


  turnosRecomendados(
    agenteId: number
  ): string {
    return this.excepciones.turnosRecomendados(
      agenteId
    );
  }

  turnoRecomendado(
    agenteId: number,
    estado: 'A' | 'B' | 'C'
  ): boolean {
    return this.excepciones.turnoRecomendado(
      agenteId,
      estado
    );
  }

  abrirExcepcion(
    agente: TrabajadorResumen
  ): void {
    this.excepciones.abrir(
      agente
    );
    this.cdr.detectChanges();
  }



  guardarExcepcion(): void {
    if (
      !this.plazaId ||
      !this.excepciones.agente ||
      this.excepciones.guardando
    ) {
      return;
    }

    const errorValidacion =
      this.excepciones.validar();

    if (errorValidacion) {
      this.error = errorValidacion;
      return;
    }

    const request =
      this.excepciones.construirRequest(
        this.plazaId
      );

    if (!request) {
      return;
    }

    this.excepciones.guardando = true;
    this.error = '';

    this.facade
      .guardarExcepcion(
        request
      )
      .pipe(
        finalize(
          () => {
            this.excepciones.guardando = false;
            this.cdr.detectChanges();
          }
        )
      )
      .subscribe({
        next: excepcion => {
          this.excepciones.aplicar(
            excepcion
          );

          this.mensaje =
            'Excepción del agente guardada correctamente.';

          this.cdr.detectChanges();
        },
        error: e => {
          this.error =
            this.mensajeError(
              e,
              'No se pudo guardar la excepción.'
            );

          this.cdr.detectChanges();
        }
      });
  }

  quitarExcepcion(): void {
    if (
      !this.plazaId ||
      !this.excepciones.agente ||
      this.excepciones.guardando
    ) {
      return;
    }

    if (
      !window.confirm(
        `¿Quitar la excepción de ${this.excepciones.agente.nombreCompleto}?`
      )
    ) {
      return;
    }

    const agenteId =
      this.excepciones.agente.id;

    this.excepciones.guardando = true;
    this.error = '';

    this.facade
      .desactivarExcepcion(
        agenteId,
        this.plazaId
      )
      .pipe(
        finalize(
          () => {
            this.excepciones.guardando = false;
            this.cdr.detectChanges();
          }
        )
      )
      .subscribe({
        next: () => {
          this.excepciones.quitar(
            agenteId
          );

          this.mensaje =
            'Excepción eliminada correctamente.';

          this.cdr.detectChanges();
        },
        error: e => {
          this.error =
            this.mensajeError(
              e,
              'No se pudo eliminar la excepción.'
            );

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


    this.guardando =
      true;

    this.error =
      '';

    this.mensaje =
      '';


    this.guardadoFacade
      .guardar(
        this.plazaId,
        this.cambios,
        this.anio,
        this.mes
      )
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

          this.guardadoFacade.aplicarResultado(
            this.matrix,
            turnosGuardados
          );


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


    this.liderFacade
      .asignar(
        this.plazaId,
        agente.id,
        controladorId,
        this.hoy()
      )
      .subscribe({

        next: (
          grupo
        ) => {

          this.grupos =
            this.liderFacade.reemplazarGrupo(
              this.grupos,
              grupo
            );


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




  estaProcesandoAgente(
    agenteId: number
  ): boolean {

    return this.agentesProcesando
      .has(
        agenteId
      );
  }




  alternarDetalles(): void {
    this.mostrarDetalles = !this.mostrarDetalles;
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



  private reconstruirCacheSecuencias(): void {
    this.agentesProgramadosLista =
      this.secuenciaState.reconstruir(
        this.agentes,
        this.secuencias,
        this.gruposProgramacion.map(
          grupo => grupo.codigo
        ),
        this.busqueda
      );

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