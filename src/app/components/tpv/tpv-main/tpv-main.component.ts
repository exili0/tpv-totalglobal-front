import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { CategoryService } from '../../../services/category.service';
import { ProductGridComponent } from '../product-grid/product-grid.component';
import { CartComponent } from '../cart/cart.component';
import { OrderSummaryComponent } from '../order-summary/order-summary.component';
import { QuantityKeypadComponent } from '../quantity-keypad/quantity-keypad.component';
import { NavbarComponent } from '../../navbar/navbar.component';
import { Category } from '../../../models/category.model';
import { CartService } from '../../../services/cart.service';
import { TableService } from '../../../services/table.service';
import { AuthService } from '../../../services/auth.service';
import { AccessibilityThemeService } from '../../../services/accessibility-theme.service';
import { CategoryColorAccessibilityService } from '../../../services/category-color-accessibility.service';

@Component({
  selector: 'app-tpv-main',
  standalone: true,
  imports: [CommonModule, ProductGridComponent, CartComponent, OrderSummaryComponent, QuantityKeypadComponent, NavbarComponent],
  templateUrl: './tpv-main.component.html',
  styleUrl: './tpv-main.component.css',
})
export class TpvMainComponent implements OnInit, OnDestroy {
  categories: Category[] = [];
  selectedCategory: Category | null = null;
  selectedTableNumber: number | null = null;
  isLoading = false;
  error: string | null = null;
  isCategoriesPanelOpen = false;

  private currentUsername: string | null = null;
  private backendSyncSubscription?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly categoryService: CategoryService,
    private readonly cartService: CartService,
    private readonly tableService: TableService,
    private readonly authService: AuthService,
    private readonly accessibilityThemeService: AccessibilityThemeService,
    private readonly categoryColorAccessibilityService: CategoryColorAccessibilityService
  ) {}

  ngOnInit(): void {
    // Comprobamos primero si el param existe: Number(null) === 0, (no es NaN),
    // por lo que sin esta guarda se reservaría la mesa 0 silenciosamente
    const param = this.route.snapshot.paramMap.get('tableNumber');
    if (!param) {
      this.router.navigate(['/tpv']);
      return;
    }
    const tableNumber = Number(param);
    // isFinite cubre también Infinity y NaN
    if (!Number.isFinite(tableNumber)) {
      this.router.navigate(['/tpv']);
      return;
    }

    const username = this.authService.getCurrentUsername();
    if (!username) {
      this.router.navigate(['/tpv']);
      return;
    }

    this.currentUsername = username;
    this.tableService.claimTable(tableNumber, username).subscribe({
      next: () => {
        this.selectedTableNumber = tableNumber;
        this.cartService.setActiveTable(tableNumber);
        // Mantiene el carrito alineado con backend si hay cambios desde otra vista
        // o por reconexiones breves.
        this.backendSyncSubscription = interval(5000).subscribe(() => {
          this.cartService.refreshActiveTableFromBackend();
        });
        this.loadRootCategories();
      },
      error: () => {
        this.router.navigate(['/tpv']);
      },
    });
  }
  // Construye un Set con los números de mesa que tienen órdenes abiertas con líneas.
  ngOnDestroy(): void {
    this.backendSyncSubscription?.unsubscribe();
    if (this.selectedTableNumber !== null && this.currentUsername) {
      // Soltamos la mesa al salir para evitar bloqueos "fantasma" de sesión.
      this.tableService.releaseTable(this.selectedTableNumber, this.currentUsername).subscribe({
        error: (error) => {
          console.error('Error liberando la mesa al salir de la vista:', error);
        },
      });
    }
  }
  ////////// Volver a selector de mesas 
  goToTables(): void {
    this.router.navigate(['/tpv']);
  }

  loadRootCategories(): void {
    this.isLoading = true;
    this.error = null;
    this.categoryService.getRootCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.isLoading = false;
      },
      error: (err) => {
        // Mensaje simple para UI y detalle en consola para depuración local.
        this.error = 'Error al cargar categorías';
        this.isLoading = false;
        console.error(err);
      },
    });
  }

  selectCategory(category: Category): void {
    this.selectedCategory = category;
    this.closeCategoriesPanel();
  }

  goBack(): void {
    this.selectedCategory = null;
  }

  toggleCategoriesPanel(): void {
    this.isCategoriesPanelOpen = !this.isCategoriesPanelOpen;
  }

  closeCategoriesPanel(): void {
    this.isCategoriesPanelOpen = false;
  }

  /**
   * Resuelve el estilo final de cada botón de categoría.
   * Si la categoría tiene color propio, se remapea según el tema de
   * daltonismo activo para mantener diferenciación.
   * 
   * Si no tiene color propio, se usa una paleta de tonos ya adaptada por CSS.
   */
  getCategoryButtonStyles(category: Category, index: number): Record<string, string> {
    const theme = this.accessibilityThemeService.getSavedTheme();

    if (category.color && category.color.trim().length > 0) {
      return {
        'background-color': this.categoryColorAccessibilityService.getDisplayColor(category.color, theme, index),
        color: 'var(--category-text-color)',
        'border-color': 'var(--category-border-color)',
      };
    }

    const toneIndex = (index % 8) + 1;
    return {
      'background-color': `var(--category-tone-${toneIndex})`,
      color: 'var(--category-text-color)',
      'border-color': 'var(--category-border-color)',
    };
  }
}
