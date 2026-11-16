import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AsistenciaApiService } from '../../services/asistencia-api.service';
import { PermutasApiService } from '../../services/permutas-api.service';
import { Plaza, Turno } from '../../models/asistencia.models';
import { PermutaDetalle, ResumenPermutas } from '../../models/permutas.models';

@Component({
  selector: 'app-permutas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './permutas.component.html'
})
export class PermutasComponent implements OnInit {
  private readonly api = inject(PermutasApiService);
  private readonly asistencia = inject(AsistenciaApiService);

  readonly plazas = signal<Plaza[]>([]);
  readonly turnos = signal<Turno[]>([]);
  readonly registros = signal<PermutaDetalle[]>([]);
  readonly resumen = signal<ResumenPermutas | null>(null);
  readonly cargando = signal(false);
  readonly cargandoDashboard = signal(false);
  readonly error = signal('');

  periodo = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
  inicio = this.periodo + '-01';
  fin = this.fechaFinMes(this.periodo);
  plazaId: number | null = null;
  turnoId: number | null = null;
  codigo: number | null = null;

  ngOnInit(): void {
    forkJoin({ plazas: this.asistencia.getPlazas(), turnos: this.asistencia.getTurnos() })
      .subscribe({
        next: data => {
          this.plazas.set(data.plazas.filter(p => p.activo));
          this.turnos.set(data.turnos);
        },
        error: () => this.error.set('No se pudieron cargar los filtros de plazas y turnos.')
      });
    this.aplicarFiltros();
    this.cargarDashboard();
  }

  cambiarPeriodo(): void {
    if (!/^\d{4}-\d{2}$/.test(this.periodo)) return;
    this.inicio = this.periodo + '-01';
    this.fin = this.fechaFinMes(this.periodo);
    this.aplicarFiltros();
    this.cargarDashboard();
  }

  private fechaFinMes(mes: string): string {
    const [year, month] = mes.split('-').map(Number);
    const dia = new Date(year, month, 0).getDate();
    return mes + '-' + String(dia).padStart(2, '0');
  }

  aplicarFiltros(): void {
    this.cargando.set(true);
    this.error.set('');
    this.api.listar({
      inicio: this.inicio, fin: this.fin, plazaId: this.plazaId,
      turnoId: this.turnoId, codigo: this.codigo
    }).subscribe({
      next: data => {
        this.registros.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo obtener el historial de permutas.');
      }
    });
  }

  cargarDashboard(): void {
    this.cargandoDashboard.set(true);
    this.api.dashboard(this.periodo).subscribe({
      next: data => {
        this.resumen.set(data);
        this.cargandoDashboard.set(false);
      },
      error: () => {
        this.cargandoDashboard.set(false);
        this.error.set('No se pudo cargar el dashboard de permutas.');
      }
    });
  }

  plazasConPermutas(): number {
    return this.resumen()?.porPlaza.filter(p => p.total > 0).length ?? 0;
  }

  barraPorcentaje(valor: number): number {
    const max = Math.max(1, ...(this.resumen()?.porPlaza.map(p => p.total) ?? [1]));
    return Math.round(valor * 100 / max);
  }

  limpiarFiltros(): void {
    this.plazaId = null;
    this.turnoId = null;
    this.codigo = null;
    this.inicio = this.periodo + '-01';
    this.fin = this.fechaFinMes(this.periodo);
    this.aplicarFiltros();
  }
}
