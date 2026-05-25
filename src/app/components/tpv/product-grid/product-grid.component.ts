import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../../services/product.service';
import { CartService } from '../../../services/cart.service';
import { Category } from '../../../models/category.model';
import { Product } from '../../../models/product.model';
import { QuantitySelectorService } from '../../../services/quantity-selector.service';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-grid.component.html',
  styleUrl: './product-grid.component.css',
})
export class ProductGridComponent implements OnInit {
  @Input() category: Category | null = null;
  products: Product[] = [];
  isLoading = false;
  error: string | null = null;
  expandedProductIds = new Set<number>();

  constructor(
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    private readonly quantitySelectorService: QuantitySelectorService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
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
    const quantity = this.quantitySelectorService.getCurrentQuantity();
    const mode = this.quantitySelectorService.getCurrentMode();

    if (mode === 'subtract') {
      this.cartService.subtractFromCart(product, quantity);
      this.quantitySelectorService.applySelectionAndReset(); // Reseteamos cantidad a 1 y modo a 'add' tras aplicar selección
      return;
    }

    this.cartService.addToCart(product, quantity);
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
}
