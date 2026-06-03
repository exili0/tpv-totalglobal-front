import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize, first, switchMap } from 'rxjs/operators';
import { CartService } from '../../../services/cart.service';
import { CartSummary } from '../../../models/cart.model';
import { PosOperationsService } from '../../../services/pos-operations.service';
import { AuthService } from '../../../services/auth.service';
import { CreateOrderRequest, PaymentMethod } from '../../../models/pos.model';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-summary.component.html',
  styleUrl: './order-summary.component.css',
})
export class OrderSummaryComponent implements OnInit {
  cartSummary$!: Observable<CartSummary>;
  selectedTable: number | null = null;
  currentStep: 1 | 2 | 3 = 1; // 1: Resumen, 2: Método de pago, 3: Confirmación
  selectedPaymentMethod: PaymentMethod = 'CASH';
  splitPeopleCount = 1; // !! Dividir cuenta (implelmentar!!)
  cashReceivedAmount = 0;
  tipAmount = 0;
  activeAmountField: 'cash' | 'tip' = 'cash';
  notes = '';
  isExpanded = false;
  isProcessing = false;
  feedbackMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(
    private readonly cartService: CartService,
    private readonly posOperationsService: PosOperationsService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cartSummary$ = this.cartService.getCartSummary();
    this.cartService.getActiveTableNumber().subscribe((tableNumber) => {
      this.selectedTable = tableNumber;
    });
  }

  toggleSummary(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.currentStep = 1;
    }
  }

  goToStep(step: 1 | 2 | 3, total: number): void {
    if (step > 1 && !this.canContinueFromCart()) {
      return;
    }

    if (step > 2 && !this.canContinueFromPayment(total)) {
      return;
    }

    this.currentStep = step;
  }

  goToNextStep(total: number): void {
    if (this.currentStep === 1) {
      this.goToStep(2, total);
      return;
    }

    if (this.currentStep === 2) {
      this.goToStep(3, total);
    }
  }

  goToPreviousStep(): void {
    if (this.currentStep === 3) {
      this.currentStep = 2;
      return;
    }

    if (this.currentStep === 2) {
      this.currentStep = 1;
    }
  }

  canContinueFromCart(): boolean {
    return this.selectedTable !== null;
  }

  canContinueFromPayment(total: number): boolean {
    if (this.selectedPaymentMethod !== 'CASH') {
      return true;
    }

    return this.cashReceivedAmount >= this.getGrandTotal(total);
  }

  setSplitPeopleCount(value: number, _total: number): void {
    const safeValue = Number.isFinite(value) ? Math.trunc(value) : 1;
    this.splitPeopleCount = Math.max(1, safeValue);
  }

  getSplitAmount(total: number): number {
    const people = Math.max(1, this.splitPeopleCount);
    return this.roundToCents(this.getGrandTotal(total) / people);
  }

  getFinalTotal(total: number): number {
    return this.getGrandTotal(total);
  }

  onPaymentMethodChange(method: PaymentMethod, _total: number): void {
    this.selectedPaymentMethod = method;
    if (method === 'CASH') {
      this.activeAmountField = 'cash';
      return;
    }

    this.activeAmountField = 'tip';
  }

  /** Muestra importes con dos decimales para emular display de terminal de cobro. */
  formatAmountForInput(amount: number): string {
    return this.roundToCents(amount).toFixed(2).replace('.', ',');
  }

  /**
   * Captura teclado físico/numpad y aplica el mismo flujo de céntimos que el keypad táctil
   * Ejemplo: 9 -> 0,09; 0 -> 0,90; 5 -> 9,05.
   */
  onAmountKeyDown(event: KeyboardEvent, total: number, field: 'cash' | 'tip'): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    // Permitir navegación y confirmación con Tab, Shift+Tab y Enter.
    const key = event.key;
    if (key === 'Tab' || key === 'Shift' || key === 'Enter') {
      return;
    }
    // Si el campo es efectivo, solo permitirlo si el método de pago es efectivo
    if (field === 'cash' && this.selectedPaymentMethod !== 'CASH') {
      return;
    }

    this.setActiveAmountField(field);
    // Permitir solo números, Backspace, Delete, Escape y punto/coma 
    // (que se ignoran pero no bloquean para permitir escribir decimales).
    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      this.onTouchKeyPress(key, total);
      return;
    }

    if (key === 'Backspace') {
      event.preventDefault();
      this.onTouchKeyPress('⌫', total);
      return;
    }

    if (key === 'Delete' || key === 'Escape') {
      event.preventDefault();
      this.onTouchKeyPress('C', total);
      return;
    }

    if (key === '.' || key === ',') {
      event.preventDefault();
      return;
    }

    event.preventDefault();
  }

  /** Define qué campo numérico controla el keypad táctil del modal de cobro. */
  setActiveAmountField(field: 'cash' | 'tip'): void {
    if (field === 'cash' && this.selectedPaymentMethod !== 'CASH') {
      return;
    }
    this.activeAmountField = field;
  }

  /** Atajos rápidos para efectivo entregado (importe exacto y saltos habituales de caja). */
  setQuickCashAmount(total: number, increment: number): void {
    if (this.selectedPaymentMethod !== 'CASH') {
      return;
    }

    this.activeAmountField = 'cash';
    const next = increment === 0
      ? this.getGrandTotal(total)
      : this.cashReceivedAmount + increment;
    this.cashReceivedAmount = this.roundToCents(next);
  }

  /**
   * Keypad numérico táctil del modal de cobro.
   * Opera en céntimos para evitar errores de coma flotante al escribir importes.
   */
  onTouchKeyPress(key: string, total: number): void {
    const targetField = this.activeAmountField === 'cash' && this.selectedPaymentMethod !== 'CASH'
      ? 'tip'
      : this.activeAmountField;

    const current = targetField === 'cash' ? this.cashReceivedAmount : this.tipAmount;
    let cents = this.toCents(current);

    if (key === 'C') {
      cents = 0;
    } else if (key === '⌫') {
      cents = Math.trunc(cents / 10);
    } else {
      const digits = key === '00' ? [0, 0] : [Number(key)];
      for (const digit of digits) {
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
          continue;
        }
        cents = Math.min(9_999_999, cents * 10 + digit);
      }
    }

    const value = this.fromCents(cents);
    if (targetField === 'cash') {
      this.cashReceivedAmount = value;
      return;
    }

    this.onTipAmountChange(value, total);
  }

  getCashChange(total: number): number {
    return Math.max(0, this.cashReceivedAmount - this.getGrandTotal(total));
  }

  onTipAmountChange(value: number | string, _total: number): void {
    // Sanea el valor: descarta no-numéricos y negativos, recorta a 2 decimales.
    const parsed = Number(value);
    const safeTip = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    this.tipAmount = Number(safeTip.toFixed(2));
  }

  /** Redondea el importe a 2 decimales al salir del campo (evita artefactos de punto flotante). */
  roundToCents(amount: number): number {
    return Number((+amount || 0).toFixed(2));
  }

  processPayment(): void {
    this.feedbackMessage = null;
    this.errorMessage = null;

    this.cartSummary$.pipe(first()).subscribe((summary) => {
      if (summary.itemCount === 0) {
        return;
      }

      if (this.selectedTable === null) {
        this.errorMessage = 'Selecciona una mesa para poder cobrar';
        return;
      }

      const serviceLabel = this.selectedTable === 0 ? 'Barra (Mesa 0)' : `Mesa ${this.selectedTable}`;
      if (!confirm(`Cobrar pedido para ${serviceLabel} y generar ticket?`)) {
        return;
      }

      const operatorUsername = this.authService.getCurrentUsername();
      if (!operatorUsername) {
        this.errorMessage = 'No se pudo identificar el usuario actual';
        return;
      }

      this.isProcessing = true;

      if (this.selectedPaymentMethod === 'CASH') {
        // En efectivo validamos el dinero entregado antes de crear el cobro.
        if (this.cashReceivedAmount <= 0) {
          this.isProcessing = false;
          this.errorMessage = 'Introduce el importe entregado en efectivo';
          return;
        }

        if (this.cashReceivedAmount < this.getGrandTotal(summary.total)) {
          this.isProcessing = false;
          this.errorMessage = 'El importe entregado no cubre el total del ticket y propina';
          return;
        }
      }

      // El total del ticket sigue yendo en amount; el efectivo recibido se envía aparte.
      const safeTipAmount = this.getTipAmountSafe();
      const cashChange = this.selectedPaymentMethod === 'CASH'
        ? this.cashReceivedAmount - this.getGrandTotal(summary.total)
        : 0;

      const orderRequest: CreateOrderRequest = {
        tableNumber: this.selectedTable,
        items: summary.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        notes: this.notes.trim().length > 0 ? this.notes.trim() : undefined,
        operatorUsername,
        operatorSessionToken: this.authService.getSessionToken(),
      };

      this.posOperationsService
        .openOrUpdateOrder(orderRequest)
        .pipe(
          switchMap((saleOrder) =>
            this.posOperationsService.registerPayment({
              saleOrderId: saleOrder.id,
              paymentMethod: this.selectedPaymentMethod,
              amount: summary.total,
              receivedAmount: this.selectedPaymentMethod === 'CASH' ? this.cashReceivedAmount : this.getGrandTotal(summary.total),
              cashierUsername: operatorUsername,
              tipAmount: safeTipAmount,
            })
          ),
          finalize(() => {
            this.isProcessing = false;
          })
        )
        .subscribe({
          next: () => {
            this.cartService.clearCart();
            this.isExpanded = false;
            this.currentStep = 1;
            this.splitPeopleCount = 1;
            this.notes = '';
            this.tipAmount = 0;
            this.cashReceivedAmount = 0;
            const username = this.authService.getCurrentUsername();
            if (this.selectedPaymentMethod === 'CASH') {
              const baseMessage = username ? `Cobro en efectivo completado por ${username}` : 'Cobro en efectivo completado';
              const tipSuffix = safeTipAmount > 0 ? ` Propina: ${safeTipAmount.toFixed(2)} €.` : '';
              this.feedbackMessage = `${baseMessage}.${tipSuffix} Cambio: ${cashChange.toFixed(2)} €`;
            } else {
              if (username) {
                this.feedbackMessage = safeTipAmount > 0
                  ? `Cobro completado por ${username}. Propina: ${safeTipAmount.toFixed(2)} €`
                  : `Cobro completado por ${username}`;
              } else {
                this.feedbackMessage = safeTipAmount > 0
                  ? `Cobro completado correctamente. Propina: ${safeTipAmount.toFixed(2)} €`
                  : 'Cobro completado correctamente';
              }
            }
          },
          error: (error: unknown) => {
            this.errorMessage = this.getErrorMessage(error, 'No se pudo completar el cobro');
          },
        });
    });
  }
  // Devolver msj de error informativo
  // pruebas back!!! se debe quitar!!!!!!!!
  private getErrorMessage(error: unknown, fallback: string): string {
    const backendText = this.extractBackendTextError(error);
    if (backendText) {
      return backendText;
    }

    if (error instanceof HttpErrorResponse && typeof error.message === 'string') {
      if (error.message.includes('is not valid JSON') || error.message.includes('Unexpected token')) {
        return 'El backend devolvio un error en texto plano (posible stock insuficiente en el momento del cobro). Hay que ajustar el backend para responder JSON en errores.';
      }
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
  // Extrae msjs de error en texto plano que el backend podría devolver en lugar de JSON ç
  // (por ejemplo, en casos de error no controlados o excepciones).
  private extractBackendTextError(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }

    const raw = error.error;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }

    if (raw && typeof raw === 'object') {
      if ('text' in raw) {
        const text = (raw as { text?: unknown }).text;
        if (typeof text === 'string' && text.trim().length > 0) {
          return text.trim();
        }
      }

      if ('error' in raw) {
        //nested significa que el backend podría estar envolviendo el error original 
        // dentro de otra propiedad "error" 
        const nested = (raw as { error?: unknown }).error;
        if (typeof nested === 'string' && nested.trim().length > 0) {
          return nested.trim();
        }
      }
    }

    return null;
  }

  /** Devuelve la propina como número finito >= 0 con 2 decimales, seguro para enviar al backend. */
  private getTipAmountSafe(): number {
    const normalized = Number.isFinite(this.tipAmount) ? this.tipAmount : 0;
    return Number(Math.max(0, normalized).toFixed(2));
  }

  /** Suma la propina al total base para obtener el importe total a cobrar. */
  private getGrandTotal(baseTotal: number): number {
    return baseTotal + this.getTipAmountSafe();
  }

  private toCents(amount: number): number {
    return Math.max(0, Math.trunc(this.roundToCents(amount) * 100));
  }
  // Convertir a céntimos.
  private fromCents(cents: number): number {
    return this.roundToCents(cents / 100);
  }
}
