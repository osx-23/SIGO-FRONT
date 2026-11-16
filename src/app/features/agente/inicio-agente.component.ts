import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-inicio-agente',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './inicio-agente.component.html',
  styleUrl: './inicio-agente.component.css'
})
export class InicioAgenteComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly bienvenidaVisible = signal(this.auth.consumirBienvenidaAgente());
  private timerBienvenida: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.bienvenidaVisible()) {
      this.timerBienvenida = setTimeout(() => {
        this.bienvenidaVisible.set(false);
        this.timerBienvenida = null;
      }, 2800);
    }
  }

  ngOnDestroy(): void {
    if (this.timerBienvenida !== null) {
      clearTimeout(this.timerBienvenida);
      this.timerBienvenida = null;
    }
  }

  tieneOpciones(): boolean {
    return this.auth.tieneModulo('MI_HORARIO')
      || this.auth.tieneModulo('INVENTARIO')
      || this.auth.tieneModulo('RELEVOS')
      || this.auth.tieneModulo('INCIDENCIAS');
  }

  cerrarSesion(): void {
    // No se pierde la sesión si una navegación es cancelada.
    void this.router.navigateByUrl('/login').then(navegado => {
      if (navegado) this.auth.logout();
    });
  }
}
