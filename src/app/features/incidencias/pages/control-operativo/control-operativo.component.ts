import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AsistenciaApiService } from '../../../asistencia/services/asistencia-api.service';
import { Plaza, Turno } from '../../../asistencia/models/asistencia.models';
import { IncidenciaApiService } from '../../services/incidencia-api.service';
import { ViaIncidencia } from '../../models/incidencia.models';
import {
  ControlOperativoApiService, ControlOperativoEvidencia, ControlOperativoVia, ControlOperativoInput,
  ControlOperativoReporte, ControlOperativoResponsable, TipoControlOperativo
} from '../../services/control-operativo-api.service';

type CategoriaEvidencia = 'PLAZA' | 'INGRESO' | 'INCIDENTE' | 'COLA';
interface FotoControlOperativo {
  file: File;
  url: string;
  categoria: CategoriaEvidencia;
}

@Component({
  selector: 'app-control-operativo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="co">
      <header class="co-header">
        <span class="co-heading-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3.5 3.5 20h17L12 3.5Z"></path><path d="M12 9v5m0 3h.01"></path>
          </svg>
        </span>
        <div>
          <p class="co-eyebrow">SIGO · INCIDENCIAS</p>
          <h1>Control operativo de plazas</h1>
          <p>Registra la condición de la plaza, presencia de motorizados, incidentes y tamaño de cola con evidencias fotográficas.</p>
        </div>
      </header>

      <nav class="co-tabs" aria-label="Secciones del control operativo">
        <button type="button" [class.selected]="vista==='nuevo'" (click)="cambiarVista('nuevo')">Nuevo reporte</button>
        <button type="button" [class.selected]="vista==='historial'" (click)="cambiarVista('historial')">Historial</button>
        <button type="button" [class.selected]="vista==='dashboard'" (click)="cambiarVista('dashboard')">Dashboard</button>
        <button *ngIf="esSupervisor" type="button" [class.selected]="vista==='vias'" (click)="cambiarVista('vias')">Vías por plaza</button>
      </nav>
      <p class="co-error" role="alert" *ngIf="error">{{error}}</p>
      <p class="co-success" role="status" *ngIf="mensaje">{{mensaje}}</p>

      <form *ngIf="vista==='nuevo'" (ngSubmit)="guardar()" #coForm="ngForm" class="co-form">
        <section class="co-panel co-general">
          <div class="co-panel-head">
            <div>
              <p class="co-section-kicker">DATOS GENERALES</p>
              <h2>{{editandoId ? 'Editar control operativo #' + editandoId : 'Nuevo control operativo'}}</h2>
              <p>La plaza y el responsable se precargan desde la sesión. El turno se sugiere según la hora, pero puedes modificarlo.</p>
            </div>
          </div>
          <div class="co-grid co-general-grid">
            <label>Plaza
              <select name="plaza" [(ngModel)]="form.plazaId" (ngModelChange)="cambioPlaza()" [disabled]="!esSupervisor" required>
                <option [ngValue]="0">Selecciona una plaza</option>
                <option *ngFor="let p of plazas" [ngValue]="p.id">{{p.codigo}}</option>
              </select>
            </label>
            <label>Turno
              <select name="turno" [(ngModel)]="form.turnoId" required>
                <option [ngValue]="0">Selecciona un turno</option>
                <option *ngFor="let turno of turnos" [ngValue]="turno.id">Turno {{turno.codigo.trim()}}</option>
              </select>
            </label>
            <label>Responsable
              <select name="responsable" [(ngModel)]="form.responsableId" required>
                <option [ngValue]="0">Selecciona un responsable</option>
                <option *ngFor="let responsable of responsables" [ngValue]="responsable.id">
                  {{responsable.nombreCompleto}}
                </option>
              </select>
            </label>
            <label>Vía
              <select name="via" [(ngModel)]="form.viaId">
                <option [ngValue]="null">No aplica / Plaza general</option>
                <option *ngFor="let v of vias" [ngValue]="v.id">Vía {{v.numero}}</option>
              </select>
            </label>
            <label>Fecha
              <input type="date" name="fecha" [(ngModel)]="form.fecha" required>
            </label>
            <label>Hora
              <input type="time" name="hora" [(ngModel)]="form.hora" required>
            </label>
          </div>
          <p class="co-helper" *ngIf="cargandoTurnos || cargandoResponsables">
            {{cargandoTurnos ? 'Cargando turnos… ' : ''}}{{cargandoResponsables ? 'Cargando responsables…' : ''}}
          </p>
        </section>

        <section class="co-panel co-details">
          <div class="co-panel-head">
            <div>
              <p class="co-section-kicker">DETALLE DEL CONTROL</p>
              <h2>Situación operativa de la plaza</h2>
              <p>Completa los cuatro apartados. Cada fotografía corresponde al apartado donde la adjuntas.</p>
            </div>
          </div>

          <div class="co-evidence-grid">
            <article class="co-evidence-card" (paste)="pegarImagenCategoria($event,'PLAZA')">
              <div class="co-card-title">
                <span class="co-card-icon" aria-hidden="true">01</span>
                <div><h3>Situación de la plaza</h3><p>Estado de la circulación</p></div>
              </div>
              <label>Condición observada
                <select name="situacion" [(ngModel)]="form.situacion">
                  <option value="">Selecciona una condición</option>
                  <option *ngFor="let s of situaciones" [value]="s">{{s}}</option>
                </select>
              </label>
              <p class="co-photo-caption"><strong>PLAZA:</strong> {{form.situacion || 'Sin información'}}</p>
              <button type="button" class="co-photo-drop" (click)="fotoPlazaInput.click()"
                (dragover)="permitirArrastre($event)" (drop)="soltarImagenCategoria($event,'PLAZA')"
                aria-label="Añadir o reemplazar fotografía de la plaza">
                <ng-container *ngIf="fotoCategoria('PLAZA') as foto; else sinFotoPlaza">
                  <img [src]="foto.url" alt="Evidencia fotográfica de la situación de la plaza">
                  <span class="co-photo-overlay">Cambiar fotografía</span>
                </ng-container>
                <ng-template #sinFotoPlaza>
                  <span class="co-upload-symbol" aria-hidden="true">+</span>
                  <strong>Agregar fotografía</strong>
                  <small>Haz clic, arrastra o pega una imagen</small>
                </ng-template>
              </button>
              <input #fotoPlazaInput hidden type="file" accept="image/jpeg,image/png,image/webp"
                (change)="seleccionarImagenCategoria($event,'PLAZA')">
              <button *ngIf="fotoCategoria('PLAZA')" type="button" class="co-remove" (click)="quitarFotoCategoria('PLAZA')">Quitar fotografía</button>
            </article>

            <article class="co-evidence-card" (paste)="pegarImagenCategoria($event,'INGRESO')">
              <div class="co-card-title">
                <span class="co-card-icon" aria-hidden="true">02</span>
                <div><h3>Ingreso</h3><p>Presencia de motorizado</p></div>
              </div>
              <label>Motorizado
                <select name="ingreso" [(ngModel)]="form.ingreso">
                  <option value="">Selecciona una opción</option>
                  <option *ngFor="let i of ingresos" [value]="i">{{i}}</option>
                </select>
              </label>
              <p class="co-photo-caption"><strong>INGRESO:</strong> {{form.ingreso || 'Sin información'}}</p>
              <button type="button" class="co-photo-drop" (click)="fotoIngresoInput.click()"
                (dragover)="permitirArrastre($event)" (drop)="soltarImagenCategoria($event,'INGRESO')"
                aria-label="Añadir o reemplazar fotografía del ingreso">
                <ng-container *ngIf="fotoCategoria('INGRESO') as foto; else sinFotoIngreso">
                  <img [src]="foto.url" alt="Evidencia fotográfica del ingreso">
                  <span class="co-photo-overlay">Cambiar fotografía</span>
                </ng-container>
                <ng-template #sinFotoIngreso>
                  <span class="co-upload-symbol" aria-hidden="true">+</span>
                  <strong>Agregar fotografía</strong>
                  <small>Haz clic, arrastra o pega una imagen</small>
                </ng-template>
              </button>
              <input #fotoIngresoInput hidden type="file" accept="image/jpeg,image/png,image/webp"
                (change)="seleccionarImagenCategoria($event,'INGRESO')">
              <button *ngIf="fotoCategoria('INGRESO')" type="button" class="co-remove" (click)="quitarFotoCategoria('INGRESO')">Quitar fotografía</button>
            </article>

            <article class="co-evidence-card" (paste)="pegarImagenCategoria($event,'INCIDENTE')">
              <div class="co-card-title">
                <span class="co-card-icon" aria-hidden="true">03</span>
                <div><h3>Incidente</h3><p>Novedades operativas</p></div>
              </div>
              <label>Incidente registrado
                <select name="incidente" [(ngModel)]="form.incidente">
                  <option value="">Selecciona un incidente</option>
                  <option *ngFor="let i of incidentes" [value]="i">{{i}}</option>
                </select>
              </label>
              <p class="co-photo-caption"><strong>INCIDENTE:</strong> {{form.incidente || 'Sin incidente especificado'}}</p>
              <button type="button" class="co-photo-drop" (click)="fotoIncidenteInput.click()"
                (dragover)="permitirArrastre($event)" (drop)="soltarImagenCategoria($event,'INCIDENTE')"
                aria-label="Añadir o reemplazar fotografía del incidente">
                <ng-container *ngIf="fotoCategoria('INCIDENTE') as foto; else sinFotoIncidente">
                  <img [src]="foto.url" alt="Evidencia fotográfica del incidente">
                  <span class="co-photo-overlay">Cambiar fotografía</span>
                </ng-container>
                <ng-template #sinFotoIncidente>
                  <span class="co-upload-symbol" aria-hidden="true">+</span>
                  <strong>Agregar fotografía</strong>
                  <small>Haz clic, arrastra o pega una imagen</small>
                </ng-template>
              </button>
              <input #fotoIncidenteInput hidden type="file" accept="image/jpeg,image/png,image/webp"
                (change)="seleccionarImagenCategoria($event,'INCIDENTE')">
              <button *ngIf="fotoCategoria('INCIDENTE')" type="button" class="co-remove" (click)="quitarFotoCategoria('INCIDENTE')">Quitar fotografía</button>
            </article>

            <article class="co-evidence-card" (paste)="pegarImagenCategoria($event,'COLA')">
              <div class="co-card-title">
                <span class="co-card-icon" aria-hidden="true">04</span>
                <div><h3>Tamaño de cola</h3><p>Longitud estimada en metros</p></div>
              </div>
              <label>Metros de cola {{form.tipo==='MEDICION'?'(obligatorio)':''}}
                <div class="co-meter-input">
                  <input type="number" name="cola" [(ngModel)]="form.colaMetros" min="0" max="50000"
                    [required]="form.tipo==='MEDICION'" placeholder="Ej. 400">
                  <span>metros</span>
                </div>
              </label>
              <p class="co-photo-caption"><strong>TAMAÑO DE COLA:</strong> {{form.colaMetros === null ? 'Sin medición' : form.colaMetros + ' metros'}}</p>
              <button type="button" class="co-photo-drop" (click)="fotoColaInput.click()"
                (dragover)="permitirArrastre($event)" (drop)="soltarImagenCategoria($event,'COLA')"
                aria-label="Añadir o reemplazar fotografía de la cola">
                <ng-container *ngIf="fotoCategoria('COLA') as foto; else sinFotoCola">
                  <img [src]="foto.url" alt="Evidencia fotográfica del tamaño de cola">
                  <span class="co-photo-overlay">Cambiar fotografía</span>
                </ng-container>
                <ng-template #sinFotoCola>
                  <span class="co-upload-symbol" aria-hidden="true">+</span>
                  <strong>Agregar fotografía</strong>
                  <small>Haz clic, arrastra o pega una imagen</small>
                </ng-template>
              </button>
              <input #fotoColaInput hidden type="file" accept="image/jpeg,image/png,image/webp"
                (change)="seleccionarImagenCategoria($event,'COLA')">
              <button *ngIf="fotoCategoria('COLA')" type="button" class="co-remove" (click)="quitarFotoCategoria('COLA')">Quitar fotografía</button>
            </article>
          </div>
          <p class="co-helper">Puedes subir una imagen por apartado (JPG, PNG o WEBP; máximo 10 MB). Las fotografías son opcionales.</p>
        </section>

        <section class="co-panel co-bottom">
          <div class="co-panel-head">
            <div><h2>Observaciones y seguimiento</h2><p>Agrega información adicional cuando sea necesario.</p></div>
          </div>
          <div class="co-bottom-fields">
            <label>Descripción / observaciones
              <textarea name="descripcion" [(ngModel)]="form.descripcion" maxlength="10000" rows="4"
                placeholder="Detalle adicional de la situación registrada"></textarea>
            </label>
            <label>Estado
              <select name="estado" [(ngModel)]="form.estado">
                <option value="REGISTRADO">Registrado</option>
                <option value="EN_OBSERVACION">En observación</option>
                <option value="ATENDIDO">Atendido</option>
              </select>
            </label>
          </div>
          <div class="co-actions">
            <button type="button" class="co-secondary" (click)="limpiar()">Limpiar</button>
            <button type="submit" [disabled]="guardando || !coForm.form.valid || !form.plazaId || !form.turnoId">
              {{guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Registrar control operativo'}}
            </button>
          </div>
        </section>
      </form>

      <section class="co-panel" *ngIf="vista==='historial'">
        <div class="co-panel-head">
          <div><h2>Historial de control operativo</h2><p>Registros de los últimos 30 días o el rango seleccionado.</p></div>
          <button type="button" class="co-secondary" (click)="cargarHistorial()">Actualizar</button>
        </div>
        <div class="co-filters">
          <label>Desde <input type="date" [(ngModel)]="filtros.inicio"></label>
          <label>Hasta <input type="date" [(ngModel)]="filtros.fin"></label>
           <label *ngIf="esSupervisor">Plaza
            <select [(ngModel)]="filtros.plazaId">
              <option [ngValue]="null">Todas</option>
              <option *ngFor="let p of plazas" [ngValue]="p.id">{{p.codigo}}</option>
            </select>
          </label>
          <button type="button" (click)="cargarHistorial()">Filtrar</button>
        </div>
        <p *ngIf="cargando">Cargando reportes…</p>
        <p *ngIf="!cargando && !reportes.length">No se encontraron reportes en el período.</p>
        <div class="co-table-wrap" *ngIf="reportes.length">
          <table>
            <thead><tr><th>Fecha / hora</th><th>Plaza / vía</th><th>Responsable</th><th>Situación</th><th>Cola</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              <tr *ngFor="let r of reportes">
                <td>{{r.fecha}} {{r.hora}}</td>
                <td>{{r.plazaCodigo}} <span *ngIf="r.viaNumero">/ {{r.viaNumero}}</span></td>
                <td>{{r.responsableNombre || r.registradoPor}}</td>
                <td>{{r.situacion||'—'}}</td><td>{{r.colaMetros==null?'—':r.colaMetros+' m'}}</td>
                <td>{{r.estado.replace('_',' ')}}</td>
                <td><button type="button" class="co-link" (click)="editar(r)">Editar</button>
                  <button type="button" class="co-link" (click)="verEvidencias(r)">Fotos</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="co-evidence" *ngIf="reporteEvidencias">
          <h3>Evidencias del reporte #{{reporteEvidencias.id}}</h3>
          <p *ngIf="!evidencias.length">No hay fotografías asociadas.</p>
          <div class="co-photos">
            <a *ngFor="let e of evidencias" [href]="e.urlArchivo" target="_blank" rel="noopener noreferrer">
              <img [src]="e.urlArchivo" alt="Evidencia de control operativo">
              <small>{{e.categoria}}</small>
            </a>
          </div>
        </div>
      </section>

      <section class="co-panel" *ngIf="vista==='vias' && esSupervisor">
        <div class="co-panel-head">
          <div><h2>Vías por plaza</h2><p>Utiliza el catálogo de SIGO que también consultan otros módulos. Desactivar una vía la ocultará en sus nuevos registros.</p></div>
        </div>
        <div class="co-filters">
          <label>Plaza
            <select [(ngModel)]="plazaGestion" (ngModelChange)="cargarViasGestion()">
              <option *ngFor="let p of plazas" [ngValue]="p.id">{{p.codigo}}</option>
            </select>
          </label>
          <label>Desde <input type="number" min="1" max="999999" [(ngModel)]="desdeVia"></label>
          <label>Hasta <input type="number" min="1" max="999999" [(ngModel)]="hastaVia"></label>
          <button type="button" (click)="asignarVias()" [disabled]="guardando">Asignar / reactivar vías</button>
        </div>
        <div *ngIf="viasGestion.length" class="co-vias">
          <article *ngFor="let v of viasGestion">
            <span><strong>Vía {{v.numero}}</strong> — {{v.activa?'Activa':'Inactiva'}}</span>
            <button type="button" *ngIf="v.activa" class="co-secondary" [disabled]="guardando"
              (click)="desactivarVia(v.numero)">Desactivar</button>
          </article>
        </div>
        <p *ngIf="!viasGestion.length">No hay vías configuradas para esta plaza.</p>
      </section>

      <section class="co-panel" *ngIf="vista==='dashboard'">
        <div class="co-panel-head"><div><h2>Dashboard operativo</h2><p>Indicadores del conjunto de reportes filtrados en el historial.</p></div>
          <button type="button" class="co-secondary" (click)="cargarHistorial()">Actualizar datos</button></div>
        <div class="co-kpis">
          <article><small>Registros</small><strong>{{reportes.length}}</strong></article>
          <article><small>Reportes operativos</small><strong>{{reportes.length}}</strong></article>
          <article><small>Registros con cola</small><strong>{{totalConCola}}</strong></article>
          <article><small>Máxima cola</small><strong>{{maxCola}} m</strong></article>
          <article><small>Promedio de cola</small><strong>{{promedioCola | number:'1.0-1'}} m</strong></article>
        </div>
        <h3>Registros por plaza</h3>
        <div *ngFor="let item of resumenPlazas" class="co-bar">
          <span>{{item.plaza}} ({{item.total}})</span>
          <div><span [style.width.%]="item.porcentaje"></span></div>
        </div>
        <p *ngIf="!reportes.length">Aún no hay datos para graficar.</p>
      </section>
    </main>
  `,
  styles: [`
    :host { display:block; --co-navy:#0b2342; --co-blue:#2563eb; --co-muted:#64748b; --co-line:#dfe5ee; --co-panel:#fff; }
    .co{max-width:1200px;margin:0 auto;padding:20px 16px 64px;color:#0f172a}
    .co-header{background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:26px 28px;margin-bottom:18px;display:flex;align-items:flex-start;gap:16px;box-shadow:0 4px 16px rgba(11,35,66,.04)}
    .co-heading-icon{width:48px;height:48px;flex:0 0 48px;display:grid;place-items:center;border-radius:15px;background:#eff6ff;color:var(--co-blue)}
    .co-heading-icon svg{width:26px;height:26px}
    .co-eyebrow,.co-section-kicker{margin:0;color:var(--co-blue);font-weight:800;text-transform:uppercase;letter-spacing:.13em;font-size:11px}
    .co h1{font-size:clamp(22px,2.5vw,30px);font-weight:750;letter-spacing:-.025em;color:var(--co-navy);margin:5px 0 6px}
    .co h2{font-size:19px;letter-spacing:-.015em;color:var(--co-navy);margin:4px 0 5px}
    .co h3{font-size:15px;line-height:1.3;color:var(--co-navy);margin:0}
    .co-header p:not(.co-eyebrow),.co-panel-head p:not(.co-section-kicker){color:var(--co-muted);font-size:13px;line-height:1.6;margin:0}
    .co-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
    .co button{cursor:pointer;border:0;border-radius:11px;padding:11px 17px;background:var(--co-blue);color:#fff;font-weight:700;font:inherit;font-size:13px}
    .co button:disabled{opacity:.5;cursor:not-allowed}
    .co button:focus-visible,.co input:focus-visible,.co select:focus-visible,.co textarea:focus-visible{outline:2px solid var(--co-blue);outline-offset:2px}
    .co-tabs button{background:#eaf0f8;color:#38516e}
    .co-tabs button.selected{background:var(--co-navy);color:#fff;box-shadow:0 3px 12px rgba(11,35,66,.14)}
    .co-panel{background:var(--co-panel);border:1px solid #e2e8f0;box-shadow:0 4px 14px rgba(15,23,42,.035);border-radius:20px;padding:24px;margin-top:16px}
    .co-panel-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:19px;flex-wrap:wrap}
    .co-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .co-general-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
    .co label{display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:700;color:#334155;min-width:0}
    .co input,.co select,.co textarea{box-sizing:border-box;min-width:0;width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;background:white;color:#0f172a;font:inherit;font-size:13px;font-weight:400}
    .co textarea{resize:vertical}
    .co select:disabled{background:#f1f5f9;color:#64748b}
    .co-evidence-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .co-evidence-card{border:1px solid #dbe4f0;border-radius:16px;background:#fff;overflow:hidden;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 2px 8px rgba(15,23,42,.025)}
    .co-card-title{display:flex;align-items:center;gap:11px}
    .co-card-title p{margin:3px 0 0;color:var(--co-muted);font-size:12px}
    .co-card-icon{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:10px;background:#eff6ff;color:var(--co-blue);font-size:12px;font-weight:800}
    .co-photo-caption{font-size:12px;color:#334155;font-weight:600;margin:3px 0 -2px;min-height:18px;overflow-wrap:anywhere}
    .co-photo-caption strong{color:#1d4ed8;font-weight:800}
    .co-photo-drop{position:relative;display:flex!important;flex-direction:column;justify-content:center;align-items:center;width:100%;aspect-ratio:16 / 9;min-height:165px;overflow:hidden;border:2px dashed #bbcee8!important;border-radius:12px!important;background:linear-gradient(135deg,#f8fbff,#eff6ff)!important;color:#2563eb!important;gap:7px;isolation:isolate}
    .co-photo-drop:hover{background:#eaf3ff!important;border-color:#2563eb!important}
    .co-photo-drop img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
    .co-upload-symbol{font-size:26px;line-height:1;width:40px;height:40px;background:#dbeafe;color:#1d4ed8;border-radius:50%;display:grid;place-items:center}
    .co-photo-drop strong{font-size:14px;color:var(--co-navy)}
    .co-photo-drop small{font-size:12px;color:#64748b;text-align:center}
    .co-photo-overlay{position:absolute;bottom:0;left:0;right:0;padding:10px;text-align:center;background:rgba(11,35,66,.83);color:#fff;font-weight:700;z-index:1}
    .co-remove{align-self:flex-end;background:transparent!important;color:#b91c1c!important;padding:4px 7px!important}
    .co-meter-input{display:flex;align-items:stretch;border-radius:10px;overflow:hidden}
    .co-meter-input input{border-radius:10px 0 0 10px;flex:1;min-width:0}
    .co-meter-input span{padding:11px 13px;background:#eff6ff;color:#1d4ed8;border:1px solid #cbd5e1;border-left:0;font-weight:700;border-radius:0 10px 10px 0;white-space:nowrap}
    .co-helper{font-size:12px;color:#64748b;margin:12px 0 0}
    .co-bottom-fields{display:grid;grid-template-columns:2fr 1fr;align-items:start;gap:16px}
    .co-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
    .co-secondary{background:#eaf0f8!important;color:#334155!important}
    .co-error,.co-success{padding:12px 16px;border-radius:10px;margin:12px 0;font-size:13px;font-weight:650}
    .co-error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
    .co-success{background:#ecfdf5;color:#166534;border:1px solid #a7f3d0}
    .co-filters{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin:14px 0}
    .co-filters label{min-width:155px}
    .co-table-wrap{overflow-x:auto}
    .co table{border-collapse:collapse;width:100%;font-size:13px;min-width:740px}
    .co th,.co td{text-align:left;border-bottom:1px solid #e2e8f0;padding:13px 8px}
    .co th{color:#475569;background:#f8fafc}
    .co-link{background:transparent!important;color:#1d4ed8!important;padding:4px 7px!important}
    .co-photos{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px}
    .co-photos>a{display:flex;flex-direction:column;align-items:start;gap:5px}
    .co-photos img{width:150px;height:105px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0}
    .co-evidence{border-top:1px solid #e2e8f0;margin-top:20px;padding-top:10px}
    .co-vias{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
    .co-vias article{border:1px solid #e2e8f0;border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .co-vias button{padding:7px 10px;font-size:12px}
    .co-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
    .co-kpis article{display:flex;flex-direction:column;gap:8px;padding:18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}
    .co-kpis small{color:#64748b}
    .co-kpis strong{font-size:25px;color:#1d4ed8}
    .co-bar{margin:15px 0}
    .co-bar>span{font-size:13px;font-weight:600}
    .co-bar>div{margin-top:5px;height:10px;border-radius:99px;background:#e2e8f0;overflow:hidden}
    .co-bar>div span{display:block;height:100%;background:var(--co-blue)}
    @media(max-width:850px){.co-general-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:680px){
      .co{padding:12px 10px 50px}
      .co-header{padding:20px 16px;border-radius:18px;gap:12px}
      .co-heading-icon{width:42px;height:42px;flex-basis:42px}
      .co-panel{padding:16px;border-radius:16px}
      .co-general-grid,.co-evidence-grid,.co-bottom-fields{grid-template-columns:minmax(0,1fr)}
      .co-actions{flex-direction:column}
      .co-actions button{width:100%}
      .co-photo-drop{min-height:180px}
    }
  `]
})
export class ControlOperativoComponent implements OnInit, OnDestroy {
  private readonly api = inject(ControlOperativoApiService);
  private readonly catalogos = inject(AsistenciaApiService);
  private readonly incidenciaApi = inject(IncidenciaApiService);
  readonly auth = inject(AuthService);
  vista: 'nuevo' | 'historial' | 'dashboard' | 'vias' = 'nuevo';
  plazas: Plaza[] = [];
  turnos: Turno[] = [];
  responsables: ControlOperativoResponsable[] = [];
  vias: ViaIncidencia[] = [];
  viasGestion: ControlOperativoVia[] = [];
  plazaGestion = 0;
  desdeVia = 101;
  hastaVia = 105;
  reportes: ControlOperativoReporte[] = [];
  evidencias: ControlOperativoEvidencia[] = [];
  reporteEvidencias: ControlOperativoReporte | null = null;
  cargando = false;
  cargandoTurnos = true;
  cargandoResponsables = true;
  private historialCargado = false;
  private historialSolicitud = 0;
  guardando = false;
  error = '';
  mensaje = '';
  editandoId: number | null = null;
  fotos: FotoControlOperativo[] = [];
  filtros: {inicio:string;fin:string;plazaId:number|null} =
    {inicio: this.restarDias(30), fin: this.fechaHoy(), plazaId:null};
  form: ControlOperativoInput = this.nuevoForm();

  readonly situaciones = ['Fluida','Tráfico en contra'];
  readonly ingresos = ['Con motorizado','Sin motorizado'];
  readonly incidentes = ['PNP en el semáforo','Falla en el sistema','Sin incidente'];

  get esSupervisor(): boolean { return this.auth.tieneRol('SUPERVISOR'); }
  get totalConCola(): number { return this.reportes.filter(r=>r.colaMetros!=null).length; }
  get maxCola(): number { return Math.max(0,...this.reportes.map(r=>r.colaMetros??0)); }
  get promedioCola(): number {
    const conCola=this.reportes.filter(r=>r.colaMetros!=null);
    return conCola.length ? conCola.reduce((s,r)=>s+(r.colaMetros??0),0)/conCola.length : 0;
  }
  get resumenPlazas(): {plaza:string;total:number;porcentaje:number}[] {
    const conteos=new Map<string,number>();
    this.reportes.forEach(r=>conteos.set(r.plazaCodigo,(conteos.get(r.plazaCodigo)||0)+1));
    const max=Math.max(1,...conteos.values());
    return [...conteos.entries()].map(([plaza,total])=>({plaza,total,porcentaje:100*total/max}))
      .sort((a,b)=>b.total-a.total);
  }

  async ngOnInit(): Promise<void> {
    this.cargando=true;
    try {
      const [plazas,turnos,responsables]=await Promise.all([
        firstValueFrom(this.catalogos.getPlazas()),
        firstValueFrom(this.catalogos.getTurnos()),
        firstValueFrom(this.api.responsables())
      ]);
      this.plazas=plazas.filter(p=>p.activo);
      this.plazaGestion=this.plazas[0]?.id ?? 0;
      this.turnos=turnos;
      this.responsables=responsables;
      const usuario=this.auth.usuario();
      this.form.plazaId=usuario?.plazaId ?? 0;
      this.form.responsableId=usuario?.trabajadorId ?? usuario?.id ?? 0;
      if(!this.esSupervisor && usuario?.plazaId) {
        this.filtros.plazaId=usuario.plazaId;
      }
      this.sincronizarTurno(this.form.hora);
      await this.cambioPlaza();
      await this.cargarHistorial();
    } catch (e) { this.error=this.errorHttp(e); }
    finally { this.cargando=false; }
  }
  ngOnDestroy(): void { this.fotos.forEach(f=>URL.revokeObjectURL(f.url)); }

  cambiarVista(vista:'nuevo'|'historial'|'dashboard'|'vias'):void {
    this.vista=vista;this.error='';this.mensaje='';
    if (vista==='vias') void this.cargarViasGestion();
    else if (vista!=='nuevo') void this.cargarHistorial();
  }
  private fechaHoy():string {
    const partes = new Intl.DateTimeFormat('en-US',{
      timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(new Date());
    const valor = (tipo:string) => partes.find(p=>p.type===tipo)?.value ?? '';
    return valor('year')+'-'+valor('month')+'-'+valor('day');
  }
  private horaAhora():string {
    const partes = new Intl.DateTimeFormat('en-US',{
      timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(new Date());
    const valor = (tipo:string) => partes.find(p=>p.type===tipo)?.value ?? '00';
    return valor('hour')+':'+valor('minute');
  }
  private restarDias(dias:number):string {
    const [y,m,d] = this.fechaHoy().split('-').map(Number);
    const fecha = new Date(Date.UTC(y,m-1,d));
    fecha.setUTCDate(fecha.getUTCDate()-dias);
    return fecha.toISOString().slice(0,10);
  }
  sincronizarTurno(hora:string):void {
    const match = /^([01]\d|2[0-3]):[0-5]\d$/.exec(hora);
    if (!match) {this.form.turnoId=0;return;}
    const minutos = Number(hora.slice(0,2))*60 + Number(hora.slice(3,5));
    const codigo = minutos>=360 && minutos<840 ? 'A' :
      minutos>=840 && minutos<1320 ? 'B' : 'C';
    this.form.turnoId=this.turnos.find(t=>t.codigo.trim().toUpperCase()===codigo)?.id ?? 0;
  }
  private nuevoForm():ControlOperativoInput {
    return {plazaId:0,turnoId:0,responsableId:0,viaId:null,tipo:'REPORTE',fecha:this.fechaHoy(),hora:this.horaAhora(),
      situacion:'',ingreso:'',incidente:'',colaMetros:null,descripcion:'',estado:'REGISTRADO'};
  }
  async cambioPlaza():Promise<void> {
    this.form.viaId=null;this.vias=[];
    if(!this.form.plazaId)return;
    const plazaId=this.form.plazaId;
    try {
      const vias=await firstValueFrom(this.incidenciaApi.getVias(plazaId));
      if(this.form.plazaId===plazaId)this.vias=vias.filter(v=>v.activa!==false);
    } catch(e) { this.error=this.errorHttp(e); }
  }
  async cargarHistorial():Promise<void> {
    this.cargando=true;this.error='';
    try{
      this.reportes=await firstValueFrom(this.api.listar({
        inicio:this.filtros.inicio,fin:this.filtros.fin,
        plazaId:this.esSupervisor?this.filtros.plazaId:this.auth.usuario()?.plazaId
      }));
    }catch(e){this.error=this.errorHttp(e);}
    finally{this.cargando=false;}
  }
  fotoCategoria(categoria: CategoriaEvidencia): FotoControlOperativo | undefined {
    return this.fotos.find(f => f.categoria === categoria);
  }

  private agregarFoto(file: File, categoria: CategoriaEvidencia): void {
    this.error = '';
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0) {
      this.error = 'Solo se admiten imágenes JPG, PNG o WEBP de hasta 10 MB.';
      return;
    }
    const anterior = this.fotos.findIndex(f => f.categoria === categoria);
    if (anterior >= 0) {
      URL.revokeObjectURL(this.fotos[anterior].url);
      this.fotos.splice(anterior,1);
    }
    this.fotos.push({file, url: URL.createObjectURL(file), categoria});
  }

  seleccionarImagenCategoria(event: Event, categoria: CategoriaEvidencia): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.agregarFoto(file,categoria);
    input.value = '';
  }

  pegarImagenCategoria(event: ClipboardEvent, categoria: CategoriaEvidencia): void {
    const item = Array.from(event.clipboardData?.items ?? []).find(i => i.kind === 'file' && i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) return;
    event.preventDefault();
    this.agregarFoto(file,categoria);
  }

  permitirArrastre(event: DragEvent): void {
    event.preventDefault();
  }

  soltarImagenCategoria(event: DragEvent, categoria: CategoriaEvidencia): void {
    event.preventDefault();
    const file = Array.from(event.dataTransfer?.files ?? []).find(f => f.type.startsWith('image/'));
    if (file) this.agregarFoto(file,categoria);
  }

  quitarFotoCategoria(categoria: CategoriaEvidencia): void {
    const i = this.fotos.findIndex(f => f.categoria === categoria);
    if (i === -1) return;
    URL.revokeObjectURL(this.fotos[i].url);
    this.fotos.splice(i,1);
  }

  limpiar():void {
    this.fotos.forEach(f=>URL.revokeObjectURL(f.url));this.fotos=[];
    const actual=this.auth.usuario();
    this.form=this.nuevoForm();
    this.form.plazaId=actual?.plazaId ?? 0;
    this.form.responsableId=actual?.trabajadorId ?? actual?.id ?? 0;
    this.sincronizarTurno(this.form.hora);
    this.editandoId=null;this.error='';this.mensaje='';
    void this.cambioPlaza();
  }
  async guardar():Promise<void> {
    this.error='';this.mensaje='';
    if(!this.form.plazaId || !this.form.turnoId || !this.form.responsableId || !this.form.fecha || !this.form.hora) {
      this.error='Completa plaza, responsable, fecha y hora; verifica el turno automático.';return;
    }
    if(this.form.tipo==='MEDICION' && this.form.colaMetros==null){
      this.error='Indica el tamaño de cola para la medición.';return;
    }
    this.guardando=true;
    try {
      const payload={...this.form, colaMetros: this.form.colaMetros==null ? null : Number(this.form.colaMetros)};
      const registro=this.editandoId
        ? await firstValueFrom(this.api.actualizar(this.editandoId,payload))
        : await firstValueFrom(this.api.crear(payload));
      const fallidas:string[]=[];
      for(const f of this.fotos){
        try{await firstValueFrom(this.api.subirEvidencia(registro.id,f.file,f.categoria));}
        catch{fallidas.push(f.file.name);}
      }
      this.limpiar();
      this.mensaje=fallidas.length
        ? 'Reporte #'+registro.id+' guardado, pero no se pudieron subir '+fallidas.length+' imagen(es). Puedes volver a adjuntarlas.'
        : 'Reporte operativo #'+registro.id+' guardado correctamente.';
      await this.cargarHistorial();
    } catch(e){this.error=this.errorHttp(e);}
    finally{this.guardando=false;}
  }
  async editar(registro:ControlOperativoReporte):Promise<void> {
    this.vista='nuevo';this.editandoId=registro.id;this.error='';this.mensaje='';
    this.form={plazaId:registro.plazaId,turnoId:registro.turnoId,
      viaId:null,responsableId:registro.responsableId || registro.registradoPorId,
      tipo:registro.tipo as TipoControlOperativo,fecha:registro.fecha,
      hora:registro.hora,situacion:registro.situacion,ingreso:registro.ingreso,
      incidente:registro.incidente,colaMetros:registro.colaMetros,
      descripcion:registro.descripcion,estado:registro.estado};
    this.sincronizarTurno(registro.hora);
    await this.cambioPlaza();this.form.viaId=registro.viaId;
  }
  async verEvidencias(registro:ControlOperativoReporte):Promise<void> {
    this.reporteEvidencias=registro;this.evidencias=[];this.error='';
    try{this.evidencias=await firstValueFrom(this.api.evidencias(registro.id));}
    catch(e){this.error=this.errorHttp(e);}
  }
  async cargarViasGestion():Promise<void> {
    if(!this.esSupervisor || !this.plazaGestion)return;
    this.error='';
    try{this.viasGestion=await firstValueFrom(this.api.vias(this.plazaGestion));}
    catch(e){this.error=this.errorHttp(e);}
  }
  async asignarVias():Promise<void> {
    const desde=Number(this.desdeVia),hasta=Number(this.hastaVia);
    if(!this.esSupervisor || !this.plazaGestion)return;
    if(!Number.isInteger(desde)||!Number.isInteger(hasta)||desde<1||hasta<desde||hasta>999999||hasta-desde>99){
      this.error='Ingresa un rango válido de máximo 100 vías.';return;
    }
    this.guardando=true;this.error='';this.mensaje='';
    try{
      this.viasGestion=await firstValueFrom(this.api.asignarVias(this.plazaGestion,desde,hasta));
      this.mensaje='Vías asignadas o reactivadas correctamente.';
    }catch(e){this.error=this.errorHttp(e);}
    finally{this.guardando=false;}
  }
  async desactivarVia(numero:number):Promise<void> {
    if(!this.esSupervisor || !this.plazaGestion)return;
    this.guardando=true;this.error='';this.mensaje='';
    try{
      await firstValueFrom(this.api.desactivarVia(this.plazaGestion,numero));
      await this.cargarViasGestion();
      this.mensaje='Vía '+numero+' desactivada.';
    }catch(e){this.error=this.errorHttp(e);}
    finally{this.guardando=false;}
  }

  private errorHttp(e:unknown):string {
    const err=e as {error?:{message?:string;detail?:string};message?:string};
    return err?.error?.message || err?.error?.detail || err?.message || 'No se pudo completar la operación.';
  }
}
