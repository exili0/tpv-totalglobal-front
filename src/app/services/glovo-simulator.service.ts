import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GlovoSimulatedOrderRequest, GlovoSimulationResponse } from '../models/glovo-simulator.model';

@Injectable({
  providedIn: 'root',
})
export class GlovoSimulatorService {
  private readonly apiUrl = 'http://localhost:8080/api/pos/integrations/glovo';

  constructor(private readonly http: HttpClient) {}
    // Simula la entrada de un pedido despachado de Glovo, enviando los datos al backend y recibiendo el resultado de la simulación
  simulateOrder(request: GlovoSimulatedOrderRequest): Observable<GlovoSimulationResponse> {
    return this.http.post<GlovoSimulationResponse>(`${this.apiUrl}/simulate`, request);
  }
}
