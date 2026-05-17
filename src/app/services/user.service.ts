import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserEntity {
  id?: number;  
  username: string;
  password?: string;  
  name?: string;
  lastname?: string;
  email?: string;
  dateCreated?: string | number;  
  role: string;
  active: boolean;
  failedAttempts?: number;
  firstLogin?: boolean;  
  lockedDate?: string | number;  
}

export interface CreateUserRequest {
  username: string;
  name: string;
  lastname: string;
  email: string;
  date?: string;
  role: string;
}

export interface UpdateUserRequest {
  username?: string;
  name?: string;
  lastname?: string;
  email?: string;
  role?: string;
  active?: boolean;
  date?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  /** API de administración de usuarios. */
  private apiUrl = 'http://localhost:8080/api/users';

  constructor(private http: HttpClient) { }

  /** Lista usuarios para panel admin. */
  getAllUsers(): Observable<UserEntity[]> {
    return this.http.get<UserEntity[]>(this.apiUrl);
  }

  /** Recupera detalle de un usuario por id. */
  getUserById(id: number): Observable<UserEntity> {
    return this.http.get<UserEntity>(`${this.apiUrl}/${id}`);   
  }

  /** Crea un usuario nuevo. */
  createUser(user: CreateUserRequest): Observable<UserEntity> {
    return this.http.post<UserEntity>(this.apiUrl, user);
  }
  
  /** Actualiza los datos del usuario. */
  updateUser(id: number, user: UpdateUserRequest): Observable<UserEntity> {
    return this.http.put<UserEntity>(`${this.apiUrl}/${id}`, user);
  }

  /** Elimina usuario por id. */
  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /** Activa/desactiva usuario sin borrar su histórico. */
  toggleUserActive(id: number, active: boolean): Observable<UserEntity> {
    return this.http.patch<UserEntity>(`${this.apiUrl}/${id}/active`, { active });
  }

  /** Fuerza próximo acceso como primer login (reset de flujo inicial). */
  resetToFirstLogin(id: number): Observable<UserEntity> {
    return this.http.patch<UserEntity>(`${this.apiUrl}/${id}/first-login`, {});
  }
}
