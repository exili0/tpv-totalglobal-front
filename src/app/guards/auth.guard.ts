import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * `adminGuard` protege rutas de administración.
 *
 * Se usa para evitar que usuarios autenticados sin privilegios de admin
 * accedan por URL directa a pantallas sensibles de gestión.
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.getUserRole();

  if (role === 'ADMIN') {
    return true;
  }

  if (role === 'COMMON_USER') {
    router.navigate(['/user-view']);
    return false;
  }

  router.navigate(['/login']);
  return false;
};

/**
 * `userGuard` protege rutas funcionales del TPV.
 *
 * Permite acceso a ADMIN y COMMON_USER. Si no hay sesión/rol válido,
 * redirige a login para forzar autenticación.
 */
export const userGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.getUserRole();

  if (role === 'COMMON_USER' || role === 'ADMIN') {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
