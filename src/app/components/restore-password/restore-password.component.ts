import { Component, OnInit, ChangeDetectorRef, inject, PLATFORM_ID } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-restore-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restore-password.component.html',
  styleUrl: './restore-password.component.css',
})
export class RestorePasswordComponent implements OnInit {
  username: string = '';
  firstAnswer: string = '';
  secondAnswer: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';
  isSetupMode: boolean = false;
  returnTo: string = '/login';

  private readonly platformId = inject(PLATFORM_ID);

  private get sessionStore(): Storage | null {
    return isPlatformBrowser(this.platformId) ? sessionStorage : null;
  }

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.isSetupMode = params['setupMode'] === 'true';

      if (params['returnTo']) {
        this.returnTo = params['returnTo'];
      }

      if (this.isSetupMode) {
        const storedUsername = this.sessionStore?.getItem('setupSecurityUsername');
        if (storedUsername) {
          this.username = storedUsername;
        } else {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  goToLogin(): void {
    this.sessionStore?.removeItem('restorePasswordUsername');
    this.sessionStore?.removeItem('setupSecurityUsername');
    this.router.navigate([this.returnTo]);
  }

  restorePassword(): void {
    this.errorMessage = '';

    if (!this.username.trim() || !this.firstAnswer.trim() || !this.secondAnswer.trim()) {
      this.errorMessage = 'Por favor, completa todos los campos';
      return;
    }

    this.isLoading = true;

    if (this.isSetupMode) {
      this.authService
        .setupSecurityQuestions({
          username: this.username.trim(),
          firstAnswer: this.firstAnswer.trim(),
          secondAnswer: this.secondAnswer.trim(),
        })
        .subscribe({
          next: () => {
            this.isLoading = false;
            this.cdr.detectChanges();
            this.sessionStore?.removeItem('setupSecurityUsername');
            alert('Configuración completada. Ya puedes iniciar sesión.');
            this.router.navigate(['/login']);
          },
          error: (error) => {
            this.isLoading = false;
            this.errorMessage = error.error?.message || 'Error al configurar las preguntas';
            this.cdr.detectChanges();
          },
        });
    } else {
      this.authService
        .verifySecurityQuestions({
          username: this.username.trim(),
          firstAnswer: this.firstAnswer.trim(),
          secondAnswer: this.secondAnswer.trim(),
        })
        .subscribe({
          next: () => {
            this.isLoading = false;
            this.cdr.detectChanges();
            this.sessionStore?.setItem('restorePasswordUsername', this.username);
            this.router.navigate(['/setNewPassword']);
          },
          error: (error) => {
            this.isLoading = false;
            if (error.status === 423) {
              this.errorMessage = 'La cuenta está bloqueada. Contacta con un administrador.';
            } else {
              this.errorMessage = error.error?.message || 'Respuestas incorrectas';
            }
            this.cdr.detectChanges();
          },
        });
    }
  }
}
