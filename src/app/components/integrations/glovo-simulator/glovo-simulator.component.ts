import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import {
  GlovoPaymentMethod,
  GlovoSimulatedOrderRequest,
  GlovoSimulationResponse,
} from '../../../models/glovo-simulator.model';
import { Product } from '../../../models/product.model';
import { AuthService } from '../../../services/auth.service';
import { GlovoSimulatorService } from '../../../services/glovo-simulator.service';
import { ProductService } from '../../../services/product.service';
import { NavbarComponent } from '../../navbar/navbar.component';

interface SimulationLine {
  productId: number | null;
  quantity: number;
}

@Component({
  selector: 'app-glovo-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './glovo-simulator.component.html',
  styleUrl: './glovo-simulator.component.css',
})
export class GlovoSimulatorComponent implements OnInit {
  products: Product[] = [];
  lines: SimulationLine[] = [{ productId: null, quantity: 1 }];

  glovoOrderId = '';
  orderCode = '';
  storeId = '';
  customerName = '';
  specialRequirements = '';
  paymentMethod: GlovoPaymentMethod = 'DELAYED';

  isLoadingProducts = false;
  isSubmitting = false;
  errorMessage: string | null = null;
  feedbackMessage: string | null = null;
  lastSimulation: GlovoSimulationResponse | null = null;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly productService: ProductService,
    private readonly glovoSimulatorService: GlovoSimulatorService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  addLine(): void {
    this.lines.push({ productId: null, quantity: 1 });
  }

  removeLine(index: number): void {
    if (this.lines.length === 1) {
      this.lines[0] = { productId: null, quantity: 1 };
      return;
    }
    this.lines.splice(index, 1);
  }

  openTickets(): void {
    this.router.navigate(['/tpv/tickets']);
  }

  submitSimulation(): void {
    this.errorMessage = null;
    this.feedbackMessage = null;
    this.lastSimulation = null;

    const operatorUsername = this.authService.getCurrentUsername();
    if (!operatorUsername) {
      this.errorMessage = 'No se pudo identificar al usuario actual para registrar el ticket.';
      return;
    }

    const validLines = this.lines
      .filter((line) => line.productId !== null)
      .map((line) => ({
        productId: line.productId as number,
        quantity: Math.max(1, Math.trunc(line.quantity || 1)),
      }));

    if (validLines.length === 0) {
      this.errorMessage = 'Añade al menos una línea de producto para simular el pedido de Glovo.';
      return;
    }

    const payload: GlovoSimulatedOrderRequest = {
      glovoOrderId: this.normalizeOptional(this.glovoOrderId),
      orderCode: this.normalizeOptional(this.orderCode),
      storeId: this.normalizeOptional(this.storeId),
      customerName: this.normalizeOptional(this.customerName),
      specialRequirements: this.normalizeOptional(this.specialRequirements),
      paymentMethod: this.paymentMethod,
      operatorUsername,
      items: validLines,
    };

    this.isSubmitting = true;
    this.glovoSimulatorService
      .simulateOrder(payload)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (response) => {
          this.lastSimulation = response;
          this.feedbackMessage = response.message;
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo simular el pedido de Glovo.');
        },
      });
  }

  getProductName(productId: number | null): string {
    if (productId === null) {
      return '-';
    }

    return this.products.find((product) => product.id === productId)?.name ?? '-';
  }

  private loadProducts(): void {
    this.isLoadingProducts = true;
    this.productService
      .getActiveProducts()
      .pipe(finalize(() => (this.isLoadingProducts = false)))
      .subscribe({
        next: (products) => {
          this.products = products;
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudieron cargar los productos activos.');
        },
      });
  }

  private normalizeOptional(value: string): string | undefined {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.readBackendMessage(error.error);
      if (backendMessage) {
        return backendMessage;
      }
    }

    return fallback;
  }

  private readBackendMessage(errorBody: unknown): string | null {
    if (typeof errorBody === 'string' && errorBody.trim().length > 0) {
      return errorBody.trim();
    }

    if (errorBody && typeof errorBody === 'object' && 'message' in errorBody) {
      const message = (errorBody as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim().length > 0) {
        return message.trim();
      }
    }

    return null;
  }
}
