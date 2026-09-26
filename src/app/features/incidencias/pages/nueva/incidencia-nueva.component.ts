import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of, switchMap } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { Plaza, Turno } from '../../../asistencia/models/asistencia.models';
import { AsistenciaApiService } from '../../../asistencia/services/asistencia-api.service';
import { ImageCropperModalComponent } from '../../../asistencia/shared/image-cropper-modal.component';
import { TipoIncidencia, ViaIncidencia } from '../../models/incidencia.models';
import { IncidenciaApiService } from '../../services/incidencia-api.service';

interface ArchivoPreview {
  file: File;
  url: string;
}

@Component({
  selector: 'app-incidencia-nueva',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageCropperModalComponent],
  templateUrl: './incidencia-nueva.component.html'
})
export class IncidenciaNuevaComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  private readonly api = inject(IncidenciaApiService);
  private readonly catalogos = inject(AsistenciaApiService);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly cropperVisible = signal(false);
  readonly cropperFile = signal<File | null>(null);

  plazas: Plaza[] = [];
  turnos: Turno[] = [];
  tipos: TipoIncidencia[] = [];
  vias: ViaIncidencia[] = [];
  fotos: ArchivoPreview[] = [];

  readonly form = this.fb.group({
    plazaId: this.fb.control<number | null>(null, Validators.required),
    turnoId: this.fb.control<number | null>(null, Validators.required),
    tipoId: this.fb.control<number | null>(null, Validators.required),
    viaId: this.fb.control<number | null>(null),
    fecha: this.fb.control(this.fechaHoy(), Validators.required),
    hora: this.fb.control(this.horaActual(), Validators.required),
    descripcion: this.fb.control('', [Validators.required, Validators.minLength(3), Validators.maxLength(2000)])
  });

  get esOperador(): boolean {
    return this.auth.usuario()?.rol === 'OPERADOR';
  }

  ngOnInit(): void {
    const usuario = this.auth.usuario();
    if (this.esOperador && usuario?.plazaId) {
      this.form.patchValue({ plazaId: usuario.plazaId }, { emitEvent: false });
    }

    this.form.controls.plazaId.valueChanges.subscribe(plazaId => {
      this.form.patchValue({ viaId: null }, { emitEvent: false });
      if (plazaId) this.cargarVias(plazaId);
      else this.vias = [];
    });

    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.fotos.forEach(f => URL.revokeObjectURL(f.url));
  }

  seleccionarEvidencia(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.error.set('');

    if (!file) return;
    if (this.fotos.length >= 5) return this.error.set('Puedes adjuntar como máximo 5 evidencias.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return this.error.set('Solo se permiten imágenes JPG, PNG o WEBP.');
    }
    if (file.size > 10 * 1024 * 1024) {
      return this.error.set('Cada fotografía debe pesar como máximo 10 MB.');
    }

    this.cropperFile.set(file);
    this.cropperVisible.set(true);
  }

  onCropperConfirm(file: File): void {
    this.fotos.push({ file, url: URL.createObjectURL(file) });
    this.cropperVisible.set(false);
    this.cropperFile.set(null);
  }

  onCropperCancel(): void {
    this.cropperVisible.set(false);
    this.cropperFile.set(null);
  }

  quitarFoto(index: number): void {
    const [foto] = this.fotos.splice(index, 1);
    if (foto) URL.revokeObjectURL(foto.url);
  }

  registrar(): void {
    this.error.set('');
    this.mensaje.set('');
    this.form.markAllAsTouched();

    const usuario = this.auth.usuario();
    if (!usuario?.trabajadorId) return this.error.set('No se pudo identificar al usuario.');
    if (this.form.invalid) return this.error.set('Completa los campos obligatorios.');

    const raw = this.form.getRawValue();
    const plazaId = this.esOperador ? usuario.plazaId : raw.plazaId;
    if (!plazaId) return this.error.set('Selecciona una plaza.');

    this.guardando.set(true);
    this.api.registrar({
      plazaId,
      turnoId: Number(raw.turnoId),
      tipoId: Number(raw.tipoId),
      viaId: raw.viaId ? Number(raw.viaId) : null,
      fecha: String(raw.fecha),
      hora: String(raw.hora),
      descripcion: String(raw.descripcion ?? '').trim()
    }).pipe(
      switchMap(incidencia => {
        if (!this.fotos.length) return of(incidencia);
        return forkJoin(this.fotos.map(f => this.api.subirEvidencia(incidencia.id, f.file))).pipe(
          switchMap(() => of(incidencia))
        );
      })
    ).subscribe({
      next: incidencia => {
        this.guardando.set(false);
        this.mensaje.set(`Incidencia #${incidencia.id} registrada en observación.`);
        this.resetear();
      },
      error: err => {
        this.guardando.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo registrar la incidencia.');
      }
    });
  }

  private cargarDatos(): void {
    const usuario = this.auth.usuario();
    this.cargando.set(true);

    const plazas$ = this.esOperador
      ? of([] as Plaza[])
      : this.catalogos.getPlazas();

    forkJoin({
      plazas: plazas$,
      turnos: this.catalogos.getTurnos(),
      tipos: this.api.getTipos()
    }).subscribe({
      next: ({ plazas, turnos, tipos }) => {
        this.plazas = (plazas ?? []).filter(p => p.activo !== false);
        this.turnos = turnos ?? [];
        this.tipos = tipos ?? [];

        const plazaId = this.esOperador ? usuario?.plazaId : this.form.controls.plazaId.value;
        if (plazaId) this.cargarVias(plazaId);

        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudieron cargar los datos para registrar la incidencia.');
      }
    });
  }

  private cargarVias(plazaId: number): void {
    this.api.getVias(plazaId).subscribe({
      next: vias => this.vias = (vias ?? []).filter(v => v.activa !== false),
      error: () => this.error.set('No se pudieron cargar las vías de la plaza.')
    });
  }

  private resetear(): void {
    this.fotos.forEach(f => URL.revokeObjectURL(f.url));
    this.fotos = [];
    const usuario = this.auth.usuario();
    this.form.reset({
      plazaId: this.esOperador ? usuario?.plazaId ?? null : null,
      turnoId: null,
      tipoId: null,
      viaId: null,
      fecha: this.fechaHoy(),
      hora: this.horaActual(),
      descripcion: ''
    });
    this.vias = [];
    const plazaId = this.form.controls.plazaId.value;
    if (plazaId) this.cargarVias(plazaId);
  }

  private fechaHoy(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  private horaActual(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}
