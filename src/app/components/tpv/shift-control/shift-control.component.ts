import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { PosOperationsService } from '../../../services/pos-operations.service';

/**
 * Panel de control de turno de caja.
 * Permite al operador abrir y cerrar el turno con un fondo inicial de efectivo.
 * Se usa como modal embebido en la barra de navegación.
 */
@Component({
  selector: 'app-shift-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shift-control.component.html',
  styleUrl: './shift-control.component.css',
})
export class ShiftControlComponent {
  // Fondo inicial en efectivo al abrir turno
  openingFloat = 0;
  isLoading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly posOperationsService: PosOperationsService
  ) {}

  /** Abre un nuevo turno de caja con el fondo de apertura indicado. */
  openShift(): void {
    this.clearMessages();
    this.isLoading = true;

    this.posOperationsService
      .openShift({
        openingFloat: this.openingFloat,
        openedBy: this.authService.getCurrentUsername() ?? 'usuario',
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'Turno abierto correctamente';
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo abrir el turno');
        },
      });
  }

  /** Cierra el turno de caja activo y registra quién lo ha cerrado. */
  closeShift(): void {
    this.clearMessages();
    this.isLoading = true;

    this.posOperationsService
      .closeShift({
        closedBy: this.authService.getCurrentUsername() ?? 'usuario',
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'Turno cerrado correctamente';
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo cerrar el turno');
        },
      });
  }

  private clearMessages(): void {
    this.successMessage = null;
    this.errorMessage = null;
  }

  /** Extrae el texto del error del backend o devuelve un mensaje de respaldo. */
  private getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') {
      const raw = (error as { error?: unknown }).error;
      if (typeof raw === 'string' && raw.trim().length > 0) {
        return raw;
      }
      if (raw && typeof raw === 'object' && 'message' in raw) {
        const msg = (raw as { message?: unknown }).message;
        if (typeof msg === 'string' && msg.trim().length > 0) {
          return msg;
        }
      }
    }
    return fallback;
  }
}
