import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ShiftControlComponent } from '../tpv/shift-control/shift-control.component';
import { DailyZReportComponent } from '../tpv/daily-z-report/daily-z-report.component';

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
export class NavbarComponent implements OnInit {
  // Controla si el menú lateral está abierto (pasado desde el padre en algunos contextos)
  @Input() isMenuOpen = false;
  // Permite que el backdrop del menú sea transparente en ciertas vistas
  @Input() transparentBackdrop = false;

  isUserCardOpen = false;
  isShiftModalOpen = false;
  isZReportModalOpen = false;
  currentUserName = '';
  currentUserRole = '';

  constructor(private router: Router, private authService: AuthService) { }

  ngOnInit(): void {
    // Cargamos los datos del usuario autenticado para mostrarlos en la tarjeta de usuario
    this.currentUserName = this.authService.getCurrentUsername() || 'Usuario';
    this.currentUserRole = this.authService.getUserRole() || 'Rol';
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
  openZReportModal(): void {
    this.closeMenu();
    this.isZReportModalOpen = true;
    this.isShiftModalOpen = false;
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
    const modalLabel = this.isShiftModalOpen ? 'turno de caja' : 'reporte Z';
    const shouldClose = confirm(`¿Seguro que quieres salir del ${modalLabel}?`);
    if (!shouldClose) {
      return;
    }

    this.isShiftModalOpen = false;
    this.isZReportModalOpen = false;
  }

  /** Cierra sesión y redirige al login. */
  goToLogin(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
