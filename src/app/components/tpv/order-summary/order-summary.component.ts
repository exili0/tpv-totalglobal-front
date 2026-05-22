import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  selectedPaymentMethod: PaymentMethod = 'CASH';
  cashReceivedAmount = 0;
  tipAmount = 0;
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
    // Si el cobro es en efectivo, mantenemos el importe entregado alineado con el total del carrito.
    this.cartSummary$.subscribe((summary) => {
      if (this.selectedPaymentMethod === 'CASH') {
        this.cashReceivedAmount = this.getGrandTotal(summary.total);
      }
    });
  }

  toggleSummary(): void {
    this.isExpanded = !this.isExpanded;
  }

  onPaymentMethodChange(method: PaymentMethod, total: number): void {
    this.selectedPaymentMethod = method;
    // En tarjeta u otros métodos no necesitamos cambio, así que normalizamos el campo al total.
    if (method === 'CASH') {
      this.cashReceivedAmount = this.getGrandTotal(total);
      return;
    }

    this.cashReceivedAmount = this.getGrandTotal(total);
  }

  getCashChange(total: number): number {
    return Math.max(0, this.cashReceivedAmount - this.getGrandTotal(total));
  }

  onTipAmountChange(value: number | string, total: number): void {
    // Sanea el valor: descarta no-numéricos y negativos, recorta a 2 decimales.
    const parsed = Number(value);
    const safeTip = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    this.tipAmount = Number(safeTip.toFixed(2));

    // Si el cobro es en efectivo, el importe entregado nunca puede bajar del nuevo total.
    if (this.selectedPaymentMethod === 'CASH') {
      this.cashReceivedAmount = Math.max(this.cashReceivedAmount, this.getGrandTotal(total));
    }
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

  /** Devuelve la propina como número finito >= 0 con 2 decimales, seguro para enviar al backend. */
  private getTipAmountSafe(): number {
    const normalized = Number.isFinite(this.tipAmount) ? this.tipAmount : 0;
    return Number(Math.max(0, normalized).toFixed(2));
  }

  /** Suma la propina al total base para obtener el importe total a cobrar. */
  private getGrandTotal(baseTotal: number): number {
    return baseTotal + this.getTipAmountSafe();
  }
}
