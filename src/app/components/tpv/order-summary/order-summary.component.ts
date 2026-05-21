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
        this.cashReceivedAmount = summary.total;
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
      this.cashReceivedAmount = total;
      return;
    }

    this.cashReceivedAmount = total;
  }

  getCashChange(total: number): number {
    return Math.max(0, this.cashReceivedAmount - total);
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

        if (this.cashReceivedAmount < summary.total) {
          this.isProcessing = false;
          this.errorMessage = 'El importe entregado no cubre el total del ticket';
          return;
        }
      }

      // El total del ticket sigue yendo en amount; el efectivo recibido se envía aparte.
      const cashChange = this.selectedPaymentMethod === 'CASH' ? this.cashReceivedAmount - summary.total : 0;

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
              receivedAmount: this.selectedPaymentMethod === 'CASH' ? this.cashReceivedAmount : summary.total,
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
            this.cashReceivedAmount = 0;
            const username = this.authService.getCurrentUsername();
            if (this.selectedPaymentMethod === 'CASH') {
              const baseMessage = username ? `Cobro en efectivo completado por ${username}` : 'Cobro en efectivo completado';
              this.feedbackMessage = `${baseMessage}. Cambio: ${cashChange.toFixed(2)} €`;
            } else {
              this.feedbackMessage = username ? `Cobro completado por ${username}` : 'Cobro completado correctamente';
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
}
