import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../../core/auth/auth.service';
import { Plaza } from '../../../asistencia/models/asistencia.models';
import { AsistenciaApiService } from '../../../asistencia/services/asistencia-api.service';
import { EstadoIncidencia, IncidenciaResponse } from '../../models/incidencia.models';
import { IncidenciaApiService } from '../../services/incidencia-api.service';

@Component({
  selector: 'app-incidencia-historial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './incidencia-historial.component.html'
})
export class IncidenciaHistorialComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(IncidenciaApiService);
  private readonly catalogos = inject(AsistenciaApiService);

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly actualizandoId = signal<number | null>(null);

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
        this.plazas = (plazas ?? []).filter(p => p.activo !== false);
        this.buscar();
      },
      error: () => {
        this.error.set('No se pudieron cargar las plazas.');
        this.buscar();
      }
    });
  }

  buscar(): void {
    if (this.cargando()) return;
    this.error.set('');

    if (!this.inicio || !this.fin) return this.error.set('Selecciona las fechas.');
    if (this.inicio > this.fin) return this.error.set('La fecha inicial no puede ser posterior a la final.');

    this.cargando.set(true);
    this.api.listar(this.inicio, this.fin, this.plazaId, this.estado).subscribe({
      next: data => {
        this.incidencias = data ?? [];
        this.cargando.set(false);
      },
      error: err => {
        this.cargando.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo cargar el historial de incidencias.');
      }
    });
  }

  limpiar(): void {
    this.inicio = this.primerDiaMes();
    this.fin = this.fechaHoy();
    this.estado = null;
    if (!this.esOperador) this.plazaId = null;
    this.buscar();
  }

  marcarAtendido(item: IncidenciaResponse): void {
    if (!this.puedeAtender || item.estado === 'ATENDIDO' || this.actualizandoId() !== null) return;

    this.actualizandoId.set(item.id);
    this.api.atender(item.id).subscribe({
      next: actualizado => {
        this.incidencias = this.incidencias.map(i => i.id === actualizado.id ? actualizado : i);
        this.actualizandoId.set(null);
      },
      error: err => {
        this.actualizandoId.set(null);
        this.error.set(err?.error?.message ?? 'No se pudo cambiar el estado de la incidencia.');
      }
    });
  }

  horaCorta(hora: string): string {
    return hora?.slice(0, 5) || '--:--';
  }

  private fechaHoy(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  private primerDiaMes(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-01`;
  }
}
