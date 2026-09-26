import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  signal
} from '@angular/core';

import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ModuloSigo } from '../../core/auth/auth.models';
import { ChatComponent } from '../../features/chat/chat.component';
import { IncidenciaApiService } from '../../features/incidencias/services/incidencia-api.service';

type GrupoMenu =
  | 'PROGRAMACION'
  | 'RELEVOS'
  | 'INCIDENCIAS'
  | 'ASISTENCIA'
  | 'INVENTARIO'
  | 'USUARIOS';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ChatComponent
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css'
})
export class MainLayoutComponent implements OnInit, OnDestroy {

  readonly sidebarOpen = signal(false);
  readonly collapsed = signal(false);
  readonly chatOpen = signal(false);

  readonly incidenciasPendientes = signal(0);

  readonly gruposAbiertos =
    signal<Set<GrupoMenu>>(
      new Set<GrupoMenu>()
    );

  readonly year =
    new Date().getFullYear();

  private timerIncidencias:
    ReturnType<typeof setInterval> | null =
    null;


  constructor(
    public auth: AuthService,
    private router: Router,
    private incidenciasApi: IncidenciaApiService
  ) {}


  /*
   * ============================================================
   * CICLO DE VIDA
   * ============================================================
   */

  ngOnInit(): void {

    this.abrirGrupoSegunRuta();

    this.actualizarIncidenciasPendientes();

    this.timerIncidencias =
      setInterval(
        () =>
          this.actualizarIncidenciasPendientes(),
        45000
      );
  }


  ngOnDestroy(): void {

    if (this.timerIncidencias) {

      clearInterval(
        this.timerIncidencias
      );

      this.timerIncidencias =
        null;
    }
  }


  /*
   * ============================================================
   * PERMISOS
   * ============================================================
   */

  has(
    modulo: ModuloSigo
  ): boolean {

    return this.auth.tieneModulo(
      modulo
    );
  }


  puedeUsarChat(): boolean {

    return (
      this.auth.tieneRol(
        'SUPERVISOR',
        'CONTROLADOR'
      ) &&
      this.auth.tieneModulo(
        'CHAT'
      )
    );
  }


  puedeVerAvisosIncidencias(): boolean {

    return (
      this.auth.tieneRol(
        'SUPERVISOR',
        'CONTROLADOR'
      ) &&
      this.auth.tieneModulo(
        'INCIDENCIAS'
      )
    );
  }


  /*
   * ============================================================
   * GRUPOS DEL SIDEBAR
   * ============================================================
   */

  grupoAbierto(
    grupo: GrupoMenu
  ): boolean {

    return this.gruposAbiertos()
      .has(grupo);
  }


  toggleGrupo(
    grupo: GrupoMenu
  ): void {

    /*
     * Si el sidebar está minimizado en escritorio,
     * lo expandimos antes de abrir el módulo.
     */
    if (
      innerWidth > 900 &&
      this.collapsed()
    ) {

      this.collapsed.set(false);

      this.abrirSoloGrupo(
        grupo
      );

      return;
    }

    const nuevos =
      new Set(
        this.gruposAbiertos()
      );

    /*
     * Accordion:
     * solo dejamos un grupo abierto.
     */
    if (
      nuevos.has(
        grupo
      )
    ) {

      nuevos.delete(
        grupo
      );

    } else {

      nuevos.clear();

      nuevos.add(
        grupo
      );
    }

    this.gruposAbiertos.set(
      nuevos
    );
  }


  private abrirSoloGrupo(
    grupo: GrupoMenu
  ): void {

    this.gruposAbiertos.set(
      new Set<GrupoMenu>([
        grupo
      ])
    );
  }


  private abrirGrupoSegunRuta(): void {

    const url =
      this.router.url;

    if (
      url.startsWith(
        '/programacion'
      )
    ) {

      this.abrirSoloGrupo(
        'PROGRAMACION'
      );

      return;
    }

    if (
      url.startsWith(
        '/relevos'
      )
    ) {

      this.abrirSoloGrupo(
        'RELEVOS'
      );

      return;
    }

    if (
      url.startsWith(
        '/incidencias'
      )
    ) {

      this.abrirSoloGrupo(
        'INCIDENCIAS'
      );

      return;
    }

    if (
      url.startsWith(
        '/asistencia'
      )
    ) {

      this.abrirSoloGrupo(
        'ASISTENCIA'
      );

      return;
    }

    if (
      url.startsWith(
        '/inventario'
      )
    ) {

      this.abrirSoloGrupo(
        'INVENTARIO'
      );

      return;
    }

    if (
      url.startsWith(
        '/usuarios'
      )
    ) {

      this.abrirSoloGrupo(
        'USUARIOS'
      );

      return;
    }

    this.gruposAbiertos.set(
      new Set<GrupoMenu>()
    );
  }


  /*
   * ============================================================
   * INCIDENCIAS
   * ============================================================
   */

  actualizarIncidenciasPendientes(): void {

    if (
      !this.puedeVerAvisosIncidencias()
    ) {

      this.incidenciasPendientes.set(
        0
      );

      return;
    }

    this.incidenciasApi
      .pendientesCount()
      .subscribe({

        next: respuesta => {

          this.incidenciasPendientes.set(
            Number(
              respuesta?.cantidad ??
              0
            )
          );
        },

        error: () => {

          this.incidenciasPendientes.set(
            0
          );
        }

      });
  }


  /*
   * ============================================================
   * CHAT
   * ============================================================
   */

  toggleChat(): void {

    if (
      !this.puedeUsarChat()
    ) {
      return;
    }

    this.chatOpen.update(
      abierto =>
        !abierto
    );
  }


  cerrarChat(): void {

    this.chatOpen.set(
      false
    );
  }


  /*
   * ============================================================
   * SIDEBAR
   * ============================================================
   */

  toggle(): void {

    if (
      innerWidth <= 900
    ) {

      this.sidebarOpen.update(
        abierto =>
          !abierto
      );

      return;
    }

    this.collapsed.update(
      colapsado =>
        !colapsado
    );
  }


  close(): void {

    if (
      innerWidth <= 900
    ) {

      this.sidebarOpen.set(
        false
      );
    }
  }


  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */

  logout(): void {

    this.chatOpen.set(
      false
    );

    this.sidebarOpen.set(
      false
    );

    this.gruposAbiertos.set(
      new Set<GrupoMenu>()
    );

    this.auth.logout();

    void this.router.navigateByUrl(
      '/login'
    );
  }


  /*
   * ============================================================
   * RESPONSIVE
   * ============================================================
   */

  @HostListener(
    'window:resize'
  )
  resize(): void {

    if (
      innerWidth > 900
    ) {

      this.sidebarOpen.set(
        false
      );
    }
  }

}