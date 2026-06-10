import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BusinessTable } from '../models/pos.model';
import { AuthService } from './auth.service';

export interface CreateTableRequest {
  tableNumber: number;
  displayName: string;
  capacity: number;
}

@Injectable({
  providedIn: 'root'
})
export class TableService {
  /** API de mesas (claim/release) con control de concurrencia por sesión. */
  private readonly apiUrl = 'http://localhost:8080/api/tables';

  constructor(private http: HttpClient, private authService: AuthService) {}

  /** Obtiene mesas activas mostradas en el selector principal del TPV. */
  getActiveTables(): Observable<BusinessTable[]> {
    return this.http.get<BusinessTable[]>(this.apiUrl);
  }

  /** Crea una nueva mesa (uso administrativo). */
  createTable(request: CreateTableRequest): Observable<BusinessTable> {
    return this.http.post<BusinessTable>(this.apiUrl, request);
  }

  /** Desactiva una mesa (uso administrativo). */
  deleteTable(tableNumber: number): Observable<BusinessTable> {
    return this.http.delete<BusinessTable>(`${this.apiUrl}/${tableNumber}`);
  }

  /** Toma bloqueo operativo de mesa para un operador/sesión. */
  claimTable(tableNumber: number, _username: string): Observable<BusinessTable> {
    const sessionToken = this.authService.getSessionToken();
    // username y role ya no viajan por query: backend los resuelve desde JWT.
    const params = new HttpParams().set('sessionToken', sessionToken);
    return this.http.post<BusinessTable>(`${this.apiUrl}/${tableNumber}/claim`, null, { params });
  }

  /** Libera bloqueo de mesa cuando se abandona o finaliza operación. */
  releaseTable(tableNumber: number, _username: string): Observable<BusinessTable> {
    const sessionToken = this.authService.getSessionToken();
    // Solo mantenemos sessionToken operativo para control de bloqueo de mesa.
    const params = new HttpParams().set('sessionToken', sessionToken);
    return this.http.post<BusinessTable>(`${this.apiUrl}/${tableNumber}/release`, null, { params });
  }
}
