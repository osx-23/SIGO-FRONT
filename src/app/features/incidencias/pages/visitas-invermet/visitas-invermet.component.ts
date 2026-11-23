import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { concatMap, from, map, of, switchMap, tap, toArray } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { Plaza } from '../../../asistencia/models/asistencia.models';
import { AsistenciaApiService } from '../../../asistencia/services/asistencia-api.service';
import { PreguntaInvermet, VisitaInvermet, VisitaInvermetRequest } from '../../models/visita-invermet.models';
import { VisitaInvermetApiService } from '../../services/visita-invermet-api.service';

interface FotoLocal {
  file: File;
  url: string;
}

@Component({
  selector: 'app-visitas-invermet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './visitas-invermet.component.html'
})
export class VisitasInvermetComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly api = inject(VisitaInvermetApiService);
  private readonly catalogos = inject(AsistenciaApiService);

  readonly pestaña = signal<'registro' | 'historial'>('registro');
  readonly guardando = signal(false);
  readonly cargando = signal(false);
  readonly exportandoId = signal<number | null>(null);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly detalle = signal<VisitaInvermet | null>(null);
  plazas: Plaza[] = [];
  visitas: VisitaInvermet[] = [];
  fotos: FotoLocal[] = [];
  filtroInicio = this.fechaHace30Dias();
  filtroFin = this.fechaHoy();
  filtroPlaza: number | null = null;
  private visitaPendienteId: number | null = null;
  form: VisitaInvermetRequest = this.formularioVacio();

  get esOperador(): boolean {
    return this.auth.usuario()?.rol === 'OPERADOR';
  }
  get duracion(): string {
    if (!this.form.horaInicio || !this.form.horaFinal) return '--:--';
    const [h1, m1] = this.form.horaInicio.split(':').map(Number);
    const [h2, m2] = this.form.horaFinal.split(':').map(Number);
    let minutes = h2 * 60 + m2 - (h1 * 60 + m1);
    if (minutes < 0) minutes += 1440;
    return this.formatoMinutos(minutes);
  }
  get visitasFiltradas(): VisitaInvermet[] {
    return this.visitas;
  }

  ngOnInit(): void {
    if (!this.esOperador) {
      this.catalogos.getPlazas().subscribe({
        next: plazas => this.plazas = (plazas ?? []).filter(p => p.activo !== false),
        error: () => this.error.set('No se pudo cargar el catálogo de plazas.')
      });
    }
    this.cargarHistorial();
  }
  ngOnDestroy(): void {
    this.fotos.forEach(f => URL.revokeObjectURL(f.url));
  }
  cambiarPestaña(p: 'registro' | 'historial'): void {
    this.pestaña.set(p);
    this.error.set('');
    this.mensaje.set('');
    if (p === 'historial') this.cargarHistorial();
  }
  agregarFotos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = '';
    if (!archivos.length) return;
    if (this.fotos.length + archivos.length > 4) {
      this.error.set('Puedes cargar como máximo 4 fotografías por visita.');
      return;
    }
    for (const archivo of archivos) {
      if (!['image/jpeg','image/png','image/webp'].includes(archivo.type) ||
          archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
        this.error.set('Las fotos deben ser JPG, PNG o WEBP de hasta 10 MB cada una.');
        return;
      }
    }
    for (const file of archivos) this.fotos.push({ file, url: URL.createObjectURL(file) });
    this.error.set('');
  }
  quitarFoto(index: number): void {
    if (this.guardando()) return;
    const [f] = this.fotos.splice(index, 1);
    if (f) URL.revokeObjectURL(f.url);
  }
  registrar(): void {
    if (this.guardando()) return;
    this.error.set('');
    this.mensaje.set('');
    const v = this.form;
    if (!v.plazaId || !v.controlador.trim() || !v.supervisor.trim() ||
        !v.fecha || !v.horaInicio || !v.horaFinal) {
      this.error.set('Completa la plaza, controlador, supervisor, fecha y horas de la visita.');
      return;
    }
    if (v.horaInicio === v.horaFinal) {
      this.error.set('La hora de inicio y fin no pueden ser iguales.');
      return;
    }
    if (!Number.isInteger(v.casetasEnPlaza) || !Number.isInteger(v.casetasAbiertas) ||
        v.casetasEnPlaza < 0 || v.casetasAbiertas < 0 || v.casetasAbiertas > v.casetasEnPlaza) {
      this.error.set('Verifica las casetas: abiertas no puede superar el total.');
      return;
    }
    if (v.preguntas.some(p => !p.pregunta.trim() && (p.quienRespondio.trim() || p.respuesta.trim()))) {
      this.error.set('Escribe la pregunta correspondiente a cada respuesta ingresada.');
      return;
    }
    const payload: VisitaInvermetRequest = {
      ...v,
      controlador: v.controlador.trim(),
      supervisor: v.supervisor.trim(),
      datoVisita1: v.datoVisita1.trim(),
      datoVisita2: v.datoVisita2.trim(),
      observaciones: v.observaciones.trim(),
      preguntas: v.preguntas.filter(p => p.pregunta.trim()).map(p => ({
        ...p,
        pregunta: p.pregunta.trim(),
        quienRespondio: p.quienRespondio.trim(),
        respuesta: p.respuesta.trim()
      }))
    };
    this.guardando.set(true);
    // Si una fotografía falla, el siguiente intento completa la misma visita, sin duplicar el acta.
    const visita$ = this.visitaPendienteId
      ? of({ id: this.visitaPendienteId } as VisitaInvermet)
      : this.api.registrar(payload);
    visita$.pipe(
      tap(v => this.visitaPendienteId = v.id),
      switchMap(v => from([...this.fotos]).pipe(
        concatMap(f => this.api.subirFoto(v.id, f.file).pipe(
          tap(() => {
            const i = this.fotos.indexOf(f);
            if (i >= 0) this.fotos.splice(i, 1);
            URL.revokeObjectURL(f.url);
          })
        )),
        toArray(),
        map(() => v)
      ))
    ).subscribe({
      next: v => {
        this.guardando.set(false);
        this.visitaPendienteId = null;
        this.form = this.formularioVacio();
        this.mensaje.set('Visita Invermet #' + v.id + ' registrada correctamente. Puedes exportarla desde el historial.');
        this.cargarHistorial();
      },
      error: err => {
        this.guardando.set(false);
        const detalle = err?.error?.message || 'No se pudo completar el registro.';
        this.error.set(this.visitaPendienteId
          ? 'El acta #' + this.visitaPendienteId + ' ya está guardada. Faltan algunas fotografías; vuelve a pulsar Guardar para reintentar. ' + detalle
          : detalle);
      }
    });
  }
  cargarHistorial(): void {
    if (!this.filtroInicio || !this.filtroFin || this.filtroInicio > this.filtroFin) {
      this.error.set('Selecciona un rango de fechas válido.');
      return;
    }
    this.cargando.set(true);
    this.api.listar(this.filtroInicio, this.filtroFin, this.esOperador ? null : this.filtroPlaza).subscribe({
      next: visitas => {
        this.visitas = visitas ?? [];
        this.cargando.set(false);
      },
      error: err => {
        this.cargando.set(false);
        this.error.set(err?.error?.message ?? 'No se pudieron cargar las visitas registradas.');
      }
    });
  }
  verDetalle(item: VisitaInvermet): void {
    this.api.obtener(item.id).subscribe({
      next: detalle => this.detalle.set(detalle),
      error: () => this.error.set('No se pudo abrir el detalle de la visita.')
    });
  }
  descargarExcel(item: VisitaInvermet): void {
    if (this.exportandoId() != null) return;
    this.exportandoId.set(item.id);
    this.api.descargarExcel(item.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Visita_Invermet_' + item.plazaCodigo + '_' + item.fecha + '_' + item.id + '.xlsx';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.exportandoId.set(null);
      },
      error: err => {
        this.exportandoId.set(null);
        this.error.set(err?.error?.message || 'No se pudo exportar el Excel.');
      }
    });
  }
  formatoMinutos(minutes: number): string {
    if (!Number.isFinite(minutes)) return '--:--';
    return Math.floor(minutes / 60).toString().padStart(2, '0') + ':' +
      (minutes % 60).toString().padStart(2, '0');
  }
  private formularioVacio(): VisitaInvermetRequest {
    const now = new Date();
    return {
      plazaId: this.auth.usuario()?.plazaId ?? 0,
      controlador: '',
      supervisor: '',
      fecha: this.fechaHoy(),
      horaInicio: now.toTimeString().slice(0,5),
      horaFinal: '',
      casetasEnPlaza: 0,
      casetasAbiertas: 0,
      datoVisita1: '',
      datoVisita2: '',
      observaciones: '',
      preguntas: Array.from({length: 5}, (_, i): PreguntaInvermet => ({
        numero: i + 1, pregunta: '', quienRespondio: '', respuesta: ''
      }))
    };
  }
  private fechaHoy(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,10);
  }
  private fechaHace30Dias(): string {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,10);
  }
}
