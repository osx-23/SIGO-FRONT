import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ProgramacionApiService } from '../../data-access/programacion-api.service';
import {
  CasetaConfiguracion,
  ConfiguracionAsignacionCaseta,
  GeneradorCasetasPropuesta,
  GrupoFlujoCaseta,
  Plaza,
  RestriccionCaseta,
  TipoPeriodoCaseta,
  TrabajadorResumen,
  Ubicacion
} from '../../models/programacion.models';

@Component({
  selector: 'app-generador-asignacion-casetas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './generador-asignacion-casetas.component.html',
  styleUrl: './generador-asignacion-casetas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeneradorAsignacionCasetasComponent
  implements OnInit {

  private readonly api =
    inject(ProgramacionApiService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  plazas: Plaza[] = [];
  agentes: TrabajadorResumen[] = [];
  casetas: CasetaConfiguracion[] = [];
  ubicaciones: Ubicacion[] = [];
  restricciones: RestriccionCaseta[] = [];

  plazaId: number | null = null;
  periodoMes = this.mesActual();

  tipoPeriodo: TipoPeriodoCaseta = 'SEMANA';
  semana = 1;

  configuracion: ConfiguracionAsignacionCaseta = {
    plazaId: 0,
    maxMismaCasetaSemana: 3,
    maxMismaCasetaMes: 8,
    maxConsecutivos: 2,
    balancearFlujo: true
  };

  propuesta: GeneradorCasetasPropuesta | null = null;

  nuevaRestriccionAgenteId: number | null = null;
  nuevaRestriccionUbicacionId: number | null = null;
  nuevaRestriccionMotivo = '';

  cargando = false;
  guardandoConfiguracion = false;
  generando = false;
  guardandoPropuesta = false;
  guardandoRestriccion = false;

  mensaje = '';
  error = '';

  async ngOnInit(): Promise<void> {
    await this.cargarPlazas();
  }

  async cargarPlazas(): Promise<void> {
    this.cargando = true;
    this.error = '';

    try {
      this.plazas =
        await firstValueFrom(
          this.api.getPlazas()
        );

      if (this.plazas.length) {
        this.plazaId =
          this.plazas[0].id;

        await this.cargarContexto();
      }
    } catch (error) {
      this.error =
        this.mensajeError(
          error,
          'No se pudieron cargar las plazas.'
        );
    } finally {
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  async cambiarPlaza(): Promise<void> {
    this.propuesta = null;
    this.mensaje = '';
    this.error = '';

    if (!this.plazaId) {
      return;
    }

    await this.cargarContexto();
  }

  async cargarContexto(): Promise<void> {
    if (!this.plazaId) {
      return;
    }

    this.cargando = true;
    this.error = '';

    try {
      const contexto =
        await firstValueFrom(
          forkJoin({
            configuracion:
              this.api.getConfiguracionGeneradorCasetas(
                this.plazaId
              ),
            casetas:
              this.api.getCasetasGenerador(
                this.plazaId
              ),
            ubicaciones:
              this.api.getUbicacionesConfiguracion(
                this.plazaId
              ),
            restricciones:
              this.api.getRestriccionesCasetas(
                this.plazaId
              ),
            agentes:
              this.api.getAgentes(
                this.plazaId
              )
          })
        );

      this.configuracion =
        contexto.configuracion;

      this.casetas =
        contexto.casetas;

      this.ubicaciones =
        contexto.ubicaciones;

      this.restricciones =
        contexto.restricciones;

      this.agentes =
        contexto.agentes;

      this.limpiarFormularioRestriccion();
    } catch (error) {
      this.error =
        this.mensajeError(
          error,
          'No se pudo cargar la configuración del generador.'
        );
    } finally {
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  async guardarConfiguracion(): Promise<void> {
    if (!this.plazaId) {
      return;
    }

    this.guardandoConfiguracion = true;
    this.error = '';
    this.mensaje = '';

    try {
      this.configuracion =
        await firstValueFrom(
          this.api.guardarConfiguracionGeneradorCasetas({
            plazaId: this.plazaId,
            maxMismaCasetaSemana:
              Number(
                this.configuracion
                  .maxMismaCasetaSemana
              ),
            maxMismaCasetaMes:
              Number(
                this.configuracion
                  .maxMismaCasetaMes
              ),
            maxConsecutivos:
              Number(
                this.configuracion
                  .maxConsecutivos
              ),
            balancearFlujo:
              this.configuracion
                .balancearFlujo
          })
        );

      this.mensaje =
        'Reglas generales guardadas correctamente.';
    } catch (error) {
      this.error =
        this.mensajeError(
          error,
          'No se pudieron guardar las reglas.'
        );
    } finally {
      this.guardandoConfiguracion = false;
      this.cdr.markForCheck();
    }
  }

  async guardarCaseta(
    caseta: CasetaConfiguracion
  ): Promise<void> {
    if (!this.plazaId) {
      return;
    }

    this.error = '';
    this.mensaje = '';

    try {
      const guardada =
        await firstValueFrom(
          this.api.guardarCasetaGenerador(
            caseta.ubicacionId,
            {
              plazaId: this.plazaId,
              grupoFlujo:
                caseta.grupoFlujo,
              maxSemana:
                this.numeroONull(
                  caseta.maxSemana
                ),
              maxMes:
                this.numeroONull(
                  caseta.maxMes
                )
            }
          )
        );

      const index =
        this.casetas.findIndex(
          item =>
            item.ubicacionId ===
            guardada.ubicacionId
        );

      if (index >= 0) {
        this.casetas = [
          ...this.casetas.slice(0, index),
          guardada,
          ...this.casetas.slice(index + 1)
        ];
      }

      this.mensaje =
        `Configuración de ${guardada.codigo} guardada.`;
    } catch (error) {
      this.error =
        this.mensajeError(
          error,
          'No se pudo guardar la configuración de la caseta.'
        );
    } finally {
      this.cdr.markForCheck();
    }
  }

  async agregarRestriccion(): Promise<void> {
    if (
      !this.plazaId ||
      !this.nuevaRestriccionAgenteId ||
      !this.nuevaRestriccionUbicacionId
    ) {
      this.error =
        'Selecciona un agente y una caseta.';
      return;
    }

    this.guardandoRestriccion = true;
    this.error = '';
    this.mensaje = '';

    try {
      await firstValueFrom(
        this.api.guardarRestriccionCaseta({
          plazaId: this.plazaId,
          trabajadorId:
            this.nuevaRestriccionAgenteId,
          ubicacionId:
            this.nuevaRestriccionUbicacionId,
          motivo:
            this.nuevaRestriccionMotivo
              .trim() || null,
          activo: true
        })
      );

      this.restricciones =
        await firstValueFrom(
          this.api.getRestriccionesCasetas(
            this.plazaId
          )
        );

      this.limpiarFormularioRestriccion();

      this.mensaje =
        'Restricción agregada correctamente.';
    } catch (error) {
      this.error =
        this.mensajeError(
          error,
          'No se pudo guardar la restricción.'
        );
    } finally {
      this.guardandoRestriccion = false;
      this.cdr.markForCheck();
    }
  }

  async eliminarRestriccion(
    restriccion: RestriccionCaseta
  ): Promise<void> {
    if (
      !confirm(
        `¿Quitar la restricción de ${restriccion.trabajador} para la caseta ${restriccion.ubicacionCodigo}?`
      )
    ) {
      return;
    }

    this.error = '';
    this.mensaje = '';

    try {
      await firstValueFrom(
        this.api.eliminarRestriccionCaseta(
          restriccion.id
        )
      );

      this.restricciones =
        this.restricciones.filter(
          item =>
            item.id !==
            restriccion.id
        );

      this.mensaje =
        'Restricción eliminada.';
    } catch (error) {
      this.error =
        this.mensajeError(
          error,
          'No se pudo eliminar la restricción.'
        );
    } finally {
      this.cdr.markForCheck();
    }
  }

  async generar(): Promise<void> {
    if (!this.plazaId) {
      return;
    }

    const [anio, mes] =
      this.periodoMes
        .split('-')
        .map(Number);

    if (!anio || !mes) {
      this.error =
        'Selecciona un mes válido.';
      return;
    }

    this.generando = true;
    this.error = '';
    this.mensaje = '';
    this.propuesta = null;

    try {
      this.propuesta =
        await firstValueFrom(
          this.api.generarPropuestaCasetas({
            plazaId: this.plazaId,
            anio,
            mes,
            periodo:
              this.tipoPeriodo,
            semana:
              this.tipoPeriodo ===
              'SEMANA'
                ? this.semana
                : null
          })
        );

      if (
        this.propuesta
          .conflictos.length
      ) {
        this.mensaje =
          'La propuesta se generó con observaciones. Revísalas antes de guardar.';
      } else {
        this.mensaje =
          'Propuesta generada correctamente. Aún no se ha guardado.';
      }
    } catch (error) {
      this.error =
        this.mensajeError(
          error,
          'No se pudo generar la distribución.'
        );
    } finally {
      this.generando = false;
      this.cdr.markForCheck();
    }
  }

  async guardarPropuesta(): Promise<void> {
    if (
      !this.plazaId ||
      !this.propuesta ||
      !this.propuesta.asignaciones.length
    ) {
      return;
    }

    this.guardandoPropuesta = true;
    this.error = '';
    this.mensaje = '';

    try {
      await firstValueFrom(
        this.api.guardarDistribucion({
          plazaId: this.plazaId,
          distribuciones:
            this.propuesta
              .asignaciones
              .map(item => ({
                programacionTurnoId:
                  item.programacionTurnoId,
                ubicacionId:
                  item.ubicacionId,
                observacion:
                  'Generado automáticamente'
              }))
        })
      );

      this.mensaje =
        'Distribución guardada correctamente. Ya está disponible para el controlador.';
    } catch (error) {
      this.error =
        this.mensajeError(
          error,
          'No se pudo guardar la distribución generada.'
        );
    } finally {
      this.guardandoPropuesta = false;
      this.cdr.markForCheck();
    }
  }

  exportarJsonDiagnostico(): void {
    if (
      !this.propuesta ||
      !this.plazaId
    ) {
      return;
    }

    const plaza =
      this.plazas.find(
        item => item.id === this.plazaId
      ) ?? null;

    const ubicacionPorId =
      new Map(
        this.ubicaciones.map(
          item => [
            item.id,
            item
          ] as const
        )
      );

    const configuracionPorId =
      new Map(
        this.casetas.map(
          item => [
            item.ubicacionId,
            item
          ] as const
        )
      );

    type HistorialFlujo = {
      fecha: string;
      ubicacionId: number;
      ubicacionCodigo: string;
      tipo: string | null;
    };

    const ultimaPorAgenteFlujo =
      new Map<string, HistorialFlujo>();

    const asignacionesDiagnostico =
      [...this.propuesta.asignaciones]
        .sort((a, b) =>
          a.fecha.localeCompare(b.fecha)
          || a.turno.localeCompare(b.turno)
          || a.codigoTrabajador - b.codigoTrabajador
        )
        .map(item => {
          const ubicacion =
            ubicacionPorId.get(
              item.ubicacionId
            );

          const configuracionCaseta =
            configuracionPorId.get(
              item.ubicacionId
            );

          const historialKey =
            `${item.trabajadorId}|${item.grupoFlujo}`;

          const ultimaMismoFlujo =
            ultimaPorAgenteFlujo.get(
              historialKey
            ) ?? null;

          const tipo =
            ubicacion?.tipo ?? null;

          const excepcionesDetectadas:
            string[] = [];

          if (
            ultimaMismoFlujo &&
            tipo &&
            (
              tipo === 'VIA' ||
              tipo === 'AUXILIAR'
            ) &&
            ultimaMismoFlujo.tipo === tipo
          ) {
            excepcionesDetectadas.push(
              'REPETICION_TIPO_EN_MISMO_FLUJO'
            );
          }

          if (
            ubicacion &&
            !this.ubicacionHabilitadaParaTurno(
              ubicacion,
              item.turno
            )
          ) {
            excepcionesDetectadas.push(
              'UBICACION_NO_HABILITADA_PARA_TURNO'
            );
          }

          if (tipo === 'APOYO') {
            excepcionesDetectadas.push(
              'USO_DE_APOYO'
            );
          }

          const diagnostico = {
            programacionTurnoId:
              item.programacionTurnoId,
            fecha:
              item.fecha,
            turno:
              item.turno,
            agente: {
              id:
                item.trabajadorId,
              codigo:
                item.codigoTrabajador,
              nombre:
                item.trabajador
            },
            ubicacion: {
              id:
                item.ubicacionId,
              codigo:
                item.ubicacionCodigo,
              nombre:
                item.ubicacionNombre,
              tipo,
              orden:
                ubicacion?.orden ?? null,
              activo:
                ubicacion?.activo ?? null,
              habilitadaParaTurno:
                ubicacion
                  ? this.ubicacionHabilitadaParaTurno(
                      ubicacion,
                      item.turno
                    )
                  : null
            },
            flujo:
              item.grupoFlujo,
            puntaje:
              item.puntaje,
            limitesCaseta: {
              maxSemana:
                configuracionCaseta
                  ?.maxSemana ?? null,
              maxMes:
                configuracionCaseta
                  ?.maxMes ?? null
            },
            ultimaAsignacionMismoFlujo:
              ultimaMismoFlujo,
            excepcionesDetectadas
          };

          ultimaPorAgenteFlujo.set(
            historialKey,
            {
              fecha:
                item.fecha,
              ubicacionId:
                item.ubicacionId,
              ubicacionCodigo:
                item.ubicacionCodigo,
              tipo
            }
          );

          return diagnostico;
        });

    type ResumenTurno = {
      fecha: string;
      turno: 'A' | 'B' | 'C';
      agentesAsignados: number;
      agentesSinAsignar: number;
      agentesProgramados: number;
      viasUsadas: number;
      auxiliaresUsados: number;
      apoyosUsados: number;
      ubicacionesUsadas: string[];
      ubicacionesLibres: string[];
      duplicidades: string[];
      alertas: string[];
    };

    const resumenPorTurno =
      new Map<string, ResumenTurno>();

    const obtenerResumen = (
      fecha: string,
      turno: 'A' | 'B' | 'C'
    ): ResumenTurno => {
      const key =
        `${fecha}|${turno}`;

      const existente =
        resumenPorTurno.get(key);

      if (existente) {
        return existente;
      }

      const elegibles =
        this.ubicaciones.filter(
          ubicacion =>
            ubicacion.activo &&
            (
              turno !== 'C' ||
              ubicacion.tipo === 'VIA'
            )
        );

      const creado: ResumenTurno = {
        fecha,
        turno,
        agentesAsignados: 0,
        agentesSinAsignar: 0,
        agentesProgramados: 0,
        viasUsadas: 0,
        auxiliaresUsados: 0,
        apoyosUsados: 0,
        ubicacionesUsadas: [],
        ubicacionesLibres:
          elegibles.map(
            item => item.codigo
          ),
        duplicidades: [],
        alertas: []
      };

      resumenPorTurno.set(
        key,
        creado
      );

      return creado;
    };

    const ocupacionPorTurno =
      new Map<string, Map<number, number>>();

    for (
      const item of asignacionesDiagnostico
    ) {
      const resumen =
        obtenerResumen(
          item.fecha,
          item.turno
        );

      resumen.agentesAsignados++;

      const codigo =
        item.ubicacion.codigo;

      if (
        !resumen.ubicacionesUsadas.includes(
          codigo
        )
      ) {
        resumen.ubicacionesUsadas.push(
          codigo
        );
      }

      resumen.ubicacionesLibres =
        resumen.ubicacionesLibres.filter(
          value => value !== codigo
        );

      switch (item.ubicacion.tipo) {
        case 'VIA':
          resumen.viasUsadas++;
          break;

        case 'AUXILIAR':
          resumen.auxiliaresUsados++;
          break;

        case 'APOYO':
          resumen.apoyosUsados++;
          break;
      }

      const turnoKey =
        `${item.fecha}|${item.turno}`;

      const ocupacion =
        ocupacionPorTurno.get(
          turnoKey
        ) ?? new Map<number, number>();

      const cantidad =
        (
          ocupacion.get(
            item.ubicacion.id
          ) ?? 0
        ) + 1;

      ocupacion.set(
        item.ubicacion.id,
        cantidad
      );

      ocupacionPorTurno.set(
        turnoKey,
        ocupacion
      );

      if (cantidad > 1) {
        resumen.duplicidades.push(
          codigo
        );
      }
    }

    for (
      const conflicto of
      this.propuesta.conflictos
    ) {
      const resumen =
        obtenerResumen(
          conflicto.fecha,
          conflicto.turno
        );

      resumen.agentesSinAsignar++;
    }

    for (
      const resumen of
      resumenPorTurno.values()
    ) {
      resumen.agentesProgramados =
        resumen.agentesAsignados
        + resumen.agentesSinAsignar;

      if (
        resumen.agentesSinAsignar > 0 &&
        resumen.ubicacionesLibres.length > 0
      ) {
        resumen.alertas.push(
          'HAY_PERSONAL_SIN_ASIGNAR_Y_UBICACIONES_LIBRES'
        );
      }

      if (
        resumen.duplicidades.length > 0
      ) {
        resumen.alertas.push(
          'CASETA_DUPLICADA_EN_MISMO_TURNO'
        );
      }

      const auxiliaresActivos =
        this.ubicaciones.filter(
          item =>
            item.activo &&
            item.tipo === 'AUXILIAR'
        ).length;

      if (
        resumen.apoyosUsados > 0 &&
        resumen.auxiliaresUsados <
          auxiliaresActivos
      ) {
        resumen.alertas.push(
          'APOYO_USADO_ANTES_DE_COMPLETAR_AUXILIARES'
        );
      }

      resumen.ubicacionesUsadas.sort();
      resumen.ubicacionesLibres.sort();
      resumen.duplicidades =
        [...new Set(
          resumen.duplicidades
        )].sort();
    }

    const catalogoCasetas =
      this.ubicaciones
        .map(ubicacion => {
          const config =
            configuracionPorId.get(
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
              config?.grupoFlujo
              ?? 'SIN_CLASIFICAR',
            maxSemana:
              config?.maxSemana ?? null,
            maxMes:
              config?.maxMes ?? null
          };
        })
        .sort(
          (a, b) =>
            a.orden - b.orden
            || a.codigo.localeCompare(
              b.codigo
            )
        );

    const payload = {
      versionDiagnostico: 1,
      exportadoEn:
        new Date().toISOString(),
      plaza: {
        id:
          this.plazaId,
        codigo:
          plaza?.codigo ?? null,
        descripcion:
          plaza?.descripcion ?? null
      },
      periodo: {
        anio:
          this.propuesta.anio,
        mes:
          this.propuesta.mes,
        tipo:
          this.propuesta.periodo,
        semana:
          this.propuesta.semana,
        desde:
          this.propuesta.desde,
        hasta:
          this.propuesta.hasta
      },
      reglasGenerales: {
        ...this.configuracion
      },
      limitacionesDiagnostico: [
        'El backend actualmente entrega puntaje total, pero no el desglose de penalizaciones.',
        'La fase exacta ESTRICTA/FLEXIBLE/REPARACION no viene incluida en la respuesta del backend.',
        'La última asignación del mismo flujo se calcula dentro del rango exportado; el backend puede considerar historial anterior.'
      ],
      resumen: {
        totalAsignaciones:
          asignacionesDiagnostico.length,
        totalConflictos:
          this.propuesta.conflictos.length,
        turnos:
          [...resumenPorTurno.values()]
            .sort(
              (a, b) =>
                a.fecha.localeCompare(
                  b.fecha
                )
                || a.turno.localeCompare(
                  b.turno
                )
            )
      },
      catalogoCasetas,
      restricciones:
        this.restricciones.map(
          item => ({
            id:
              item.id,
            trabajadorId:
              item.trabajadorId,
            codigoTrabajador:
              item.codigoTrabajador,
            trabajador:
              item.trabajador,
            ubicacionId:
              item.ubicacionId,
            ubicacionCodigo:
              item.ubicacionCodigo,
            motivo:
              item.motivo,
            activo:
              item.activo
          })
        ),
      asignaciones:
        asignacionesDiagnostico,
      conflictos:
        this.propuesta.conflictos
    };

    const contenido =
      JSON.stringify(
        payload,
        null,
        2
      );

    const blob =
      new Blob(
        [contenido],
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
      document.createElement(
        'a'
      );

    const plazaArchivo =
      plaza?.codigo
        ?.replace(
          /[^a-zA-Z0-9_-]/g,
          '-'
        )
        || `plaza-${this.plazaId}`;

    enlace.href = url;
    enlace.download =
      `diagnostico-asignacion-casetas-${plazaArchivo}-${this.periodoMes}.json`;

    document.body.appendChild(
      enlace
    );

    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(
      url
    );

    this.mensaje =
      'JSON de diagnóstico exportado. Puedes subir ese archivo al chat para revisar la asignación.';
  }

  private ubicacionHabilitadaParaTurno(
    ubicacion: Ubicacion,
    turno: 'A' | 'B' | 'C'
  ): boolean {
    switch (turno) {
      case 'A':
        return ubicacion.permiteTurnoA;

      case 'B':
        return ubicacion.permiteTurnoB;

      case 'C':
        return ubicacion.permiteTurnoC;
    }
  }

  cambiarPeriodo(
    tipo: TipoPeriodoCaseta
  ): void {
    this.tipoPeriodo = tipo;
    this.propuesta = null;
  }

  totalAltoFlujo(): number {
    return this.casetas.filter(
      item =>
        item.activo &&
        item.grupoFlujo ===
        'ALTO_FLUJO'
    ).length;
  }

  totalBajoFlujo(): number {
    return this.casetas.filter(
      item =>
        item.activo &&
        item.grupoFlujo ===
        'BAJO_FLUJO'
    ).length;
  }

  totalSinClasificar(): number {
    return this.casetas.filter(
      item =>
        item.activo &&
        item.grupoFlujo ===
        'SIN_CLASIFICAR'
    ).length;
  }

  grupoTexto(
    grupo: GrupoFlujoCaseta
  ): string {
    switch (grupo) {
      case 'ALTO_FLUJO':
        return 'Alto flujo';

      case 'BAJO_FLUJO':
        return 'Bajo flujo';

      default:
        return 'Sin clasificar';
    }
  }

  fechaCorta(fecha: string): string {
    const date =
      new Date(`${fecha}T00:00:00`);

    return new Intl.DateTimeFormat(
      'es-PE',
      {
        day: '2-digit',
        month: 'short'
      }
    ).format(date);
  }

  private limpiarFormularioRestriccion(): void {
    this.nuevaRestriccionAgenteId = null;
    this.nuevaRestriccionUbicacionId = null;
    this.nuevaRestriccionMotivo = '';
  }

  private numeroONull(
    value: number | null
  ): number | null {
    if (
      value === null ||
      value === undefined ||
      value === ('' as unknown as number)
    ) {
      return null;
    }

    const numero = Number(value);

    return Number.isFinite(numero)
      ? numero
      : null;
  }

  private mesActual(): string {
    const hoy = new Date();

    return `${hoy.getFullYear()}-${String(
      hoy.getMonth() + 1
    ).padStart(2, '0')}`;
  }

  private mensajeError(
    error: unknown,
    fallback: string
  ): string {
    const value =
      error as {
        error?: {
          message?: string;
          error?: string;
        };
        message?: string;
      };

    return value?.error?.message
      || value?.error?.error
      || value?.message
      || fallback;
  }
}
