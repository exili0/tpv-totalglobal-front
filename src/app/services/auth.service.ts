import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

/** Respuesta mínima de login usada por el front para enrutar por rol. */
export interface LoginResponse {
  role: string;
  token: string;
  username: string;
}

/** Payload para validar preguntas de seguridad al recuperar contraseña. */
export interface RestorePasswordRequest {
  username: string;
  firstAnswer: string;
  secondAnswer: string;
}

/** Respuesta genérica de flujos de contraseña. */
export interface RestorePasswordResponse {
  message: string;
}

/** Payload para primera configuración de preguntas de seguridad. */
export interface SetupSecurityQuestionsRequest {
  username: string;
  firstAnswer: string;
  secondAnswer: string;
}

/** Payload para definir una nueva contraseña. */
export interface SetNewPasswordRequest {
  username: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8080/api/auth';
  private platformId = inject(PLATFORM_ID);
  private readonly sessionTokenKey = 'tpv_session_token';
  // Token JWT firmado por backend tras login.
  private readonly authTokenKey = 'tpv_auth_token';

  constructor(private http: HttpClient) { }

  /**
   * Centraliza el acceso a sessionStorage solo en navegador.
   * Evita errores cuando el código se ejecuta fuera del entorno browser.
   */
  private get sessionStore(): Storage | null {
    return isPlatformBrowser(this.platformId) ? sessionStorage : null;
  }

  /** Inicia sesión contra backend. */
  login(username: string, password: string): Observable<LoginResponse> {
    // El backend devuelve role + username + token JWT.
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { username, password });
  }

  /** Persiste el rol para guards y navegación condicional. */
  saveUserRole(role: string): void {
    this.sessionStore?.setItem('userRole', role);
  }

  /** Persiste token JWT para autorización de API en interceptor. */
  saveAuthToken(token: string): void {
    this.sessionStore?.setItem(this.authTokenKey, token);
  }

  /** Persiste usuario actual para trazabilidad operativa (pedidos/devoluciones). */
  saveCurrentUsername(username: string): void {
    this.sessionStore?.setItem('currentUsername', username.trim().toLowerCase());
  }

  /** Lee el rol actual de sesión. */
  getUserRole(): string | null {
    return this.sessionStore?.getItem('userRole') ?? null;
  }

  /** Lee el username autenticado. */
  getCurrentUsername(): string | null {
    return this.sessionStore?.getItem('currentUsername') ?? null;
  }

  /** Devuelve token JWT activo, o null si no hay sesión autenticada. */
  getAuthToken(): string | null {
    return this.sessionStore?.getItem(this.authTokenKey) ?? null;
  }

  /**
   * Obtiene un token de sesión de operador.
   * Se usa para bloquear/desbloquear mesas de forma segura entre sesiones.
   */
  getSessionToken(): string {
    const existingToken = this.sessionStore?.getItem(this.sessionTokenKey);
    if (existingToken) {
      return existingToken;
    }

    const generatedToken = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.sessionStore?.setItem(this.sessionTokenKey, generatedToken);
    return generatedToken;
  }

  /** Estado simple de autenticación basado en rol guardado. */
  isAuthenticated(): boolean {
    // Consideramos sesión válida solo si existen rol y token.
    return this.getUserRole() !== null && this.getAuthToken() !== null;
  }

  /** Verifica preguntas de seguridad para habilitar reset de contraseña. */
  verifySecurityQuestions(request: RestorePasswordRequest): Observable<RestorePasswordResponse> { 
    return this.http.post<RestorePasswordResponse>(`${this.apiUrl}/restore-password`, request);
  } 

  /** Configura preguntas de seguridad en primer acceso. */
  setupSecurityQuestions(request: SetupSecurityQuestionsRequest): Observable<RestorePasswordResponse> {
    return this.http.post<RestorePasswordResponse>(`${this.apiUrl}/setup-security-questions`, request);
  }

  /** Actualiza contraseña del usuario autenticado/validado. */
  setNewPassword(request: SetNewPasswordRequest): Observable<RestorePasswordResponse> {
    return this.http.post<RestorePasswordResponse>(`${this.apiUrl}/set-new-password`, request);
  }

  /** Cierra sesión limpiando estado local. */
  logout(): void {
    this.sessionStore?.clear();
  }
}
