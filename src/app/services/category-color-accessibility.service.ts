import { Injectable } from '@angular/core';
import { AccessibilityTheme } from './accessibility-theme.service';

@Injectable({
  providedIn: 'root'
})
export class CategoryColorAccessibilityService {
  /**
   * Paletas por tema para remapear tonos y mejorar separación visual
   * en distintos tipos de daltonismo.
   *
   * Diseño de la paleta:
   * - Se evita depender del par rojo/verde puro por su alta ambigüedad en
   *   protanopia/deuteranopia.
   * - Se priorizan tonos espaciados para favorecer diferenciación por matiz.
   * - Se combina con ajustes de saturación/luminosidad (no solo hue) para
   *   mantener distinción incluso cuando el matiz se percibe peor.
   */
  private readonly paletteByTheme: Record<Exclude<AccessibilityTheme, 'default'>, number[]> = {
    deuteranopia: [210, 35, 165, 265, 320, 120, 235, 20],
    protanopia: [205, 30, 170, 260, 15, 125, 225, 55],
    tritanopia: [195, 28, 155, 245, 340, 135, 220, 62]
  };

  /**
   * Convierte un color original a un color de visualización accesible.
   * Mantiene contraste percibido y distribuye tonos por índice
   *
   * Enfoque aplicado:
   * 1) Normalizar color de entrada y convertir de HEX a HSL
   * 2) Sustituir el matiz (Hue) por uno de una paleta predefinida según tema
   * 3) Reescalar saturación y luminosidad para evitar extremos poco legibles
   * 4) Convertir de vuelta a HEX y devolver para pintado en CSS
   *
   * - Esta estrategia es heurística y determinista (misma entrada -> misma salida)
   * - Está alineada con recomendaciones WCAG de no depender del color como único
   *   canal informativo y de reforzar contraste/luminancia en elementos UI
   */
  getDisplayColor(hexColor: string | null | undefined, theme: AccessibilityTheme, index = 0): string {
    // Color estable de respaldo para casos inválidos.
    const fallback = '#3d5a80';

    // Sanitiza entrada para evitar estados inesperados.
    const safeHex = this.normalizeHex(hexColor) ?? fallback;

    // En modo estándar no alteramos color original.
    if (theme === 'default') {
      return safeHex;
    }

    // Trabajamos en HSL por ser más interpretable para desplazar tono y controlar
    // intensidad de color de forma separada.
    const hsl = this.hexToHsl(safeHex);
    if (!hsl) {
      return fallback;
    }

    const palette = this.paletteByTheme[theme];

    // Índice base de paleta para distribuir categorías vecinas en tonos distintos.
    const paletteHue = palette[Math.abs(index) % palette.length];

    // Cuantiza el matiz original en bloques para conservar cierto orden relativo
    // entre colores de entrada (evita reasignación totalmente aleatoria)
    const hueByOriginal = Math.floor(hsl.h / 45) % palette.length;

    // Selección final de tono combinando bloque original + índice de posición
    const targetHue = palette[(hueByOriginal + index) % palette.length] ?? paletteHue;

    // Reescalado conservador para mantener legibilidad:
    // - Saturación: evita colores lavados y también sobresaturación agresiva.
    // - Luminosidad: evita tonos demasado oscuros o demasiado claros.
    const saturation = this.clamp(Math.round((hsl.s * 0.65) + 30), 52, 85);
    const lightness = this.clamp(Math.round((hsl.l * 0.8) + 12), 36, 62);

    return this.hslToHex(targetHue, saturation, lightness);
  }

  /**
   * Acepta solo formato HEX completo #RRGGBB para simplificar y evitar
   * ambigüedades entre notaciones cortas/extendidas.
   */
  private normalizeHex(color: string | null | undefined): string | null {
    if (!color) {
      return null;
    }

    const trimmed = color.trim();
    const hexRegex = /^#([0-9a-fA-F]{6})$/;
    return hexRegex.test(trimmed) ? trimmed : null;
  }

  /**
   * Conversión estándar RGB -> HSL.
   * Permite separar matemáticamente:
   * - h: tono
   * - s: saturación
   * - l: luminosidad
   * 
   * Esto funciona para que podamos modificar el tono sin afectar la percepción de brillo o intensidad del color, 
   * super importante para mantener la accesibilidad visual en distintos temas de daltonismo.
   */
  private hexToHsl(hex: string): { h: number; s: number; l: number } | null {
    const rgb = this.hexToRgb(hex);
    if (!rgb) {
      return null;
    }

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs((2 * l) - 1));


    // Cálculo del matiz basado en qué canal es el dominante (el más alto).
    if (delta !== 0) {
      if (max === r) {
        h = 60 * (((g - b) / delta) % 6);
      } else if (max === g) {
        h = 60 * (((b - r) / delta) + 2);
      } else {
        h = 60 * (((r - g) / delta) + 4);
      }
    }

    if (h < 0) {
      h += 360;
    }

    return {
      h: Math.round(h),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  /**
   * Conversión directa de #RRGGBB a canales enteros RGB.
   * (#RRGGBB es el formato de color hexadecimal estándar en CSS, donde RR, GG y BB son valores hexadecimales que representan la intensidad de rojo, verde y azul respectivamente).
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) {
      return null;
    }

    const r = Number.parseInt(normalized.substring(0, 2), 16);
    const g = Number.parseInt(normalized.substring(2, 4), 16);
    const b = Number.parseInt(normalized.substring(4, 6), 16);

    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return null;
    }

    return { r, g, b };
  }

  /**
   * Conversión HSL -> HEX para entregar un valor CSS compatible
   * con todo el sistema visual de Angular.
   */
  private hslToHex(h: number, s: number, l: number): string {
    const normalizedS = s / 100;
    const normalizedL = l / 100;
    const c = (1 - Math.abs((2 * normalizedL) - 1)) * normalizedS;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = normalizedL - (c / 2);

    let rPrime = 0;
    let gPrime = 0;
    let bPrime = 0;

    if (h >= 0 && h < 60) {
      rPrime = c;
      gPrime = x;
    } else if (h >= 60 && h < 120) {
      rPrime = x;
      gPrime = c;
    } else if (h >= 120 && h < 180) {
      gPrime = c;
      bPrime = x;
    } else if (h >= 180 && h < 240) {
      gPrime = x;
      bPrime = c;
    } else if (h >= 240 && h < 300) {
      rPrime = x;
      bPrime = c;
    } else {
      rPrime = c;
      bPrime = x;
    }

    const r = Math.round((rPrime + m) * 255);
    const g = Math.round((gPrime + m) * 255);
    const b = Math.round((bPrime + m) * 255);

    return `#${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`;
  }

  /**
   * Convierte un canal [0..255] a notación hexadecimal de 2 dígitos
   * Esto se usa para que el resultado sea valido como color CSS (rgb)
   */
  private toHex(value: number): string {
    return this.clamp(value, 0, 255).toString(16).padStart(2, '0');
  }

  /**
   * Limita valores a un rango para evitar salidas fuera de la gama visual útil
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
