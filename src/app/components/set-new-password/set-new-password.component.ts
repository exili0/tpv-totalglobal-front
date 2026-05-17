import { Component, OnInit, ChangeDetectorRef, inject, PLATFORM_ID } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-set-new-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './set-new-password.component.html',
  styleUrl: './set-new-password.component.css',
})
export class SetNewPasswordComponent implements OnInit {
  username: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isFirstLogin: boolean = false;

  private readonly platformId = inject(PLATFORM_ID);

  private get sessionStore(): Storage | null {
    return isPlatformBrowser(this.platformId) ? sessionStorage : null;
  }

  private get localStore(): Storage | null {
    return isPlatformBrowser(this.platformId) ? localStorage : null;
  }

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.isFirstLogin = params['firstLogin'] === 'true';

      if (this.isFirstLogin) {
        const storedUsername = this.localStore?.getItem('firstLoginUsername');
        if (storedUsername) {
          this.username = storedUsername;
        } else {
          this.router.navigate(['/login']);
        }
      } else {
        const storedUsername = this.sessionStore?.getItem('restorePasswordUsername');
        if (storedUsername) {
          this.username = storedUsername;
        } else {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  toggleShowNewPassword(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleShowConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goToLogin(): void {
    if (this.isFirstLogin) {
      this.localStore?.removeItem('firstLoginUsername');
    } else {
      this.sessionStore?.removeItem('restorePasswordUsername');
    }
    this.router.navigate(['/login']);
  }

  setNewPassword(): void {
    this.errorMessage = '';

    if (!this.newPassword.trim() || !this.confirmPassword.trim()) {
      this.errorMessage = 'Por favor, completa todos los campos';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden';
      return;
    }

    if (this.newPassword.length < 4) {
      this.errorMessage = 'La contraseña debe tener al menos 4 caracteres';
      return;
    }

    this.isLoading = true;

    const setPasswordRequest = {
      username: this.username.trim(),
      newPassword: this.newPassword.trim(),
    };

    this.authService.setNewPassword(setPasswordRequest).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.detectChanges();

        if (this.isFirstLogin) {
          this.localStore?.removeItem('firstLoginUsername');
          this.sessionStore?.setItem('setupSecurityUsername', this.username);
          this.router.navigate(['/restorePassword'], { queryParams: { setupMode: 'true' } });
        } else {
          this.sessionStore?.removeItem('restorePasswordUsername');
          this.router.navigate(['/login']);
        }
      },
      error: (error) => {
        this.isLoading = false;
        if (error.status === 423) {
          this.errorMessage = 'La cuenta está bloqueada. Contacta con un administrador.';
          this.sessionStore?.removeItem('restorePasswordUsername');
        } else if (error.status === 400 && error.error?.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Error al actualizar la contraseña';
        }
        this.cdr.detectChanges();
      },
    });
  }
}
