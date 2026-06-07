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

  constructor(private readonly cartService: CartService) {}

  ngOnInit(): void {
    this.cartItems$ = this.cartService.getCartItems();
    this.cartSummary$ = this.cartService.getCartSummary();
    this.isCartLocked$ = this.cartService.getCartLocked();
  }

  /** Elimina un producto del carrito por completo. */
  removeItem(productId: number): void {
    this.cartService.removeFromCart(productId);
  }

  /** Actualiza la cantidad de un producto ya añadido. */
  updateQuantity(productId: number, quantity: number): void {
    this.cartService.updateItemQuantity(productId, quantity);
  }

  /** Vacía el carrito entero con confirmación del usuario para evitar pérdidas accidentales. */
  clearCart(): void {
    if (confirm('¿Vacías el carrito?')) {
      this.cartService.clearCart();
    }
  }
}
