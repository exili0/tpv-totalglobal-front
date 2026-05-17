import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

/**
 * Componente modal para gestionar la decisión de devolución de stock.
 * Pregunta al usuario si el producto devuelto debe retornar al stock o considerarse desecho.
 */
@Component({
  selector: 'app-refund-stock-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './refund-stock-modal.component.html',
  styleUrls: ['./refund-stock-modal.component.css']
})
export class RefundStockModalComponent {
  readonly dialogRef = inject(MatDialogRef<RefundStockModalComponent>);
  readonly data = inject(MAT_DIALOG_DATA, { optional: true }) as any;

  product: any;
  quantity: number = 1;
  reason: string = '';
  returnToStock: boolean = true;

  constructor() {
    this.product = this.data?.product;
    this.quantity = this.data?.quantity || 1;
  }

  /**
   * Confirma la devolución con la opción de retornar al stock.
   */
  onConfirmReturnToStock(): void {
    this.returnToStock = true;
    this.dialogRef.close({
      returnToStock: true,
      quantity: this.quantity,
      reason: this.reason || 'Devolución - Producto retorna al stock'
    });
  }

  /**
   * Confirma la devolución sin retornar al stock (considerado desecho).
   */
  onConfirmAsWaste(): void {
    this.returnToStock = false;
    this.dialogRef.close({
      returnToStock: false,
      quantity: this.quantity,
      reason: this.reason || 'Devolución - Producto considerado desecho'
    });
  }

  /**
   * Cancela la operación de devolución.
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}


