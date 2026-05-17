import { Component } from '@angular/core';
import { NavbarComponent } from '../navbar/navbar.component';
import { Router } from '@angular/router';

/**
 * Vista principal del panel de administración.
 * Punto de entrada para acceder a la gestión de usuarios, productos y categorías.
 */
@Component({
  selector: 'app-admin-view',
  standalone: true,
  imports: [NavbarComponent],
  templateUrl: './admin-view.component.html',
  styleUrl: './admin-view.component.css',
})
export class AdminViewComponent {
  constructor(private readonly router: Router) {}

  goToUsersManagement(): void {
    this.router.navigate(['/usersManagament']);
  }
}
