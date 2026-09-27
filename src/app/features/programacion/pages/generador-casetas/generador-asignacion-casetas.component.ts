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
  TrabajadorResumen
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
