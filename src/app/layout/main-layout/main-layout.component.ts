import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ModuloSigo } from '../../core/auth/auth.models';
import { ChatComponent } from '../../features/chat/chat.component';
import { IncidenciaApiService } from '../../features/incidencias/services/incidencia-api.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ChatComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css'
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  sidebarOpen = signal(false);
  collapsed = signal(false);
  chatOpen = signal(false);
  incidenciasPendientes = signal(0);
  year = new Date().getFullYear();

  private timerIncidencias: ReturnType<typeof setInterval> | null = null;

  constructor(
    public auth: AuthService,
    private router: Router,
    private incidenciasApi: IncidenciaApiService
  ) {}

  ngOnInit(): void {
    this.actualizarIncidenciasPendientes();
    this.timerIncidencias = setInterval(
      () => this.actualizarIncidenciasPendientes(),
      45000
    );
  }

  ngOnDestroy(): void {
    if (this.timerIncidencias) clearInterval(this.timerIncidencias);
  }

  has(m: ModuloSigo) {
    return this.auth.tieneModulo(m);
  }

  puedeUsarChat() {
    return this.auth.tieneRol('SUPERVISOR', 'CONTROLADOR') && this.auth.tieneModulo('CHAT');
  }

  puedeVerAvisosIncidencias() {
    return this.auth.tieneRol('SUPERVISOR', 'CONTROLADOR') && this.auth.tieneModulo('INCIDENCIAS');
  }

  actualizarIncidenciasPendientes(): void {
    if (!this.puedeVerAvisosIncidencias()) {
      this.incidenciasPendientes.set(0);
      return;
    }

    this.incidenciasApi.pendientesCount().subscribe({
      next: r => this.incidenciasPendientes.set(Number(r?.cantidad ?? 0)),
      error: () => this.incidenciasPendientes.set(0)
    });
  }

  toggleChat() {
    if (this.puedeUsarChat()) this.chatOpen.update(v => !v);
  }

  cerrarChat() {
    this.chatOpen.set(false);
  }

  toggle() {
    innerWidth <= 900
      ? this.sidebarOpen.update(v => !v)
      : this.collapsed.update(v => !v);
  }

  close() {
    if (innerWidth <= 900) this.sidebarOpen.set(false);
  }

  logout() {
    this.chatOpen.set(false);
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  @HostListener('window:resize')
  resize() {
    if (innerWidth > 900) this.sidebarOpen.set(false);
  }
}
