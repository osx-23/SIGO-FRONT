import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
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
  Ubicacion
} from '../../models/programacion.models';

import {
  ProgramacionApiService
} from '../../services/programacion-api.service';

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

  seleccionado:
    number | null = null;

  busqueda = '';

  cargando = false;

  cargandoCobertura = false;

  cargandoResumen = false;

  guardando = false;

  error = '';

  mensaje = '';

  modalUbicacionesAbierto = false;

  configPlazaId: number | null = null;

  ubicacionesConfiguracion: Ubicacion[] = [];

  cargandoConfiguracion = false;

  guardandoUbicacion = false;

  procesandoUbicacionId: number | null = null;

  ubicacionEditandoId: number | null = null;

  ubicacionCodigo = '';

  ubicacionNombre = '';

  ubicacionTipo: TipoUbicacion = 'VIA';

  ubicacionOrden: number | null = null;

  errorConfiguracion = '';

  mensajeConfiguracion = '';

  conflictoVisible = false;

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

  get agentesFiltrados():
    TrabajadorResumen[] {

    const query =
      this.busqueda
        .trim()
        .toLowerCase();

    const agentePorId =
      new Map<number, TrabajadorResumen>(
        this.agentes.map(
          agente => [
            agente.id,
            agente
          ]
        )
      );

    const resultado:
      TrabajadorResumen[] = [];

    for (
      const grupo
      of this.gruposProgramacion
    ) {

      const registros =
        this.secuencias
          .filter(
            secuencia =>
              secuencia.grupo ===
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

      for (
        const registro
        of registros
      ) {

        const agente =
          agentePorId.get(
            registro.agenteId
          );

        if (
          !agente
        ) {
          continue;
        }

        if (
          query &&
          !(
            `${agente.codigo} ` +
            `${agente.nombreCompleto}`
          )
            .toLowerCase()
            .includes(query)
        ) {
          continue;
        }

        resultado.push(
          agente
        );
      }
    }

    return resultado;
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

  guardar(): void {

    if (
      !this.plazaId ||
      this.cambios.size ===
        0
    ) {

      return;
    }

    const distribuciones =
      [
        ...this.cambios
          .entries()
      ]
        .map(
          (
            [
              programacionTurnoId,
              ubicacionId
            ]
          ) => ({

            programacionTurnoId,

            ubicacionId,

            observacion:
              null

          })
        );

    this.guardando =
      true;

    this.error =
      '';

    this.mensaje =
      '';

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

          this.cambios
            .clear();

          this.mensaje =
            'Distribución guardada correctamente.';

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
            'Error guardando distribución:',
            e
          );

          this.error =
            this.mensajeError(
              e,
              'No se pudo guardar la distribución.'
            );

          this.cdr.detectChanges();

        }

      });
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

    this.cargarConfiguracionUbicaciones();
  }


  cargarConfiguracionUbicaciones(): void {

    if (
      !this.configPlazaId ||
      !this.modalUbicacionesAbierto
    ) {
      this.ubicacionesConfiguracion =
        [];
      return;
    }

    this.cargandoConfiguracion =
      true;

    this.api
      .getUbicacionesConfiguracion(
        this.configPlazaId
      )
      .pipe(
        finalize(() => {
          this.cargandoConfiguracion =
            false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (ubicaciones) => {
          this.ubicacionesConfiguracion =
            [...ubicaciones];
          this.cdr.detectChanges();
        },
        error: (e) => {
          this.ubicacionesConfiguracion =
            [];
          this.errorConfiguracion =
            this.mensajeError(
              e,
              'No se pudieron cargar las casetas de la plaza.'
            );
          this.cdr.detectChanges();
        }
      });
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
      orden
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

    this.cdr.detectChanges();

    this.cargarResumen(
      trabajadorId
    );
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