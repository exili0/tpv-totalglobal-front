import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AccessibilityThemeService } from './services/accessibility-theme.service';

/**
 * Componente raíz de la aplicación.
 * Su única responsabilidad es activar el tema de accesibilidad guardado
 * en cuanto la app arranca, antes de que se renderice cualquier vista.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'TPV_TotalGlobal';

  constructor(private accessibilityThemeService: AccessibilityThemeService) {
    // Aplicamos el tema guardado en localStorage antes de que se pinte nada
    this.accessibilityThemeService.initializeTheme();
  }
}
