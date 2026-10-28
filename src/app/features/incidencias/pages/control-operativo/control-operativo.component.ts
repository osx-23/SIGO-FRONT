import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AsistenciaApiService } from '../../../asistencia/services/asistencia-api.service';
import { Plaza, Turno } from '../../../asistencia/models/asistencia.models';
import { IncidenciaApiService } from '../../services/incidencia-api.service';
import { ViaIncidencia } from '../../models/incidencia.models';
import { ControlOperativoDashboardComponent } from './control-operativo-dashboard.component';
import {
  ControlOperativoApiService, ControlOperativoEvidencia, ControlOperativoInput,
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
  imports: [CommonModule, FormsModule, ControlOperativoDashboardComponent],
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

      <nav class="co-tabs" aria-label="Secciones de control operativo">
        <div class="co-tabs-grid">
          <button type="button" class="co-subtab" [class.is-active]="vista==='nuevo'"
            [attr.aria-pressed]="vista==='nuevo'" (click)="cambiarVista('nuevo')">
            <span class="co-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>
                <path d="M16 4h6M19 1v6M8 12h8M8 16h5"/>
              </svg>
            </span>
            <span class="co-tab-copy">
              <span class="co-tab-title">Nuevo reporte</span>
              <span class="co-tab-description">Registra las condiciones operativas de la plaza</span>
            </span>
          </button>
          <button type="button" class="co-subtab" [class.is-active]="vista==='historial'"
            [attr.aria-pressed]="vista==='historial'" (click)="cambiarVista('historial')">
            <span class="co-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="4" width="14" height="17" rx="2"/>
                <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h4"/>
              </svg>
            </span>
            <span class="co-tab-copy">
              <span class="co-tab-title">Historial</span>
              <span class="co-tab-description">Consulta los reportes operativos registrados</span>
            </span>
          </button>
          <button type="button" class="co-subtab" [class.is-active]="vista==='dashboard'"
            [attr.aria-pressed]="vista==='dashboard'" (click)="cambiarVista('dashboard')">
            <span class="co-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3v18h18M7 16v-4M12 16V8M17 16V5"/>
              </svg>
            </span>
            <span class="co-tab-copy">
              <span class="co-tab-title">Dashboard</span>
              <span class="co-tab-description">Visualiza indicadores y mediciones de cola</span>
            </span>
          </button>
        </div>
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
              <select name="turno" [(ngModel)]="form.turnoId" [disabled]="cargandoTurnos" required>
                <option [ngValue]="0">{{cargandoTurnos ? 'Cargando turnos…' : 'Selecciona un turno'}}</option>
                <option *ngFor="let turno of turnos" [ngValue]="turno.id">Turno {{turno.codigo.trim()}}</option>
              </select>
            </label>
            <label>Responsable
              <select name="responsable" [(ngModel)]="form.responsableId" [disabled]="cargandoResponsables" required>
                <option [ngValue]="0">{{cargandoResponsables ? 'Cargando responsables…' : 'Selecciona un responsable'}}</option>
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
            <div><h2>Observaciones</h2><p>Agrega información adicional cuando sea necesario.</p></div>
          </div>
          <div class="co-bottom-fields">
            <label>Descripción / observaciones
              <textarea name="descripcion" [(ngModel)]="form.descripcion" maxlength="10000" rows="4"
                placeholder="Detalle adicional de la situación registrada"></textarea>
            </label>
          </div>
          <div class="co-actions">
            <button type="button" class="co-secondary" (click)="limpiar()">Limpiar</button>
            <button type="submit" [disabled]="guardando || cargandoTurnos || cargandoResponsables || !coForm.form.valid || !form.plazaId || !form.turnoId || !form.responsableId">
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
            <thead><tr><th>Fecha</th><th>Hora</th><th>Plaza / vía</th><th>Responsable</th><th>Situación</th><th>Cola</th><th>Acciones</th></tr></thead>
            <tbody>
              <tr *ngFor="let r of reportes">
                <td class="co-fecha">{{r.fecha}}</td>
                <td class="co-hora">{{r.hora}}</td>
                <td>{{r.plazaCodigo}} <span *ngIf="r.viaNumero">/ {{r.viaNumero}}</span></td>
                <td>{{r.responsableNombre || r.registradoPor}}</td>
                <td>{{r.situacion||'—'}}</td><td>{{r.colaMetros==null?'—':r.colaMetros+' m'}}</td>
                <td>
                  <div class="co-table-actions">
                    <button type="button" class="co-action-button co-action-edit" (click)="editar(r)"
                      [attr.aria-label]="'Editar reporte '+r.id">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="m16 4 4 4M4 20l4.5-.8L20 7.7a2.1 2.1 0 0 0-3-3L5.5 16.2 4 20Z"/>
                      </svg>
                      Editar
                    </button>
                    <button type="button" class="co-action-button co-action-view" (click)="verRegistro(r)"
                      [attr.aria-label]="'Ver reporte '+r.id+' y evidencias'">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M2.5 12c2.4-4.3 5.5-6.5 9.5-6.5s7.1 2.2 9.5 6.5c-2.4 4.3-5.5 6.5-9.5 6.5S4.9 16.3 2.5 12Z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      Ver
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <app-control-operativo-dashboard *ngIf="vista==='dashboard'" [plazas]="plazas"></app-control-operativo-dashboard>
    </main>

    <div *ngIf="modalAbierto" class="co-modal-overlay" (click)="cerrarModal()">
      <section class="co-modal" role="dialog" aria-modal="true" aria-labelledby="co-modal-titulo"
        (click)="$event.stopPropagation()">
        <header class="co-modal-head">
          <div>
            <p class="co-eyebrow">SIGO · CONTROL OPERATIVO</p>
            <h2 id="co-modal-titulo">Detalle del reporte #{{registroModal?.id || modalRegistroId}}</h2>
            <p>Información registrada y fotografías de evidencia.</p>
          </div>
          <button type="button" class="co-modal-close" (click)="cerrarModal()" aria-label="Cerrar detalle">×</button>
        </header>
        <div class="co-modal-body">
          <p *ngIf="modalCargando" class="co-modal-loading" role="status">Cargando reporte y evidencias…</p>
          <p *ngIf="modalError" class="co-error" role="alert">{{modalError}}</p>
          <ng-container *ngIf="registroModal as r">
            <div class="co-modal-summary">
              <div>
                <span>Fecha y hora</span>
                <strong>{{r.fecha}} · {{r.hora}}</strong>
              </div>
              <div>
                <span>Plaza y vía</span>
                <strong>{{r.plazaCodigo}} · {{r.viaNumero ? 'Vía '+r.viaNumero : 'Plaza general'}}</strong>
              </div>
              <div>
                <span>Turno</span>
                <strong>Turno {{r.turnoCodigo}}</strong>
              </div>
              <div class="co-modal-cola">
                <span>Tamaño de cola</span>
                <strong>{{r.colaMetros === null ? 'No registrado' : r.colaMetros+' metros'}}</strong>
              </div>
            </div>

            <h3 class="co-modal-subtitle">Detalles del control</h3>
            <div class="co-modal-fields">
              <div><span>Responsable</span><strong>{{r.responsableNombre || r.registradoPor || '—'}}</strong></div>
              <div><span>Registrado por</span><strong>{{r.registradoPor || '—'}}</strong></div>
              <div><span>Situación de la plaza</span><strong>{{r.situacion || 'No especificada'}}</strong></div>
              <div><span>Ingreso</span><strong>{{r.ingreso || 'No especificado'}}</strong></div>
              <div><span>Incidente</span><strong>{{r.incidente || 'No especificado'}}</strong></div>
            </div>
            <section class="co-modal-obs">
              <h3>Observaciones</h3>
              <p>{{r.descripcion || 'Sin observaciones adicionales.'}}</p>
            </section>

            <section class="co-modal-evidence">
              <div class="co-modal-evidence-head">
                <h3>Fotografías de evidencia</h3>
                <span>{{evidenciasModal.length}} {{evidenciasModal.length===1 ? 'imagen' : 'imágenes'}}</span>
              </div>
              <div class="co-modal-gallery" *ngIf="evidenciasModal.length; else sinEvidencias">
                <a *ngFor="let foto of evidenciasModal" class="co-modal-photo"
                  [href]="foto.urlArchivo" target="_blank" rel="noopener noreferrer"
                  [attr.aria-label]="'Abrir fotografía de '+nombreCategoria(foto.categoria)">
                  <img [src]="foto.urlArchivo" loading="lazy"
                    [alt]="'Evidencia de '+nombreCategoria(foto.categoria)+' del reporte '+r.id">
                  <span>{{nombreCategoria(foto.categoria)}}</span>
                </a>
              </div>
              <ng-template #sinEvidencias>
                <p class="co-modal-empty">Este reporte no tiene fotografías adjuntas.</p>
              </ng-template>
            </section>
          </ng-container>
        </div>
        <footer class="co-modal-footer">
          <button type="button" (click)="cerrarModal()">Cerrar</button>
        </footer>
      </section>
    </div>
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
    .co-tabs{padding:8px 10px;margin:0 0 18px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 2px 9px rgba(15,23,42,.04)}
    .co-tabs-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .co button{cursor:pointer;border:0;border-radius:11px;padding:11px 17px;background:var(--co-blue);color:#fff;font-weight:700;font:inherit;font-size:13px}
    .co button:disabled{opacity:.5;cursor:not-allowed}
    .co button:focus-visible,.co input:focus-visible,.co select:focus-visible,.co textarea:focus-visible{outline:2px solid var(--co-blue);outline-offset:2px}
    .co-tabs .co-subtab{display:flex;align-items:center;justify-content:flex-start;gap:12px;min-width:0;min-height:82px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#475569;text-align:left;transition:background-color .15s,border-color .15s,color .15s,box-shadow .15s}
    .co-tabs .co-subtab:hover:not(.is-active){border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}
    .co-tabs .co-subtab.is-active{border-color:#2563eb;background:#2563eb;color:#fff;box-shadow:0 4px 12px rgba(37,99,235,.14)}
    .co-tab-icon{display:flex;align-items:center;justify-content:center;flex:0 0 42px;width:42px;height:42px;border-radius:10px;background:#eff6ff;color:#2563eb}
    .co-tab-icon svg{width:22px;height:22px}
    .co-subtab.is-active .co-tab-icon{background:rgba(255,255,255,.17);color:#fff}
    .co-tab-copy{display:block;min-width:0}
    .co-tab-title{display:block;font-size:14px;line-height:1.35;font-weight:800}
    .co-tab-description{display:block;margin-top:4px;font-size:11px;line-height:1.4;font-weight:500;opacity:.85}
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
    .co-bottom-fields{display:grid;grid-template-columns:minmax(0,1fr);align-items:start;gap:16px}
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
    .co .co-fecha,.co .co-hora{white-space:nowrap;font-variant-numeric:tabular-nums}
    .co-table-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .co .co-action-button{display:inline-flex;align-items:center;gap:6px;padding:8px 11px;border-radius:9px;border:1px solid #d4e2f5;background:#fff;color:#1d4ed8;font-weight:750;font-size:12px}
    .co .co-action-button:hover{background:#eff6ff;border-color:#93c5fd}
    .co .co-action-edit{background:#eff6ff}
    .co .co-action-view{background:#2563eb;color:#fff;border-color:#2563eb}
    .co .co-action-view:hover{background:#1d4ed8;color:#fff}
    .co-action-button svg{height:15px;width:15px}
    .co-modal-overlay{position:fixed;inset:0;z-index:1300;background:rgba(15,23,42,.70);display:flex;align-items:center;justify-content:center;padding:18px}
    .co-modal{width:min(960px,100%);max-height:92dvh;overflow:hidden;display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 22px 65px rgba(15,23,42,.25);color:#0b2342}
    .co-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:21px 24px;border-bottom:1px solid #e2e8f0}
    .co-modal-head h2{margin:6px 0;color:#0b2342;font-size:21px;letter-spacing:-.025em}
    .co-modal-head p:last-child{font-size:12px;color:#64748b;margin:5px 0 0}
    .co-modal-close{width:38px;height:38px;flex:0 0 38px;border:0;border-radius:10px;background:#eaf0f8;color:#475569;font-size:25px;cursor:pointer}
    .co-modal-body{overflow-y:auto;padding:22px 24px;flex:1;background:#f8fafc}
    .co-modal-loading{font-size:13px;color:#475569}
    .co-modal-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .co-modal-summary>div{display:flex;flex-direction:column;gap:9px;padding:15px;background:#fff;border:1px solid #e1e8f2;border-radius:12px;min-width:0}
    .co-modal-summary span,.co-modal-fields span{color:#64748b;font-size:11px;font-weight:650}
    .co-modal-summary strong,.co-modal-fields strong{color:#17243b;font-size:13px;overflow-wrap:anywhere}
    .co-modal-summary .co-modal-cola{background:#ecfdf5;border-color:#c5eee0}
    .co-modal-summary .co-modal-cola strong{color:#0f8274;font-size:18px}
    .co-modal-subtitle,.co-modal-obs h3,.co-modal-evidence h3{font-size:15px;color:#0b2342;margin:20px 0 13px;font-weight:800}
    .co-modal-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .co-modal-fields>div{display:flex;flex-direction:column;gap:7px;background:#fff;border:1px solid #e1e8f2;border-radius:10px;padding:13px;min-width:0}
    .co-modal-obs{background:#fff;border:1px solid #e1e8f2;border-radius:11px;padding:15px;margin-top:20px}
    .co-modal-obs h3{margin:0 0 9px}
    .co-modal-obs p{font-size:13px;color:#334155;line-height:1.6;white-space:pre-wrap;margin:0}
    .co-modal-evidence{margin-top:19px}
    .co-modal-evidence-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .co-modal-evidence-head h3{margin:0 0 12px}
    .co-modal-evidence-head span{font-size:11px;color:#64748b}
    .co-modal-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:13px}
    .co-modal-photo{display:flex;flex-direction:column;gap:8px;padding:8px;background:#fff;border:1px solid #e1e8f2;border-radius:11px;text-decoration:none;color:#1d4ed8;font-size:12px;font-weight:700}
    .co-modal-photo:hover{border-color:#2563eb}
    .co-modal-photo img{width:100%;height:138px;object-fit:cover;border-radius:7px}
    .co-modal-empty{padding:20px;color:#64748b;font-size:13px;border:1px dashed #cbd5e1;border-radius:10px;text-align:center}
    .co-modal-footer{padding:14px 24px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;background:#fff}
    .co-modal-footer button{background:#2563eb;color:#fff;border:0;border-radius:10px;padding:10px 22px;font-size:13px;font-weight:750;cursor:pointer}
    @media(max-width:690px){
      .co-modal-overlay{padding:7px}
      .co-modal{max-height:96dvh;border-radius:14px}
      .co-modal-head,.co-modal-body,.co-modal-footer{padding:15px}
      .co-modal-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
      .co-modal-fields{grid-template-columns:1fr}
      .co-modal-gallery{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media(max-width:850px){.co-general-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:680px){
      .co{padding:12px 10px 50px}
      .co-header{padding:20px 16px;border-radius:18px;gap:12px}
      .co-heading-icon{width:42px;height:42px;flex-basis:42px}
      .co-panel{padding:16px;border-radius:16px}
      .co-tabs{padding:8px}
      .co-tabs-grid{grid-template-columns:minmax(0,1fr);gap:8px}
      .co-tabs .co-subtab{min-height:76px;flex-direction:row;justify-content:flex-start;gap:12px;padding:12px 14px;text-align:left}
      .co-tab-icon{flex-basis:40px;width:40px;height:40px;border-radius:9px}
      .co-tab-icon svg{width:20px;height:20px}
      .co-tab-title{font-size:13px}
      .co-tab-description{font-size:11px}
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
  private readonly cdr = inject(ChangeDetectorRef);
  vista: 'nuevo' | 'historial' | 'dashboard' = 'nuevo';
  plazas: Plaza[] = [];
  turnos: Turno[] = [];
  responsables: ControlOperativoResponsable[] = [];
  vias: ViaIncidencia[] = [];
  reportes: ControlOperativoReporte[] = [];
  modalAbierto = false;
  modalCargando = false;
  modalError = '';
  modalRegistroId: number | null = null;
  registroModal: ControlOperativoReporte | null = null;
  evidenciasModal: ControlOperativoEvidencia[] = [];
  private solicitudModal = 0;
  cargando = false;
  cargandoTurnos = true;
  cargandoResponsables = true;
  private historialCargado = false;
  private historialSolicitud = 0;
  private viasSolicitud = 0;
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
  ngOnInit(): void {
    // Mostrar el formulario inmediatamente: evitar esperar tres catálogos,
    // las vías y hasta 500 filas del historial antes de permitir registrar.
    const usuario = this.auth.usuario();
    this.form.plazaId = usuario?.plazaId ?? 0;
    this.form.responsableId = usuario?.trabajadorId ?? usuario?.id ?? 0;

    // Mostrar inmediatamente los valores de la sesión; luego completar catálogos.
    if (usuario?.plazaId) {
      this.plazas = [{
        id: usuario.plazaId,
        codigo: usuario.plaza || 'Plaza asignada',
        descripcion: null,
        activo: true
      }];
    }
    if (this.form.responsableId && usuario?.nombre) {
      this.responsables = [{
        id: this.form.responsableId,
        nombreCompleto: usuario.nombre
      }];
    }
    if (!this.esSupervisor && usuario?.plazaId) {
      this.filtros.plazaId = usuario.plazaId;
    } else {
      void this.cargarPlazasIniciales();
    }

    // Cada catálogo se carga de forma independiente, sin bloquear la interfaz.
    void this.cargarTurnosIniciales();
    void this.cargarResponsablesIniciales();
    if (this.form.plazaId) void this.cambioPlaza();
    // El historial y dashboard se consultan únicamente cuando se abren.
  }

  private async cargarPlazasIniciales(): Promise<void> {
    try {
      const plazas = await firstValueFrom(this.catalogos.getPlazas());
      const activas = (plazas || []).filter(p => p.activo);
      // Mantener la plaza de sesión visible aunque el catálogo llegue vacío.
      if (activas.length) this.plazas = activas;
    } catch (e) {
      this.error = 'No se pudo cargar el catálogo de plazas. ' + this.errorHttp(e);
    } finally {
      // Los cambios posteriores a await requieren notificar a Angular.
      this.cdr.markForCheck();
    }
  }

  private async cargarTurnosIniciales(): Promise<void> {
    try {
      this.turnos = await firstValueFrom(this.catalogos.getTurnos());
      // Sugerir A/B/C solo en la primera carga, sin sobrescribir cambios manuales.
      if (!this.form.turnoId) this.sincronizarTurno(this.form.hora);
    } catch (e) {
      this.error = 'No se pudo cargar el catálogo de turnos. ' + this.errorHttp(e);
    } finally {
      this.cargandoTurnos = false;
      this.cdr.markForCheck();
    }
  }

  private async cargarResponsablesIniciales(): Promise<void> {
    try {
      const responsables = await firstValueFrom(this.api.responsables());
      // Si la lista llega vacía, conservar como referencia el usuario autenticado.
      if (responsables.length) this.responsables = responsables;
    } catch (e) {
      this.error = 'No se pudo cargar la lista de responsables. ' + this.errorHttp(e);
    } finally {
      this.cargandoResponsables = false;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void { this.fotos.forEach(f=>URL.revokeObjectURL(f.url)); }

  cambiarVista(vista:'nuevo'|'historial'|'dashboard'):void {
    this.vista=vista;this.error='';this.mensaje='';
    if (vista==='historial' && !this.historialCargado && !this.cargando) {
      void this.cargarHistorial();
    }
    // El componente de Dashboard administra sus propios filtros y carga.
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
      situacion:'',ingreso:'',incidente:'',colaMetros:null,descripcion:''};
  }
  async cambioPlaza():Promise<void> {
    const solicitud = ++this.viasSolicitud;
    this.form.viaId = null;
    this.vias = [];
    if (!this.form.plazaId) return;
    const plazaId = this.form.plazaId;
    try {
      const vias = await firstValueFrom(this.incidenciaApi.getVias(plazaId));
      if (solicitud === this.viasSolicitud && this.form.plazaId === plazaId) {
        this.vias = vias.filter(v => v.activa !== false);
      }
    } catch (e) {
      if (solicitud === this.viasSolicitud) this.error = this.errorHttp(e);
    } finally {
      this.cdr.markForCheck();
    }
  }
  async cargarHistorial(): Promise<void> {
    const solicitud = ++this.historialSolicitud;
    this.cargando = true;
    this.error = '';
    try {
      const datos = await firstValueFrom(this.api.listar({
        inicio: this.filtros.inicio, fin: this.filtros.fin,
        plazaId: this.esSupervisor ? this.filtros.plazaId : this.auth.usuario()?.plazaId
      }));
      // No sobrescribir un filtro nuevo con la respuesta de una petición anterior.
      if (solicitud !== this.historialSolicitud) return;
      this.reportes = datos;
      this.historialCargado = true;
    } catch (e) {
      if (solicitud === this.historialSolicitud) this.error = this.errorHttp(e);
    } finally {
      if (solicitud === this.historialSolicitud) this.cargando = false;
      this.cdr.markForCheck();
    }
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
      this.error='Completa plaza, turno, responsable, fecha y hora.';return;
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
      // Hasta cuatro evidencias independientes: subirlas en paralelo.
      const subidas = await Promise.allSettled(
        this.fotos.map(f => firstValueFrom(this.api.subirEvidencia(registro.id,f.file,f.categoria)))
      );
      const fallidas = subidas.filter(r => r.status === 'rejected').length;
      this.historialCargado = false; // Se actualizará cuando el usuario abra Historial.
      this.limpiar();
      this.mensaje = fallidas
        ? 'Reporte #'+registro.id+' guardado, pero falló la subida de '+fallidas+' imagen(es). Puedes editarlas nuevamente.'
        : 'Reporte operativo #'+registro.id+' guardado correctamente.';
    } catch(e){this.error=this.errorHttp(e);}
    finally{this.guardando=false;this.cdr.markForCheck();}
  }
  async editar(registro:ControlOperativoReporte):Promise<void> {
    this.vista='nuevo';this.editandoId=registro.id;this.error='';this.mensaje='';
    this.form={plazaId:registro.plazaId,turnoId:registro.turnoId,
      viaId:null,responsableId:registro.responsableId || registro.registradoPorId,
      tipo:registro.tipo as TipoControlOperativo,fecha:registro.fecha,
      hora:registro.hora,situacion:registro.situacion,ingreso:registro.ingreso,
      incidente:registro.incidente,colaMetros:registro.colaMetros,
      descripcion:registro.descripcion};
    // Conservar el turno registrado, incluso si se eligió manualmente.
    await this.cambioPlaza();this.form.viaId=registro.viaId;
    this.cdr.markForCheck();
  }
  async verRegistro(registro:ControlOperativoReporte):Promise<void> {
    const solicitud = ++this.solicitudModal;
    this.modalAbierto = true;
    this.modalCargando = true;
    this.modalError = '';
    this.modalRegistroId = registro.id;
    this.registroModal = null;
    this.evidenciasModal = [];
    this.cdr.markForCheck();
    try {
      const [detalle,fotos] = await Promise.allSettled([
        firstValueFrom(this.api.obtener(registro.id)),
        firstValueFrom(this.api.evidencias(registro.id))
      ]);
      // No mostrar resultados antiguos si se cerró o abrió otro reporte.
      if (solicitud !== this.solicitudModal || !this.modalAbierto) return;
      if (detalle.status === 'fulfilled') {
        this.registroModal = detalle.value;
      } else {
        this.modalError = 'No se pudieron cargar los datos del reporte. ' + this.errorHttp(detalle.reason);
      }
      if (fotos.status === 'fulfilled') {
        this.evidenciasModal = fotos.value;
      } else {
        this.modalError += (this.modalError ? ' ' : '') +
          'No se pudieron cargar las fotografías. ' + this.errorHttp(fotos.reason);
      }
    } catch(e:unknown) {
      if (solicitud !== this.solicitudModal || !this.modalAbierto) return;
      this.modalError = this.errorHttp(e);
    } finally {
      if (solicitud === this.solicitudModal) {
        this.modalCargando = false;
        this.cdr.markForCheck();
      }
    }
  }
  nombreCategoria(categoria:string):string {
    const titulos:Record<string,string> = {
      PLAZA:'Situación de la plaza',INGRESO:'Ingreso',
      INCIDENTE:'Incidente',COLA:'Tamaño de cola'
    };
    return titulos[categoria] ?? categoria;
  }
  cerrarModal():void {
    ++this.solicitudModal;
    this.modalAbierto = false;
    this.registroModal = null;
    this.evidenciasModal = [];
    this.modalRegistroId = null;
    this.modalError = '';
    this.modalCargando = false;
    this.cdr.markForCheck();
  }
  @HostListener('document:keydown.escape')
  cerrarConEscape():void {
    if (this.modalAbierto) this.cerrarModal();
  }
  private errorHttp(e:unknown):string {
    const err=e as {error?:{message?:string;detail?:string};message?:string};
    return err?.error?.message || err?.error?.detail || err?.message || 'No se pudo completar la operación.';
  }
}
