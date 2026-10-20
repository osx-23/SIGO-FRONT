import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal
} from '@angular/core';

import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  forkJoin,
  Observable,
  of,
  switchMap
} from 'rxjs';

import {
  AuthService
} from '../../../../core/auth/auth.service';

import {
  Plaza,
  Turno
} from '../../../asistencia/models/asistencia.models';

import {
  AsistenciaApiService
} from '../../../asistencia/services/asistencia-api.service';

import {
  ImageCropperModalComponent
} from '../../../asistencia/shared/image-cropper-modal.component';

import {
  ElementoRelevo,
  EstadoOperativo,
  RelevoRequest,
  RelevoResponse,
  RelevoSesion,
  Via
} from '../../models/relevo.models';

import {
  RelevoApiService
} from '../../services/relevo-api.service';


/* ============================================================
   INTERFACES
   ============================================================ */

interface ArchivoPreview {
  file: File;
  url: string;
}

interface CropTarget {
  tipo: 'checklist' | 'via';
  index: number;
}


/* ============================================================
   COMPONENTE
   ============================================================ */

@Component({
  selector: 'app-relevo-nuevo',
  standalone: true,

  imports: [
    CommonModule,
    ReactiveFormsModule,
    ImageCropperModalComponent
  ],

  templateUrl: './relevo-nuevo.component.html',
  styleUrl: './relevo-nuevo.component.css'
})
export class RelevoNuevoComponent implements OnInit, OnDestroy {

  /* ==========================================================
     DEPENDENCIAS
     ========================================================== */

  private readonly fb =
    inject(FormBuilder);

  readonly auth =
    inject(AuthService);

  private readonly relevoApi =
    inject(RelevoApiService);

  private readonly asistenciaApi =
    inject(AsistenciaApiService);


  /* ==========================================================
     ESTADOS
     ========================================================== */

  readonly cargando =
    signal(false);

  readonly cargandoVias =
    signal(false);

  readonly guardando =
    signal(false);

  readonly sesion = signal<RelevoSesion | null>(null);
  readonly ultimoFinalizado = signal<RelevoSesion | null>(null);
  readonly recuperandoSesion = signal(true);
  readonly iniciandoSesion = signal(false);
  readonly guardandoAvance = signal(false);
  readonly anulandoSesion = signal(false);
  readonly confirmarFinalizacion = signal(false);
  readonly confirmarAnulacion = signal(false);


  readonly mensaje =
    signal('');

  readonly error =
    signal('');


  /* ==========================================================
     CROPPER
     ========================================================== */

  readonly cropperVisible =
    signal(false);

  readonly cropperFile =
    signal<File | null>(null);

  readonly cropTarget =
    signal<CropTarget | null>(null);


  /* ==========================================================
     CATÁLOGOS
     ========================================================== */

  plazas: Plaza[] = [];

  turnos: Turno[] = [];

  elementos: ElementoRelevo[] = [];

  viasDisponibles: Via[] = [];


  /* ==========================================================
     FOTOS
     ========================================================== */

  readonly archivosChecklist =
    new Map<number, ArchivoPreview[]>();

  readonly archivosVias =
    new Map<number, ArchivoPreview[]>();


  /* ==========================================================
     ESTADOS OPERATIVOS
     ========================================================== */

  readonly estados: {
    value: EstadoOperativo;
    label: string;
  }[] = [

    {
      value: 'OPERATIVO',
      label: 'Operativo'
    },

    {
      value: 'OBSERVADO',
      label: 'Observado'
    },

    {
      value: 'NO_OPERATIVO',
      label: 'No operativo'
    }

  ];


  /* ==========================================================
     FORMULARIO
     ========================================================== */

  readonly form = this.fb.group({

    plazaId:
      this.fb.control<number | null>(
        null,
        Validators.required
      ),

    turnoId:
      this.fb.control<number | null>(
        null,
        Validators.required
      ),

    fecha:
      this.fb.control(
        this.fechaHoy(),
        Validators.required
      ),

    hora:
      this.fb.control(
        this.horaActual(),
        Validators.required
      ),

    checklist:
      this.fb.array<FormGroup>([]),

    vias:
      this.fb.array<FormGroup>([]),

    observaciones:
      this.fb.control(''),

    resumen:
      this.fb.control('')

  });


  /* ==========================================================
     GETTERS
     ========================================================== */

  get checklist(): FormArray<FormGroup> {
    return this.form.controls.checklist;
  }

  get vias(): FormArray<FormGroup> {
    return this.form.controls.vias;
  }


  /* ==========================================================
     INIT
     ========================================================== */

  ngOnInit(): void {

    this.cargarDatos();


    /*
     * Cuando SUPERVISOR o CONTROLADOR cambien la plaza,
     * cargamos las vías correspondientes.
     */
    this.form.controls.plazaId
      .valueChanges
      .subscribe(plazaId => {

        if (!plazaId) {

          this.viasDisponibles = [];

          this.vias.clear();

          return;
        }


        /*
         * El operador no necesita reaccionar a un selector
         * porque su plaza es fija.
         */
        if (!this.puedeSeleccionarPlaza()) {
          return;
        }


        this.cargarVias(
          Number(plazaId)
        );

      });

  }


  ngOnDestroy(): void {

    this.archivosChecklist
      .forEach(
        items =>
          this.liberarPreviews(items)
      );


    this.archivosVias
      .forEach(
        items =>
          this.liberarPreviews(items)
      );

  }


  /* ==========================================================
     ROLES
     ========================================================== */

  puedeSeleccionarPlaza(): boolean {

    const usuario =
      this.auth.usuario();


    const rol =
      String(
        usuario?.rol ?? ''
      )
        .trim()
        .toUpperCase();


    return (
      rol === 'SUPERVISOR' ||
      rol === 'CONTROLADOR'
    );

  }


  esOperador(): boolean {

    const rol =
      String(
        this.auth.usuario()?.rol ?? ''
      )
        .trim()
        .toUpperCase();


    return rol === 'OPERADOR';

  }


  /* ==========================================================
     PLAZA SELECCIONADA
     ========================================================== */

  plazaSeleccionada(): Plaza | undefined {

    const plazaId =
      Number(
        this.form.controls
          .plazaId
          .value ?? 0
      );


    return this.plazas.find(
      plaza =>
        Number(plaza.id) ===
        plazaId
    );

  }


  plazaSeleccionadaTexto(): string {

    const plaza =
      this.plazaSeleccionada();


    if (plaza) {

      return plaza.descripcion
        ? `${plaza.codigo} · ${plaza.descripcion}`
        : plaza.codigo;

    }


    return (
      this.auth.usuario()?.plaza ??
      'Sin plaza'
    );

  }


  /* ==========================================================
     ELEMENTOS
     ========================================================== */

  elementosCategoria(
    categoria:
      | 'BASE_OPERATIVA'
      | 'PLAZA_PEAJE'
  ): {
    elemento: ElementoRelevo;
    index: number;
  }[] {

    return this.elementos

      .map(
        (elemento, index) => ({
          elemento,
          index
        })
      )

      .filter(
        item =>
          item.elemento.categoria ===
          categoria
      );

  }


  /* ==========================================================
     FOTOS
     ========================================================== */

  fotosChecklist(
    index: number
  ): ArchivoPreview[] {

    return (
      this.archivosChecklist.get(index) ??
      []
    );

  }


  fotosVia(
    index: number
  ): ArchivoPreview[] {

    return (
      this.archivosVias.get(index) ??
      []
    );

  }


  seleccionarFotosChecklist(
    index: number,
    event: Event
  ): void {

    this.abrirCropper(
      'checklist',
      index,
      event
    );

  }


  seleccionarFotosVia(
    index: number,
    event: Event
  ): void {

    this.abrirCropper(
      'via',
      index,
      event
    );

  }


  /* ==========================================================
     CROPPER
     ========================================================== */

  onCropperConfirm(
    file: File
  ): void {

    const target =
      this.cropTarget();


    if (!target) {
      return;
    }


    const store =
      target.tipo === 'checklist'
        ? this.archivosChecklist
        : this.archivosVias;


    const actuales =
      store.get(target.index) ??
      [];


    if (
      actuales.length >= 5
    ) {

      this.error.set(
        'Puedes adjuntar como máximo 5 fotografías por elemento.'
      );

      this.cerrarCropper();

      return;

    }


    store.set(
      target.index,
      [
        ...actuales,
        {
          file,
          url:
            URL.createObjectURL(file)
        }
      ]
    );


    this.cerrarCropper();

  }


  onCropperCancel(): void {

    this.cerrarCropper();

  }


  quitarFotoChecklist(
    index: number,
    fotoIndex: number
  ): void {

    this.quitarArchivo(
      this.archivosChecklist,
      index,
      fotoIndex
    );

  }


  quitarFotoVia(
    index: number,
    fotoIndex: number
  ): void {

    this.quitarArchivo(
      this.archivosVias,
      index,
      fotoIndex
    );

  }


  /* ==========================================================
     REGISTRAR
     ========================================================== */


  iniciarRelevo(): void {
    if (this.iniciandoSesion() || this.sesion()) return;
    const plazaId = Number(this.form.controls.plazaId.value);
    const turnoId = Number(this.form.controls.turnoId.value);
    if (!plazaId || !turnoId) {
      this.error.set('Selecciona una plaza y un turno para iniciar el relevo.');
      return;
    }
    this.iniciandoSesion.set(true);
    this.error.set('');
    this.relevoApi.iniciarSesion(plazaId, turnoId).subscribe({
      next: sesion => {
        this.asignarSesion(sesion);
        this.iniciandoSesion.set(false);
        this.mensaje.set('Relevo iniciado. La hora de inicio quedó registrada.');
      },
      error: err => {
        this.iniciandoSesion.set(false);
        this.error.set(err?.error?.message ?? 'No fue posible iniciar el relevo.');
      }
    });
  }

  guardarAvanceRelevo(): void {
    const sesion = this.sesion();
    if (!sesion || this.guardandoAvance()) return;
    this.guardandoAvance.set(true);
    this.error.set('');
    this.relevoApi.guardarAvanceSesion(sesion.id, JSON.stringify(this.form.getRawValue())).subscribe({
      next: guardada => {
        this.sesion.set(guardada);
        this.guardandoAvance.set(false);
        this.mensaje.set('Avance guardado. Las fotografías se enviarán al finalizar el relevo.');
      },
      error: err => {
        this.guardandoAvance.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo guardar el avance.');
      }
    });
  }

  solicitarFinalizacion(): void {
    if (!this.sesion() || this.guardando()) return;
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.cargandoVias()) {
      this.error.set('Completa los campos del relevo antes de finalizar.');
      return;
    }
    this.confirmarFinalizacion.set(true);
  }

  solicitarAnulacion(): void {
    if (this.sesion() && !this.anulandoSesion()) {
      this.confirmarAnulacion.set(true);
    }
  }

  anularRelevo(): void {
    const actual = this.sesion();
    if (!actual || this.anulandoSesion()) return;
    this.anulandoSesion.set(true);
    this.relevoApi.anularSesion(actual.id).subscribe({
      next: () => {
        this.anulandoSesion.set(false);
        this.confirmarAnulacion.set(false);
        this.sesion.set(null);
        this.limpiarFormulario();
        this.mensaje.set('La sesión fue anulada; puedes iniciar un relevo nuevo.');
      },
      error: err => {
        this.anulandoSesion.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo anular la sesión.');
      }
    });
  }

  formatearMomento(valor: string | null): string {
    if (!valor) return 'Pendiente';
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(valor));
  }

  private asignarSesion(sesion: RelevoSesion): void {
    this.sesion.set(sesion);
    const momento = new Date(sesion.iniciadoEn);
    const partes = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(momento);
    const campo = (nombre: string) => partes.find(parte => parte.type === nombre)?.value ?? '';
    const fecha = `${campo('year')}-${campo('month')}-${campo('day')}`;
    const hora = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(momento);
    this.form.patchValue({
      plazaId: sesion.plazaId,
      turnoId: sesion.turnoId,
      fecha,
      hora
    }, { emitEvent: false });
    if (Number(this.viasDisponibles[0]?.plazaId ?? sesion.plazaId) !== sesion.plazaId
      || !this.vias.length) {
      this.cargarVias(sesion.plazaId, true);
    }
    this.restaurarBorrador();
  }

  private recuperarSesion(): void {
    this.recuperandoSesion.set(true);
    this.relevoApi.sesionActual().subscribe({
      next: sesion => {
        this.recuperandoSesion.set(false);
        if (sesion) {
          this.asignarSesion(sesion);
          this.mensaje.set('Se recuperó el relevo en proceso. Puedes continuar donde lo dejaste.');
        }
      },
      error: err => {
        this.recuperandoSesion.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo recuperar el relevo en proceso.');
      }
    });
  }

  private restaurarBorrador(): void {
    const guardado = this.sesion()?.borrador;
    if (!guardado || !this.checklist.length) return;
    try {
      const data = JSON.parse(guardado) as {
        observaciones?: string; resumen?: string;
        checklist?: Array<{ elementoId: number; estado: EstadoOperativo; detalle: string; cantidad: number | null }>;
        vias?: Array<{ viaId: number; estado: EstadoOperativo; detalle: string }>;
      };
      this.form.patchValue({
        observaciones: data.observaciones ?? '',
        resumen: data.resumen ?? ''
      }, { emitEvent: false });
      const items = new Map((data.checklist ?? []).map(item => [Number(item.elementoId), item]));
      for (const control of this.checklist.controls) {
        const item = items.get(Number(control.get('elementoId')?.value));
        if (item) control.patchValue(item);
      }
      const vias = new Map((data.vias ?? []).map(item => [Number(item.viaId), item]));
      for (const control of this.vias.controls) {
        const item = vias.get(Number(control.get('viaId')?.value));
        if (item) control.patchValue(item);
      }
    } catch {
      this.error.set('Se recuperó el relevo, pero el avance guardado no se pudo interpretar.');
    }
  }

  registrar(): void {
    if (!this.sesion() || !this.confirmarFinalizacion()) return;
    this.confirmarFinalizacion.set(false);

    this.mensaje.set('');
    this.error.set('');


    this.form.markAllAsTouched();


    const usuario =
      this.auth.usuario();


    if (!usuario?.trabajadorId) {

      this.error.set(
        'Tu usuario no tiene un trabajador asociado.'
      );

      return;

    }


    const plazaId =
      Number(
        this.form.controls
          .plazaId
          .value ?? 0
      );


    if (!plazaId) {

      this.error.set(
        'Debes seleccionar una plaza.'
      );

      return;

    }


    if (this.form.invalid) {

      this.error.set(
        'Revisa los campos obligatorios y los detalles de los ítems observados/no operativos.'
      );

      return;

    }


    const raw =
      this.form.getRawValue();


    /* ========================================================
       REQUEST

       IMPORTANTE:
       Ahora enviamos plazaId del formulario.
       ======================================================== */

    const request:
      RelevoRequest = {

      plazaId,

      turnoId:
        Number(
          raw.turnoId
        ),

      operadorId:
        usuario.trabajadorId,

      fecha:
        String(
          raw.fecha
        ),

      hora:
        String(
          raw.hora
        ),


      checklist:

        this.checklist.controls
          .map(
            control => ({

              elementoId:
                Number(
                  control
                    .get('elementoId')
                    ?.value
                ),

              estado:
                control
                  .get('estado')
                  ?.value as EstadoOperativo,

              detalle:
                this.textoONull(
                  control
                    .get('detalle')
                    ?.value
                ),

              cantidad:
                control
                  .get('cantidad')
                  ?.value === null

                  ? null

                  : Number(
                      control
                        .get('cantidad')
                        ?.value
                    )

            })
          ),


      vias:

        this.vias.controls
          .map(
            control => ({

              viaId:
                Number(
                  control
                    .get('viaId')
                    ?.value
                ),

              estado:
                control
                  .get('estado')
                  ?.value as EstadoOperativo,

              detalle:
                this.textoONull(
                  control
                    .get('detalle')
                    ?.value
                )

            })
          ),


      observaciones:
        this.textoONull(
          raw.observaciones
        ),


      resumen:
        this.textoONull(
          raw.resumen
        )

    };


    this.guardando.set(true);


    const sesionActual = this.sesion()!;

    this.relevoApi
      .finalizarSesion(sesionActual.id, request)
      .pipe(
        switchMap(finalizada => {
          this.ultimoFinalizado.set(finalizada);
          this.sesion.set(null);
          return this.relevoApi.obtener(finalizada.relevoId!).pipe(
            switchMap(relevo => this.subirEvidencias(relevo))
          );
        })
      )

      .subscribe({

        next: relevo => {

          this.guardando.set(false);


          this.mensaje.set(
            `Relevo #${relevo.id} finalizado correctamente.`
          );


          this.limpiarFormulario();

        },


        error: err => {

          this.guardando.set(false);


          this.error.set(
            this.ultimoFinalizado()
              ? 'El relevo se finalizó, pero hubo un problema al cargar alguna fotografía. Revisa el historial para verificar las evidencias.'
              : (err?.error?.message ?? 'No se pudo finalizar el relevo.')
          );

        }

      });

  }


  /* ==========================================================
     CARGA INICIAL
     ========================================================== */

  private cargarDatos(): void {

    const usuario =
      this.auth.usuario();


    if (!usuario) {

      this.error.set(
        'No se pudo obtener la información del usuario.'
      );

      return;

    }


    /*
     * El operador sí necesita plaza asignada.
     */
    if (
      !this.puedeSeleccionarPlaza() &&
      !usuario.plazaId
    ) {

      this.error.set(
        'Tu usuario no tiene una plaza asignada.'
      );

      return;

    }


    this.cargando.set(true);


    /*
     * getCatalogos() ya nos entrega plazas y turnos.
     */
    forkJoin({

      catalogos:
        this.asistenciaApi
          .getCatalogos(),

      elementos:
        this.relevoApi
          .getElementos()

    }).subscribe({

      next: ({
        catalogos,
        elementos
      }) => {

        /* ====================================================
           PLAZAS
           ==================================================== */

        this.plazas =
          [...(catalogos.plazas ?? [])]

            .filter(
              plaza =>
                plaza.activo !== false
            )

            .sort(
              (a, b) =>
                String(a.codigo)
                  .localeCompare(
                    String(b.codigo),
                    undefined,
                    {
                      numeric: true
                    }
                  )
            );


        /* ====================================================
           TURNOS
           ==================================================== */

        this.turnos =
          catalogos.turnos ??
          [];


        /* ====================================================
           ELEMENTOS
           ==================================================== */

        this.elementos =
          [...(elementos ?? [])]

            .filter(
              item =>
                item.activo !== false
            )

            .sort(
              (a, b) =>

                a.categoria === b.categoria

                  ? (
                      (a.orden ?? 0) -
                      (b.orden ?? 0)
                    )

                  : a.categoria
                      .localeCompare(
                        b.categoria
                      )
            );


        this.construirChecklist();


        /* ====================================================
           PLAZA INICIAL
           ==================================================== */

        if (
          this.puedeSeleccionarPlaza()
        ) {

          /*
           * Supervisor / Controlador:
           *
           * Si tiene plaza asignada, la dejamos como
           * selección inicial.
           *
           * Si no tiene, dejamos null para que elija.
           */
          if (
            usuario.plazaId &&
            this.plazas.some(
              plaza =>
                Number(plaza.id) ===
                Number(usuario.plazaId)
            )
          ) {

            this.form.controls
              .plazaId
              .setValue(
                Number(
                  usuario.plazaId
                ),
                {
                  emitEvent: false
                }
              );


            this.cargarVias(
              Number(
                usuario.plazaId
              ),
              true
            );

          } else {

            this.form.controls
              .plazaId
              .setValue(
                null,
                {
                  emitEvent: false
                }
              );


            this.viasDisponibles = [];
            this.vias.clear();

            this.cargando.set(false);

          }

        } else {

          /*
           * OPERADOR:
           *
           * Siempre utilizamos su plaza asignada.
           */
          this.form.controls
            .plazaId
            .setValue(
              Number(
                usuario.plazaId
              ),
              {
                emitEvent: false
              }
            );


          this.cargarVias(
            Number(
              usuario.plazaId
            ),
            true
          );

        }

        this.recuperarSesion();

      },


      error: () => {

        this.recuperandoSesion.set(false);
        this.cargando.set(false);


        this.error.set(
          'No se pudieron cargar plazas, turnos o elementos para el relevo.'
        );

      }

    });

  }


  /* ==========================================================
     CARGAR VÍAS POR PLAZA
     ========================================================== */

  private cargarVias(
    plazaId: number,
    cargaInicial = false
  ): void {

    /*
     * Antes de cambiar de plaza eliminamos las imágenes
     * asociadas a las vías anteriores.
     */
    this.limpiarFotosVias();


    this.viasDisponibles = [];

    this.vias.clear();


    if (!plazaId) {

      if (cargaInicial) {
        this.cargando.set(false);
      }

      return;

    }


    this.cargandoVias.set(true);


    this.relevoApi
      .getVias(plazaId)
      .subscribe({

        next: vias => {
          if (Number(this.form.controls.plazaId.value) !== plazaId) return;

          this.viasDisponibles =
            [...(vias ?? [])]

              .filter(
                item =>
                  item.activa !== false
              )

              .sort(
                (a, b) =>
                  (
                    a.orden ??
                    a.numero ??
                    0
                  )
                  -
                  (
                    b.orden ??
                    b.numero ??
                    0
                  )
              );


          this.construirVias();
          if (this.sesion()?.borrador) this.restaurarBorrador();

          this.cargandoVias.set(false);


          if (cargaInicial) {
            this.cargando.set(false);
          }

        },


        error: () => {

          this.viasDisponibles = [];

          this.vias.clear();


          this.cargandoVias.set(false);


          if (cargaInicial) {
            this.cargando.set(false);
          }


          this.error.set(
            'No se pudieron cargar las vías de la plaza seleccionada.'
          );

        }

      });

  }


  /* ==========================================================
     CHECKLIST
     ========================================================== */

  private construirChecklist(): void {

    this.checklist.clear();


    this.elementos
      .forEach(
        elemento => {

          const group =
            this.fb.group({

              elementoId:
                this.fb.control(
                  elemento.id,
                  Validators.required
                ),

              estado:
                this.fb.control<EstadoOperativo>(
                  'OPERATIVO',
                  Validators.required
                ),

              detalle:
                this.fb.control(''),

              cantidad:
                this.fb.control<number | null>(
                  elemento.requiereCantidad
                    ? 0
                    : null,

                  elemento.requiereCantidad
                    ? [
                        Validators.required,
                        Validators.min(0)
                      ]
                    : []
                )

            });


          group
            .get('estado')
            ?.valueChanges
            .subscribe(
              () =>
                this.actualizarDetalle(
                  group
                )
            );


          this.checklist.push(
            group
          );

        }
      );

  }


  /* ==========================================================
     VÍAS
     ========================================================== */

  private construirVias(): void {

    this.vias.clear();


    this.viasDisponibles
      .forEach(
        via => {

          const group =
            this.fb.group({

              viaId:
                this.fb.control(
                  via.id,
                  Validators.required
                ),

              estado:
                this.fb.control<EstadoOperativo>(
                  'OPERATIVO',
                  Validators.required
                ),

              detalle:
                this.fb.control('')

            });


          group
            .get('estado')
            ?.valueChanges
            .subscribe(
              () =>
                this.actualizarDetalle(
                  group
                )
            );


          this.vias.push(
            group
          );

        }
      );

  }


  /* ==========================================================
     VALIDACIÓN DETALLE
     ========================================================== */

  private actualizarDetalle(
    group: FormGroup
  ): void {

    const estado =
      group
        .get('estado')
        ?.value as EstadoOperativo;


    const detalle =
      group
        .get('detalle');


    if (
      estado === 'OPERATIVO'
    ) {

      detalle?.clearValidators();

    } else {

      detalle?.setValidators([
        Validators.required,
        Validators.minLength(3)
      ]);

    }


    detalle
      ?.updateValueAndValidity({
        emitEvent: false
      });

  }


  /* ==========================================================
     ABRIR CROPPER
     ========================================================== */

  private abrirCropper(
    tipo: 'checklist' | 'via',
    index: number,
    event: Event
  ): void {

    const input =
      event.target as HTMLInputElement;


    const file =
      input.files?.[0];


    input.value = '';


    if (!file) {
      return;
    }


    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp'
      ].includes(file.type)
    ) {

      this.error.set(
        'Solo se permiten imágenes JPG, PNG o WEBP.'
      );

      return;

    }


    if (
      file.size >
      10 * 1024 * 1024
    ) {

      this.error.set(
        'Cada fotografía debe pesar como máximo 10 MB.'
      );

      return;

    }


    const store =
      tipo === 'checklist'
        ? this.archivosChecklist
        : this.archivosVias;


    if (
      (
        store.get(index) ??
        []
      ).length >= 5
    ) {

      this.error.set(
        'Puedes adjuntar como máximo 5 fotografías por elemento.'
      );

      return;

    }


    this.cropTarget.set({
      tipo,
      index
    });


    this.cropperFile.set(
      file
    );


    this.cropperVisible.set(
      true
    );

  }


  private cerrarCropper(): void {

    this.cropperVisible.set(
      false
    );

    this.cropperFile.set(
      null
    );

    this.cropTarget.set(
      null
    );

  }


  /* ==========================================================
     QUITAR ARCHIVO
     ========================================================== */

  private quitarArchivo(
    store: Map<number, ArchivoPreview[]>,
    index: number,
    fotoIndex: number
  ): void {

    const items =
      [
        ...(store.get(index) ?? [])
      ];


    const eliminado =
      items.splice(
        fotoIndex,
        1
      )[0];


    if (eliminado) {

      URL.revokeObjectURL(
        eliminado.url
      );

    }


    store.set(
      index,
      items
    );

  }


  /* ==========================================================
     LIMPIAR FOTOS DE VÍAS
     ========================================================== */

  private limpiarFotosVias(): void {

    this.archivosVias
      .forEach(
        items =>
          this.liberarPreviews(items)
      );


    this.archivosVias.clear();

  }


  /* ==========================================================
     SUBIR EVIDENCIAS
     ========================================================== */

  private subirEvidencias(
    relevo: RelevoResponse
  ): Observable<RelevoResponse> {

    const uploads:
      Observable<unknown>[] = [];


    relevo.checklist
      .forEach(
        (item, index) => {

          for (
            const preview of
            this.archivosChecklist.get(index) ??
            []
          ) {

            uploads.push(

              this.relevoApi
                .subirEvidenciaChecklist(
                  item.id,
                  preview.file
                )

            );

          }

        }
      );


    relevo.vias
      .forEach(
        (item, index) => {

          for (
            const preview of
            this.archivosVias.get(index) ??
            []
          ) {

            uploads.push(

              this.relevoApi
                .subirEvidenciaVia(
                  item.id,
                  preview.file
                )

            );

          }

        }
      );


    if (!uploads.length) {

      return of(
        relevo
      );

    }


    return forkJoin(
      uploads
    )
      .pipe(
        switchMap(
          () =>
            of(relevo)
        )
      );

  }


  /* ==========================================================
     LIMPIAR FORMULARIO
     ========================================================== */

  private limpiarFormulario(): void {
    this.confirmarAnulacion.set(false);
    this.confirmarFinalizacion.set(false);

    this.archivosChecklist
      .forEach(
        items =>
          this.liberarPreviews(items)
      );


    this.archivosVias
      .forEach(
        items =>
          this.liberarPreviews(items)
      );


    this.archivosChecklist.clear();
    this.archivosVias.clear();


    this.form.patchValue({

      turnoId: null,

      fecha:
        this.fechaHoy(),

      hora:
        this.horaActual(),

      observaciones: '',

      resumen: ''

    });


    this.construirChecklist();


    const plazaId =
      Number(
        this.form.controls
          .plazaId
          .value ?? 0
      );


    if (plazaId) {

      this.cargarVias(
        plazaId
      );

    } else {

      this.viasDisponibles = [];

      this.vias.clear();

    }

  }


  /* ==========================================================
     HELPERS
     ========================================================== */

  private liberarPreviews(
    items: ArchivoPreview[]
  ): void {

    items.forEach(
      item =>
        URL.revokeObjectURL(
          item.url
        )
    );

  }


  private textoONull(
    value: unknown
  ): string | null {

    const text =
      String(
        value ?? ''
      ).trim();


    return text || null;

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
      .slice(
        0,
        10
      );

  }


  private horaActual(): string {

    const now =
      new Date();


    return [

      String(
        now.getHours()
      ).padStart(
        2,
        '0'
      ),

      String(
        now.getMinutes()
      ).padStart(
        2,
        '0'
      )

    ].join(':');

  }

}