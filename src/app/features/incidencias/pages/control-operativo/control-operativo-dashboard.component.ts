import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { Plaza } from '../../../asistencia/models/asistencia.models';
import {
  ControlOperativoApiService, ControlOperativoDashboard, ControlOperativoDiaDashboard
} from '../../services/control-operativo-api.service';

interface PuntoCola {
  fecha: string;
  metros: number;
  x: number;
  y: number;
  etiqueta: string;
}

interface EjeCola {
  valor: number;
  y: number;
}

@Component({
  selector: 'app-control-operativo-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="dash" aria-label="Dashboard de control operativo">
      <header class="dash-toolbar">
        <div class="dash-intro">
          <p class="dash-eyebrow">SIGO · Control operativo</p>
          <h2>Visión general</h2>
          <p>Indicadores y evolución de la cola por día.</p>
        </div>
        <div class="dash-filtros">
          <label>Plaza
            <select [(ngModel)]="plazaId" (ngModelChange)="cargar()" [disabled]="!esSupervisor">
              <option [ngValue]="null">Todas las plazas</option>
              <option *ngFor="let plaza of plazas" [ngValue]="plaza.id">{{plaza.codigo}}</option>
            </select>
          </label>
          <label>Desde
            <input type="date" [(ngModel)]="inicio" (change)="cargar()" [max]="fin">
          </label>
          <label>Hasta
            <input type="date" [(ngModel)]="fin" (change)="cargar()" [min]="inicio">
          </label>
          <button type="button" class="dash-refresh" (click)="cargar()" [disabled]="cargando" aria-label="Actualizar dashboard" title="Actualizar dashboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>
            </svg>
          </button>
        </div>
      </header>

      <div *ngIf="error" class="dash-error" role="alert">{{error}}</div>

      <div class="dash-kpis" aria-label="Indicadores del período">
        <article class="dash-kpi">
          <span class="dash-kpi-icon kpi-flag" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 20V4m0 1c5-3 7 3 13 0v10c-6 3-8-3-13 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="dash-kpi-label">Incidencias registradas</span>
          <strong>{{resumen?.incidenciasRegistradas ?? 0}}</strong>
          <small>Reportes del período seleccionado</small>
        </article>
        <article class="dash-kpi">
          <span class="dash-kpi-icon kpi-up" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 19 19 5M10 5h9v9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="dash-kpi-label">Cola máxima</span>
          <strong>{{resumen?.colaMaxima ?? 0}}<span> m</span></strong>
          <small>Mayor longitud registrada</small>
        </article>
        <article class="dash-kpi">
          <span class="dash-kpi-icon kpi-ruler" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 4h14v16H5zM9 5v6M13 5v4M17 5v6M9 16v3M13 14v5M17 16v3" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          </span>
          <span class="dash-kpi-label">Promedio de máximos</span>
          <strong>{{(resumen?.promedioMaximos ?? 0) | number:'1.0-0'}}<span> m</span></strong>
          <small>Promedio de máximos diarios con datos</small>
        </article>
      </div>

      <div class="dash-main">
        <section class="dash-card dash-grafica" aria-label="Gráfica de cola máxima diaria">
          <div class="dash-card-head">
            <div>
              <h3>Cola máxima diaria</h3>
              <p>Selecciona un punto para consultar los registros de ese día.</p>
            </div>
            <span class="dash-legend"><span aria-hidden="true"></span>Cola máxima (m)</span>
          </div>
          <div *ngIf="cargando" class="dash-cargando" role="status">Cargando estadísticas…</div>
          <div *ngIf="!cargando && !puntos.length" class="dash-vacio">
            <span class="dash-vacio-icon" aria-hidden="true">↗</span>
            No hay mediciones de cola en las fechas seleccionadas.
          </div>
          <div *ngIf="!cargando && puntos.length" class="dash-chart-scroll">
            <svg class="dash-svg" viewBox="0 0 820 320" role="img" aria-label="Gráfica de la cola máxima por fecha en metros">
              <defs>
                <linearGradient id="sigo-cola-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#14b8a6" stop-opacity=".19"/>
                  <stop offset="100%" stop-color="#14b8a6" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <g *ngFor="let eje of ejes">
                <line x1="64" [attr.y1]="eje.y" x2="790" [attr.y2]="eje.y" stroke="#e5edf5" stroke-dasharray="4 5"/>
                <text x="53" [attr.y]="eje.y + 4" text-anchor="end" class="dash-axis-text">{{eje.valor}}</text>
              </g>
              <text x="22" y="22" class="dash-axis-text">m</text>
              <path *ngIf="areaCola" [attr.d]="areaCola" fill="url(#sigo-cola-fill)" stroke="none"/>
              <path [attr.d]="lineaCola" fill="none" stroke="#14b8a6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              <g *ngFor="let p of puntos">
                <circle [attr.cx]="p.x" [attr.cy]="p.y" r="13" fill="transparent" stroke="none"
                  tabindex="0" role="button" [attr.aria-label]="'Seleccionar '+formatoFecha(p.fecha)+': '+p.metros+' metros'"
                  (click)="seleccionarDia(p.fecha)" (keydown.enter)="seleccionarDia(p.fecha)" (keydown.space)="seleccionarDia(p.fecha);$event.preventDefault()"/>
                <circle [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="diaSeleccionado===p.fecha ? 7 : 5.2"
                  [attr.fill]="diaSeleccionado===p.fecha ? '#2563eb' : '#14b8a6'" stroke="#fff" stroke-width="2.2"
                  pointer-events="none"/>
              </g>
              <g *ngFor="let punto of etiquetasEje">
                <text [attr.x]="punto.x" y="291" text-anchor="middle" class="dash-axis-text">{{punto.etiqueta}}</text>
              </g>
            </svg>
          </div>
          <div class="dash-card-footer">
            <span>Cada punto corresponde a un día con alguna medición.</span>
            <span>Datos de reportes operativos con cola registrada</span>
          </div>
        </section>
        <aside class="dash-card dash-detalle" aria-label="Detalle diario">
          <div class="dash-detail-head">
            <div>
              <h3>Detalle del día</h3>
              <p>{{diaSeleccionado ? formatoFecha(diaSeleccionado) : 'Sin día seleccionado'}}</p>
            </div>
            <span class="dash-count">{{detalleDia?.incidencias ?? 0}} {{(detalleDia?.incidencias ?? 0)===1 ? 'reporte' : 'reportes'}}</span>
          </div>
          <div class="dash-detail-value">
            <span>Mayor cola registrada</span>
            <strong>{{detalleDia?.colaMaxima ?? 0}}<small> m</small></strong>
            <span class="dash-detail-arrow" aria-hidden="true">↗</span>
          </div>
          <p class="dash-detail-note" *ngIf="detalleDia && !detalleDia.incidencias && detalleDia.mediciones">
            Sin reportes de incidente ese día. La cola máxima proviene de las mediciones registradas.
          </p>
          <p class="dash-detail-note" *ngIf="detalleDia && detalleDia.incidencias">
            {{detalleDia.incidencias}} {{detalleDia.incidencias===1 ? 'reporte registrado' : 'reportes registrados'}} en esta fecha.
          </p>
          <p class="dash-detail-note" *ngIf="!detalleDia">
            Selecciona un punto de la gráfica para consultar los datos de un día.
          </p>
          <p class="dash-detail-measure" *ngIf="detalleDia">
            {{detalleDia.mediciones}} {{detalleDia.mediciones===1 ? 'medición de cola' : 'mediciones de cola'}} ese día.
          </p>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .dash{color:#17243b;background:#f4f7fb;padding:20px;border-radius:22px}
    .dash-toolbar{display:flex;align-items:end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:20px}
    .dash-eyebrow{font-size:11px;letter-spacing:.12em;font-weight:800;color:#2563eb;text-transform:uppercase;margin:0 0 7px}
    .dash-intro h2{font-size:20px;font-weight:800;letter-spacing:-.025em;margin:0 0 5px}
    .dash-intro p:last-child{margin:0;color:#7b8aa2;font-size:12px}
    .dash-filtros{display:flex;align-items:end;gap:10px;flex-wrap:wrap}
    .dash-filtros label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:800;color:#667894;min-width:132px}
    .dash-filtros input,.dash-filtros select{width:100%;height:42px;padding:0 11px;border:1px solid #d8e2ef;border-radius:9px;background:#fff;color:#17243b;font-size:12px;font-weight:500;outline:none}
    .dash-filtros input:focus,.dash-filtros select:focus{border-color:#2563eb;box-shadow:0 0 0 3px #dbeafe}
    .dash-filtros select:disabled{background:#eef2f7;color:#65748a}
    .dash-filtros .dash-refresh{height:42px;width:42px;border:1px solid #d8e2ef;border-radius:9px;background:#fff;color:#2563eb;display:grid;place-items:center;cursor:pointer;padding:0}
    .dash-refresh svg{width:19px;height:19px}.dash-refresh:disabled{opacity:.55;cursor:wait}
    .dash-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:20px}
    .dash-kpi{position:relative;min-height:146px;padding:22px 20px;background:#fff;border:1px solid #e1e8f2;border-radius:16px;box-shadow:0 6px 22px rgba(17,35,60,.035);display:flex;flex-direction:column;gap:9px}
    .dash-kpi-label{font-size:12px;color:#7486a2;font-weight:750;max-width:calc(100% - 53px)}
    .dash-kpi strong{font-size:31px;font-weight:850;letter-spacing:-.04em;line-height:1.25;color:#17243b}
    .dash-kpi strong span{font-size:20px;font-weight:750}
    .dash-kpi small{font-size:11px;color:#7b8da8}
    .dash-kpi-icon{position:absolute;right:18px;top:17px;width:39px;height:39px;border-radius:12px;display:grid;place-items:center}
    .dash-kpi-icon svg{width:19px;height:19px}
    .kpi-flag{color:#0f9488;background:#e6f7f4}.kpi-up{color:#2563eb;background:#ebf1ff}.kpi-ruler{color:#d97706;background:#fff3e6}
    .dash-main{display:grid;grid-template-columns:minmax(0,1.85fr) minmax(300px,1fr);gap:16px}
    .dash-card{min-width:0;background:#fff;border:1px solid #e1e8f2;border-radius:17px;padding:21px;box-shadow:0 6px 22px rgba(17,35,60,.035)}
    .dash-card-head,.dash-detail-head{display:flex;justify-content:space-between;align-items:start;gap:12px}
    .dash-card h3{margin:0;color:#17243b;font-size:16px;font-weight:800}
    .dash-card-head p,.dash-detail-head p{margin:5px 0 0;font-size:12px;color:#7788a3;line-height:1.5}
    .dash-legend{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;color:#7386a4;font-size:11px}
    .dash-legend span{width:9px;height:9px;border-radius:50%;background:#14b8a6}
    .dash-chart-scroll{margin-top:12px;overflow:hidden}
    .dash-svg{display:block;width:100%;height:auto;max-height:370px}
    .dash-axis-text{fill:#8092ad;font-size:12px;font-family:Inter,Arial,sans-serif}
    .dash-svg [role=button]{cursor:pointer;outline:0}
    .dash-svg [role=button]:focus{stroke:#2563eb;stroke-width:3}
    .dash-card-footer{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:10px;color:#8190a8;line-height:1.5;margin-top:6px}
    .dash-count{background:#eaf2ff;border-radius:99px;color:#3f6bac;font-size:10px;font-weight:800;padding:6px 10px;white-space:nowrap}
    .dash-detail-value{background:#edf9f6;border:1px solid #cceee6;border-radius:12px;padding:18px;margin-top:25px;position:relative;display:flex;flex-direction:column;gap:6px}
    .dash-detail-value>span:first-child{color:#5c8a83;font-size:11px}
    .dash-detail-value strong{font-size:26px;font-weight:850;color:#0d8779;line-height:1.2}
    .dash-detail-value strong small{font-size:13px}
    .dash-detail-arrow{position:absolute;right:17px;top:25px;font-size:26px;font-weight:700;color:#14b8a6}
    .dash-detail-note,.dash-detail-measure{color:#8090aa;font-size:11px;line-height:1.6;margin:15px 0 0}
    .dash-detail-measure{margin-top:10px}
    .dash-cargando,.dash-vacio{height:280px;display:flex;align-items:center;justify-content:center;text-align:center;color:#71839d;font-size:13px;gap:12px}
    .dash-vacio-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:#eff6ff;color:#2563eb;font-size:22px}
    .dash-error{margin-bottom:14px;padding:12px;border-radius:10px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;font-size:13px}
    @media(max-width:1050px){.dash-toolbar{align-items:start}.dash-main{grid-template-columns:1fr}.dash-kpi{min-height:142px}}
    @media(max-width:670px){
      .dash{padding:12px;border-radius:16px}
      .dash-filtros{width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
      .dash-filtros label:first-child{grid-column:1 / -1}
      .dash-filtros .dash-refresh{width:100%}
      .dash-kpis{grid-template-columns:1fr;gap:10px}
      .dash-kpi{min-height:115px;padding:15px}
      .dash-kpi strong{font-size:27px}
      .dash-card{padding:15px}
      .dash-legend{font-size:10px}
      .dash-main{gap:12px}
    }
  `]
})
export class ControlOperativoDashboardComponent implements OnInit {
  @Input() plazas: Plaza[] = [];
  private readonly api = inject(ControlOperativoApiService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  inicio = this.fechaLima(-29);
  fin = this.fechaLima(0);
  plazaId: number | null = null;
  resumen: ControlOperativoDashboard | null = null;
  cargando = false;
  error = '';
  diaSeleccionado = '';
  puntos: PuntoCola[] = [];
  etiquetasEje: PuntoCola[] = [];
  ejes: EjeCola[] = [];
  lineaCola = '';
  areaCola = '';
  private solicitud = 0;

  get esSupervisor(): boolean { return this.auth.tieneRol('SUPERVISOR'); }
  get detalleDia(): ControlOperativoDiaDashboard | null {
    return this.resumen?.dias.find(d => d.fecha === this.diaSeleccionado) ?? null;
  }

  ngOnInit(): void {
    if (!this.esSupervisor) this.plazaId = this.auth.usuario()?.plazaId ?? null;
    void this.cargar();
  }

  private fechaLima(diferenciaDias: number): string {
    const fecha = new Date();
    const fragmentos = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(fecha);
    const valor = (tipo: string) => fragmentos.find(p => p.type === tipo)?.value ?? '';
    const fechaUtc = new Date(Date.UTC(Number(valor('year')), Number(valor('month')) - 1, Number(valor('day'))));
    fechaUtc.setUTCDate(fechaUtc.getUTCDate() + diferenciaDias);
    return fechaUtc.toISOString().slice(0, 10);
  }

  formatoFecha(fecha: string): string {
    if (!fecha || fecha.length < 10) return fecha;
    return fecha.slice(8,10) + '/' + fecha.slice(5,7) + '/' + fecha.slice(0,4);
  }

  seleccionarDia(fecha: string): void {
    this.diaSeleccionado = fecha;
    this.cdr.markForCheck();
  }

  async cargar(): Promise<void> {
    if (!this.inicio || !this.fin || this.inicio > this.fin) {
      this.error = 'Selecciona un rango de fechas válido.';
      this.cdr.markForCheck();
      return;
    }
    const actual = ++this.solicitud;
    this.error = '';
    this.cargando = true;
    this.cdr.markForCheck();
    try {
      const r = await firstValueFrom(this.api.dashboard({
        inicio: this.inicio, fin: this.fin,
        plazaId: this.esSupervisor ? this.plazaId : this.auth.usuario()?.plazaId
      }));
      if (actual !== this.solicitud) return;
      this.resumen = r;
      this.construirGrafica();
      const fechas = new Set(r.dias.map(d => d.fecha));
      if (!fechas.has(this.diaSeleccionado)) {
        this.diaSeleccionado = this.puntos[this.puntos.length - 1]?.fecha ??
          r.dias[r.dias.length - 1]?.fecha ?? '';
      }
    } catch (e: unknown) {
      if (actual !== this.solicitud) return;
      const err = e as {error?:{message?:string;detail?:string};message?:string};
      this.error = err?.error?.message || err?.error?.detail || err?.message || 'No se pudieron cargar las estadísticas.';
      this.resumen = null;
      this.puntos = [];
      this.areaCola = '';
      this.lineaCola = '';
      this.diaSeleccionado = '';
    } finally {
      if (actual === this.solicitud) {
        this.cargando = false;
        this.cdr.markForCheck();
      }
    }
  }

  private construirGrafica(): void {
    const dias = (this.resumen?.dias ?? []).filter(d => d.colaMaxima !== null);
    if (!dias.length) {
      this.puntos = [];
      this.etiquetasEje = [];
      this.ejes = [];
      this.lineaCola = '';
      this.areaCola = '';
      return;
    }

    const maximo = Math.max(100, ...dias.map(d => d.colaMaxima ?? 0));
    const paso = Math.max(25, Math.ceil(maximo / 4 / 25) * 25);
    const tope = paso * 4;
    const baseY = 260;
    const alto = 210;
    this.ejes = Array.from({length: 5}, (_, i) => ({
      valor: i * paso, y: baseY - (i * paso / tope) * alto
    }));

    this.puntos = dias.map((d, i) => {
      const x = dias.length === 1 ? 420 : 68 + (i / (dias.length - 1)) * 706;
      return {
        fecha: d.fecha,
        metros: d.colaMaxima ?? 0,
        x,
        y: baseY - ((d.colaMaxima ?? 0) / tope) * alto,
        etiqueta: d.fecha.slice(8,10) + '/' + d.fecha.slice(5,7)
      };
    });
    this.lineaCola = this.puntos.map((p, i) =>
      (i === 0 ? 'M' : 'L') + ' ' + p.x.toFixed(2) + ' ' + p.y.toFixed(2)
    ).join(' ');
    const primero = this.puntos[0];
    const ultimo = this.puntos[this.puntos.length - 1];
    this.areaCola = this.lineaCola + ' L ' + ultimo.x.toFixed(2) + ' ' + baseY +
      ' L ' + primero.x.toFixed(2) + ' ' + baseY + ' Z';

    const saltar = Math.max(1, Math.ceil(this.puntos.length / 7));
    this.etiquetasEje = this.puntos.filter((_, i) =>
      i % saltar === 0 || i === this.puntos.length - 1
    );
  }
}
