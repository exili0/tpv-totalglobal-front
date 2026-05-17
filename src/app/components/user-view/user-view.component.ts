import { Component } from '@angular/core';
import { NavbarComponent } from '../navbar/navbar.component';

/**
 * Vista de inicio para usuarios con rol COMMON_USER.
 * Sirve como página de bienvenida tras el login y da acceso al TPV.
 */
@Component({
  selector: 'app-user-view',
  standalone: true,
  imports: [NavbarComponent],
  templateUrl: './user-view.component.html',
  styleUrl: './user-view.component.css',
})
export class UserViewComponent {
}
