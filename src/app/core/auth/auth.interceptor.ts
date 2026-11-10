import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();

  const api = new URL(environment.apiUrl, document.baseURI);
  const url = new URL(req.url, document.baseURI);
  const apiPath = api.pathname.replace(/\/$/, '');
  const esApi = url.origin === api.origin &&
    (url.pathname === apiPath || url.pathname.startsWith(apiPath + '/'));
  const esLogin = esApi && url.pathname === apiPath + '/auth/login';
  const outgoing = token && esApi && !esLogin
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outgoing).pipe(
    catchError(err => {
      if (esApi && err.status === 401 && !esLogin) {
        auth.logout();
        router.navigateByUrl('/login');
      }
      if (esApi && err.status === 403) {
        router.navigateByUrl('/forbidden');
      }
      return throwError(() => err);
    })
  );
};
