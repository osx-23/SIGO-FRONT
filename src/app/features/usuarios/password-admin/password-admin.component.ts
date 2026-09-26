import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface PlazaAdmin {
  id: number;
  codigo: string;
  descripcion?: string | null;
  activo: boolean;
}

interface PuestoAgenteAdmin {
  id: number;
  nombre: string;
}

interface TrabajadorAdmin {
  id: number;
  codigo: number;
  nombreCompleto: string;
  puesto?: {
    id: number;
    nombre: string;
  } | null;
  plaza?: {
    id: number;
    codigo: string;
    descripcion?: string | null;
  } | null;
  rolSistema: 'SUPERVISOR' | 'CONTROLADOR' | 'OPERADOR';
  requiereCambioPassword: boolean;
  activo: boolean;
}

type FiltroEstado = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';
type FiltroPlaza = 'TODAS' | number;

@Component({
  selector: 'app-password-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './password-admin.component.html',
  styleUrl: './password-admin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordAdminComponent implements OnInit {

  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly api = environment.apiUrl;

  trabajadores: TrabajadorAdmin[] = [];
  plazas: PlazaAdmin[] = [];
  puestosAgente: PuestoAgenteAdmin[] = [];

  filtro = '';
  filtroEstado: FiltroEstado = 'TODOS';
  filtroPlaza: FiltroPlaza = 'TODAS';

  cargando = false;
  guardando = false;

  error = '';
  exito = '';

  modalPassword = false;
  modalUsuario = false;
  modalNuevoAgente = false;
  modalExito = false;

  seleccionado: TrabajadorAdmin | null = null;

  passwordNueva = '';
  confirmar = '';
  exigirCambio = true;

  plazaSeleccionada: number | null = null;
  activoSeleccionado = true;

  nuevoCodigo: number | null = null;
  nuevoNombre = '';
  nuevoPuestoId: number | null = null;
  nuevaPlazaId: number | null = null;
  nuevaPassword = '12345';
  nuevaPasswordConfirmacion = '12345';

  async ngOnInit(): Promise<void> {
    await this.cargarInicial();
  }

  /*
   * ============================================================
   * FILTROS LOCALES
   * ============================================================
   *
   * La plaza se filtra desde el BACKEND.
   *
   * Estado y texto se filtran localmente porque ya trabajamos
   * sobre un conjunto mucho más pequeño de trabajadores.
   */

  get visibles(): TrabajadorAdmin[] {

    const q = this.normalizar(this.filtro);

    return this.trabajadores.filter(t => {

      const coincideEstado =
        this.filtroEstado === 'TODOS' ||
        (this.filtroEstado === 'ACTIVOS' && t.activo) ||
        (this.filtroEstado === 'INACTIVOS' && !t.activo);

      if (!coincideEstado) {
        return false;
      }

      if (!q) {
        return true;
      }

      const texto = this.normalizar([
        t.codigo,
        t.nombreCompleto,
        t.puesto?.nombre ?? '',
        t.plaza?.codigo ?? '',
        t.plaza?.descripcion ?? '',
        t.rolSistema
      ].join(' '));

      return texto.includes(q);
    });
  }

  get activos(): number {
    let total = 0;

    for (const trabajador of this.trabajadores) {
      if (trabajador.activo) {
        total++;
      }
    }

    return total;
  }

  get inactivos(): number {
    return this.trabajadores.length - this.activos;
  }

  /*
   * ============================================================
   * CARGA INICIAL
   * ============================================================
   *
   * Trabajadores y plazas se cargan en paralelo.
   */

  async cargarInicial(): Promise<void> {

    if (this.cargando) {
      return;
    }

    this.cargando = true;
    this.error = '';

    try {

      const data = await firstValueFrom(
        forkJoin({
          trabajadores: this.http.get<TrabajadorAdmin[]>(
            `${this.api}/trabajadores/admin`
          ),
          plazas: this.http.get<PlazaAdmin[]>(
            `${this.api}/plazas`
          ),
          puestos: this.http.get<PuestoAgenteAdmin[]>(
            `${this.api}/trabajadores/admin/puestos-agente`
          )
        })
      );

      this.trabajadores = data.trabajadores ?? [];
      this.puestosAgente = data.puestos ?? [];

      this.plazas = (data.plazas ?? [])
        .filter(p => p.activo)
        .sort((a, b) =>
          a.codigo.localeCompare(
            b.codigo,
            undefined,
            { numeric: true }
          )
        );

    } catch (e: any) {

      this.error = this.obtenerMensajeError(
        e,
        'No se pudieron cargar los usuarios.'
      );

    } finally {

      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  /*
   * ============================================================
   * FILTRO POR PLAZA
   * ============================================================
   *
   * TODAS:
   * GET /api/trabajadores/admin
   *
   * P4:
   * GET /api/trabajadores/admin?plazaId=4
   */

  async cambiarFiltroPlaza(): Promise<void> {

    if (this.cargando) {
      return;
    }

    await this.cargarTrabajadores();
  }

  private async cargarTrabajadores(): Promise<void> {

    this.cargando = true;
    this.error = '';

    try {

      let params = new HttpParams();

      if (this.filtroPlaza !== 'TODAS') {
        params = params.set(
          'plazaId',
          this.filtroPlaza.toString()
        );
      }

      this.trabajadores = await firstValueFrom(
        this.http.get<TrabajadorAdmin[]>(
          `${this.api}/trabajadores/admin`,
          { params }
        )
      ) ?? [];

    } catch (e: any) {

      this.error = this.obtenerMensajeError(
        e,
        'No se pudieron cargar los usuarios.'
      );

    } finally {

      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  limpiarFiltros(): void {

    const debeRecargar = this.filtroPlaza !== 'TODAS';

    this.filtro = '';
    this.filtroEstado = 'TODOS';
    this.filtroPlaza = 'TODAS';

    if (debeRecargar) {
      void this.cargarTrabajadores();
    } else {
      this.cdr.markForCheck();
    }
  }

  /*
   * ============================================================
   * NUEVO AGENTE
   * ============================================================
   */

  abrirNuevoAgente(): void {

    this.nuevoCodigo = null;
    this.nuevoNombre = '';
    this.nuevoPuestoId =
      this.puestosAgente.length === 1
        ? this.puestosAgente[0].id
        : null;
    this.nuevaPlazaId =
      this.filtroPlaza === 'TODAS'
        ? null
        : this.filtroPlaza;
    this.nuevaPassword = '12345';
    this.nuevaPasswordConfirmacion = '12345';

    this.error = '';
    this.modalNuevoAgente = true;
    this.modalUsuario = false;
    this.modalPassword = false;

    this.cdr.markForCheck();
  }

  cerrarNuevoAgente(): void {

    if (this.guardando) {
      return;
    }

    this.modalNuevoAgente = false;
    this.error = '';

    this.cdr.markForCheck();
  }

  async crearAgente(): Promise<void> {

    if (this.guardando) {
      return;
    }

    if (
      !this.nuevoCodigo ||
      this.nuevoCodigo <= 0
    ) {
      this.error =
        'Ingresa un código válido.';
      this.cdr.markForCheck();
      return;
    }

    if (
      this.nuevoNombre.trim().length < 3
    ) {
      this.error =
        'Ingresa el nombre completo del agente.';
      this.cdr.markForCheck();
      return;
    }

    if (this.nuevoPuestoId === null) {
      this.error =
        'Selecciona el puesto del agente.';
      this.cdr.markForCheck();
      return;
    }

    if (this.nuevaPlazaId === null) {
      this.error =
        'Selecciona la plaza del agente.';
      this.cdr.markForCheck();
      return;
    }

    if (
      this.nuevaPassword.trim().length < 5
    ) {
      this.error =
        'La contraseña inicial debe tener al menos 5 caracteres.';
      this.cdr.markForCheck();
      return;
    }

    if (
      this.nuevaPassword !==
      this.nuevaPasswordConfirmacion
    ) {
      this.error =
        'Las contraseñas no coinciden.';
      this.cdr.markForCheck();
      return;
    }

    this.guardando = true;
    this.error = '';

    try {

      const creado =
        await firstValueFrom(
          this.http.post<TrabajadorAdmin>(
            `${this.api}/trabajadores/admin/agentes`,
            {
              codigo: this.nuevoCodigo,
              nombreCompleto:
                this.nuevoNombre.trim(),
              puestoId:
                this.nuevoPuestoId,
              plazaId:
                this.nuevaPlazaId,
              passwordInicial:
                this.nuevaPassword
            }
          )
        );

      if (
        this.filtroPlaza === 'TODAS' ||
        creado.plaza?.id ===
          this.filtroPlaza
      ) {
        this.trabajadores = [
          creado,
          ...this.trabajadores
        ];
      }

      this.modalNuevoAgente = false;

      this.exito =
        `${creado.nombreCompleto} fue registrado como agente en ${creado.plaza?.codigo ?? 'la plaza seleccionada'}.`;

      this.modalExito = true;

    } catch (e: any) {

      this.error = this.obtenerMensajeError(
        e,
        'No se pudo registrar el nuevo agente.'
      );

    } finally {

      this.guardando = false;
      this.cdr.markForCheck();
    }
  }

  /*
   * ============================================================
   * MODAL CONTRASEÑA
   * ============================================================
   */

  abrirPassword(t: TrabajadorAdmin): void {

    if (!t.activo) {
      return;
    }

    this.seleccionado = t;

    this.passwordNueva = '';
    this.confirmar = '';
    this.exigirCambio = true;

    this.error = '';

    this.modalPassword = true;
    this.modalUsuario = false;

    this.cdr.markForCheck();
  }

  /*
   * ============================================================
   * MODAL ADMINISTRAR USUARIO
   * ============================================================
   */

  abrirUsuario(t: TrabajadorAdmin): void {

    this.seleccionado = t;

    this.plazaSeleccionada =
      t.plaza?.id ?? null;

    this.activoSeleccionado =
      t.activo;

    this.error = '';

    this.modalUsuario = true;
    this.modalPassword = false;

    this.cdr.markForCheck();
  }

  /*
   * ============================================================
   * CERRAR MODALES
   * ============================================================
   */

  cerrar(): void {

    if (this.guardando) {
      return;
    }

    this.modalPassword = false;
    this.modalUsuario = false;
    this.modalNuevoAgente = false;

    this.seleccionado = null;

    this.passwordNueva = '';
    this.confirmar = '';

    this.plazaSeleccionada = null;

    this.error = '';

    this.cdr.markForCheck();
  }

  cerrarExito(): void {

    this.modalExito = false;
    this.exito = '';

    this.cdr.markForCheck();
  }

  /*
   * ============================================================
   * GUARDAR CONTRASEÑA
   * ============================================================
   */

  async guardarPassword(): Promise<void> {

    if (!this.seleccionado || this.guardando) {
      return;
    }

    if (this.passwordNueva.trim().length < 5) {

      this.error =
        'La contraseña debe tener al menos 5 caracteres.';

      this.cdr.markForCheck();

      return;
    }

    if (this.passwordNueva !== this.confirmar) {

      this.error =
        'Las contraseñas no coinciden.';

      this.cdr.markForCheck();

      return;
    }

    const trabajador = this.seleccionado;

    this.guardando = true;
    this.error = '';

    try {

      await firstValueFrom(
        this.http.put<void>(
          `${this.api}/auth/admin/trabajadores/${trabajador.id}/password`,
          {
            passwordNueva: this.passwordNueva,
            exigirCambioAlIngresar: this.exigirCambio
          }
        )
      );

      /*
       * No volvemos a consultar todos los trabajadores.
       * Actualizamos únicamente el registro modificado.
       */

      this.trabajadores = this.trabajadores.map(t =>
        t.id === trabajador.id
          ? {
              ...t,
              requiereCambioPassword: this.exigirCambio
            }
          : t
      );

      this.modalPassword = false;
      this.seleccionado = null;

      this.passwordNueva = '';
      this.confirmar = '';

      this.exito =
        `Contraseña actualizada correctamente para ${trabajador.nombreCompleto}.`;

      this.modalExito = true;

    } catch (e: any) {

      this.error = this.obtenerMensajeError(
        e,
        'No se pudo actualizar la contraseña.'
      );

    } finally {

      this.guardando = false;
      this.cdr.markForCheck();
    }
  }

  /*
   * ============================================================
   * GUARDAR PLAZA / ESTADO
   * ============================================================
   */

  async guardarUsuario(): Promise<void> {

    if (!this.seleccionado || this.guardando) {
      return;
    }

    if (this.plazaSeleccionada === null) {

      this.error =
        'Selecciona una plaza.';

      this.cdr.markForCheck();

      return;
    }

    const trabajadorAnterior =
      this.seleccionado;

    this.guardando = true;
    this.error = '';

    try {

      const actualizado =
        await firstValueFrom(
          this.http.put<TrabajadorAdmin>(
            `${this.api}/trabajadores/admin/${trabajadorAnterior.id}`,
            {
              plazaId: this.plazaSeleccionada,
              activo: this.activoSeleccionado
            }
          )
        );

      /*
       * Si estamos viendo TODAS las plazas, simplemente
       * reemplazamos el trabajador.
       *
       * Si estamos filtrando una plaza y el trabajador se
       * cambió a otra, debe desaparecer de esta lista.
       */

      if (
        this.filtroPlaza !== 'TODAS' &&
        actualizado.plaza?.id !== this.filtroPlaza
      ) {

        this.trabajadores =
          this.trabajadores.filter(
            t => t.id !== actualizado.id
          );

      } else {

        this.trabajadores =
          this.trabajadores.map(t =>
            t.id === actualizado.id
              ? actualizado
              : t
          );
      }

      const nombre =
        actualizado.nombreCompleto;

      const plaza =
        actualizado.plaza?.codigo ??
        'Sin plaza';

      const estado =
        actualizado.activo
          ? 'Activo'
          : 'Inactivo';

      this.modalUsuario = false;
      this.seleccionado = null;

      this.exito =
        `${nombre} actualizado correctamente: ${plaza} · ${estado}.`;

      this.modalExito = true;

    } catch (e: any) {

      this.error = this.obtenerMensajeError(
        e,
        'No se pudo actualizar el usuario.'
      );

    } finally {

      this.guardando = false;
      this.cdr.markForCheck();
    }
  }

  /*
   * ============================================================
   * UTILIDADES
   * ============================================================
   */

  private normalizar(valor: unknown): string {

    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private obtenerMensajeError(
    error: any,
    mensajeDefecto: string
  ): string {

    if (typeof error?.error === 'string') {
      return error.error;
    }

    return (
      error?.error?.message ??
      error?.error?.error ??
      error?.message ??
      mensajeDefecto
    );
  }
}