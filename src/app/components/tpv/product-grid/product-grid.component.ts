import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ProductService } from '../../../services/product.service';
import { CartService } from '../../../services/cart.service';
import { Category } from '../../../models/category.model';
import { Product } from '../../../models/product.model';
import { CartItem } from '../../../models/cart.model';
import { QuantitySelectorService } from '../../../services/quantity-selector.service';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-grid.component.html',
  styleUrl: './product-grid.component.css',
})
export class ProductGridComponent implements OnInit, OnDestroy {
  @Input() category: Category | null = null;
  products: Product[] = [];
  isLoading = false;
  error: string | null = null;
  expandedProductIds = new Set<number>();

  // Baseline de carrito cuando se obtuvo el snapshot de stock actual desde backend.
  private baselineCartQuantities = new Map<number, number>();
  private currentCartItems: CartItem[] = [];
  private subscriptions = new Subscription();

  constructor(
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    private readonly quantitySelectorService: QuantitySelectorService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.cartService.getCartItems().subscribe((items) => {
        this.currentCartItems = items;
      })
    );

    this.subscriptions.add(
      this.cartService.getActiveTableNumber().subscribe(() => {
        // Al cambiar de mesa, el carrito se reinicia con los productos de la nueva mesa.
        this.resetBaselineFromCurrentCart();
      })
    );

    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  ngOnChanges(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    if (!this.category?.id) {
      this.products = [];
      this.expandedProductIds.clear();
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.productService.getProductsByCategory(this.category.id).subscribe({
      next: (products) => {
        this.products = products;
        // Fijamos baseline actual para calcular delta local inmediato.
        this.resetBaselineFromCurrentCart();
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar productos';
        this.isLoading = false;
        console.error(err);
      },
    });
  }

  addToCart(product: Product): void {
    if (this.isOutOfStock(product)) {
      return;
    }

    const quantity = this.quantitySelectorService.getCurrentQuantity();
    const mode = this.quantitySelectorService.getCurrentMode();

    if (mode === 'subtract') {
      this.cartService.subtractFromCart(product, quantity);
      this.quantitySelectorService.applySelectionAndReset(); // Reseteamos cantidad a 1 y modo a 'add' tras aplicar selección
      return;
    }

    const availableStock = this.getDisplayedStock(product);
    const safeQuantity = availableStock === null ? quantity : Math.min(quantity, availableStock);

    if (safeQuantity <= 0) {
      return;
    }

    this.cartService.addToCart(product, safeQuantity);
    this.quantitySelectorService.applySelectionAndReset();
  }

  toggleDetails(productId: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.expandedProductIds.has(productId)) {
      this.expandedProductIds.delete(productId);
      return;
    }
    this.expandedProductIds.add(productId);
  }

  isExpanded(productId: number): boolean {
    return this.expandedProductIds.has(productId);
  }

  getDisplayedStock(product: Product): number | null {
    if (product.stock === undefined || product.stock === null) {
      return null;
    }

    const baselineQuantity = this.baselineCartQuantities.get(product.id) ?? 0;
    const currentQuantity = this.getCurrentCartQuantity(product.id);

    // Stock visual = stock snapshot backend + liberaciones locales - reservas locales nuevas.
    return Math.max(0, product.stock + baselineQuantity - currentQuantity);
  }

  isOutOfStock(product: Product): boolean {
    const displayedStock = this.getDisplayedStock(product);
    return displayedStock !== null && displayedStock <= 0;
  }

  private resetBaselineFromCurrentCart(): void {
    const nextBaseline = new Map<number, number>();
    for (const item of this.currentCartItems) {
      const previous = nextBaseline.get(item.productId) ?? 0;
      nextBaseline.set(item.productId, previous + item.quantity);
    }

    this.baselineCartQuantities = nextBaseline;
  }

  private getCurrentCartQuantity(productId: number): number {
    return this.currentCartItems
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }
}
