import { CommonModule } from '@angular/common';

import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { RouterLink } from '@angular/router';

import { jsPDF } from 'jspdf';



import { AuthService } from '../../../../core/auth/auth.service';

import { Plaza } from '../../../asistencia/models/asistencia.models';

import { AsistenciaApiService } from '../../../asistencia/services/asistencia-api.service';

import { RelevoChecklistResponse, RelevoResponse, RelevoViaResponse } from '../../models/relevo.models';

import { RelevoApiService } from '../../services/relevo-api.service';



@Component({ selector: 'app-relevo-historial', standalone: true, imports: [CommonModule, FormsModule, RouterLink], templateUrl: './relevo-historial.component.html', styleUrl: '../../../../shared/page.css' })

export class RelevoHistorialComponent implements OnInit {

  private readonly api = inject(RelevoApiService);

  private readonly catalogos = inject(AsistenciaApiService);

  readonly auth = inject(AuthService);

  readonly cargando = signal(false); readonly error = signal(''); readonly detalleSeleccionado = signal<RelevoResponse | null>(null); readonly generandoPdfId = signal<number | null>(null);

  relevos: RelevoResponse[] = []; plazas: Plaza[] = []; inicio = ''; fin = ''; plazaId: number | null = null;

  get esOperador(): boolean { return this.auth.usuario()?.rol === 'OPERADOR'; }



  ngOnInit(): void {

    const hoy=this.fechaHoy();

    this.inicio=this.esOperador?this.fechaInicioVentanaOperador():hoy;

    this.fin=hoy;

    const usuario=this.auth.usuario();

    if(this.esOperador){this.plazaId=usuario?.plazaId??null;this.buscar();return;}

    this.catalogos.getPlazas().subscribe({next:data=>{this.plazas=(data??[]).filter(i=>i.activo!==false);this.buscar();},error:()=>{this.error.set('No se pudieron cargar las plazas.');this.buscar();}});

  }

  buscar(): void {

    if(this.cargando())return;

    this.error.set('');

    if(!this.inicio||!this.fin)return this.error.set('Selecciona las fechas de búsqueda.');

    if(this.inicio>this.fin)return this.error.set('La fecha inicial no puede ser posterior a la fecha final.');

    this.cargando.set(true);

    this.api.listar(this.inicio,this.fin).subscribe({

      next:data=>{

        let items=(data??[]).map(i=>({...i,checklist:i.checklist??[],vias:i.vias??[]}));

        if(this.esOperador){

          items=this.filtrarHistorialOperador(items);

        }else if(this.plazaId){

          items=items.filter(i=>i.plazaId===this.plazaId);

        }

        this.relevos=items.sort((a,b)=>this.fechaHoraNumero(b)-this.fechaHoraNumero(a));

        this.cargando.set(false);

      },

      error:err=>{this.cargando.set(false);this.error.set(err?.error?.message??'No se pudo cargar el historial de relevos.');}

    });

  }

  limpiarFiltros():void{const hoy=this.fechaHoy();this.inicio=this.esOperador?this.fechaInicioVentanaOperador():hoy;this.fin=hoy;if(!this.esOperador)this.plazaId=null;this.buscar();}

  abrirDetalle(r:RelevoResponse):void{this.detalleSeleccionado.set(r);document.body.style.overflow='hidden';} cerrarDetalle():void{this.detalleSeleccionado.set(null);document.body.style.overflow='';}

  baseOperativa(r:RelevoResponse){return r.checklist.filter(i=>i.categoria==='BASE_OPERATIVA');} plazaPeaje(r:RelevoResponse){return r.checklist.filter(i=>i.categoria==='PLAZA_PEAJE');}

  totalVias(r:RelevoResponse){return r.vias?.length??0;} viasConObservacion(r:RelevoResponse){return r.vias?.filter(v=>v.estado==='OBSERVADO'||v.estado==='NO_OPERATIVO').length??0;} checklistConObservacion(r:RelevoResponse){return r.checklist?.filter(i=>i.estado==='OBSERVADO'||i.estado==='NO_OPERATIVO').length??0;}

  horaCorta(h:string){return h?.slice(0,5)||'--:--';} estadoLabel(e:string){if(e==='NO_OPERATIVO')return 'No operativo';if(e==='OBSERVADO')return 'Observado';return 'Operativo';}




  async generarPdf(relevo: RelevoResponse): Promise<void> {
    if (this.generandoPdfId() !== null) return;

    this.generandoPdfId.set(relevo.id);
    this.error.set('');

    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const logo = await this.assetDataUrl('assets/logo-lima-expresa.png');

      this.encabezadoPdf(pdf, logo, relevo);

      let y = 46;
      y = this.bloqueDatos(pdf, relevo, y);
      y = this.bloqueIndicadores(pdf, relevo, y);

      y = await this.dibujarSeccion(
        pdf,
        'BASE OPERATIVA',
        this.baseOperativa(relevo),
        y,
        logo,
        relevo
      );

      y = await this.dibujarSeccion(
        pdf,
        'PLAZA DE PEAJE',
        this.plazaPeaje(relevo),
        y,
        logo,
        relevo
      );

      y = await this.dibujarVias(
        pdf,
        relevo.vias ?? [],
        y,
        logo,
        relevo
      );

      if (relevo.resumen || relevo.observaciones) {
        y = this.ensureSpace(pdf, y, 30, logo, relevo);
        this.tituloSeccion(pdf, 'RESUMEN Y OBSERVACIONES', y);
        y += 11;

        if (relevo.resumen) {
          y = this.cajaTexto(pdf, 'Resumen del relevo', relevo.resumen, y);
        }

        if (relevo.observaciones) {
          y = this.cajaTexto(pdf, 'Observaciones generales', relevo.observaciones, y);
        }
      }


      this.numerarPaginas(pdf);

      pdf.save(
        `relevo_${relevo.fecha}_${relevo.plazaCodigo}_turno_${relevo.turnoCodigo}.pdf`
      );
    } catch (err) {
      console.error(err);
      this.error.set('No se pudo generar el PDF del relevo.');
    } finally {
      this.generandoPdfId.set(null);
    }
  }


  private filtrarHistorialOperador(items: RelevoResponse[]): RelevoResponse[] {
    const u = this.auth.usuario();

    if (!u?.trabajadorId || !u?.plazaId) return [];

    const plaza = items
      .filter(i => i.plazaId === u.plazaId)
      .sort((a, b) => this.fechaHoraNumero(b) - this.fechaHoraNumero(a));

    const propios = plaza.filter(i => i.operadorId === u.trabajadorId);
    const ids = new Set(propios.map(i => i.id));
    const ultimoPropio = propios[0];

    let anterior: RelevoResponse | undefined;

    if (ultimoPropio) {
      const fechaUltimo = this.fechaHoraNumero(ultimoPropio);
      anterior = plaza.find(
        i => i.id !== ultimoPropio.id && this.fechaHoraNumero(i) < fechaUltimo
      );
    } else {
      anterior = plaza[0];
    }

    if (anterior) ids.add(anterior.id);

    return plaza.filter(i => ids.has(i.id));
  }


  private encabezadoPdf(
    pdf: jsPDF,
    logo: string | null,
    relevo: RelevoResponse
  ): void {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, 210, 39, 'F');

    pdf.setFillColor(29, 78, 216);
    pdf.rect(0, 0, 5, 39, 'F');

    if (logo) {
      try {
        const props = pdf.getImageProperties(logo);
        const maxW = 39;
        const maxH = 16;
        const ratio = props.width / props.height;

        let logoW = maxW;
        let logoH = logoW / ratio;

        if (logoH > maxH) {
          logoH = maxH;
          logoW = logoH * ratio;
        }

        const logoY = 8 + (maxH - logoH) / 2;
        pdf.addImage(logo, 'PNG', 14, logoY, logoW, logoH, undefined, 'FAST');
      } catch {}
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text('REPORTE DE RELEVO DE TURNO', 196, 12, { align: 'right' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.2);
    pdf.setTextColor(100, 116, 139);
    pdf.text('SIGO · Sistema de Gestión Operativa', 196, 19, { align: 'right' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.4);
    pdf.setTextColor(29, 78, 216);
    pdf.text(
      `PLAZA ${relevo.plazaCodigo}  ·  TURNO ${relevo.turnoCodigo}`,
      196,
      25.5,
      { align: 'right' }
    );

    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.35);
    pdf.line(14, 35, 196, 35);
  }


  private bloqueDatos(
    pdf: jsPDF,
    r: RelevoResponse,
    y: number
  ): number {
    const x = 14;
    const w = 182;
    const h = 41;

    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(x, y, w, h, 3, 3, 'FD');

    pdf.setFillColor(29, 78, 216);
    pdf.roundedRect(x, y, 3, h, 1.5, 1.5, 'F');

    const datos = [
      {
        label: 'PLAZA',
        value: `${r.plazaCodigo}${r.plazaDescripcion ? ' · ' + r.plazaDescripcion : ''}`,
        x: 21,
        y: y + 10,
        width: 77
      },
      {
        label: 'TURNO',
        value: String(r.turnoCodigo || '—'),
        x: 109,
        y: y + 10,
        width: 78
      },
      {
        label: 'FECHA',
        value: this.fechaPdf(r.fecha),
        x: 21,
        y: y + 28,
        width: 40
      },
      {
        label: 'HORA',
        value: this.horaCorta(r.hora),
        x: 66,
        y: y + 28,
        width: 30
      },
      {
        label: 'REGISTRADO POR',
        value: r.operadorNombre || 'No disponible',
        x: 109,
        y: y + 28,
        width: 78
      }
    ];

    for (const d of datos) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.7);
      pdf.setTextColor(100, 116, 139);
      pdf.text(d.label, d.x, d.y);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);

      const lines = pdf.splitTextToSize(d.value, d.width);
      pdf.text(lines, d.x, d.y + 5.5);
    }

    return y + h + 7;
  }


  private bloqueIndicadores(
    pdf: jsPDF,
    r: RelevoResponse,
    y: number
  ): number {
    const checklist = r.checklist ?? [];
    const vias = r.vias ?? [];

    const operativos =
      checklist.filter(i => i.estado === 'OPERATIVO').length +
      vias.filter(v => v.estado === 'OPERATIVO').length;

    const observados =
      checklist.filter(i => i.estado === 'OBSERVADO').length +
      vias.filter(v => v.estado === 'OBSERVADO').length;

    const noOperativos =
      checklist.filter(i => i.estado === 'NO_OPERATIVO').length +
      vias.filter(v => v.estado === 'NO_OPERATIVO').length;

    const cards = [
      {
        label: 'OPERATIVOS',
        value: operativos,
        fill: [240, 253, 244] as [number, number, number],
        text: [21, 128, 61] as [number, number, number]
      },
      {
        label: 'OBSERVADOS',
        value: observados,
        fill: [255, 251, 235] as [number, number, number],
        text: [180, 83, 9] as [number, number, number]
      },
      {
        label: 'NO OPERATIVOS',
        value: noOperativos,
        fill: [254, 242, 242] as [number, number, number],
        text: [185, 28, 28] as [number, number, number]
      }
    ];

    const gap = 4;
    const width = (182 - gap * 2) / 3;

    cards.forEach((card, index) => {
      const x = 14 + index * (width + gap);

      pdf.setFillColor(...card.fill);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(x, y, width, 23, 3, 3, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.setTextColor(...card.text);
      pdf.text(String(card.value), x + 6, y + 10);

      pdf.setFontSize(6.6);
      pdf.text(card.label, x + 6, y + 17);
    });

    return y + 30;
  }


  private tituloSeccion(
    pdf: jsPDF,
    titulo: string,
    y: number
  ): void {
    pdf.setFillColor(239, 246, 255);
    pdf.roundedRect(14, y, 182, 9, 2, 2, 'F');

    pdf.setFillColor(29, 78, 216);
    pdf.roundedRect(14, y, 3, 9, 1.5, 1.5, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.8);
    pdf.setTextColor(29, 78, 216);
    pdf.text(titulo, 20, y + 6);

    pdf.setTextColor(15, 23, 42);
  }


  private async dibujarSeccion(
    pdf: jsPDF,
    titulo: string,
    items: RelevoChecklistResponse[],
    y: number,
    logo: string | null,
    r: RelevoResponse
  ): Promise<number> {
    if (!items?.length) return y;

    y = this.ensureSpace(pdf, y, 25, logo, r);
    this.tituloSeccion(pdf, titulo, y);
    y += 13;

    y = this.cabeceraTabla(
      pdf,
      y,
      [
        { label: 'ELEMENTO', x: 18 },
        { label: 'CANT.', x: 91 },
        { label: 'ESTADO', x: 112 },
        { label: 'DETALLE', x: 149 }
      ]
    );

    for (const item of items) {
      const detalle = item.detalle?.trim() || 'Sin observaciones';
      const detalleLines = pdf.splitTextToSize(detalle, 43);
      const nombreLines = pdf.splitTextToSize(item.nombre || '-', 66);
      const lineas = Math.max(detalleLines.length, nombreLines.length);
      const fotos = item.evidencias ?? [];
      const tieneFotos = fotos.length > 0;
      const fotoH = tieneFotos ? 50 : 0;
      const hTexto = Math.max(12, 7 + lineas * 3.6);
      const h = hTexto + fotoH;

      y = this.ensureSpace(pdf, y, h + 3, logo, r);

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(14, y, 182, h, 1.5, 1.5, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(30, 41, 59);
      pdf.text(nombreLines, 18, y + 5.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);
      pdf.text(
        item.cantidad === null || item.cantidad === undefined
          ? '—'
          : String(item.cantidad),
        94,
        y + 5.5
      );

      this.badgeEstado(pdf, item.estado, 142, y + 5.7);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.3);
      pdf.setTextColor(71, 85, 105);
      pdf.text(detalleLines, 149, y + 5.2);

      if (tieneFotos) {
        const fotoY = y + hTexto + 1.5;
        pdf.setDrawColor(241, 245, 249);
        pdf.line(18, fotoY - 2, 192, fotoY - 2);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.2);
        pdf.setTextColor(100, 116, 139);
        pdf.text('EVIDENCIA', 18, fotoY + 2.5);

        await this.dibujarMiniEvidencias(
          pdf,
          fotos.map(e => e.urlArchivo),
          39,
          fotoY - 0.5
        );
      }

      y += h + 2;
    }

    return y + 4;
  }


  private async dibujarVias(
    pdf: jsPDF,
    vias: RelevoViaResponse[],
    y: number,
    logo: string | null,
    r: RelevoResponse
  ): Promise<number> {
    if (!vias?.length) return y;

    y = this.ensureSpace(pdf, y, 25, logo, r);
    this.tituloSeccion(pdf, 'REPORTE DE VÍAS', y);
    y += 13;

    y = this.cabeceraTabla(
      pdf,
      y,
      [
        { label: 'VÍA', x: 18 },
        { label: 'NOMBRE', x: 43 },
        { label: 'ESTADO', x: 112 },
        { label: 'DETALLE', x: 149 }
      ]
    );

    for (const via of vias) {
      const nombreLines = pdf.splitTextToSize(via.nombre || '—', 59);
      const detalleLines = pdf.splitTextToSize(
        via.detalle?.trim() || 'Sin observaciones',
        43
      );

      const lineas = Math.max(nombreLines.length, detalleLines.length);
      const fotos = via.evidencias ?? [];
      const tieneFotos = fotos.length > 0;
      const fotoH = tieneFotos ? 50 : 0;
      const hTexto = Math.max(12, 7 + lineas * 3.6);
      const h = hTexto + fotoH;

      y = this.ensureSpace(pdf, y, h + 3, logo, r);

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(14, y, 182, h, 1.5, 1.5, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.2);
      pdf.setTextColor(30, 41, 59);
      pdf.text(String(via.numero ?? '—'), 18, y + 5.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.6);
      pdf.setTextColor(71, 85, 105);
      pdf.text(nombreLines, 43, y + 5.2);

      this.badgeEstado(pdf, via.estado, 142, y + 5.7);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.3);
      pdf.setTextColor(71, 85, 105);
      pdf.text(detalleLines, 149, y + 5.2);

      if (tieneFotos) {
        const fotoY = y + hTexto + 1.5;
        pdf.setDrawColor(241, 245, 249);
        pdf.line(18, fotoY - 2, 192, fotoY - 2);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.2);
        pdf.setTextColor(100, 116, 139);
        pdf.text('EVIDENCIA', 18, fotoY + 2.5);

        await this.dibujarMiniEvidencias(
          pdf,
          fotos.map(e => e.urlArchivo),
          39,
          fotoY - 0.5
        );
      }

      y += h + 2;
    }

    return y + 4;
  }


  private async dibujarMiniEvidencias(
    pdf: jsPDF,
    urls: string[],
    xInicial: number,
    y: number
  ): Promise<void> {
    const maxFotos = 4;
    const fotoW = 34;
    const fotoH = 45.3;
    const gap = 4;
    const visibles = urls.slice(0, maxFotos);

    for (let i = 0; i < visibles.length; i++) {
      const x = xInicial + i * (fotoW + gap);
      const data = await this.imagenDataUrl(visibles[i]);

      if (data) {
        try {
          pdf.addImage(
            data,
            'JPEG',
            x,
            y,
            fotoW,
            fotoH,
            undefined,
            'FAST'
          );
        } catch {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(x, y, fotoW, fotoH, 'F');
        }
      } else {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(x, y, fotoW, fotoH, 'F');
      }

      pdf.setDrawColor(203, 213, 225);
      pdf.roundedRect(x, y, fotoW, fotoH, 1.5, 1.5, 'S');
    }

    if (urls.length > maxFotos) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        `+${urls.length - maxFotos}`,
        xInicial + maxFotos * (fotoW + gap) - gap + 4,
        y + fotoH / 2
      );
    }
  }


  private cabeceraTabla(
    pdf: jsPDF,
    y: number,
    columnas: { label: string; x: number }[]
  ): number {
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(14, y, 182, 7, 1.5, 1.5, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.4);
    pdf.setTextColor(100, 116, 139);

    columnas.forEach(columna => {
      pdf.text(columna.label, columna.x, y + 4.7);
    });

    return y + 9;
  }


  private badgeEstado(
    pdf: jsPDF,
    estado: string,
    xRight: number,
    y: number
  ): void {
    const label = this.estadoLabel(estado);

    const width =
      estado === 'NO_OPERATIVO'
        ? 28
        : estado === 'OBSERVADO'
          ? 23
          : 21;

    if (estado === 'OPERATIVO') {
      pdf.setFillColor(220, 252, 231);
      pdf.setTextColor(21, 128, 61);
    } else if (estado === 'OBSERVADO') {
      pdf.setFillColor(254, 243, 199);
      pdf.setTextColor(180, 83, 9);
    } else {
      pdf.setFillColor(254, 226, 226);
      pdf.setTextColor(185, 28, 28);
    }

    pdf.roundedRect(xRight - width, y - 4.2, width, 6.3, 2, 2, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.3);
    pdf.text(
      label.toUpperCase(),
      xRight - width / 2,
      y,
      { align: 'center' }
    );

    pdf.setTextColor(15, 23, 42);
  }


  private cajaTexto(
    pdf: jsPDF,
    label: string,
    texto: string,
    y: number
  ): number {
    const lines = pdf.splitTextToSize(texto, 168);
    const h = Math.max(20, 13 + lines.length * 4);

    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(14, y, 182, h, 2.5, 2.5, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.7);
    pdf.setTextColor(29, 78, 216);
    pdf.text(label.toUpperCase(), 19, y + 6);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.3);
    pdf.setTextColor(51, 65, 85);
    pdf.text(lines, 19, y + 12);

    return y + h + 4;
  }


  private ensureSpace(
    pdf: jsPDF,
    y: number,
    needed: number,
    logo: string | null,
    r: RelevoResponse
  ): number {
    if (y + needed <= 278) {
      return y;
    }

    pdf.addPage();
    this.encabezadoPdf(pdf, logo, r);
    return 46;
  }




  private numerarPaginas(pdf: jsPDF): void {
    const total = pdf.getNumberOfPages();
    const generado = new Date();

    const fechaGeneracion =
      `${String(generado.getDate()).padStart(2, '0')}/` +
      `${String(generado.getMonth() + 1).padStart(2, '0')}/` +
      `${generado.getFullYear()} ` +
      `${String(generado.getHours()).padStart(2, '0')}:` +
      `${String(generado.getMinutes()).padStart(2, '0')}`;

    for (let p = 1; p <= total; p++) {
      pdf.setPage(p);

      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(14, 286, 196, 286);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);

      pdf.text(
        `SIGO · Lima Expresa · Generado ${fechaGeneracion}`,
        14,
        291
      );

      pdf.setFont('helvetica', 'bold');
      pdf.text(
        `Página ${p} de ${total}`,
        196,
        291,
        { align: 'right' }
      );
    }
  }


  private fechaPdf(fecha: string): string {
    if (!fecha) return '—';

    const partes = fecha.split('-');

    if (partes.length !== 3) {
      return fecha;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }


  private async assetDataUrl(path: string): Promise<string | null> {
    try {
      const response = await fetch(path);

      if (!response.ok) {
        return null;
      }

      return await this.blobDataUrl(
        await response.blob()
      );
    } catch {
      return null;
    }
  }


  private async imagenDataUrl(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        return null;
      }

      return await this.blobDataUrl(
        await response.blob()
      );
    } catch {
      return null;
    }
  }


  private blobDataUrl(blob: Blob): Promise<string | null> {
    return new Promise(resolve => {
      const reader = new FileReader();

      reader.onload = () =>
        resolve(
          typeof reader.result === 'string'
            ? reader.result
            : null
        );

      reader.onerror = () =>
        resolve(null);

      reader.readAsDataURL(blob);
    });
  }


  private fechaHoraNumero(r:RelevoResponse):number{const v=new Date(`${r.fecha}T${r.hora||'00:00:00'}`).getTime();return Number.isNaN(v)?0:v;}

  private fechaHoy():string{const now=new Date(),offset=now.getTimezoneOffset();return new Date(now.getTime()-offset*60000).toISOString().slice(0,10);}

  private fechaInicioVentanaOperador():string{const now=new Date();if(now.getHours()>=14)return this.fechaHoy();const anterior=new Date(now);anterior.setDate(anterior.getDate()-1);const offset=anterior.getTimezoneOffset();return new Date(anterior.getTime()-offset*60000).toISOString().slice(0,10);}

}