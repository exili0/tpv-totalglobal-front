import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { PaymentMethod, RefundRequest, TicketDetail, TicketSummary, TipLeaderboardEntry } from '../../../models/pos.model';
import { AuthService } from '../../../services/auth.service';
import { PosOperationsService } from '../../../services/pos-operations.service';
import { NavbarComponent } from '../../navbar/navbar.component';

type RefundMode = 'FULL_TICKET' | 'PARTIAL_TICKET' | 'BY_PRODUCT';
type TicketModalMode = 'VIEW' | 'REFUND';

interface RefundValidationPayload {
  mode: RefundMode;
  amount?: number;
  saleOrderLineId?: number;
  quantity?: number;
}

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
  modalMode: TicketModalMode = 'VIEW';
  refundMode: RefundMode = 'PARTIAL_TICKET';
  refundAmount = 0;
  selectedLineId: number | null = null;
  selectedLineQuantity = 1;
  refundReason = '';
  refundReturnToStock = true;

  private refundOpeningSignature: string | null = null;
  private lastRefundFingerprint: string | null = null;
  private lastRefundIdempotencyKey: string | null = null;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly posOperationsService: PosOperationsService
  ) {}

  ngOnInit(): void {
    this.loadTickets();
  }

  goBack(): void {
    this.router.navigate(['/tpv']);
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

  openTicketDetail(ticket: TicketSummary): void {
    this.errorMessage = null;
    this.feedbackMessage = null;
    this.isLoadingDetail = true;

    this.posOperationsService
      .getTicketByPaymentId(ticket.paymentId)
      .pipe(finalize(() => (this.isLoadingDetail = false)))
      .subscribe({
        next: (detail) => {
          this.selectedTicket = detail;
          this.modalMode = 'VIEW';
          this.isModalOpen = true;
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo cargar el ticket');
        },
      });
  }

  openTicketForRefund(ticket: TicketSummary): void {
    this.errorMessage = null;
    this.feedbackMessage = null;
    this.isLoadingDetail = true;

    this.posOperationsService
      .getTicketByPaymentId(ticket.paymentId)
      .pipe(finalize(() => (this.isLoadingDetail = false)))
      .subscribe({
        next: (detail) => {
          this.selectedTicket = detail;
          this.modalMode = 'REFUND';
          this.prepareRefundDefaults(detail);
          this.isModalOpen = true;
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo cargar el ticket');
        },
      });
  }

  downloadTicket(ticket: TicketSummary): void {
    this.errorMessage = null;
    this.feedbackMessage = null;
    this.isLoadingDetail = true;

    this.posOperationsService
      .getTicketByPaymentId(ticket.paymentId)
      .pipe(finalize(() => (this.isLoadingDetail = false)))
      .subscribe({
        next: (detail) => {
          const ticketContent = this.buildTicketFileContent(detail);
          const fileDate = this.formatDateForFilename(detail.paidAt);
          const fileName = `ticket-${detail.paymentId}-${fileDate}.txt`;
          this.triggerTextDownload(fileName, ticketContent);
          this.feedbackMessage = 'Ticket descargado correctamente';
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo descargar el ticket');
        },
      });
  }

  startRefundFromSelectedTicket(): void {
    if (!this.selectedTicket) {
      return;
    }

    this.modalMode = 'REFUND';
    this.prepareRefundDefaults(this.selectedTicket);
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.modalMode = 'VIEW';
    this.selectedTicket = null;
    this.refundMode = 'PARTIAL_TICKET';
    this.refundAmount = 0;
    this.selectedLineId = null;
    this.selectedLineQuantity = 1;
    this.refundReason = '';
    this.refundReturnToStock = true;
    this.refundOpeningSignature = null;
    this.resetRefundAttemptState();
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
    if (this.isRefunding) {
      return;
    }

    if (!this.selectedTicket) {
      this.errorMessage = 'No hay ticket seleccionado';
      return;
    }
    if (this.modalMode !== 'REFUND') {
      this.errorMessage = 'Activa primero el modo de devolución';
      return;
    }

    const username = this.authService.getCurrentUsername();
    if (!username) {
      this.errorMessage = 'No se pudo identificar el usuario actual';
      return;
    }

    const reason = this.refundReason.trim();
    if (!this.refundReturnToStock && reason.length === 0) {
      this.errorMessage = 'El motivo es obligatorio cuando la devolución no regresa al stock';
      return;
    }

    const request: RefundRequest = {
      paymentId: this.selectedTicket.paymentId,
      reason: reason.length > 0 ? reason : undefined,
      refundedBy: username,
      returnToStock: this.refundReturnToStock,
    };
    const validationPayload: RefundValidationPayload = {
      mode: this.refundMode,
    };

    // Mismo endpoint, tres caminos distintos de validación.
    // Aquí concentramos reglas para que no salgan devoluciones incoherentes.
    if (this.refundMode === 'FULL_TICKET') {
      request.amount = this.selectedTicket.refundableAmount;
      validationPayload.amount = request.amount;
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
      validationPayload.amount = request.amount;
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
      validationPayload.saleOrderLineId = selectedLine.lineId;
      validationPayload.quantity = safeQty;
    }

    const idempotencyKey = this.getOrCreateIdempotencyKey(request);
    const clientAttemptAt = new Date().toISOString();
    const selectedPaymentId = this.selectedTicket.paymentId;

    this.errorMessage = null;
    this.feedbackMessage = null;
    this.isRefunding = true;

    this.posOperationsService
      .getTicketByPaymentId(selectedPaymentId)
      .pipe(
        switchMap((latestTicket) => {
          const latestSignature = this.buildRefundStateSignature(latestTicket);
          if (this.refundOpeningSignature && this.refundOpeningSignature !== latestSignature) {
            this.selectedTicket = latestTicket;
            this.prepareRefundDefaults(latestTicket);
            throw new Error('El ticket cambió mientras preparabas la devolución. Recarga y vuelve a confirmar.');
          }

          if (!this.canApplyRefundToLatestTicket(latestTicket, validationPayload)) {
            this.selectedTicket = latestTicket;
            this.prepareRefundDefaults(latestTicket);
            throw new Error('El importe o cantidad ya no está disponible. Se recargó el ticket con el estado actual.');
          }

          return this.posOperationsService.registerRefund(request, {
            idempotencyKey,
            clientAttemptAt,
          });
        }),
        switchMap(() => this.posOperationsService.getTickets()),
        finalize(() => (this.isRefunding = false))
      )
      .subscribe({
        next: (tickets) => {
          this.tickets = tickets;
          this.feedbackMessage = `Devolución registrada correctamente (ref: ${idempotencyKey.slice(0, 8)})`;
          this.closeModal();
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

  get tipLeaderboard(): TipLeaderboardEntry[] {
    const byEmployee = new Map<string, TipLeaderboardEntry>();

    for (const ticket of this.tickets) {
      const tipAmount = ticket.tipAmount ?? 0;
      const username = this.getCollectorLabel(ticket.collectedBy);
      if (tipAmount <= 0) {
        continue;
      }

      const current = byEmployee.get(username) ?? {
        username,
        totalTips: 0,
        ticketsWithTip: 0,
      };

      current.totalTips += tipAmount;
      current.ticketsWithTip += 1;
      byEmployee.set(username, current);
    }

    return Array.from(byEmployee.values())
      .sort((a, b) => b.totalTips - a.totalTips)
      .slice(0, 5);
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      OTHER: 'Otro',
    };
    return labels[method] ?? method;
  }

  getCollectorLabel(value?: string | null): string {
    if (!value || value.trim().length === 0) {
      return 'No informado';
    }
    return value;
  }

  private getSelectedLine() {
    if (!this.selectedTicket || this.selectedLineId === null) {
      return null;
    }
    return this.selectedTicket.lines.find((line) => line.lineId === this.selectedLineId) ?? null;
  }

  private prepareRefundDefaults(detail: TicketDetail): void {
    this.refundMode = 'PARTIAL_TICKET';
    // Dejamos lista la devolución parcial, que suele ser la más frecuente en caja.
    this.refundAmount = detail.refundableAmount;
    const firstRefundableLine = detail.lines.find((line) => line.refundableQuantity > 0);
    this.selectedLineId = firstRefundableLine?.lineId ?? null;
    this.selectedLineQuantity = 1;
    this.refundReason = '';
    this.refundReturnToStock = true;
    this.refundOpeningSignature = this.buildRefundStateSignature(detail);
    this.resetRefundAttemptState();
  }

  private canApplyRefundToLatestTicket(ticket: TicketDetail, payload: RefundValidationPayload): boolean {
    if (payload.mode === 'FULL_TICKET') {
      return ticket.refundableAmount > 0;
    }

    if (payload.mode === 'PARTIAL_TICKET') {
      if (typeof payload.amount !== 'number') {
        return false;
      }
      return payload.amount > 0 && payload.amount <= ticket.refundableAmount;
    }

    if (!payload.saleOrderLineId || !payload.quantity) {
      return false;
    }

    const line = ticket.lines.find((item) => item.lineId === payload.saleOrderLineId);
    if (!line) {
      return false;
    }

    return payload.quantity > 0 && payload.quantity <= line.refundableQuantity;
  }

  private buildRefundStateSignature(ticket: TicketDetail): string {
    const linesSignature = ticket.lines
      .map((line) => `${line.lineId}:${line.refundableQuantity}`)
      .sort()
      .join('|');

    return `${ticket.paymentId}:${ticket.refundableAmount}:${linesSignature}`;
  }

  private getOrCreateIdempotencyKey(request: RefundRequest): string {
    const fingerprint = JSON.stringify({
      paymentId: request.paymentId,
      saleOrderLineId: request.saleOrderLineId ?? null,
      quantity: request.quantity ?? null,
      amount: request.amount ?? null,
      reason: request.reason ?? null,
      refundedBy: request.refundedBy,
      returnToStock: request.returnToStock ?? true,
    });

    if (this.lastRefundFingerprint === fingerprint && this.lastRefundIdempotencyKey) {
      return this.lastRefundIdempotencyKey;
    }

    const generated = this.generateIdempotencyKey();
    this.lastRefundFingerprint = fingerprint;
    this.lastRefundIdempotencyKey = generated;
    return generated;
  }

  private resetRefundAttemptState(): void {
    this.lastRefundFingerprint = null;
    this.lastRefundIdempotencyKey = null;
  }

  private generateIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    const randomChunk = Math.random().toString(36).slice(2, 10);
    return `refund-${Date.now()}-${randomChunk}`;
  }

  private buildTicketFileContent(ticket: TicketDetail): string {
    const paidAtDate = new Date(ticket.paidAt);
    const paidAtLabel = Number.isNaN(paidAtDate.getTime()) ? ticket.paidAt : this.formatDateAsDdMmYyyy(paidAtDate);
    const width = 86;
    const sectionLine = this.buildReceiptSeparator(width);
    const linesHeader = this.buildReceiptTableHeader();
    const linesContent = ticket.lines.length > 0
      ? ticket.lines.map((line) => this.buildReceiptTableRow(line)).join('\n')
      : 'No hay lineas en este ticket.';

    return [
      sectionLine,
      this.centerText('TPV TOTALGLOBAL', width),
      this.centerText('TICKET', width),
      sectionLine,
      this.buildReceiptTwoColumnLine('Ticket', `#${ticket.paymentId}`, 'Servicio', ticket.serviceLabel, width),
      this.buildReceiptTwoColumnLine('Fecha cobro', paidAtLabel, 'Metodo pago', this.getPaymentMethodLabel(ticket.paymentMethod), width),
      this.buildReceiptTwoColumnLine('Cobrado por', this.getCollectorLabel(ticket.collectedBy), 'Propina', this.formatCurrency(ticket.tipAmount ?? 0), width),
      this.buildReceiptTwoColumnLine('Importe total', this.formatCurrency(ticket.totalAmount), 'Devuelto', this.formatCurrency(ticket.refundedAmount), width),
      this.buildReceiptTwoColumnLine('Pendiente devolucion', this.formatCurrency(ticket.refundableAmount), 'Notas', ticket.notes ?? '-', width),
      sectionLine,
      'LINEAS DEL TICKET',
      sectionLine,
      linesHeader,
      sectionLine,
      linesContent,
      sectionLine,
    ].join('\n');
  }

  private triggerTextDownload(fileName: string, content: string): void {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  private formatDateForFilename(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'fecha-desconocida';
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}`;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /** Formatea fecha en salida fija dd,MM,yyyy para consistencia de negocio. */
  private formatDateAsDdMmYyyy(value: Date): string {
    const day = `${value.getDate()}`.padStart(2, '0');
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const year = value.getFullYear();
    return `${day},${month},${year}`;
  }

  private buildReceiptSeparator(width: number): string {
    return '-'.repeat(width);
  }

  private centerText(text: string, width: number): string {
    const trimmed = text.trim();
    if (trimmed.length >= width) {
      return trimmed;
    }

    const leftPadding = Math.floor((width - trimmed.length) / 2);
    const rightPadding = width - trimmed.length - leftPadding;
    return `${' '.repeat(leftPadding)}${trimmed}${' '.repeat(rightPadding)}`;
  }

  private buildReceiptTwoColumnLine(
    leftLabel: string,
    leftValue: string,
    rightLabel: string,
    rightValue: string,
    width: number
  ): string {
    const leftBlockWidth = Math.floor(width / 2);
    const rightBlockWidth = width - leftBlockWidth;
    const leftBlock = this.formatReceiptField(leftLabel, leftValue, leftBlockWidth);
    const rightBlock = this.formatReceiptField(rightLabel, rightValue, rightBlockWidth);
    return `${leftBlock}${rightBlock}`;
  }

  private formatReceiptField(label: string, value: string, width: number): string {
    const prefix = `${label}: `;
    const maxValueLength = Math.max(0, width - prefix.length);
    const safeValue = value.length > maxValueLength ? `${value.slice(0, Math.max(0, maxValueLength - 3))}...` : value;
    return `${prefix}${safeValue}`.padEnd(width, ' ');
  }

  private buildReceiptTableHeader(): string {
    return [
      this.padRight('Producto', 28),
      this.padLeft('Cant.', 6),
      this.padLeft('P.Unit', 13),
      this.padLeft('Total', 13),
      this.padLeft('Dev.', 8),
      this.padLeft('Pend.', 8),
    ].join(' ');
  }

  private buildReceiptTableRow(line: TicketDetail['lines'][number]): string {
    return [
      this.padRight(line.productName, 28),
      this.padLeft(String(line.quantity), 6),
      this.padLeft(this.formatCurrency(line.unitPrice), 13),
      this.padLeft(this.formatCurrency(line.lineTotal), 13),
      this.padLeft(String(line.refundedQuantity), 8),
      this.padLeft(String(line.refundableQuantity), 8),
    ].join(' ');
  }

  private padRight(value: string, width: number): string {
    return value.length >= width ? value.slice(0, width) : value.padEnd(width, ' ');
  }

  private padLeft(value: string, width: number): string {
    return value.length >= width ? value.slice(0, width) : value.padStart(width, ' ');
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

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
