import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Servicio para gestión de stock automatizado.
 * Proporciona acceso a operaciones de stock, movimientos y estadísticas de pérdidas.
 */
@Injectable({
  providedIn: 'root'
})
export class StockService {

  private apiUrl = 'http://localhost:8080/api/stock';

  constructor(private http: HttpClient) { }

  /**
   * Obtiene el histórico de movimientos de un producto específico.
   * @param productId ID del producto
   * @returns Observable con lista de movimientos
   */
  getProductStockHistory(productId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/movements/product/${productId}`);
  }

  /**
   * Obtiene movimientos de stock en un rango de fechas.
   * @param startDate Fecha inicio (formato: yyyy-MM-dd)
   * @param endDate Fecha fin (formato: yyyy-MM-dd)
   * @returns Observable con lista de movimientos
   */
  getMovementsByDateRange(startDate: string, endDate: string): Observable<any> {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/movements/range`, { params });
  }

  /**
   * Obtiene las pérdidas de stock de un producto específico.
   * @param productId ID del producto
   * @returns Observable con lista de desechos
   */
  getProductWasteHistory(productId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/waste/product/${productId}`);
  }

  /**
   * Obtiene estadísticas de pérdidas en un rango de fechas.
   * @param startDate Fecha inicio (formato: yyyy-MM-dd)
   * @param endDate Fecha fin (formato: yyyy-MM-dd)
   * @returns Observable con lista de pérdidas
   */
  getWasteStatistics(startDate: string, endDate: string): Observable<any> {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get(`${this.apiUrl}/waste/range`, { params });
  }

  /**
   * Obtiene un resumen de pérdidas por producto.
   * @returns Observable con mapa de productId -> totalUnidadesPerdidas
   */
  getWasteSummary(): Observable<any> {
    return this.http.get(`${this.apiUrl}/waste/summary`);
  }

  /**
   * Obtiene el total de pérdidas en todo el sistema.
   * @returns Observable con total de unidades perdidas
   */
  getTotalWaste(): Observable<any> {
    return this.http.get(`${this.apiUrl}/waste/total`);
  }
}
