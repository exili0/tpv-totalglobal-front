import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { AccessibilityTheme, AccessibilityThemeService } from '../../services/accessibility-theme.service';

/**
 * Pantalla de configuración de accesibilidad visual.
 * Permite al usuario elegir un tema de daltonismo que se aplica globalmente
 * a toda la aplicación y se persiste entre sesiones.
 */
@Component({
  selector: 'app-accessibility-settings',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './accessibility-settings.component.html',
  styleUrl: './accessibility-settings.component.css'
})
export class AccessibilitySettingsComponent {

  selectedTheme: AccessibilityTheme;

  // Opciones disponibles para el selector de tema, cada una con título y descripción breve
  readonly themeOptions: Array<{ value: AccessibilityTheme; title: string; description: string }> = [
    {
      value: 'default',
      title: 'Modo estándar',
      description: 'Paleta original de la aplicación.'
    },
    {
      value: 'deuteranopia',
      title: 'Deuteranopía',
      description: 'Mejora la diferenciación para dificultades con tonos verdes.'
    },
    {
      value: 'protanopia',
      title: 'Protanopía',
      description: 'Aumenta contraste para dificultades con tonos rojos.'
    },
    {
      value: 'tritanopia',
      title: 'Tritanopía',
      description: 'Ajusta colores para dificultades con tonos azules y amarillos.'
    }
  ];

  constructor(private accessibilityThemeService: AccessibilityThemeService) {
    // Cargamos el tema guardado para que el selector muestre la selección previa
    this.selectedTheme = this.accessibilityThemeService.getSavedTheme();
  }

  /** Aplica y persiste el tema seleccionado. */
  setTheme(theme: AccessibilityTheme): void {
    this.selectedTheme = theme;
    this.accessibilityThemeService.setTheme(theme);
  }

  /** Devuelve true si el tema indicado es el actualmente activo. */
  isThemeSelected(theme: AccessibilityTheme): boolean {
    return this.selectedTheme === theme;
  }
}

