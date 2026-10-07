import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../../core/auth/auth.service';
import { Plaza } from '../../../asistencia/models/asistencia.models';
import { AsistenciaApiService } from '../../../asistencia/services/asistencia-api.service';
import { AviAccion, AviRegistro } from '../../models/avi-registro.models';
import { AviRegistrosApiService } from '../../services/avi-registros-api.service';

@Component({
  selector: 'app-avi-placas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './avi-placas.component.html'
})
export class AviPlacasComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(AviRegistrosApiService);
  private readonly catalogos = inject(AsistenciaApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly avisoCatalogos = signal('');
  readonly registros = signal<AviRegistro[]>([]);
  readonly busqueda = signal('');
  readonly seleccionado = signal<AviRegistro | null>(null);
  readonly pagina = signal(1);
  readonly ultimaActualizacion = signal<Date | null>(null);

  readonly porPagina = 20;
  plazas: Plaza[] = [];

  desde = this.fechaHaceDias(29);
  hasta = this.fechaLocal(new Date());
  plazaId: number | null = null;
  via: number | null = null;
  accion: AviAccion | null = null;

  readonly filtrados = computed(() => {
    const texto = this.busqueda().trim().toLocaleUpperCase('es-PE');
    const datos = this.registros();
    if (!texto) return datos;
    return datos.filter(item =>
      item.placa.toLocaleUpperCase('es-PE').includes(texto) ||
      item.usuarioNombre.toLocaleUpperCase('es-PE').includes(texto) ||
      String(item.usuarioCodigo).includes(texto) ||
      item.plazaCodigo.toLocaleUpperCase('es-PE').includes(texto)
    );
  });

  readonly resumen = computed(() => {
    const datos = this.filtrados();
    return {
      total: datos.length,
      fugas: datos.filter(item => item.accion === 'FUGA').length,
      derivados: datos.filter(item => item.accion === 'DERIVADO').length
    };
  });

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.filtrados().length / this.porPagina))
  );

  readonly registrosPagina = computed(() => {
    const inicio = (this.pagina() - 1) * this.porPagina;
    return this.filtrados().slice(inicio, inicio + this.porPagina);
  });

  get esSupervisor(): boolean {
    return this.auth.tieneRol('SUPERVISOR');
  }

  ngOnInit(): void {
    if (this.esSupervisor) {
      this.catalogos.getPlazas()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: plazas => {
            this.plazas = (plazas ?? []).filter(plaza => plaza.activo !== false);
          },
          error: () => {
            this.avisoCatalogos.set('No se pudo cargar el catálogo de plazas. Puedes consultar todos los registros.');
          }
        });
    }

    // El backend aplica el alcance de la plaza y usuario según el rol.
    this.buscar();
  }

  buscar(): void {
    if (this.cargando()) return;
    this.error.set('');

    if (!this.desde || !this.hasta) {
      this.error.set('Selecciona las fechas inicial y final.');
      return;
    }
    if (this.desde > this.hasta) {
      this.error.set('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    if (this.via !== null && this.via !== undefined &&
        (!Number.isInteger(Number(this.via)) || Number(this.via) <= 0)) {
      this.error.set('La vía debe ser un número entero mayor que cero.');
      return;
    }

    const desdeIso = new Date(this.desde + 'T00:00:00').toISOString();
    const hastaIso = new Date(this.hasta + 'T23:59:59.999').toISOString();

    this.cargando.set(true);
    this.api.listar({
      desde: desdeIso,
      hasta: hastaIso,
      plazaId: this.esSupervisor ? this.plazaId : null,
      via: this.via,
      accion: this.accion
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: datos => {
          this.registros.set([...(datos ?? [])].sort((a, b) =>
            Date.parse(b.fechaHoraEvento) - Date.parse(a.fechaHoraEvento)
          ));
          this.pagina.set(1);
          this.ultimaActualizacion.set(new Date());
          this.cargando.set(false);
        },
        error: err => {
          this.cargando.set(false);
          this.registros.set([]);
          this.pagina.set(1);
          if (err.status === 0) {
            this.error.set('No se puede conectar con SIGO-BACK. Verifica que la API esté disponible.');
          } else if (err.status === 403) {
            this.error.set('No tienes permisos para consultar estos registros.');
          } else if (err.status === 401) {
            this.error.set('Tu sesión ha vencido. Vuelve a iniciar sesión.');
          } else if (typeof err.error?.message === 'string') {
            this.error.set(err.error.message);
          } else {
            this.error.set('No se pudo consultar el historial de placas AVI.');
          }
        }
      });
  }

  limpiar(): void {
    this.desde = this.fechaHaceDias(29);
    this.hasta = this.fechaLocal(new Date());
    this.plazaId = null;
    this.via = null;
    this.accion = null;
    this.busqueda.set('');
    this.buscar();
  }

  cambiarBusqueda(texto: string): void {
    this.busqueda.set(texto);
    this.pagina.set(1);
  }

  cambiarPagina(nueva: number): void {
    if (nueva >= 1 && nueva <= this.totalPaginas()) {
      this.pagina.set(nueva);
    }
  }

  abrirDetalle(registro: AviRegistro): void {
    this.seleccionado.set(registro);
  }

  cerrarDetalle(): void {
    this.seleccionado.set(null);
  }

  exportarCsv(): void {
    const datos = this.filtrados();
    if (!datos.length) return;

    const columnas = [
      'Placa', 'Acción', 'Plaza', 'Vía', 'Código de trabajador',
      'Trabajador', 'Fecha evento', 'Hora evento', 'Fecha recepción',
      'Hora recepción', 'Texto reconocido', 'UUID'
    ];
    const filas = datos.map(item => [
      item.placa, item.accion, item.plazaCodigo, item.via,
      item.usuarioCodigo, item.usuarioNombre,
      this.formatearFecha(item.fechaHoraEvento),
      this.formatearHora(item.fechaHoraEvento),
      this.formatearFecha(item.fechaHoraRecepcion),
      this.formatearHora(item.fechaHoraRecepcion),
      item.textoReconocido ?? '', item.id
    ]);

    const csv = '\uFEFF' + [columnas, ...filas]
      .map(fila => fila.map(campo => this.csvCampo(campo)).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sigo-placas-avi-' + this.fechaLocal(new Date()) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private formatearFecha(valor: string): string {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime())
      ? valor
      : fecha.toLocaleDateString('es-PE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
  }

  private formatearHora(valor: string): string {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime())
      ? valor
      : fecha.toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
  }

  private csvCampo(valor: string | number): string {
    let texto = String(valor);
    // Evita que una placa o el texto reconocido se interpreten como fórmula de hoja de cálculo.
    if (/^[=+@\-\t\r]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replace(/"/g, '""') + '"';
  }

  private fechaHaceDias(dias: number): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - dias);
    return this.fechaLocal(fecha);
  }

  private fechaLocal(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
}
