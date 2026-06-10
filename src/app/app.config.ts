import { ApplicationConfig, DEFAULT_CURRENCY_CODE, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http'; 

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

/**
 * Configuración global de la aplicación Angular.
 * Registra los proveedores principales: enrutador, cliente HTTP,
 * locale español y moneda euro.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    // Interceptor global: adjunta Authorization Bearer en cada llamada HTTP con sesión activa.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Formato de fechas y números en español
    { provide: LOCALE_ID, useValue: 'es-ES' },
    // Formato de fecha a europeo 
    { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { dateFormat: 'dd,MM,yyyy' } },
    // Moneda por defecto para el pipe currency
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'EUR' }
  ]
};
