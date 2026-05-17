import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';
import { PaymentMethod, TicketSummary } from '../../../models/pos.model';
import { PosOperationsService } from '../../../services/pos-operations.service';
import { NavbarComponent } from '../../navbar/navbar.component';

/**
 * Pantalla de historial de devoluciones.
 * Carga todos los tickets y filtra únicamente aquellos que tienen al menos
 * un importe devuelto para mostrar el historial de devoluciones realizadas.
 */
@Component({
  selector: 'app-refunds-history',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './refunds-history.component.html',
  styleUrl: './refunds-history.component.css',
})
export class RefundsHistoryComponent implements OnInit {
  tickets: TicketSummary[] = [];
  isLoading = false;
  errorMessage: string | null = null;

  constructor(private readonly posOperationsService: PosOperationsService) {}

  ngOnInit(): void {
    this.loadRefunds();
  }

  /** Obtiene todos los tickets y filtra los que tengan importe devuelto mayor a cero. */
  loadRefunds(): void {
    this.errorMessage = null;
    this.isLoading = true;

    this.posOperationsService
      .getTickets()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (tickets) => {
          this.tickets = tickets.filter((ticket) => ticket.refundedAmount > 0);
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudieron cargar las devoluciones');
        },
      });
  }

  get hasRefunds(): boolean {
    return this.tickets.length > 0;
  }

  /** Convierte el código interno del método de pago en texto legible para el usuario. */
  getPaymentMethodLabel(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      OTHER: 'Otro',
    };
    return labels[method] ?? method;
  }

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
