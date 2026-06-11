import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { CartService } from '../../../services/cart.service';
import { CartItem, CartSummary } from '../../../models/cart.model';

/**
 * Componente del carrito de compra activo en el TPV.
 * Muestra las líneas del pedido, permite modificar cantidades
 * y ofrece la acción de vaciar el carrito.
 */
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
})
export class CartComponent implements OnInit {
  // Streams reactivos del servicio para que la vista se actualice automáticamente
  cartItems$!: Observable<CartItem[]>;
  cartSummary$!: Observable<CartSummary>;
  isCartLocked$!: Observable<boolean>;

  isNoteModalOpen = false;
  editingLineId: string | null = null;
  editingProductName = '';
  noteDraft = '';

  constructor(private readonly cartService: CartService) {}

  ngOnInit(): void {
    this.cartItems$ = this.cartService.getCartItems();
    this.cartSummary$ = this.cartService.getCartSummary();
    this.isCartLocked$ = this.cartService.getCartLocked();
  }

  /** Elimina un producto del carrito por completo. */
  removeItem(lineId: string): void {
    this.cartService.removeFromCartByLine(lineId);
  }

  /** Actualiza la cantidad de un producto ya añadido. */
  updateQuantity(lineId: string, quantity: number): void {
    this.cartService.updateItemQuantityByLine(lineId, quantity);
  }

  editNote(item: CartItem): void {
    this.editingLineId = item.lineId;
    this.editingProductName = item.productName;
    this.noteDraft = item.note ?? '';
    this.isNoteModalOpen = true;
  }

  closeNoteModal(): void {
    this.isNoteModalOpen = false;
    this.editingLineId = null;
    this.editingProductName = '';
    this.noteDraft = '';
  }

  saveNote(): void {
    if (!this.editingLineId) {
      return;
    }

    this.cartService.updateItemNote(this.editingLineId, this.noteDraft.trim());
    this.closeNoteModal();
  }

  /** Vacía el carrito entero con confirmación del usuario para evitar pérdidas accidentales. */
  clearCart(): void {
    if (confirm('¿Vacías el carrito?')) {
      this.cartService.clearCart();
    }
  }
}
