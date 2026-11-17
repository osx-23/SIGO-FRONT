import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AsistenciaApiService } from '../../services/asistencia-api.service';
import { PermutasApiService } from '../../services/permutas-api.service';
import { Plaza, Turno } from '../../models/asistencia.models';
import { PermutaDetalle, ResumenPermutas } from '../../models/permutas.models';
import { HistorialPaginacionComponent } from '../../../../shared/components/historial-paginacion.component';

@Component({
  selector: 'app-permutas',
  standalone: true,
  imports: [CommonModule, FormsModule, HistorialPaginacionComponent],
  templateUrl: './permutas.component.html'
})
export class PermutasComponent implements OnInit {
  private readonly api = inject(PermutasApiService);
  private readonly asistencia = inject(AsistenciaApiService);

  readonly plazas = signal<Plaza[]>([]);
  readonly turnos = signal<Turno[]>([]);
  readonly registros = signal<PermutaDetalle[]>([]);
  readonly totalRegistros = signal(0);
  readonly totalPaginas = signal(0);
  paginaActual = 1;
  tamanoPagina = 10;
  private solicitudHistorial = 0;
  readonly resumen = signal<ResumenPermutas | null>(null);
  readonly cargando = signal(false);
  readonly cargandoDashboard = signal(false);
  readonly exportando = signal(false);
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
    this.paginaActual = 1;
    this.cargarPaginaHistorial();
  }

  cambiarPaginaHistorial(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas() || pagina === this.paginaActual) return;
    this.paginaActual = pagina;
    this.cargarPaginaHistorial();
  }

  cambiarTamanoHistorial(tamano: number): void {
    if (![10, 25, 50].includes(tamano)) return;
    this.tamanoPagina = tamano;
    this.aplicarFiltros();
  }

  private cargarPaginaHistorial(): void {
    if (this.inicio && this.fin && this.inicio > this.fin) {
      this.error.set('La fecha inicial no puede superar la final.');
      return;
    }
    const solicitud = ++this.solicitudHistorial;
    this.cargando.set(true);
    this.error.set('');
    this.api.listarPaginado({
      inicio: this.inicio, fin: this.fin, plazaId: this.plazaId,
      turnoId: this.turnoId, codigo: this.codigo
    }, this.paginaActual - 1, this.tamanoPagina).subscribe({
      next: data => {
        if (solicitud !== this.solicitudHistorial) return;
        this.registros.set(data.registros);
        this.totalRegistros.set(data.total);
        this.totalPaginas.set(data.totalPaginas);
        this.cargando.set(false);
        if (data.totalPaginas > 0 && this.paginaActual > data.totalPaginas) {
          this.paginaActual = data.totalPaginas;
          this.cargarPaginaHistorial();
        }
      },
      error: () => {
        if (solicitud !== this.solicitudHistorial) return;
        this.registros.set([]);
        this.totalRegistros.set(0);
        this.totalPaginas.set(0);
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

  exportarExcel(): void {
    if (this.exportando()) return;
    if (this.inicio && this.fin && this.inicio > this.fin) {
      this.error.set('La fecha inicial no puede superar la final.');
      return;
    }
    this.error.set('');
    this.exportando.set(true);
    this.api.exportarExcel({
      inicio: this.inicio, fin: this.fin, plazaId: this.plazaId,
      turnoId: this.turnoId, codigo: this.codigo
    }, Number(this.periodo.slice(0, 4))).subscribe({
      next: blob => {
        this.exportando.set(false);
        if (!blob.size) {
          this.error.set('El servidor devolvió un Excel vacío.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'SIGO_Permutas_' + this.periodo.slice(0, 4) +
          '_' + (this.inicio || 'todas') + '_' + (this.fin || 'todas') + '.xlsx';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.exportando.set(false);
        this.error.set('No se pudo generar el Excel de permutas. Revisa la conexión con el backend.');
      }
    });
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
