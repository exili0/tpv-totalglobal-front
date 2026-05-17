import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { PaymentMethod, RefundRequest, TicketDetail, TicketSummary } from '../../../models/pos.model';
import { AuthService } from '../../../services/auth.service';
import { PosOperationsService } from '../../../services/pos-operations.service';
import { NavbarComponent } from '../../navbar/navbar.component';

type RefundMode = 'FULL_TICKET' | 'PARTIAL_TICKET' | 'BY_PRODUCT';

@Component({
  selector: 'app-tickets-history',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './tickets-history.component.html',
  styleUrl: './tickets-history.component.css',
})
export class TicketsHistoryComponent implements OnInit {
  tickets: TicketSummary[] = [];
  selectedTicket: TicketDetail | null = null;

  isLoading = false;
  isLoadingDetail = false;
  isRefunding = false;

  errorMessage: string | null = null;
  feedbackMessage: string | null = null;

  isModalOpen = false;
  refundMode: RefundMode = 'PARTIAL_TICKET';
  refundAmount = 0;
  selectedLineId: number | null = null;
  selectedLineQuantity = 1;
  refundReason = '';

  constructor(
    private readonly authService: AuthService,
    private readonly posOperationsService: PosOperationsService
  ) {}

  ngOnInit(): void {
    this.loadTickets();
  }

  loadTickets(): void {
    this.errorMessage = null;
    this.feedbackMessage = null;
    this.isLoading = true;

    this.posOperationsService
      .getTickets()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (tickets) => {
          this.tickets = tickets;
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudieron cargar los tickets');
        },
      });
  }

  openTicket(ticket: TicketSummary): void {
    this.errorMessage = null;
    this.feedbackMessage = null;
    this.isLoadingDetail = true;

    this.posOperationsService
      .getTicketByPaymentId(ticket.paymentId)
      .pipe(finalize(() => (this.isLoadingDetail = false)))
      .subscribe({
        next: (detail) => {
          this.selectedTicket = detail;
          this.refundMode = 'PARTIAL_TICKET';
          // Al abrir, dejamos preparada la devolución más común (importe parcial)
          // para evitar pasos extra al cajero.
          this.refundAmount = detail.refundableAmount;
          const firstRefundableLine = detail.lines.find((line) => line.refundableQuantity > 0);
          // Si hay líneas devolvibles, preseleccionamos la primera para acelerar
          // la devolución por producto.
          this.selectedLineId = firstRefundableLine?.lineId ?? null;
          this.selectedLineQuantity = 1;
          this.refundReason = '';
          this.isModalOpen = true;
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo cargar el ticket');
        },
      });
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedTicket = null;
    this.refundMode = 'PARTIAL_TICKET';
    this.refundAmount = 0;
    this.selectedLineId = null;
    this.selectedLineQuantity = 1;
    this.refundReason = '';
  }

  setRefundMode(mode: RefundMode): void {
    this.refundMode = mode;
    if (!this.selectedTicket) return;

    if (mode === 'FULL_TICKET') {
      this.refundAmount = this.selectedTicket.refundableAmount;
      return;
    }

    if (mode === 'PARTIAL_TICKET') {
      // Protegemos el importe por si venimos de un estado anterior con un valor inválido.
      this.refundAmount = Math.min(this.refundAmount || 0, this.selectedTicket.refundableAmount);
      return;
    }

    const selectedLine = this.getSelectedLine();
    if (!selectedLine) {
      const firstRefundableLine = this.selectedTicket.lines.find((line) => line.refundableQuantity > 0);
      this.selectedLineId = firstRefundableLine?.lineId ?? null;
      this.selectedLineQuantity = 1;
      return;
    }

    this.selectedLineQuantity = Math.min(this.selectedLineQuantity, selectedLine.refundableQuantity);
  }

  onSelectedLineChange(): void {
    const selectedLine = this.getSelectedLine();
    if (!selectedLine) {
      this.selectedLineQuantity = 1;
      return;
    }

    this.selectedLineQuantity = Math.max(1, Math.min(this.selectedLineQuantity, selectedLine.refundableQuantity));
  }

  registerRefund(): void {
    if (!this.selectedTicket) {
      this.errorMessage = 'No hay ticket seleccionado';
      return;
    }

    const username = this.authService.getCurrentUsername();
    if (!username) {
      this.errorMessage = 'No se pudo identificar el usuario actual';
      return;
    }

    const request: RefundRequest = {
      paymentId: this.selectedTicket.paymentId,
      reason: this.refundReason.trim().length > 0 ? this.refundReason.trim() : undefined,
      refundedBy: username,
    };

    // Mismo endpoint, tres caminos distintos de validación.
    // Aquí concentramos reglas para que no salgan devoluciones incoherentes.
    if (this.refundMode === 'FULL_TICKET') {
      request.amount = this.selectedTicket.refundableAmount;
    } else if (this.refundMode === 'PARTIAL_TICKET') {
      if (this.refundAmount <= 0) {
        this.errorMessage = 'El importe de la devolución debe ser mayor que cero';
        return;
      }
      if (this.refundAmount > this.selectedTicket.refundableAmount) {
        this.errorMessage = 'La devolución no puede superar el importe pendiente';
        return;
      }
      request.amount = this.refundAmount;
    } else {
      const selectedLine = this.getSelectedLine();
      if (!selectedLine) {
        this.errorMessage = 'Selecciona un producto para la devolución parcial';
        return;
      }

      const safeQty = Math.trunc(this.selectedLineQuantity);
      if (safeQty <= 0) {
        this.errorMessage = 'La cantidad a devolver debe ser mayor que cero';
        return;
      }
      if (safeQty > selectedLine.refundableQuantity) {
        this.errorMessage = 'La cantidad supera lo pendiente de devolución para ese producto';
        return;
      }

      request.saleOrderLineId = selectedLine.lineId;
      request.quantity = safeQty;
    }

    this.errorMessage = null;
    this.feedbackMessage = null;
    this.isRefunding = true;

    this.posOperationsService
      .registerRefund(request)
      .pipe(finalize(() => (this.isRefunding = false)))
      .subscribe({
        next: () => {
          this.feedbackMessage = 'Devolución registrada correctamente';
          // Recargamos listado para reflejar importes pendientes ya recalculados.
          this.closeModal();
          this.loadTickets();
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo registrar la devolución');
        },
      });
  }

  get canRefundByProduct(): boolean {
    if (!this.selectedTicket) return false;
    return this.selectedTicket.lines.some((line) => line.refundableQuantity > 0);
  }

  getSelectedLineMaxQuantity(): number {
    return this.getSelectedLine()?.refundableQuantity ?? 1;
  }

  get hasTickets(): boolean {
    return this.tickets.length > 0;
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      OTHER: 'Otro',
    };
    return labels[method] ?? method;
  }

  private getSelectedLine() {
    if (!this.selectedTicket || this.selectedLineId === null) {
      return null;
    }
    return this.selectedTicket.lines.find((line) => line.lineId === this.selectedLineId) ?? null;
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
