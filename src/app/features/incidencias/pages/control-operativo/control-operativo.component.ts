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
  ControlOperativoReporte, TipoControlOperativo
} from '../../services/control-operativo-api.service';

@Component({
  selector: 'app-control-operativo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="co">
      <header class="co-header">
        <div>
          <p class="co-eyebrow">SIGO / Incidencias</p>
          <h1>Control Operativo de Plazas</h1>
          <p>Registra las condiciones del tránsito, los ingresos, incidentes y tamaño de cola sin modificar las incidencias existentes.</p>
        </div>
      </header>

      <div class="co-tabs" role="tablist" aria-label="Control operativo">
        <button type="button" [class.selected]="vista==='nuevo'" (click)="cambiarVista('nuevo')">Nuevo reporte</button>
        <button type="button" [class.selected]="vista==='historial'" (click)="cambiarVista('historial')">Historial</button>
        <button type="button" [class.selected]="vista==='dashboard'" (click)="cambiarVista('dashboard')">Dashboard</button>
        <button *ngIf="esSupervisor" type="button" [class.selected]="vista==='vias'" (click)="cambiarVista('vias')">Vías por plaza</button>
      </div>
      <p class="co-error" role="alert" *ngIf="error">{{error}}</p>
      <p class="co-success" role="status" *ngIf="mensaje">{{mensaje}}</p>

      <section class="co-panel" *ngIf="vista==='nuevo'">
        <div class="co-panel-head">
          <div><h2>{{editandoId ? 'Editar reporte operativo' : 'Nuevo registro operativo'}}</h2>
          <p>Datos para el seguimiento de la plaza y de la vía seleccionada.</p></div>
        </div>
        <form (ngSubmit)="guardar()" #coForm="ngForm">
          <div class="co-grid">
            <label>Tipo de registro
              <select name="tipo" [(ngModel)]="form.tipo" required>
                <option value="REPORTE">Reporte operativo</option>
                <option value="MEDICION">Medición de cola</option>
              </select>
            </label>
            <label>Plaza
              <select name="plaza" [(ngModel)]="form.plazaId" (ngModelChange)="cambioPlaza()" [disabled]="!esSupervisor" required>
                <option [ngValue]="0">Seleccionar plaza</option>
                <option *ngFor="let p of plazas" [ngValue]="p.id">{{p.codigo}}</option>
              </select>
            </label>
            <label>Turno
              <select name="turno" [(ngModel)]="form.turnoId" required>
                <option [ngValue]="0">Seleccionar turno</option>
                <option *ngFor="let t of turnos" [ngValue]="t.id">{{t.codigo}} - {{t.nombre}}</option>
              </select>
            </label>
            <label>Vía (opcional)
              <select name="via" [(ngModel)]="form.viaId">
                <option [ngValue]="null">Sin vía específica</option>
                <option *ngFor="let v of vias" [ngValue]="v.id">Vía {{v.numero}}</option>
              </select>
            </label>
            <label>Fecha
              <input type="date" name="fecha" [(ngModel)]="form.fecha" required>
            </label>
            <label>Hora
              <input type="time" name="hora" [(ngModel)]="form.hora" required>
            </label>
            <label>Situación de la plaza
              <select name="situacion" [(ngModel)]="form.situacion">
                <option value="">Sin especificar</option>
                <option *ngFor="let s of situaciones" [value]="s">{{s}}</option>
              </select>
            </label>
            <label>Ingreso
              <select name="ingreso" [(ngModel)]="form.ingreso">
                <option value="">Sin especificar</option>
                <option *ngFor="let i of ingresos" [value]="i">{{i}}</option>
              </select>
            </label>
            <label>Incidente operativo
              <select name="incidente" [(ngModel)]="form.incidente">
                <option value="">Sin incidente registrado</option>
                <option *ngFor="let i of incidentes" [value]="i">{{i}}</option>
              </select>
            </label>
            <label>Tamaño de cola (metros) {{form.tipo==='MEDICION'?'*':''}}
              <input type="number" name="cola" [(ngModel)]="form.colaMetros" min="0" max="50000"
                [required]="form.tipo==='MEDICION'" placeholder="Ej. 400">
            </label>
            <label>Estado
              <select name="estado" [(ngModel)]="form.estado">
                <option value="REGISTRADO">Registrado</option>
                <option value="EN_OBSERVACION">En observación</option>
                <option value="ATENDIDO">Atendido</option>
              </select>
            </label>
          </div>
          <label class="co-full">Descripción / observaciones
            <textarea name="descripcion" [(ngModel)]="form.descripcion" maxlength="10000" rows="3"
              placeholder="Información adicional del evento"></textarea>
          </label>
          <div class="co-upload" tabindex="0" (paste)="pegarImagen($event)">
            <strong>Evidencias fotográficas</strong>
            <p>Puedes pegar una imagen aquí (Ctrl/Cmd + V) o seleccionar hasta 5 archivos JPG, PNG o WEBP de máximo 10 MB.</p>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp"
              (change)="seleccionarImagenes($event)" aria-label="Adjuntar imágenes">
            <div class="co-photos" *ngIf="fotos.length">
              <div *ngFor="let foto of fotos; let i=index">
                <img [src]="foto.url" alt="Vista previa de evidencia">
                <select [(ngModel)]="foto.categoria" [name]="'categoriaEvidencia'+i" aria-label="Categoría de evidencia">
                  <option value="PLAZA">Plaza</option>
                  <option value="INGRESO">Ingreso</option>
                  <option value="INCIDENTE">Incidente</option>
                  <option value="COLA">Cola</option>
                </select>
                <button type="button" (click)="quitarFoto(i)">Quitar</button>
              </div>
            </div>
            <small *ngIf="editandoId">Las fotos añadidas se guardarán al actualizar. Las existentes se consultan en el historial.</small>
          </div>
          <div class="co-actions">
            <button type="button" class="co-secondary" (click)="limpiar()">Limpiar</button>
            <button type="submit" [disabled]="guardando || !coForm.form.valid || !form.plazaId || !form.turnoId">
              {{guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Registrar control'}}
            </button>
          </div>
        </form>
      </section>

      <section class="co-panel" *ngIf="vista==='historial'">
        <div class="co-panel-head">
          <div><h2>Historial de control operativo</h2><p>Registros de los últimos 30 días o el rango seleccionado.</p></div>
          <button type="button" class="co-secondary" (click)="cargarHistorial()">Actualizar</button>
        </div>
        <div class="co-filters">
          <label>Desde <input type="date" [(ngModel)]="filtros.inicio"></label>
          <label>Hasta <input type="date" [(ngModel)]="filtros.fin"></label>
          <label>Tipo
            <select [(ngModel)]="filtros.tipo">
              <option value="">Todos</option>
              <option value="REPORTE">Reportes</option>
              <option value="MEDICION">Mediciones</option>
            </select>
          </label>
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
            <thead><tr><th>Fecha / hora</th><th>Plaza / vía</th><th>Tipo</th><th>Situación</th><th>Cola</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              <tr *ngFor="let r of reportes">
                <td>{{r.fecha}} {{r.hora}}</td>
                <td>{{r.plazaCodigo}} <span *ngIf="r.viaNumero">/ {{r.viaNumero}}</span></td>
                <td>{{r.tipo==='MEDICION'?'Medición':'Reporte'}}</td>
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
          <article><small>Reportes operativos</small><strong>{{totalReportes}}</strong></article>
          <article><small>Mediciones de cola</small><strong>{{totalMediciones}}</strong></article>
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
    .co{max-width:1320px;margin:0 auto;padding:24px 16px 72px;color:var(--text-primary,#172334)}
    .co-header{margin-bottom:20px}.co-eyebrow{font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-size:12px}
    h1{font-size:clamp(24px,3vw,34px);margin:4px 0 8px;font-weight:800}
    h2{font-size:20px;margin:0 0 6px}h3{font-size:17px}
    .co-header p,.co-panel-head p{color:#64748b;margin:0;line-height:1.5}
    .co-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
    button{cursor:pointer;border:0;border-radius:10px;padding:10px 16px;background:#0f766e;color:white;font-weight:650}
    button:disabled{opacity:.55;cursor:not-allowed}
    .co-tabs button,.co-secondary{background:#e8eef5;color:#334155}
    .co-tabs button.selected{background:#0f766e;color:white}
    .co-panel{background:white;border:1px solid #e2e8f0;box-shadow:0 6px 20px #0f172a0a;border-radius:16px;padding:22px;margin-top:16px}
    .co-panel-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px;flex-wrap:wrap}
    .co-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    label{display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:700;color:#475569}
    input,select,textarea{box-sizing:border-box;width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:11px;background:white;color:#0f172a;font:inherit;font-weight:400}
    input:focus,select:focus,textarea:focus{outline:2px solid #5eead4;outline-offset:1px}
    .co-full{margin-top:18px}.co-upload{border:2px dashed #cbd5e1;border-radius:12px;background:#f8fafc;padding:16px;margin-top:18px}
    .co-upload:focus{outline:2px solid #0f766e}.co-upload p{color:#64748b;font-size:13px}
    .co-upload input{background:transparent;border:0;padding:4px}.co-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
    .co-error,.co-success{padding:12px;border-radius:10px;margin:12px 0;font-weight:600}
    .co-error{background:#fee2e2;color:#991b1b}.co-success{background:#dcfce7;color:#166534}
    .co-filters{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin:14px 0}.co-filters label{min-width:155px}
    .co-table-wrap{overflow-x:auto}.co table{border-collapse:collapse;width:100%;font-size:13px;min-width:750px}
    th,td{text-align:left;border-bottom:1px solid #e2e8f0;padding:13px 8px}th{color:#64748b;background:#f8fafc}
    .co-link{background:transparent;color:#0f766e;padding:4px 7px}
    .co-photos{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px}
    .co-photos>div,.co-photos>a{display:flex;flex-direction:column;align-items:start;gap:5px}
    .co-photos img{width:120px;height:100px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0}
    .co-photos button{background:#e2e8f0;color:#334155;padding:5px 10px;font-size:12px}
    .co-evidence{border-top:1px solid #e2e8f0;margin-top:20px;padding-top:10px}
    .co-vias{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}\n    .co-vias article{border:1px solid #e2e8f0;border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:8px}\n    .co-vias button{padding:7px 10px;font-size:12px}\n    .co-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
    .co-kpis article{display:flex;flex-direction:column;gap:8px;padding:18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}
    .co-kpis small{color:#64748b}.co-kpis strong{font-size:25px;color:#0f766e}
    .co-bar{margin:15px 0}.co-bar>span{font-size:13px;font-weight:600}
    .co-bar>div{margin-top:5px;height:10px;border-radius:99px;background:#e2e8f0;overflow:hidden}
    .co-bar>div span{display:block;height:100%;background:#0f766e}
    @media(max-width:680px){.co{padding:16px 8px 60px}.co-panel{padding:14px}.co-grid{grid-template-columns:1fr}.co-actions{flex-direction:column}.co-actions button{width:100%}}
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
  vias: ViaIncidencia[] = [];\n  viasGestion: ControlOperativoVia[] = [];\n  plazaGestion = 0;\n  desdeVia = 101;\n  hastaVia = 105;
  reportes: ControlOperativoReporte[] = [];
  evidencias: ControlOperativoEvidencia[] = [];
  reporteEvidencias: ControlOperativoReporte | null = null;
  cargando = false;
  guardando = false;
  error = '';
  mensaje = '';
  editandoId: number | null = null;
  fotos: {file: File;url:string;categoria:'PLAZA'|'INGRESO'|'INCIDENTE'|'COLA'}[] = [];
  filtros: {inicio:string;fin:string;tipo:string;plazaId:number|null} =
    {inicio: this.restarDias(30), fin: this.fechaHoy(), tipo:'', plazaId:null};
  form: ControlOperativoInput = this.nuevoForm();

  readonly situaciones = ['Fluida','Tráfico moderado','Congestionada','Tráfico en contra','Tráfico detenido','Otro'];
  readonly ingresos = ['Con motorizado','Sin motorizado','Motorizado en camino','Ingreso restringido','Sin novedad'];
  readonly incidentes = ['PNP en el semáforo','Falla en el sistema','Accidente vehicular','Vehículo averiado','Manifestación','Bloqueo de vía','Sin incidente','Otro'];

  get esSupervisor(): boolean { return this.auth.tieneRol('SUPERVISOR'); }
  get totalReportes(): number { return this.reportes.filter(r=>r.tipo==='REPORTE').length; }
  get totalMediciones(): number { return this.reportes.filter(r=>r.tipo==='MEDICION').length; }
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
      const [plazas,turnos]=await Promise.all([
        firstValueFrom(this.catalogos.getPlazas()),firstValueFrom(this.catalogos.getTurnos())
      ]);
      this.plazas=plazas.filter(p=>p.activo);\n      this.plazaGestion=this.plazas[0]?.id ?? 0;
      this.turnos=turnos;
      const usuario=this.auth.usuario();
      if(!this.esSupervisor && usuario?.plazaId) {
        this.form.plazaId=usuario.plazaId;
        this.filtros.plazaId=usuario.plazaId;
      }
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
    const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  private horaAhora():string {
    const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  }
  private restarDias(dias:number):string {
    const d=new Date();d.setDate(d.getDate()-dias);
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  private nuevoForm():ControlOperativoInput {
    return {plazaId:0,turnoId:0,viaId:null,tipo:'REPORTE',fecha:this.fechaHoy(),hora:this.horaAhora(),
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
        tipo:this.filtros.tipo,plazaId:this.esSupervisor?this.filtros.plazaId:this.auth.usuario()?.plazaId
      }));
    }catch(e){this.error=this.errorHttp(e);}
    finally{this.cargando=false;}
  }
  private agregarFoto(file:File):void {
    if(this.fotos.length>=5){this.error='Máximo 5 evidencias.';return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>10*1024*1024) {
      this.error='Se permiten imágenes JPG, PNG o WEBP de máximo 10 MB.';return;
    }
    this.fotos.push({file,url:URL.createObjectURL(file),categoria:'PLAZA'});
  }
  seleccionarImagenes(event:Event):void {
    const el=event.target as HTMLInputElement;
    for(const file of Array.from(el.files||[]))this.agregarFoto(file);
    el.value='';
  }
  pegarImagen(event:ClipboardEvent):void {
    for(const item of Array.from(event.clipboardData?.items||[])){
      if(item.kind==='file'){
        const file=item.getAsFile();
        if(file){event.preventDefault();this.agregarFoto(file);}
      }
    }
  }
  quitarFoto(index:number):void {
    const [foto]=this.fotos.splice(index,1);
    if(foto)URL.revokeObjectURL(foto.url);
  }
  limpiar():void {
    this.fotos.forEach(f=>URL.revokeObjectURL(f.url));this.fotos=[];
    const actual=this.auth.usuario();
    this.form=this.nuevoForm();
    if(!this.esSupervisor && actual?.plazaId)this.form.plazaId=actual.plazaId;
    this.editandoId=null;this.error='';this.mensaje='';
    void this.cambioPlaza();
  }
  async guardar():Promise<void> {
    this.error='';this.mensaje='';
    if(!this.form.plazaId || !this.form.turnoId || !this.form.fecha || !this.form.hora) {
      this.error='Completa plaza, turno, fecha y hora.';return;
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
      viaId:null,tipo:registro.tipo as TipoControlOperativo,fecha:registro.fecha,
      hora:registro.hora,situacion:registro.situacion,ingreso:registro.ingreso,
      incidente:registro.incidente,colaMetros:registro.colaMetros,
      descripcion:registro.descripcion,estado:registro.estado};
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
