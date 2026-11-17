import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { AsistenciaApiService } from '../../services/asistencia-api.service';
import { PermutasApiService } from '../../services/permutas-api.service';
import { Plaza, Turno } from '../../models/asistencia.models';
import { PermutaDetalle, ResumenAnualPermutas, ResumenPermutas } from '../../models/permutas.models';
import { HistorialPaginacionComponent } from '../../../../shared/components/historial-paginacion.component';

@Component({
  selector: 'app-permutas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HistorialPaginacionComponent],
  templateUrl: './permutas.component.html'
})
export class PermutasComponent implements OnInit {
  private readonly api = inject(PermutasApiService);
  private readonly asistencia = inject(AsistenciaApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly vista: 'graficos' | 'historial' =
    this.route.snapshot.data['vista'] === 'historial' ? 'historial' : 'graficos';

  readonly plazas = signal<Plaza[]>([]);
  readonly turnos = signal<Turno[]>([]);
  readonly registros = signal<PermutaDetalle[]>([]);
  readonly totalRegistros = signal(0);
  readonly totalPaginas = signal(0);
  readonly resumen = signal<ResumenPermutas | null>(null);
  readonly anual = signal<ResumenAnualPermutas | null>(null);
  readonly cargando = signal(false);
  readonly cargandoDashboard = signal(false);
  readonly exportando = signal(false);
  readonly error = signal('');
  paginaActual = 1;
  tamanoPagina = 10;
  private solicitudHistorial = 0;
  private solicitudDashboard = 0;

  readonly meses = [
    { numero: 1, nombre: 'Ene', completo: 'enero' },
    { numero: 2, nombre: 'Feb', completo: 'febrero' },
    { numero: 3, nombre: 'Mar', completo: 'marzo' },
    { numero: 4, nombre: 'Abr', completo: 'abril' },
    { numero: 5, nombre: 'May', completo: 'mayo' },
    { numero: 6, nombre: 'Jun', completo: 'junio' },
    { numero: 7, nombre: 'Jul', completo: 'julio' },
    { numero: 8, nombre: 'Ago', completo: 'agosto' },
    { numero: 9, nombre: 'Set', completo: 'septiembre' },
    { numero: 10, nombre: 'Oct', completo: 'octubre' },
    { numero: 11, nombre: 'Nov', completo: 'noviembre' },
    { numero: 12, nombre: 'Dic', completo: 'diciembre' }
  ];

  anio = new Date().getFullYear();
  mes: number | null = new Date().getMonth() + 1;
  plazaId: number | null = null;
  turnoId: number | null = null;
  codigo: number | null = null;

  get inicio(): string {
    return `${this.anio}-${String(this.mes ?? 1).padStart(2, '0')}-01`;
  }
  get fin(): string {
    if (this.mes === null) return `${this.anio}-12-31`;
    const dia = new Date(this.anio, this.mes, 0).getDate();
    return `${this.anio}-${String(this.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }
  get periodoTexto(): string {
    const nombreMes = this.meses.find(m => m.numero === this.mes)?.completo;
    return this.mes === null ? `Todo el año ${this.anio}` : `${nombreMes} de ${this.anio}`;
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const anio = Number(params.get('anio'));
    const mes = params.get('mes');
    if (Number.isInteger(anio) && anio >= 2000 && anio <= 2100) this.anio = anio;
    if (mes === 'todos') this.mes = null;
    else if (mes !== null) {
      const m = Number(mes);
      if (Number.isInteger(m) && m >= 1 && m <= 12) this.mes = m;
    }
    if (this.vista === 'historial') {
      forkJoin({ plazas: this.asistencia.getPlazas(), turnos: this.asistencia.getTurnos() })
        .subscribe({
          next: data => {
            this.plazas.set(data.plazas);
            this.turnos.set(data.turnos);
          },
          error: () => this.error.set('No se pudieron cargar los filtros de plazas y turnos.')
        });
      this.aplicarFiltros();
    } else {
      this.cargarDashboard();
    }
  }

  cambiarPeriodo(): void {
    const y = Number(this.anio);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      this.error.set('Selecciona un año entre 2000 y 2100.');
      return;
    }
    this.anio = y;
    this.mes = this.mes === null ? null : Number(this.mes);
    if (this.mes !== null && (!Number.isInteger(this.mes) || this.mes < 1 || this.mes > 12)) {
      this.error.set('Selecciona un mes válido.');
      return;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { anio: this.anio, mes: this.mes ?? 'todos' },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    if (this.vista === 'graficos') this.cargarDashboard();
    else this.aplicarFiltros();
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
    const solicitud = ++this.solicitudDashboard;
    this.cargandoDashboard.set(true);
    this.error.set('');
    const mes = this.mes;
    const periodo = `${this.anio}-${String(mes ?? 1).padStart(2, '0')}`;
    forkJoin({
      anual: this.api.resumenAnual(this.anio),
      mensual: mes === null ? of(null) : this.api.dashboard(periodo)
    }).subscribe({
      next: ({ anual, mensual }) => {
        if (solicitud !== this.solicitudDashboard) return;
        this.anual.set(anual);
        const fila = anual.meses.find(m => m.mes === mes);
        this.resumen.set(mes === null
          ? {
              total: anual.total, porPlaza: anual.totalesPorPlaza,
              topAgentes: anual.topAgentes
            }
          : {
              total: fila?.total ?? mensual?.total ?? 0,
              porPlaza: fila?.porPlaza ?? mensual?.porPlaza ?? [],
              topAgentes: mensual?.topAgentes ?? []
            });
        this.cargandoDashboard.set(false);
      },
      error: () => {
        if (solicitud !== this.solicitudDashboard) return;
        this.anual.set(null);
        this.resumen.set(null);
        this.cargandoDashboard.set(false);
        this.error.set('No se pudo consultar el reporte anual de permutas.');
      }
    });
  }

  totalDePlaza(mes: { porPlaza: { plaza: string; total: number }[] }, plaza: string): number {
    return mes.porPlaza.find(p => p.plaza === plaza)?.total ?? 0;
  }
  totalAnualPlaza(plaza: string): number {
    return this.anual()?.totalesPorPlaza.find(p => p.plaza === plaza)?.total ?? 0;
  }
  nombrePlaza(plaza: string): string {
    return plaza === 'P2' ? 'P2/P3' : plaza === 'P6' ? 'P6/P7' : plaza;
  }
  plazasConPermutas(): number {
    return this.resumen()?.porPlaza.filter(p => p.total > 0).length ?? 0;
  }

  exportarExcel(): void {
    if (this.exportando()) return;
    this.error.set('');
    this.exportando.set(true);
    this.api.exportarExcel({
      inicio: this.inicio, fin: this.fin, plazaId: this.plazaId,
      turnoId: this.turnoId, codigo: this.codigo
    }, this.anio).subscribe({
      next: blob => {
        this.exportando.set(false);
        if (!blob.size) {
          this.error.set('El servidor devolvió un Excel vacío.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `SIGO_Permutas_${this.anio}_${this.mes ?? 'todos'}_meses.xlsx`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.exportando.set(false);
        this.error.set('No se pudo generar el Excel de permutas.');
      }
    });
  }

  limpiarFiltros(): void {
    this.plazaId = null;
    this.turnoId = null;
    this.codigo = null;
    this.aplicarFiltros();
  }
}
