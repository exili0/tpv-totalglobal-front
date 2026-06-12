import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, catchError, interval, of, startWith, switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { OperationalModalService } from '../../services/operational-modal.service';
import { AccessibilityThemeService } from '../../services/accessibility-theme.service';
import { ShiftControlComponent } from '../tpv/shift-control/shift-control.component';
import { DailyZReportComponent } from '../tpv/daily-z-report/daily-z-report.component';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';

/**
 * Barra de navegación principal de la aplicación.
 * Muestra el menú lateral, la tarjeta del usuario y los modales de turno/reporte Z.
 * Se usa como cabecera en todas las vistas que requieren navegación.
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, ShiftControlComponent, DailyZReportComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  private static readonly LOW_STOCK_THRESHOLD = 30;   // Cantidad de stock por debajo de la cual se considera que un producto tiene stock bajo
  private static readonly LOW_STOCK_POLLING_MS = 30000; // Frecuencia de comprobación de stock bajo (30 segundos)

  // Controla si el menú lateral está abierto (pasado desde el padre en algunos contextos)
  @Input() isMenuOpen = false;
  // Permite que el backdrop del menú sea transparente en ciertas vistas
  @Input() transparentBackdrop = false;

  isUserCardOpen = false;
  isShiftModalOpen = false;
  isZReportModalOpen = false;
  isLowStockModalOpen = false;
  lowStockProducts: Product[] = [];
  lowStockAlertCount = 0;
  hasLowStockNotification = false;
  zReportPresetDate: string | null = null;
  currentUserName = '';
  currentUserRole = '';
  /** true cuando hay un tema de daltonismo activo (no 'default'). */
  isAccessibilityThemeActive = false;
  private modalRequestSubscription?: Subscription;
  private themeSubscription?: Subscription;
  private lowStockSubscription?: Subscription; 
  private lastLowStockIds = new Set<number>();

  constructor(
    private router: Router,
    private authService: AuthService,
    private operationalModalService: OperationalModalService,
    private accessibilityThemeService: AccessibilityThemeService,
    private productService: ProductService
  ) { }

  ngOnInit(): void {
    // Cargamos los datos del usuario autenticado para mostrarlos en la tarjeta de usuario
    this.currentUserName = this.authService.getCurrentUsername() || 'Usuario';
    this.currentUserRole = this.authService.getUserRole() || 'Rol';

    this.modalRequestSubscription = this.operationalModalService.zReportRequests$.subscribe((dateIso) => {
      this.openZReportModal(dateIso);
    });

    // Escucha cambios de tema para activar/desactivar el badge de accesibilidad.
    this.themeSubscription = this.accessibilityThemeService.currentTheme$.subscribe((theme) => {
      this.isAccessibilityThemeActive = theme !== 'default';
    });

    this.startLowStockMonitoring(); // inicia la monitorización de stock bajo al cargar el componente
  }

  ngOnDestroy(): void {
    this.modalRequestSubscription?.unsubscribe();
    this.themeSubscription?.unsubscribe();
    this.lowStockSubscription?.unsubscribe();
  }

  toggleMenu(): void { this.isMenuOpen = !this.isMenuOpen; }
  closeMenu(): void { this.isMenuOpen = false; }
  toggleUserCard(): void { this.isUserCardOpen = !this.isUserCardOpen; }

  /** Devuelve el nombre del usuario activo tal como está guardado en sesión. */
  get displayUserName(): string { return this.currentUserName; }

  /** Transforma el rol interno (ADMIN/COMMON_USER) en texto legible para la UI. */
  get displayUserRole(): string {
    return this.currentUserRole === 'ADMIN' ? 'Administrador' : 'Usuario Común';
  }

  /** Comprueba si el usuario actual tiene rol ADMIN para mostrar/ocultar opciones del menú. */
  get isAdmin(): boolean {
    return this.authService.getUserRole() === 'ADMIN';
  }

  goToHome(): void {
    this.closeMenu();
    this.router.navigate(['/tpv']);
  }

  goToTPV(): void {
    this.closeMenu();
    this.router.navigate(['/tpv']);
  }

  /** Redirige al panel de inicio según el rol: admin-view o user-view. */
  goToRoleView(): void {
    this.closeMenu();
    if (this.isAdmin) {
      this.router.navigate(['/admin-view']);
      return;
    }
    this.router.navigate(['/user-view']);
  }

  goToAdminCategories(): void {
    this.closeMenu();
    this.router.navigate(['/admin/categories']);
  }

  goToAdminProducts(): void {
    this.closeMenu();
    this.router.navigate(['/admin/products']);
  }

  goToUsersManagement(): void {
    this.closeMenu();
    this.router.navigate(['/admin/users']);
  }

  goToShiftProfits(): void {
    this.closeMenu();
    this.router.navigate(['/admin/shift-profits']);
  }

  gotoRestorePassword(): void {
    this.closeMenu();
    // si el usuario ya estaba en una ruta protegida, lo redirigimos de vuelta a esa ruta tras restaurar la contraseña
    const currentUrl = this.router.url.split('?')[0];
    const returnTo = currentUrl && currentUrl !== '/login' ? currentUrl : '/login';
    this.router.navigate(['/restorePassword'], { queryParams: { returnTo } });
  }

  goToAccessibility(): void {
    this.closeMenu();
    this.router.navigate(['/accesibilidad']);
  }

  /** Abre el modal de control de turno de caja y cierra el de reporte Z si estaba abierto. */
  openShiftModal(): void {
    this.closeMenu();
    this.isShiftModalOpen = true;
    this.isZReportModalOpen = false;
  }

  /** Abre el modal del cierre Z diario y cierra el de turno si estaba abierto. */
  openZReportModal(dateIso?: string): void {
    this.closeMenu();
    this.zReportPresetDate = dateIso ?? null;
    this.isZReportModalOpen = true;
    this.isShiftModalOpen = false;
  }

  openZAfterShiftClose(dateIso: string): void {
    this.openZReportModal(dateIso);
  }

  openLowStockModal(): void {
    this.closeMenu();
    this.isLowStockModalOpen = true;
    this.isShiftModalOpen = false;
    this.isZReportModalOpen = false;
    this.hasLowStockNotification = false;
  }

  goToRefunds(): void {
    this.closeMenu();
    this.router.navigate(['/tpv/devoluciones']);
  }

  goToTickets(): void {
    this.closeMenu();
    this.router.navigate(['/tpv/tickets']);
  }

  goToGlovoIntegration(): void {
    this.closeMenu();
    this.router.navigate(['/integrations/glovo']);
  }

  /**
   * Cierra el modal operativo activo (turno o reporte Z) con confirmación del usuario.
   * Evita cierres accidentales en medio de una operación.
   */
  closeOperationalModal(): void {
    const modalLabel = this.isShiftModalOpen
      ? 'turno de caja'
      : this.isZReportModalOpen
        ? 'reporte Z'
        : 'aviso de stock bajo';
    const shouldClose = confirm(`¿Seguro que quieres salir del ${modalLabel}?`);
    if (!shouldClose) {
      return;
    }

    this.isShiftModalOpen = false;
    this.isZReportModalOpen = false;
    this.isLowStockModalOpen = false;
    this.zReportPresetDate = null;
  }

  private startLowStockMonitoring(): void {
    this.lowStockSubscription = interval(NavbarComponent.LOW_STOCK_POLLING_MS)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.productService.getActiveProducts().pipe(
            catchError(() => of([] as Product[]))
          )
        )
      )
      .subscribe((products) => {
        this.updateLowStockState(products);
      });
  }

  private updateLowStockState(products: Product[]): void {
    const lowStockProducts = products
      .filter((product) => this.isLowStockProduct(product))
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));

    const currentIds = new Set<number>(lowStockProducts.map((product) => product.id));
    const hasNewLowStock = lowStockProducts.some((product) => !this.lastLowStockIds.has(product.id));

    this.lowStockProducts = lowStockProducts;
    this.lowStockAlertCount = lowStockProducts.length;

    if (hasNewLowStock) {
      this.hasLowStockNotification = true;
    }

    if (lowStockProducts.length === 0) {
      this.hasLowStockNotification = false;
    }

    this.lastLowStockIds = currentIds;
  }

  private isLowStockProduct(product: Product): boolean {
    return product.stock !== null
      && product.stock !== undefined
      && product.stock < NavbarComponent.LOW_STOCK_THRESHOLD;
  }

  /** Cierra sesión y redirige al login. */
  goToLogin(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
