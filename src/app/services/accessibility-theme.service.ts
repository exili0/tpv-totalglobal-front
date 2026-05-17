import { Injectable } from '@angular/core';

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
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
  }
}
