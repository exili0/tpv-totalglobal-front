import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { PosOperationsService } from '../../../services/pos-operations.service';
import { CashRegisterShift, SaleOrder } from '../../../models/pos.model';

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
  isRefreshing = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;
  currentShift: CashRegisterShift | null = null;
  pendingServices: string[] = [];

  constructor(
    private readonly authService: AuthService,
    private readonly posOperationsService: PosOperationsService
  ) {
    this.refreshOperationalState();
  }

  /** Abre un nuevo turno de caja con el fondo de apertura indicado. */
  openShift(): void {
    if (this.isShiftOpen) {
      this.errorMessage = 'Ya hay un turno de caja abierto';
      return;
    }

    this.clearMessages();
    this.isLoading = true;

    this.posOperationsService
      .openShift({
        openingFloat: this.openingFloat,
        openedBy: this.authService.getCurrentUsername() ?? 'usuario',
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (shift) => {
          this.currentShift = shift;
          this.pendingServices = [];
          this.openingFloat = 0;
          this.successMessage = 'Turno abierto correctamente';
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo abrir el turno');
        },
      });
  }

  /** Cierra el turno de caja activo y registra quién lo ha cerrado. */
  closeShift(): void {
    if (!this.isShiftOpen) {
      this.errorMessage = 'No hay un turno de caja abierto';
      return;
    }

    if (this.pendingServices.length > 0) {
      this.errorMessage = `No se puede cerrar la caja: hay servicios sin pagar (${this.pendingServices.join(', ')})`;
      return;
    }

    this.clearMessages();
    this.isLoading = true;

    this.posOperationsService
      .closeShift({
        closedBy: this.authService.getCurrentUsername() ?? 'usuario',
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.currentShift = null;
          this.pendingServices = [];
          this.successMessage = 'Turno cerrado correctamente';
          this.refreshOperationalState();
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo cerrar el turno');
          this.refreshOperationalState();
        },
      });
  }

  get isShiftOpen(): boolean {
    return this.currentShift?.status === 'OPEN';
  }

  get openedByLabel(): string {
    if (!this.currentShift?.openedBy) {
      return 'No informado';
    }
    return this.currentShift.openedBy;
  }

  get openedAtLabel(): string {
    const rawDate = this.currentShift?.openedAt;
    if (!rawDate) {
      return '-';
    }
    return new Date(rawDate).toLocaleString('es-ES');
  }

  private refreshOperationalState(): void {
    this.isRefreshing = true;

    forkJoin({
      shift: this.posOperationsService.getCurrentShift(),
      openOrders: this.posOperationsService.getOpenOrders(),
    })
      .pipe(finalize(() => (this.isRefreshing = false)))
      .subscribe({
        next: ({ shift, openOrders }) => {
          this.currentShift = shift;
          this.pendingServices = this.extractPendingServices(openOrders);
        },
        error: () => {
          this.errorMessage = 'No se pudo refrescar el estado de caja';
        },
      });
  }

  private extractPendingServices(openOrders: SaleOrder[]): string[] {
    const labels = new Set<string>();

    for (const order of openOrders) {
      if (!order.orderLines || order.orderLines.length === 0) {
        continue;
      }

      const tableNumber = order.table?.tableNumber;
      if (tableNumber === 0) {
        labels.add('Barra');
      } else if (typeof tableNumber === 'number') {
        labels.add(`Mesa ${tableNumber}`);
      } else {
        labels.add('Servicio sin mesa');
      }
    }

    return [...labels].sort((a, b) => a.localeCompare(b));
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
