import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { Plaza } from '../../../asistencia/models/asistencia.models';
import {
  ControlOperativoApiService, ControlOperativoDashboard,
  ControlOperativoEvidencia, ControlOperativoReporte,
  ControlOperativoTurnoDashboard, TurnoOperativo
} from '../../services/control-operativo-api.service';

type Periodo = 'SEMANA' | 'MES' | 'ANIO';
interface Punto {
  reporteId: number;
  turno: TurnoOperativo;
  fecha: string;
  clave: string;
  etiqueta: string;
  cola: number;
  registros: number;
  mediciones: number;
  plaza: string;
  hora: string;
  situacion: string;
  ingreso: string;
  incidente: string;
  x: number;
  y: number;
}
interface Serie { turno: TurnoOperativo; color: string; puntos: Punto[]; linea: string; }
interface Eje { valor: number; y: number; }
const COLORES: Record<TurnoOperativo,string> = {
  A: '#2563eb', B: '#14b8a6', C: '#8b5cf6'
};
const TURNOS: TurnoOperativo[] = ['A','B','C'];

@Component({
  selector: 'app-control-operativo-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="dash" aria-label="Dashboard de control operativo">
      <header class="dash-toolbar">
        <div>
          <p class="eyebrow">SIGO · CONTROL OPERATIVO</p>
          <h2>Visión general</h2>
          <p>Seguimiento de la cola vehicular por turno y período.</p>
        </div>
        <div class="filtros">
          <label>Plaza
            <select [(ngModel)]="plazaId" (ngModelChange)="cargar()" [disabled]="!esSupervisor">
              <option [ngValue]="null">Todas las plazas</option>
              <option *ngFor="let p of plazas" [ngValue]="p.id">{{p.codigo}}</option>
            </select>
          </label>
          <div class="periodo-wrap">
            <span class="field-caption">Ver por</span>
            <div class="periodo-botones" role="group" aria-label="Agrupación del gráfico">
              <button type="button" *ngFor="let p of periodos" [class.actual]="periodo===p.valor"
                [attr.aria-pressed]="periodo===p.valor" (click)="cambiarPeriodo(p.valor)">
                {{p.texto}}
              </button>
            </div>
          </div>
          <div class="navegacion">
            <span class="field-caption">Período seleccionado</span>
            <div class="periodo-nav">
              <button type="button" aria-label="Período anterior" (click)="mover(-1)">‹</button>
              <strong>{{tituloPeriodo}}</strong>
              <button type="button" aria-label="Período siguiente" (click)="mover(1)">›</button>
            </div>
          </div>
          <button type="button" class="recargar" (click)="cargar()" [disabled]="cargando"
            title="Actualizar" aria-label="Actualizar dashboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>
            </svg>
          </button>
        </div>
      </header>

      <p *ngIf="error" class="error" role="alert">{{error}}</p>

      <section class="indicadores" aria-label="Indicadores principales">
        <article class="indicador">
          <span class="indicador-icono verde" aria-hidden="true">⚑</span>
          <span class="indicador-etiqueta">Incidencias registradas</span>
          <strong>{{resumen?.incidenciasRegistradas ?? 0}}</strong>
          <small>Reportes del período</small>
        </article>
        <article class="indicador">
          <span class="indicador-icono azul" aria-hidden="true">↗</span>
          <span class="indicador-etiqueta">Cola máxima</span>
          <strong>{{resumen?.colaMaxima ?? 0}}<span> m</span></strong>
          <small>Mayor longitud registrada</small>
        </article>
        <article class="indicador">
          <span class="indicador-icono naranja" aria-hidden="true">▥</span>
          <span class="indicador-etiqueta">Promedio de máximos</span>
          <strong>{{(resumen?.promedioMaximos ?? 0) | number:'1.0-0'}}<span> m</span></strong>
          <small>Promedio de máximos diarios</small>
        </article>
      </section>

      <div class="principal">
        <section class="panel grafica" aria-label="Gráfica de la cola por turno">
          <div class="panel-head grafica-head">
            <div>
              <h3>Cola máxima por turno</h3>
              <p>{{descripcionGrafica}}</p>
            </div>
            <div class="leyendas">
              <span *ngFor="let t of turnos"><i [style.background]="colorTurno(t)"></i>Turno {{t}}</span>
            </div>
          </div>
          <div *ngIf="cargando" class="sin-datos" role="status">Cargando datos…</div>
          <div *ngIf="!cargando && !hayPuntos" class="sin-datos">No hay mediciones de cola en este período.</div>
          <div class="grafica-contenido" *ngIf="!cargando && hayPuntos" (mouseleave)="tooltip=null">
            <svg viewBox="0 0 820 320" class="svg-grafica" role="img"
              aria-label="Gráfica de máximo de cola por turno A, B y C">
              <g *ngFor="let eje of ejes">
                <line x1="60" [attr.y1]="eje.y" x2="787" [attr.y2]="eje.y"
                  stroke="#e3eaf3" stroke-dasharray="4 5"/>
                <text x="51" [attr.y]="eje.y+4" text-anchor="end" class="eje-texto">{{eje.valor}}</text>
              </g>
              <text x="23" y="24" class="eje-texto">m</text>
              <g *ngFor="let serie of series">
                <path [attr.d]="serie.linea" fill="none" [attr.stroke]="serie.color"
                  stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
                <g *ngFor="let p of serie.puntos">
                  <circle [attr.cx]="p.x" [attr.cy]="p.y" r="15" fill="transparent"
                    tabindex="0" role="button"
                    [attr.aria-label]="'Turno '+p.turno+', '+p.etiqueta+', '+p.cola+' metros'"
                    (mouseenter)="mostrarTooltip(p)" (mouseleave)="tooltip=null"
                    (focus)="mostrarTooltip(p)" (blur)="tooltip=null"
                    (click)="seleccionarPunto(p)"
                    (keydown.enter)="seleccionarPunto(p)"
                    (keydown.space)="seleccionarPunto(p);$event.preventDefault()">
                    <title>Turno {{p.turno}} · {{p.etiqueta}} · {{p.cola}} m · {{p.plaza}}</title>
                  </circle>
                  <circle [attr.cx]="p.x" [attr.cy]="p.y"
                    [attr.r]="puntoSeleccionado?.reporteId===p.reporteId ? 7 : 5.2"
                    [attr.fill]="serie.color" stroke="#fff" stroke-width="2.4"
                    pointer-events="none"/>
                </g>
              </g>
              <text *ngFor="let t of etiquetasEje" [attr.x]="t.x" y="291"
                text-anchor="middle" class="eje-texto">{{t.texto}}</text>
            </svg>
            <div *ngIf="tooltip as p" class="tooltip" role="status"
              [style.left.%]="p.x/820*100" [style.top.%]="p.y/320*100"
              [class.tooltip-invertido]="p.x > 530">
              <strong [style.color]="colorTurno(p.turno)">Turno {{p.turno}} · {{p.etiqueta}}</strong>
              <b>{{p.cola}} m</b>
              <span>Plaza: {{p.plaza || 'No indicada'}} · {{p.hora}}</span>
              <span *ngIf="p.situacion">Situación: {{p.situacion}}</span>
              <span *ngIf="p.incidente">Incidente: {{p.incidente}}</span>
              <small>Reporte #{{p.reporteId}} · Haz clic para ver este registro</small>
            </div>
          </div>
          <div class="pie-grafica">
            <span>Colores por turno · pasa el cursor para ver información.</span>
            <span>{{periodo === 'ANIO' ? 'Máximo de cada mes' : 'Máximo de cada día'}}</span>
          </div>
        </section>
        <aside class="panel detalle" aria-label="Detalle del registro seleccionado">
          <div class="panel-head">
            <div>
              <h3>Detalle del registro</h3>
              <p>{{puntoSeleccionado ? formatoFecha(puntoSeleccionado.fecha) : 'Selecciona un punto de la gráfica'}}</p>
            </div>
            <span class="pildora" *ngIf="puntoSeleccionado">
              #{{puntoSeleccionado.reporteId}} · Turno {{puntoSeleccionado.turno}}
            </span>
          </div>
          <div class="cola-dia">
            <span>Tamaño de cola registrado</span>
            <strong>{{puntoSeleccionado?.cola ?? 0}}<small> m</small></strong>
            <span class="flecha" aria-hidden="true">↗</span>
          </div>
          <div *ngIf="puntoSeleccionado as p" class="registro-datos">
            <div><small>Plaza</small><strong>{{reporteSeleccionado?.plazaCodigo || p.plaza}}</strong></div>
            <div><small>Turno</small><strong>Turno {{reporteSeleccionado?.turnoCodigo || p.turno}}</strong></div>
            <div><small>Hora</small><strong>{{reporteSeleccionado?.hora || p.hora}}</strong></div>
            <div><small>Responsable</small><strong>{{reporteSeleccionado?.responsableNombre || (seleccionandoRegistro ? 'Cargando…' : 'No indicado')}}</strong></div>
            <div><small>Situación de la plaza</small><strong>{{reporteSeleccionado?.situacion || p.situacion || 'Sin información'}}</strong></div>
            <div><small>Ingreso</small><strong>{{reporteSeleccionado?.ingreso || p.ingreso || 'Sin información'}}</strong></div>
            <div><small>Incidente</small><strong>{{reporteSeleccionado?.incidente || p.incidente || 'Sin incidente indicado'}}</strong></div>
            <div *ngIf="reporteSeleccionado?.viaNumero"><small>Vía</small><strong>{{reporteSeleccionado.viaNumero}}</strong></div>
          </div>
          <p *ngIf="!puntoSeleccionado" class="nota">
            Haz clic en un punto para ver los datos de ese registro en este panel.
          </p>
          <p *ngIf="seleccionandoRegistro" class="nota" role="status">Cargando información del registro…</p>
          <p *ngIf="errorRegistro" class="error" role="alert">{{errorRegistro}}</p>
          <button type="button" class="abrir-modal" (click)="abrirDetalle()"
            [disabled]="!puntoSeleccionado || seleccionandoRegistro">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>
            </svg>
            Ver registro completo y fotografías
          </button>
        </aside>
      </div>
    </section>

    <div *ngIf="modalAbierto" class="modal-fondo" (click)="cerrarModal()">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="tituloDetalleCO"
        (click)="$event.stopPropagation()">
        <header class="modal-cabecera">
          <div>
            <p class="eyebrow">SIGO · CONTROL OPERATIVO</p>
            <h2 id="tituloDetalleCO">Detalle del reporte #{{puntoSeleccionado?.reporteId}}</h2>
            <p>{{puntoSeleccionado ? formatoFecha(puntoSeleccionado.fecha) : ''}} · Datos y fotografías del registro seleccionado.</p>
          </div>
          <button type="button" class="cerrar" aria-label="Cerrar detalle" (click)="cerrarModal()">×</button>
        </header>
        <div class="modal-cuerpo">
          <p *ngIf="detalleCargando" class="aviso" role="status">Cargando registro y evidencias…</p>
          <p *ngIf="detalleError" class="error" role="alert">{{detalleError}}</p>
          <article *ngIf="reporteModal as r" class="reporte">
            <div class="reporte-titulo">
              <div><strong>Reporte #{{r.id}}</strong><p>{{r.plazaCodigo}} · Turno {{r.turnoCodigo}} · {{r.fecha}} {{r.hora}}</p></div>
              <span class="medida-reporte">{{r.colaMetros===null ? 'Sin medición' : r.colaMetros+' m'}}</span>
            </div>
            <div class="datos-reporte">
              <div><small>Responsable</small><strong>{{r.responsableNombre || r.registradoPor}}</strong></div>
              <div><small>Registrado por</small><strong>{{r.registradoPor}}</strong></div>
              <div><small>Vía</small><strong>{{r.viaNumero || 'Plaza general'}}</strong></div>
              <div><small>Situación de la plaza</small><strong>{{r.situacion || 'Sin información'}}</strong></div>
              <div><small>Ingreso</small><strong>{{r.ingreso || 'Sin información'}}</strong></div>
              <div><small>Incidente</small><strong>{{r.incidente || 'Sin incidente indicado'}}</strong></div>
            </div>
            <p *ngIf="r.descripcion" class="observaciones"><b>Observaciones:</b> {{r.descripcion}}</p>
            <div class="evidencias">
              <h4>Fotografías de evidencia</h4>
              <div class="evidencias-grid" *ngIf="fotosModal.length; else sinFotos">
                <a *ngFor="let foto of fotosModal" [href]="foto.urlArchivo"
                  target="_blank" rel="noopener noreferrer" class="foto">
                  <img [src]="foto.urlArchivo" [alt]="'Evidencia '+foto.categoria+' del reporte '+r.id" loading="lazy">
                  <span>{{etiquetaFoto(foto.categoria)}}</span>
                </a>
              </div>
              <ng-template #sinFotos><p class="nota">Este registro no tiene imágenes adjuntas.</p></ng-template>
            </div>
          </article>
        </div>
        <footer class="modal-pie">
          <button type="button" (click)="cerrarModal()">Cerrar</button>
        </footer>
      </section>
    </div>
  `,
  styles: [`
    :host{display:block;color:#19283d}
    .dash{background:#f3f6fb;padding:20px;border-radius:20px}
    .dash-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:18px;margin-bottom:20px}
    .eyebrow{color:#2563eb;font-size:10px;font-weight:800;letter-spacing:.13em;margin:0 0 6px}
    .dash-toolbar h2{font-size:21px;font-weight:850;letter-spacing:-.025em;margin:0 0 5px}
    .dash-toolbar p:last-child{color:#7787a0;font-size:12px;margin:0}
    .filtros{display:flex;align-items:end;flex-wrap:wrap;gap:12px}
    .filtros label,.periodo-wrap,.navegacion{display:flex;flex-direction:column;gap:6px;min-width:125px;font-size:11px;color:#64748b;font-weight:800}
    .field-caption{display:block}
    .filtros select{height:42px;padding:0 12px;border:1px solid #d8e2ef;border-radius:10px;background:#fff;color:#19283d;font:inherit;font-size:12px}
    .filtros select:disabled{opacity:.7}
    .periodo-botones,.periodo-nav{display:flex;align-items:center;border:1px solid #d8e2ef;background:#fff;border-radius:10px;overflow:hidden;height:42px}
    .periodo-botones button,.periodo-nav button{height:100%;border:0;background:transparent;color:#50617b;font-size:12px;font-weight:800;cursor:pointer;padding:0 12px}
    .periodo-botones button.actual{background:#2563eb;color:white}
    .periodo-botones button:hover:not(.actual),.periodo-nav button:hover{background:#eff6ff}
    .periodo-nav strong{font-size:12px;color:#19283d;min-width:106px;text-align:center;padding:0 2px}
    .periodo-nav button{font-size:25px;line-height:1}
    .recargar{height:42px;width:42px;padding:0;display:grid;place-items:center;border:1px solid #d8e2ef;border-radius:10px;background:white;color:#2563eb;cursor:pointer}
    .recargar svg{width:18px;height:18px}.recargar:disabled{opacity:.4}
    .indicadores{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:20px}
    .indicador{display:flex;flex-direction:column;gap:9px;position:relative;min-height:137px;padding:22px 20px;background:#fff;border:1px solid #e0e7f1;border-radius:16px}
    .indicador-etiqueta{font-size:12px;font-weight:800;color:#7183a0;padding-right:44px}
    .indicador>strong{font-size:32px;letter-spacing:-.04em;color:#19283d;line-height:1.25}
    .indicador>strong span{font-size:18px}
    .indicador small{color:#8191a9;font-size:11px}
    .indicador-icono{display:grid;place-items:center;position:absolute;right:18px;top:16px;width:38px;height:38px;border-radius:12px;font-size:22px}
    .indicador-icono.verde{background:#e5f7f2;color:#0d9488}.indicador-icono.azul{background:#edf2ff;color:#2563eb}.indicador-icono.naranja{background:#fff2e5;color:#d97706}
    .principal{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(310px,.8fr);gap:16px}
    .panel{min-width:0;padding:20px;background:#fff;border:1px solid #e0e7f1;border-radius:16px}
    .panel-head{display:flex;justify-content:space-between;align-items:start;gap:12px}
    .panel-head h3{font-size:16px;font-weight:800;margin:0}
    .panel-head p{font-size:12px;color:#7487a0;margin:6px 0 0;line-height:1.5}
    .pildora{border-radius:99px;background:#edf4ff;color:#3567a8;font-size:10px;white-space:nowrap;padding:6px 10px;font-weight:800}
    .cola-dia{position:relative;margin:22px 0 13px;padding:18px;background:#effaf7;border:1px solid #ceeee5;border-radius:13px;display:flex;flex-direction:column;gap:7px}
    .cola-dia>span:first-child{font-size:11px;color:#648c83}
    .cola-dia strong{font-size:28px;color:#0b8978}.cola-dia strong small{font-size:14px}
    .flecha{position:absolute;right:20px;top:22px;font-size:25px;color:#14b8a6}
    .nota{color:#8191a7;font-size:12px;line-height:1.6;margin:12px 0}
    .registro-datos{display:grid;grid-template-columns:1fr;gap:11px;margin-top:16px}
    .registro-datos>div{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #eef2f8;padding-bottom:8px}
    .registro-datos small{font-size:11px;color:#8191a7;flex:0 0 43%}
    .registro-datos strong{font-size:12px;text-align:right;font-weight:700;color:#19283d;overflow-wrap:anywhere}
    .abrir-modal{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:20px;width:100%;border:0;border-radius:11px;background:#2563eb;color:#fff;padding:13px;font-weight:800;font-size:12px;cursor:pointer}
    .abrir-modal svg{width:17px;height:17px}.abrir-modal:disabled{opacity:.45;cursor:default}
    .grafica-head{flex-wrap:wrap}
    .leyendas{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:#71839d;font-size:11px}
    .leyendas span{display:inline-flex;align-items:center;gap:5px}
    .leyendas i{display:block;width:9px;height:9px;border-radius:50%}
    .grafica-contenido{position:relative;margin:10px 0}
    .svg-grafica{width:100%;height:auto;display:block;max-height:380px}
    .eje-texto{fill:#8191ad;font-size:12px;font-family:Arial,sans-serif}
    .svg-grafica circle[role=button]{cursor:pointer}
    .tooltip{pointer-events:none;position:absolute;transform:translate(-15%,-105%);min-width:210px;max-width:260px;padding:11px 13px;display:flex;flex-direction:column;gap:4px;z-index:3;background:#fff;border:1px solid #d9e3ef;box-shadow:0 9px 26px #0f172a22;border-radius:11px;font-size:11px;color:#475569}
    .tooltip-invertido{transform:translate(-90%,-105%)}
    .tooltip b{font-size:19px;color:#0b2342}.tooltip small{font-size:10px;color:#7a8ca5}
    .pie-grafica{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#8594aa;font-size:10px;line-height:1.5}
    .sin-datos{min-height:255px;display:flex;align-items:center;justify-content:center;color:#8191a7;font-size:13px}
    .error{padding:12px 15px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;color:#991b1b;font-size:13px;margin:12px 0}
    .modal-fondo{position:fixed;z-index:1200;inset:0;background:#0f172acc;display:flex;align-items:center;justify-content:center;padding:20px}
    .modal{width:min(960px,100%);max-height:92vh;overflow:hidden;display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 22px 70px #0004}
    .modal-cabecera,.modal-pie{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:20px 24px;background:white}
    .modal-cabecera{border-bottom:1px solid #e2e8f0}.modal-cabecera h2{font-size:20px;margin:3px 0}.modal-cabecera p:last-child{color:#64748b;font-size:12px;margin:3px 0}
    .cerrar{border:0;border-radius:10px;background:#eff4fa;color:#475569;width:36px;height:36px;font-size:24px;cursor:pointer}
    .modal-cuerpo{overflow:auto;padding:22px 24px;flex:1;background:#f8fafc}
    .modal-pie{border-top:1px solid #e2e8f0;justify-content:flex-end}.modal-pie button{border:0;background:#2563eb;border-radius:10px;color:#fff;font-weight:800;padding:10px 24px;cursor:pointer}
    .aviso{font-size:13px;color:#64748b}
    .reporte{padding:18px;margin-bottom:14px;background:#fff;border:1px solid #dfe7f1;border-radius:14px}
    .reporte-titulo{display:flex;align-items:start;justify-content:space-between;gap:10px}
    .reporte-titulo strong{font-size:15px}.reporte-titulo p{font-size:12px;color:#64748b;margin:4px 0}
    .medida-reporte{background:#e6f7f2;color:#0f8274;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:800}
    .datos-reporte{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px}
    .datos-reporte div{display:flex;flex-direction:column;gap:5px;min-width:0}
    .datos-reporte small{font-size:11px;color:#64748b}.datos-reporte strong{font-size:12px;color:#17243b;overflow-wrap:anywhere}
    .observaciones{font-size:12px;color:#334155;line-height:1.5;border-top:1px solid #edf1f6;padding-top:13px;margin:16px 0}
    .evidencias{margin-top:18px;border-top:1px solid #edf1f6;padding-top:15px}.evidencias h4{font-size:13px;margin:0 0 12px}
    .evidencias-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
    .foto{display:flex;flex-direction:column;gap:7px;color:#1d4ed8;font-size:11px;text-decoration:none;font-weight:750}
    .foto img{width:100%;height:125px;border-radius:9px;object-fit:cover;border:1px solid #dfe7f1}
    @media(max-width:1040px){.principal{grid-template-columns:1fr}.grafica{order:0}.detalle{order:1}.filtros{justify-content:start}}
    @media(max-width:680px){.dash{padding:12px}.filtros{width:100%;display:grid;grid-template-columns:1fr 1fr}.filtros label{grid-column:1 / -1}.periodo-wrap,.navegacion{min-width:0}.periodo-wrap{grid-column:1 / -1}.recargar{display:none}.indicadores{grid-template-columns:1fr;gap:10px}.indicador{min-height:110px;padding:15px}.panel{padding:15px}.tooltip{max-width:190px;min-width:175px}.modal-fondo{padding:8px}.modal-cabecera,.modal-cuerpo,.modal-pie{padding:14px}.datos-reporte{grid-template-columns:1fr 1fr}}
  `]
})
export class ControlOperativoDashboardComponent implements OnInit {
  @Input() plazas: Plaza[] = [];
  private readonly api = inject(ControlOperativoApiService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly periodos: {valor: Periodo; texto:string}[] = [
    {valor:'SEMANA',texto:'Semana'},{valor:'MES',texto:'Mes'},{valor:'ANIO',texto:'Año'}
  ];
  readonly turnos = TURNOS;
  periodo: Periodo = 'MES';
  referencia = this.fechaLima();
  plazaId: number | null = null;
  resumen: ControlOperativoDashboard | null = null;
  error = '';
  cargando = false;
  puntoSeleccionado: Punto | null = null;
  reporteSeleccionado: ControlOperativoReporte | null = null;
  seleccionandoRegistro = false;
  errorRegistro = '';
  series: Serie[] = [];
  etiquetasEje: {x:number;texto:string}[] = [];
  ejes: Eje[] = [];
  tooltip: Punto | null = null;

  modalAbierto = false;
  detalleCargando = false;
  detalleError = '';
  reporteModal: ControlOperativoReporte | null = null;
  fotosModal: ControlOperativoEvidencia[] = [];
  private solicitud = 0;
  private solicitudDetalle = 0;
  private solicitudRegistro = 0;

  get esSupervisor(): boolean {return this.auth.tieneRol('SUPERVISOR');}
  get hayPuntos():boolean {return this.series.some(s=>s.puntos.length>0);}
  get tituloPeriodo():string {
    const {inicio,fin}=this.rango();
    if(this.periodo==='SEMANA') return this.fechaCorta(inicio)+' – '+this.fechaCorta(fin);
    if(this.periodo==='ANIO') return inicio.slice(0,4);
    const fecha=new Date(inicio+'T12:00:00Z');
    return new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric',timeZone:'UTC'}).format(fecha);
  }
  get descripcionGrafica():string {
    return this.periodo==='ANIO' ? 'Máximo de cada mes por turno. Selecciona un punto para ver el día del pico.' :
      'Máximo diario de cada turno. Pasa el cursor por un punto para ver sus datos.';
  }

  ngOnInit():void {
    if(!this.esSupervisor) this.plazaId=this.auth.usuario()?.plazaId ?? null;
    void this.cargar();
  }
  private fechaLima():string {
    const partes=new Intl.DateTimeFormat('en-US',{
      timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(new Date());
    const v=(tipo:string)=>partes.find(p=>p.type===tipo)?.value??'';
    return v('year')+'-'+v('month')+'-'+v('day');
  }
  private date(iso:string):Date {return new Date(iso+'T12:00:00Z');}
  private iso(d:Date):string{return d.toISOString().slice(0,10);}
  private rango():{inicio:string;fin:string} {
    const d=this.date(this.referencia);
    const y=d.getUTCFullYear(),m=d.getUTCMonth();
    if(this.periodo==='ANIO') return {inicio:y+'-01-01',fin:y+'-12-31'};
    if(this.periodo==='MES') return {inicio:this.iso(new Date(Date.UTC(y,m,1,12))),
      fin:this.iso(new Date(Date.UTC(y,m+1,0,12)))};
    const dia=d.getUTCDay(),lunes=new Date(d);
    lunes.setUTCDate(d.getUTCDate()-((dia+6)%7));
    const domingo=new Date(lunes);domingo.setUTCDate(lunes.getUTCDate()+6);
    return {inicio:this.iso(lunes),fin:this.iso(domingo)};
  }
  private fechaCorta(s:string):string {return s.slice(8,10)+'/'+s.slice(5,7);}
  formatoFecha(s:string):string {return s ? this.fechaCorta(s)+'/'+s.slice(0,4) : '—';}
  colorTurno(t:TurnoOperativo):string{return COLORES[t];}
  cambiarPeriodo(p:Periodo):void {if(this.periodo===p)return;this.periodo=p;void this.cargar();}
  mover(delta:number):void {
    const d=this.date(this.referencia);
    if(this.periodo==='SEMANA')d.setUTCDate(d.getUTCDate()+delta*7);
    if(this.periodo==='MES'){
      const dia=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+delta);
      const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)).getUTCDate();
      d.setUTCDate(Math.min(dia,max));
    }
    if(this.periodo==='ANIO')d.setUTCFullYear(d.getUTCFullYear()+delta);
    this.referencia=this.iso(d);
    void this.cargar();
  }
  async seleccionarPunto(p:Punto):Promise<void> {
    const id=++this.solicitudRegistro;
    this.puntoSeleccionado=p;
    this.reporteSeleccionado=null;
    this.seleccionandoRegistro=true;
    this.errorRegistro='';
    this.tooltip=null;
    this.cdr.markForCheck();
    try {
      const reporte=await firstValueFrom(this.api.obtener(p.reporteId));
      if(id!==this.solicitudRegistro)return;
      this.reporteSeleccionado=reporte;
    }catch(e:unknown) {
      if(id!==this.solicitudRegistro)return;
      const err=e as {error?:{message?:string;detail?:string};message?:string};
      this.errorRegistro=err?.error?.message||err?.error?.detail||err?.message||
        'No se pudo cargar el registro seleccionado.';
    }finally {
      if(id===this.solicitudRegistro){
        this.seleccionandoRegistro=false;
        this.cdr.markForCheck();
      }
    }
  }
  mostrarTooltip(p:Punto):void {this.tooltip=p;this.cdr.markForCheck();}
  async cargar():Promise<void> {
    const id=++this.solicitud;
    const rango=this.rango();
    this.cargando=true;this.error='';this.tooltip=null;
    // Cancelar la solicitud individual anterior si cambian filtros o período.
    ++this.solicitudRegistro;
    this.puntoSeleccionado=null;
    this.reporteSeleccionado=null;
    this.seleccionandoRegistro=false;
    this.errorRegistro='';
    this.cdr.markForCheck();
    try {
      const r=await firstValueFrom(this.api.dashboard({
        inicio:rango.inicio,fin:rango.fin,
        plazaId:this.esSupervisor?this.plazaId:this.auth.usuario()?.plazaId
      }));
      if(id!==this.solicitud)return;
      this.resumen=r;
      this.construir();
      const puntos=this.series.flatMap(s=>s.puntos)
        .sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.turno.localeCompare(b.turno));
      // Escoger un único registro real; nunca sumar datos de otros puntos.
      const actual=puntos[puntos.length-1]??null;
      if(actual) void this.seleccionarPunto(actual);
    }catch(e:unknown){
      if(id!==this.solicitud)return;
      const err=e as {error?:{message?:string;detail?:string};message?:string};
      this.error=err?.error?.message||err?.error?.detail||err?.message||'No se pudo cargar el dashboard.';
      this.resumen=null;this.series=[];this.etiquetasEje=[];this.ejes=[];
      this.puntoSeleccionado=null;this.reporteSeleccionado=null;
    }finally {
      if(id===this.solicitud){this.cargando=false;this.cdr.markForCheck();}
    }
  }

  private construir():void {
    const r=this.resumen;
    if(!r){this.series=[];return;}
    const {inicio,fin}=this.rango();
    const etiquetas:string[]=[];
    const d=this.date(inicio),ultimo=this.date(fin);
    if(this.periodo==='ANIO'){
      for(let m=1;m<=12;m++)etiquetas.push(inicio.slice(0,4)+'-'+String(m).padStart(2,'0'));
    }else{
      while(d<=ultimo){etiquetas.push(this.iso(d));d.setUTCDate(d.getUTCDate()+1);}
    }
    const index=new Map(etiquetas.map((s,i)=>[s,i]));
    const clave=(fecha:string)=>this.periodo==='ANIO'?fecha.slice(0,7):fecha;
    const registros=new Map<string,ControlOperativoTurnoDashboard>();
    const conteos=new Map<string,{registros:number;mediciones:number}>();
    for(const item of r.turnos){
      if(item.colaMaxima===null)continue;
      const k=clave(item.fecha)+'|'+item.turno;
      const previo=registros.get(k);
      const cnt=conteos.get(k)??{registros:0,mediciones:0};
      cnt.registros+=item.registros;cnt.mediciones+=item.mediciones;conteos.set(k,cnt);
      if(!previo || (item.colaMaxima??0)>(previo.colaMaxima??0) ||
          (item.colaMaxima===previo.colaMaxima && item.fecha>previo.fecha))registros.set(k,item);
    }
    const maximo=Math.max(100,...[...registros.values()].map(t=>t.colaMaxima??0));
    const paso=Math.max(25,Math.ceil(maximo/4/25)*25),tope=paso*4;
    this.ejes=Array.from({length:5},(_,i)=>({valor:i*paso,y:260-(i*paso/tope)*210}));
    this.etiquetasEje=etiquetas.map((s,i)=>({
      x:etiquetas.length===1?420:68+i/(etiquetas.length-1)*706,
      texto:this.periodo==='ANIO'
        ? new Intl.DateTimeFormat('es-PE',{month:'short',timeZone:'UTC'}).format(this.date(s+'-01'))
        :this.fechaCorta(s)
    })).filter((_,i)=>i===0||i===etiquetas.length-1||i%Math.max(1,Math.ceil(etiquetas.length/7))===0);

    this.series=TURNOS.map(turno=>{
      const puntos:Punto[]=[];
      for(const [k,item] of registros){
        if(!k.endsWith('|'+turno))continue;
        const pos=index.get(clave(item.fecha));
        if(pos===undefined)continue;
        const count=conteos.get(k);
        puntos.push({
          reporteId:item.reporteId,turno,fecha:item.fecha,clave:clave(item.fecha),
          etiqueta:this.periodo==='ANIO'?clave(item.fecha):this.formatoFecha(item.fecha),
          cola:item.colaMaxima??0,registros:count?.registros??item.registros,
          mediciones:count?.mediciones??item.mediciones,plaza:item.plazaCodigo,
          hora:item.hora,situacion:item.situacion,
          ingreso:item.ingreso,incidente:item.incidente,
          x:etiquetas.length===1?420:68+pos/(etiquetas.length-1)*706,
          y:260-(item.colaMaxima??0)/tope*210
        });
      }
      puntos.sort((a,b)=>a.x-b.x);
      return {turno,color:COLORES[turno],puntos,
        linea:puntos.map((p,i)=>(i?'L ':'M ')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ')};
    });
  }

  async abrirDetalle():Promise<void> {
    const reporteId=this.puntoSeleccionado?.reporteId;
    if(!reporteId)return;
    const id=++this.solicitudDetalle;
    this.modalAbierto=true;this.detalleCargando=true;this.detalleError='';
    this.reporteModal=null;this.fotosModal=[];
    this.cdr.markForCheck();
    try {
      const [reporte,fotos]=await Promise.all([
        firstValueFrom(this.api.obtener(reporteId)),
        firstValueFrom(this.api.evidencias(reporteId))
      ]);
      if(id===this.solicitudDetalle && this.modalAbierto){
        this.reporteModal=reporte;
        this.fotosModal=fotos;
      }
    }catch(e:unknown){
      if(id!==this.solicitudDetalle||!this.modalAbierto)return;
      const err=e as {error?:{message?:string;detail?:string};message?:string};
      this.detalleError=err?.error?.message||err?.error?.detail||err?.message||
        'No se pudieron cargar las evidencias del registro.';
    }finally {
      if(id===this.solicitudDetalle){
        this.detalleCargando=false;
        this.cdr.markForCheck();
      }
    }
  }
  etiquetaFoto(categoria:string):string {
    const etiquetas:Record<string,string>={
      PLAZA:'Situación de la plaza',INGRESO:'Ingreso',INCIDENTE:'Incidente',COLA:'Tamaño de cola'
    };
    return etiquetas[categoria]??categoria;
  }
  cerrarModal():void {
    this.solicitudDetalle++;
    this.modalAbierto=false;this.reporteModal=null;this.fotosModal=[];this.detalleError='';
    this.cdr.markForCheck();
  }
  @HostListener('document:keydown.escape')
  onEscape():void {if(this.modalAbierto)this.cerrarModal();}
}
