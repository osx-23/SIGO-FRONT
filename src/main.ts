import { bootstrapApplication } from '@angular/platform-browser';
import { inject, provideAppInitializer } from '@angular/core';
import { AuthService } from './app/core/auth/auth.service';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/auth/auth.interceptor';

bootstrapApplication(AppComponent,{
  providers:[
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Restaurar la sesión antes de que el router evalúe los guards.
    provideAppInitializer(() => inject(AuthService).restore())
  ]
}).catch(console.error);
