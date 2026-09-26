import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import {
  Plaza,
  Turno
} from '../../../asistencia/models/asistencia.models';
import { AsistenciaApiService } from '../../../asistencia/services/asistencia-api.service';
import { ImageCropperModalComponent } from '../../../asistencia/shared/image-cropper-modal.component';
import {
  EstadoIncidencia,
  IncidenciaRequest,
  IncidenciaResponse,
  TipoIncidencia,
  ViaIncidencia
} from '../../models/incidencia.models';
import { IncidenciaApiService } from '../../services/incidencia-api.service';

interface EvidenciaTarget {
  incidenciaId: number;
  evidenciaId: number | null;
}

interface EditarIncidenciaForm {
  plazaId: number | null;
  turnoId: number | null;
  tipoId: number | null;
  viaId: number | null;
  fecha: string;
  hora: string;
  descripcion: string;
}

@Component({
  selector: 'app-incidencia-historial',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ImageCropperModalComponent
  ],
  templateUrl: './incidencia-historial.component.html'
})
export class IncidenciaHistorialComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(IncidenciaApiService);
  private readonly catalogos = inject(AsistenciaApiService);

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly actualizandoId = signal<number | null>(null);

  readonly detalle = signal<IncidenciaResponse | null>(null);
  readonly cargandoDetalle = signal(false);
  readonly guardandoEvidencia = signal(false);
  readonly eliminandoEvidenciaId = signal<number | null>(null);

  readonly editando = signal<IncidenciaResponse | null>(null);
  readonly guardandoEdicion = signal(false);
  readonly generandoPdfId = signal<number | null>(null);

  readonly cropperVisible = signal(false);
  readonly cropperFile = signal<File | null>(null);
  readonly evidenciaTarget = signal<EvidenciaTarget | null>(null);

  incidencias: IncidenciaResponse[] = [];
  plazas: Plaza[] = [];
  turnos: Turno[] = [];
  tipos: TipoIncidencia[] = [];
  viasEdicion: ViaIncidencia[] = [];

  inicio = this.primerDiaMes();
  fin = this.fechaHoy();
  plazaId: number | null = null;
  estado: EstadoIncidencia | null = null;

  editarForm: EditarIncidenciaForm = this.formEdicionVacio();

  get esOperador(): boolean {
    return this.auth.usuario()?.rol === 'OPERADOR';
  }

  get puedeAtender(): boolean {
    return this.auth.tieneRol(
      'SUPERVISOR',
      'CONTROLADOR'
    );
  }

  ngOnInit(): void {
    const usuario = this.auth.usuario();

    if (this.esOperador) {
      this.plazaId =
        usuario?.plazaId ?? null;
    }

    forkJoin({
      plazas: this.catalogos.getPlazas(),
      turnos: this.catalogos.getTurnos(),
      tipos: this.api.getTipos()
    }).subscribe({
      next: ({
        plazas,
        turnos,
        tipos
      }) => {
        this.plazas =
          (plazas ?? [])
            .filter(
              plaza =>
                plaza.activo !== false
            );

        this.turnos =
          turnos ?? [];

        this.tipos =
          tipos ?? [];

        this.buscar();
      },
      error: () => {
        this.error.set(
          'No se pudieron cargar los catálogos de incidencias.'
        );

        this.buscar();
      }
    });
  }

  buscar(): void {
    if (this.cargando()) return;

    this.error.set('');

    if (!this.inicio || !this.fin) {
      return this.error.set(
        'Selecciona las fechas.'
      );
    }

    if (this.inicio > this.fin) {
      return this.error.set(
        'La fecha inicial no puede ser posterior a la final.'
      );
    }

    this.cargando.set(true);

    this.api
      .listar(
        this.inicio,
        this.fin,
        this.plazaId,
        this.estado
      )
      .subscribe({
        next: data => {
          this.incidencias =
            data ?? [];

          this.cargando.set(false);
        },
        error: err => {
          this.cargando.set(false);

          this.error.set(
            err?.error?.message ??
            'No se pudo cargar el historial de incidencias.'
          );
        }
      });
  }

  limpiar(): void {
    this.inicio =
      this.primerDiaMes();

    this.fin =
      this.fechaHoy();

    this.estado = null;

    if (!this.esOperador) {
      this.plazaId = null;
    }

    this.buscar();
  }

  abrirDetalle(
    item: IncidenciaResponse
  ): void {
    this.error.set('');
    this.cargandoDetalle.set(true);
    this.detalle.set(item);

    this.api.obtener(item.id)
      .subscribe({
        next: incidencia => {
          this.detalle.set(
            incidencia
          );

          this.actualizarItemLocal(
            incidencia
          );

          this.cargandoDetalle.set(false);
        },
        error: err => {
          this.cargandoDetalle.set(false);

          this.error.set(
            err?.error?.message ??
            'No se pudo cargar el detalle de la incidencia.'
          );
        }
      });
  }

  cerrarDetalle(): void {
    if (
      this.guardandoEvidencia() ||
      this.eliminandoEvidenciaId() !== null
    ) {
      return;
    }

    this.detalle.set(null);
  }

  abrirEditar(
    item: IncidenciaResponse
  ): void {
    this.error.set('');

    this.editando.set(item);

    this.editarForm = {
      plazaId:
        this.esOperador
          ? this.auth.usuario()?.plazaId ?? item.plazaId
          : item.plazaId,
      turnoId: item.turnoId,
      tipoId: item.tipoId,
      viaId: item.viaId,
      fecha: item.fecha,
      hora: this.horaCorta(item.hora),
      descripcion: item.descripcion
    };

    this.cargarViasEdicion(
      this.editarForm.plazaId,
      item.viaId
    );
  }

  cerrarEditar(): void {
    if (this.guardandoEdicion()) {
      return;
    }

    this.editando.set(null);
    this.viasEdicion = [];
    this.editarForm =
      this.formEdicionVacio();
  }

  onPlazaEdicionChange(): void {
    this.editarForm.viaId = null;

    this.cargarViasEdicion(
      this.editarForm.plazaId,
      null
    );
  }

  guardarEdicion(): void {
    const item =
      this.editando();

    if (!item) return;

    const plazaId =
      this.esOperador
        ? this.auth.usuario()?.plazaId
        : this.editarForm.plazaId;

    if (
      !plazaId ||
      !this.editarForm.turnoId ||
      !this.editarForm.tipoId ||
      !this.editarForm.fecha ||
      !this.editarForm.hora ||
      this.editarForm.descripcion
        .trim()
        .length < 3
    ) {
      return this.error.set(
        'Completa correctamente los campos de la incidencia.'
      );
    }

    const request: IncidenciaRequest = {
      plazaId,
      turnoId:
        this.editarForm.turnoId,
      tipoId:
        this.editarForm.tipoId,
      viaId:
        this.editarForm.viaId,
      fecha:
        this.editarForm.fecha,
      hora:
        this.editarForm.hora,
      descripcion:
        this.editarForm.descripcion.trim()
    };

    this.guardandoEdicion.set(true);
    this.error.set('');

    this.api
      .actualizar(
        item.id,
        request
      )
      .subscribe({
        next: actualizado => {
          this.guardandoEdicion.set(false);

          this.actualizarItemLocal(
            actualizado
          );

          if (
            this.detalle()?.id ===
            actualizado.id
          ) {
            this.detalle.set(
              actualizado
            );
          }

          this.cerrarEditar();
        },
        error: err => {
          this.guardandoEdicion.set(false);

          this.error.set(
            err?.error?.message ??
            'No se pudo editar la incidencia.'
          );
        }
      });
  }

  marcarAtendido(
    item: IncidenciaResponse
  ): void {
    if (
      !this.puedeAtender ||
      item.estado === 'ATENDIDO' ||
      this.actualizandoId() !== null
    ) {
      return;
    }

    this.actualizandoId.set(
      item.id
    );

    this.api
      .atender(item.id)
      .subscribe({
        next: actualizado => {
          this.actualizarItemLocal(
            actualizado
          );

          if (
            this.detalle()?.id ===
            actualizado.id
          ) {
            this.detalle.set(
              actualizado
            );
          }

          this.actualizandoId.set(null);
        },
        error: err => {
          this.actualizandoId.set(null);

          this.error.set(
            err?.error?.message ??
            'No se pudo cambiar el estado de la incidencia.'
          );
        }
      });
  }

  seleccionarEvidencia(
    incidenciaId: number,
    evidenciaId: number | null,
    event: Event
  ): void {
    const input =
      event.target as HTMLInputElement;

    const file =
      input.files?.[0];

    input.value = '';

    this.error.set('');

    if (!file) return;

    const item =
      this.detalle();

    if (
      evidenciaId === null &&
      (item?.evidencias.length ?? 0) >= 5
    ) {
      return this.error.set(
        'La incidencia ya tiene el máximo de 5 evidencias.'
      );
    }

    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp'
      ].includes(file.type)
    ) {
      return this.error.set(
        'Solo se permiten imágenes JPG, PNG o WEBP.'
      );
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      return this.error.set(
        'Cada fotografía debe pesar como máximo 10 MB.'
      );
    }

    this.evidenciaTarget.set({
      incidenciaId,
      evidenciaId
    });

    this.cropperFile.set(file);
    this.cropperVisible.set(true);
  }

  onCropperConfirm(
    file: File
  ): void {
    const target =
      this.evidenciaTarget();

    if (!target) {
      this.cerrarCropper();
      return;
    }

    this.guardandoEvidencia.set(true);

    const request$ =
      target.evidenciaId === null
        ? this.api.subirEvidencia(
            target.incidenciaId,
            file
          )
        : this.api.reemplazarEvidencia(
            target.incidenciaId,
            target.evidenciaId,
            file
          );

    request$.subscribe({
      next: () => {
        this.guardandoEvidencia.set(false);
        this.cerrarCropper();

        this.recargarDetalle(
          target.incidenciaId
        );
      },
      error: err => {
        this.guardandoEvidencia.set(false);
        this.cerrarCropper();

        this.error.set(
          err?.error?.message ??
          'No se pudo guardar la evidencia.'
        );
      }
    });
  }

  onCropperCancel(): void {
    if (this.guardandoEvidencia()) {
      return;
    }

    this.cerrarCropper();
  }

  eliminarEvidencia(
    incidenciaId: number,
    evidenciaId: number
  ): void {
    if (
      this.eliminandoEvidenciaId() !== null ||
      this.guardandoEvidencia()
    ) {
      return;
    }

    const confirmar =
      window.confirm(
        '¿Deseas eliminar esta evidencia?'
      );

    if (!confirmar) return;

    this.eliminandoEvidenciaId.set(
      evidenciaId
    );

    this.api
      .eliminarEvidencia(
        incidenciaId,
        evidenciaId
      )
      .subscribe({
        next: () => {
          this.eliminandoEvidenciaId.set(null);

          this.recargarDetalle(
            incidenciaId
          );
        },
        error: err => {
          this.eliminandoEvidenciaId.set(null);

          this.error.set(
            err?.error?.message ??
            'No se pudo eliminar la evidencia.'
          );
        }
      });
  }

  generarPdf(
    item: IncidenciaResponse
  ): void {
    if (
      this.generandoPdfId() !== null
    ) {
      return;
    }

    this.generandoPdfId.set(
      item.id
    );

    this.api
      .obtener(item.id)
      .subscribe({
        next: incidencia => {
          void this.construirPdf(
            incidencia
          ).finally(() =>
            this.generandoPdfId.set(null)
          );
        },
        error: err => {
          this.generandoPdfId.set(null);

          this.error.set(
            err?.error?.message ??
            'No se pudo generar el PDF.'
          );
        }
      });
  }

  horaCorta(
    hora: string
  ): string {
    return hora.slice(0, 5) || '--:--';
  }

  private cargarViasEdicion(
    plazaId: number | null,
    viaSeleccionada: number | null
  ): void {
    this.viasEdicion = [];

    if (!plazaId) return;

    this.api
      .getVias(plazaId)
      .subscribe({
        next: vias => {
          this.viasEdicion =
            (vias ?? [])
              .filter(
                via =>
                  via.activa !== false
              );

          if (
            viaSeleccionada &&
            !this.viasEdicion.some(
              via =>
                via.id ===
                viaSeleccionada
            )
          ) {
            this.editarForm.viaId =
              null;
          }
        },
        error: () => {
          this.error.set(
            'No se pudieron cargar las vías para editar la incidencia.'
          );
        }
      });
  }

  private recargarDetalle(
    id: number
  ): void {
    this.cargandoDetalle.set(true);

    this.api.obtener(id)
      .subscribe({
        next: incidencia => {
          this.detalle.set(
            incidencia
          );

          this.actualizarItemLocal(
            incidencia
          );

          this.cargandoDetalle.set(false);
        },
        error: err => {
          this.cargandoDetalle.set(false);

          this.error.set(
            err?.error?.message ??
            'No se pudo actualizar el detalle de la incidencia.'
          );
        }
      });
  }

  private actualizarItemLocal(
    actualizado: IncidenciaResponse
  ): void {
    this.incidencias =
      this.incidencias.map(
        item =>
          item.id === actualizado.id
            ? actualizado
            : item
      );
  }

  private cerrarCropper(): void {
    this.cropperVisible.set(false);
    this.cropperFile.set(null);
    this.evidenciaTarget.set(null);
  }

  private async construirPdf(
    item: IncidenciaResponse
  ): Promise<void> {
    const pdf =
      new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

    const pageW =
      pdf.internal.pageSize.getWidth();

    const pageH =
      pdf.internal.pageSize.getHeight();

    let y = 14;

    const logo =
      await this.imagenDataUrl(
        'assets/logo-lima-expresa.png'
      );

    if (logo) {
      try {
        const props =
          pdf.getImageProperties(logo);

        const maxW = 38;
        const maxH = 15;
        const ratio =
          props.width / props.height;

        let w = maxW;
        let h = w / ratio;

        if (h > maxH) {
          h = maxH;
          w = h * ratio;
        }

        pdf.addImage(
          logo,
          this.formatoImagen(logo),
          14,
          y,
          w,
          h,
          undefined,
          'FAST'
        );
      } catch {}
    }

    pdf.setFont(
      'helvetica',
      'bold'
    );
    pdf.setFontSize(16);
    pdf.setTextColor(
      15,
      23,
      42
    );
    pdf.text(
      'REPORTE DE INCIDENCIA',
      pageW - 14,
      y + 7,
      {
        align: 'right'
      }
    );

    pdf.setFont(
      'helvetica',
      'normal'
    );
    pdf.setFontSize(8);
    pdf.setTextColor(
      100,
      116,
      139
    );
    pdf.text(
      `SIGO · Incidencia #${item.id}`,
      pageW - 14,
      y + 12,
      {
        align: 'right'
      }
    );

    y += 22;

    pdf.setDrawColor(
      37,
      99,
      235
    );
    pdf.setLineWidth(0.8);
    pdf.line(
      14,
      y,
      pageW - 14,
      y
    );

    y += 8;

    const estadoTexto =
      item.estado === 'OBSERVACION'
        ? 'EN OBSERVACIÓN'
        : 'ATENDIDO';

    const filas: Array<
      [string, string]
    > = [
      [
        'Plaza',
        item.plazaCodigo
      ],
      [
        'Turno',
        item.turnoCodigo
      ],
      [
        'Vía',
        item.viaNumero
          ? `Vía ${item.viaNumero}${item.viaNombre ? ' · ' + item.viaNombre : ''}`
          : 'Plaza general'
      ],
      [
        'Tipo',
        item.tipoNombre
      ],
      [
        'Fecha',
        item.fecha
      ],
      [
        'Hora',
        this.horaCorta(
          item.hora
        )
      ],
      [
        'Estado',
        estadoTexto
      ],
      [
        'Registrado por',
        `${item.registradoPorNombre} · Código ${item.registradoPorCodigo}`
      ]
    ];

    for (
      let i = 0;
      i < filas.length;
      i += 2
    ) {
      const izquierda =
        filas[i];

      const derecha =
        filas[i + 1];

      this.campoPdf(
        pdf,
        14,
        y,
        88,
        izquierda[0],
        izquierda[1]
      );

      if (derecha) {
        this.campoPdf(
          pdf,
          108,
          y,
          88,
          derecha[0],
          derecha[1]
        );
      }

      y += 17;
    }

    y += 3;

    pdf.setFont(
      'helvetica',
      'bold'
    );
    pdf.setFontSize(9);
    pdf.setTextColor(
      71,
      85,
      105
    );
    pdf.text(
      'DETALLE',
      14,
      y
    );

    y += 5;

    const detalleLineas =
      pdf.splitTextToSize(
        item.descripcion,
        174
      );

    const detalleH =
      Math.max(
        24,
        10 +
        detalleLineas.length * 4.4
      );

    pdf.setFillColor(
      248,
      250,
      252
    );
    pdf.setDrawColor(
      226,
      232,
      240
    );
    pdf.roundedRect(
      14,
      y,
      182,
      detalleH,
      2,
      2,
      'FD'
    );

    pdf.setFont(
      'helvetica',
      'normal'
    );
    pdf.setFontSize(9);
    pdf.setTextColor(
      51,
      65,
      85
    );
    pdf.text(
      detalleLineas,
      19,
      y + 8
    );

    y += detalleH + 9;

    if (
      item.evidencias.length
    ) {
      pdf.setFont(
        'helvetica',
        'bold'
      );
      pdf.setFontSize(9);
      pdf.setTextColor(
        71,
        85,
        105
      );
      pdf.text(
        `EVIDENCIAS (${item.evidencias.length})`,
        14,
        y
      );

      y += 6;

      const fotoW = 84;
      const fotoH = 68;
      const gapX = 8;
      const gapY = 8;

      for (
        let i = 0;
        i < item.evidencias.length;
        i++
      ) {
        if (
          y + fotoH + 14 >
          pageH
        ) {
          pdf.addPage();
          y = 18;
        }

        const col =
          i % 2;

        const x =
          14 +
          col *
          (fotoW + gapX);

        const data =
          await this.imagenDataUrl(
            item.evidencias[i]
              .urlArchivo
          );

        pdf.setFillColor(
          248,
          250,
          252
        );
        pdf.setDrawColor(
          203,
          213,
          225
        );

        pdf.roundedRect(
          x,
          y,
          fotoW,
          fotoH,
          2,
          2,
          'FD'
        );

        if (data) {
          try {
            const props =
              pdf.getImageProperties(
                data
              );

            const ratio =
              props.width /
              props.height;

            let w =
              fotoW - 4;

            let h =
              w / ratio;

            if (
              h >
              fotoH - 4
            ) {
              h =
                fotoH - 4;

              w =
                h * ratio;
            }

            const imgX =
              x +
              (fotoW - w) / 2;

            const imgY =
              y +
              (fotoH - h) / 2;

            pdf.addImage(
              data,
              this.formatoImagen(
                data
              ),
              imgX,
              imgY,
              w,
              h,
              undefined,
              'FAST'
            );
          } catch {}
        }

        if (
          col === 1 ||
          i ===
          item.evidencias.length - 1
        ) {
          y +=
            fotoH + gapY;
        }
      }
    }

    const total =
      pdf.getNumberOfPages();

    for (
      let pagina = 1;
      pagina <= total;
      pagina++
    ) {
      pdf.setPage(pagina);

      pdf.setFont(
        'helvetica',
        'normal'
      );
      pdf.setFontSize(7);
      pdf.setTextColor(
        100,
        116,
        139
      );

      pdf.text(
        'SIGO · Lima Expresa',
        14,
        pageH - 8
      );

      pdf.text(
        `Página ${pagina} de ${total}`,
        pageW - 14,
        pageH - 8,
        {
          align: 'right'
        }
      );
    }

    pdf.save(
      `incidencia-${item.id}-${item.fecha}.pdf`
    );
  }

  private campoPdf(
    pdf: jsPDF,
    x: number,
    y: number,
    w: number,
    label: string,
    value: string
  ): void {
    pdf.setFillColor(
      248,
      250,
      252
    );
    pdf.setDrawColor(
      226,
      232,
      240
    );
    pdf.roundedRect(
      x,
      y,
      w,
      14,
      2,
      2,
      'FD'
    );

    pdf.setFont(
      'helvetica',
      'bold'
    );
    pdf.setFontSize(6.5);
    pdf.setTextColor(
      100,
      116,
      139
    );
    pdf.text(
      label.toUpperCase(),
      x + 4,
      y + 4.5
    );

    pdf.setFont(
      'helvetica',
      'normal'
    );
    pdf.setFontSize(8.5);
    pdf.setTextColor(
      15,
      23,
      42
    );

    const text =
      pdf.splitTextToSize(
        value || '-',
        w - 8
      );

    pdf.text(
      text.slice(0, 2),
      x + 4,
      y + 9.5
    );
  }

  private imagenDataUrl(
    url: string
  ): Promise<string | null> {
    return fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(
            'No se pudo cargar la imagen'
          );
        }

        return response.blob();
      })
      .then(blob =>
        new Promise<string | null>(
          resolve => {
            const reader =
              new FileReader();

            reader.onload =
              () =>
                resolve(
                  typeof reader.result ===
                  'string'
                    ? reader.result
                    : null
                );

            reader.onerror =
              () =>
                resolve(null);

            reader.readAsDataURL(
              blob
            );
          }
        )
      )
      .catch(() => null);
  }

  private formatoImagen(
    dataUrl: string
  ): 'PNG' | 'JPEG' | 'WEBP' {
    if (
      dataUrl.startsWith(
        'data:image/png'
      )
    ) {
      return 'PNG';
    }

    if (
      dataUrl.startsWith(
        'data:image/webp'
      )
    ) {
      return 'WEBP';
    }

    return 'JPEG';
  }

  private formEdicionVacio():
    EditarIncidenciaForm {
    return {
      plazaId: null,
      turnoId: null,
      tipoId: null,
      viaId: null,
      fecha: '',
      hora: '',
      descripcion: ''
    };
  }

  private fechaHoy(): string {
    const now =
      new Date();

    const offset =
      now.getTimezoneOffset();

    return new Date(
      now.getTime() -
      offset * 60000
    )
      .toISOString()
      .slice(0, 10);
  }

  private primerDiaMes(): string {
    const now =
      new Date();

    const local =
      new Date(
        now.getTime() -
        now.getTimezoneOffset() *
        60000
      );

    return (
      `${local.getFullYear()}-` +
      `${String(
        local.getMonth() + 1
      ).padStart(2, '0')}-01`
    );
  }
}
