import { ApplicationConfig, DEFAULT_CURRENCY_CODE, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http'; 

import { routes } from './app.routes';

/**
 * Configuración global de la aplicación Angular.
 * Registra los proveedores principales: enrutador, cliente HTTP,
 * locale español y moneda euro.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideHttpClient(withFetch()),
    // Formato de fechas y números en español
    { provide: LOCALE_ID, useValue: 'es-ES' },
    // Moneda por defecto para el pipe currency
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'EUR' }
  ]
};
