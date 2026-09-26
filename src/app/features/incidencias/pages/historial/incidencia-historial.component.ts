import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../../core/auth/auth.service';
import { Plaza } from '../../../asistencia/models/asistencia.models';
import { AsistenciaApiService } from '../../../asistencia/services/asistencia-api.service';
import { ImageCropperModalComponent } from '../../../asistencia/shared/image-cropper-modal.component';
import {
  EstadoIncidencia,
  IncidenciaResponse
} from '../../models/incidencia.models';
import { IncidenciaApiService } from '../../services/incidencia-api.service';

interface EvidenciaTarget {
  incidenciaId: number;
  evidenciaId: number | null;
}

@Component({
  selector: 'app-incidencia-historial',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ImageCropperModalComponent
  ],
  templateUrl: './incidencia-historial.component.html'
})
export class IncidenciaHistorialComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(IncidenciaApiService);
  private readonly catalogos = inject(AsistenciaApiService);

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly actualizandoId = signal<number | null>(null);

  readonly detalle = signal<IncidenciaResponse | null>(null);
  readonly cargandoDetalle = signal(false);
  readonly guardandoEvidencia = signal(false);
  readonly eliminandoEvidenciaId = signal<number | null>(null);

  readonly cropperVisible = signal(false);
  readonly cropperFile = signal<File | null>(null);
  readonly evidenciaTarget = signal<EvidenciaTarget | null>(null);

  incidencias: IncidenciaResponse[] = [];
  plazas: Plaza[] = [];
  inicio = this.primerDiaMes();
  fin = this.fechaHoy();
  plazaId: number | null = null;
  estado: EstadoIncidencia | null = null;

  get esOperador(): boolean {
    return this.auth.usuario()?.rol === 'OPERADOR';
  }

  get puedeAtender(): boolean {
    return this.auth.tieneRol('SUPERVISOR', 'CONTROLADOR');
  }

  ngOnInit(): void {
    const usuario = this.auth.usuario();

    if (this.esOperador) {
      this.plazaId = usuario?.plazaId ?? null;
      this.buscar();
      return;
    }

    this.catalogos.getPlazas().subscribe({
      next: plazas => {
        this.plazas = (plazas ?? [])
          .filter(p => p.activo !== false);

        this.buscar();
      },
      error: () => {
        this.error.set(
          'No se pudieron cargar las plazas.'
        );
        this.buscar();
      }
    });
  }

  buscar(): void {
    if (this.cargando()) return;

    this.error.set('');

    if (!this.inicio || !this.fin) {
      return this.error.set(
        'Selecciona las fechas.'
      );
    }

    if (this.inicio > this.fin) {
      return this.error.set(
        'La fecha inicial no puede ser posterior a la final.'
      );
    }

    this.cargando.set(true);

    this.api
      .listar(
        this.inicio,
        this.fin,
        this.plazaId,
        this.estado
      )
      .subscribe({
        next: data => {
          this.incidencias = data ?? [];
          this.cargando.set(false);
        },
        error: err => {
          this.cargando.set(false);
          this.error.set(
            err?.error?.message ??
            'No se pudo cargar el historial de incidencias.'
          );
        }
      });
  }

  limpiar(): void {
    this.inicio = this.primerDiaMes();
    this.fin = this.fechaHoy();
    this.estado = null;

    if (!this.esOperador) {
      this.plazaId = null;
    }

    this.buscar();
  }

  abrirDetalle(item: IncidenciaResponse): void {
    this.error.set('');
    this.cargandoDetalle.set(true);
    this.detalle.set(item);

    this.api.obtener(item.id).subscribe({
      next: incidencia => {
        this.detalle.set(incidencia);
        this.actualizarItemLocal(incidencia);
        this.cargandoDetalle.set(false);
      },
      error: err => {
        this.cargandoDetalle.set(false);
        this.error.set(
          err?.error?.message ??
          'No se pudo cargar el detalle de la incidencia.'
        );
      }
    });
  }

  cerrarDetalle(): void {
    if (
      this.guardandoEvidencia() ||
      this.eliminandoEvidenciaId() !== null
    ) {
      return;
    }

    this.detalle.set(null);
  }

  marcarAtendido(item: IncidenciaResponse): void {
    if (
      !this.puedeAtender ||
      item.estado === 'ATENDIDO' ||
      this.actualizandoId() !== null
    ) {
      return;
    }

    this.actualizandoId.set(item.id);

    this.api.atender(item.id).subscribe({
      next: actualizado => {
        this.actualizarItemLocal(actualizado);

        if (this.detalle()?.id === actualizado.id) {
          this.detalle.set(actualizado);
        }

        this.actualizandoId.set(null);
      },
      error: err => {
        this.actualizandoId.set(null);
        this.error.set(
          err?.error?.message ??
          'No se pudo cambiar el estado de la incidencia.'
        );
      }
    });
  }

  seleccionarEvidencia(
    incidenciaId: number,
    evidenciaId: number | null,
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    this.error.set('');

    if (!file) return;

    const item = this.detalle();

    if (
      evidenciaId === null &&
      (item?.evidencias.length ?? 0) >= 5
    ) {
      return this.error.set(
        'La incidencia ya tiene el máximo de 5 evidencias.'
      );
    }

    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp'
      ].includes(file.type)
    ) {
      return this.error.set(
        'Solo se permiten imágenes JPG, PNG o WEBP.'
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return this.error.set(
        'Cada fotografía debe pesar como máximo 10 MB.'
      );
    }

    this.evidenciaTarget.set({
      incidenciaId,
      evidenciaId
    });

    this.cropperFile.set(file);
    this.cropperVisible.set(true);
  }

  onCropperConfirm(file: File): void {
    const target = this.evidenciaTarget();

    if (!target) {
      this.cerrarCropper();
      return;
    }

    this.guardandoEvidencia.set(true);

    const request$ =
      target.evidenciaId === null
        ? this.api.subirEvidencia(
            target.incidenciaId,
            file
          )
        : this.api.reemplazarEvidencia(
            target.incidenciaId,
            target.evidenciaId,
            file
          );

    request$.subscribe({
      next: () => {
        this.guardandoEvidencia.set(false);
        this.cerrarCropper();
        this.recargarDetalle(
          target.incidenciaId
        );
      },
      error: err => {
        this.guardandoEvidencia.set(false);
        this.cerrarCropper();
        this.error.set(
          err?.error?.message ??
          'No se pudo guardar la evidencia.'
        );
      }
    });
  }

  onCropperCancel(): void {
    if (this.guardandoEvidencia()) return;
    this.cerrarCropper();
  }

  eliminarEvidencia(
    incidenciaId: number,
    evidenciaId: number
  ): void {
    if (
      this.eliminandoEvidenciaId() !== null ||
      this.guardandoEvidencia()
    ) {
      return;
    }

    const confirmar = window.confirm(
      '¿Deseas eliminar esta evidencia?'
    );

    if (!confirmar) return;

    this.eliminandoEvidenciaId.set(
      evidenciaId
    );

    this.api
      .eliminarEvidencia(
        incidenciaId,
        evidenciaId
      )
      .subscribe({
        next: () => {
          this.eliminandoEvidenciaId.set(null);
          this.recargarDetalle(incidenciaId);
        },
        error: err => {
          this.eliminandoEvidenciaId.set(null);
          this.error.set(
            err?.error?.message ??
            'No se pudo eliminar la evidencia.'
          );
        }
      });
  }

  horaCorta(hora: string): string {
    return hora.slice(0, 5) || '--:--';
  }

  private recargarDetalle(id: number): void {
    this.cargandoDetalle.set(true);

    this.api.obtener(id).subscribe({
      next: incidencia => {
        this.detalle.set(incidencia);
        this.actualizarItemLocal(incidencia);
        this.cargandoDetalle.set(false);
      },
      error: err => {
        this.cargandoDetalle.set(false);
        this.error.set(
          err?.error?.message ??
          'No se pudo actualizar el detalle de la incidencia.'
        );
      }
    });
  }

  private actualizarItemLocal(
    actualizado: IncidenciaResponse
  ): void {
    this.incidencias =
      this.incidencias.map(item =>
        item.id === actualizado.id
          ? actualizado
          : item
      );
  }

  private cerrarCropper(): void {
    this.cropperVisible.set(false);
    this.cropperFile.set(null);
    this.evidenciaTarget.set(null);
  }

  private fechaHoy(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset();

    return new Date(
      now.getTime() - offset * 60000
    )
      .toISOString()
      .slice(0, 10);
  }

  private primerDiaMes(): string {
    const now = new Date();

    const local =
      new Date(
        now.getTime() -
        now.getTimezoneOffset() * 60000
      );

    return (
      `${local.getFullYear()}-` +
      `${String(local.getMonth() + 1).padStart(2, '0')}-01`
    );
  }
}
