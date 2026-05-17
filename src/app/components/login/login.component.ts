import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html', // Nombre estándar
  styleUrl: './login.component.css'     // Nombre estándar
})
export class LoginComponent { // Clase renombrada a LoginComponent para seguir el estándar
  loginForm: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;
  showPassword: boolean = false;

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Por favor, completa todos los campos';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { username, password } = this.loginForm.value;

    this.authService.login(username, password).subscribe({
      next: (response) => {
        const role = response.role.toUpperCase();
        this.authService.saveUserRole(role);
        this.authService.saveCurrentUsername(username);

        // Redirección simple según el rol del back
        if (role === 'ADMIN') {
          this.router.navigate(['/admin-view']);
        } else if (role === 'COMMON_USER') {
          this.router.navigate(['/user-view']);
        } else {
          this.errorMessage = 'Rol no reconocido';
        }
        
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        if (error.status === 428) {
          localStorage.setItem('firstLoginUsername', username);
          this.router.navigate(['/setNewPassword'], { queryParams: { firstLogin: 'true' } });
        } else if (error.status === 423) {
          this.errorMessage = 'Cuenta bloqueada por seguridad.';
        } else {
          this.errorMessage = error.error?.message || 'Usuario o contraseña incorrectos';
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  goToRestorePassword(): void {
    this.router.navigate(['/restorePassword']);
  }
}
