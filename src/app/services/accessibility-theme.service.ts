import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type AccessibilityTheme =
  | 'default'
  | 'deuteranopia'
  | 'protanopia'
  | 'tritanopia';

@Injectable({
  providedIn: 'root'
})
export class AccessibilityThemeService {
  /**
   * Clave de persistencia de la preferencia visual.
   * Se mantiene en localStorage para que el usuario no tenga que reconfigurar
   * daltonismo cada vez que abre la aplicación.
   */
  private readonly storageKey = 'tpv_accessibility_theme';

  /**
   * Subject interno que emite cada vez que el tema cambia.
   * Usado por componentes (como el navbar) que necesitan reaccionar en tiempo real.
   */
  private readonly themeSubject = new BehaviorSubject<AccessibilityTheme>('default');

  /** Observable público del tema activo. */
  readonly currentTheme$: Observable<AccessibilityTheme> = this.themeSubject.asObservable();

  /**
   * Motor visual global de daltonismo.
   *
   * Flujo completo:
   * 1) Persistencia: guarda preferencia en localStorage
   * 2) Activación: aplica data-theme en <html>
   * 3) Render: CSS variables de :root[data-theme=...] recalculan colores
   *
   * Importante: cualquier componente que use variables CSS (en lugar de
   * colores hardcodeados) queda automáticamente cubierto por el filtro.
   */

  /**
   * Inicialización temprana del tema.
   * Esta llamada se realiza al arrancar la app para minimizar "parpadeos"
   * visuales entre el tema por defecto y el tema accesible guardado.
   */
  initializeTheme(): void {
    const savedTheme = this.getSavedTheme();
    this.applyTheme(savedTheme);
  }
  /**
   * Persiste y aplica el tema seleccionado por la persona usuaria.
   *
   * Justificación de accesibilidad:
   * - WCAG 2.2 recomienda ofrecer alternativas de presentación visual
   *   para no depender de una única codificación cromática.
   * - Guardar preferencia reduce fricción de uso para usuarios con
   *   necesidades de contraste/cromía específicas.
   */
  setTheme(theme: AccessibilityTheme): void {
    localStorage.setItem(this.storageKey, theme);
    this.applyTheme(theme);
  }
  /**
   * Recupera tema guardado con validación defensiva.
   *
   * Decisiones de robustez:
   * - Si existe una clave antigua ("colorblind"), se migra en lectura a
   *   "deuteranopia" para conservar compatibilidad hacia atrás.
   * - Si el valor no es válido o no existe, se vuelve a "default".
   */
  getSavedTheme(): AccessibilityTheme {
    const theme = localStorage.getItem(this.storageKey);

    // Compatibilidad con versiones anteriores.
    if (theme === 'colorblind') {
      return 'deuteranopia';
    }

    if (theme === 'deuteranopia' || theme === 'protanopia' || theme === 'tritanopia') {
      return theme;
    }

    return 'default';
  }

  /**
   * Aplica el tema en el root del documento mediante data-attribute.
   *
   * Razón técnica:
   * - Centraliza el cambio de variables CSS sin acoplar componentes.
   * - Permite que todo el sistema visual (botones, estados, paneles y TPV)
   *   herede automáticamente la configuración de daltonismo.
   */
  private applyTheme(theme: AccessibilityTheme): void {
    // Punto único de verdad para el tema activo.
    // Todos los estilos del sistema se encadenan desde este atributo.
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    // Notifica a los suscriptores del cambio de tema (p.ej. navbar badge).
    this.themeSubject.next(theme);
  }
}
