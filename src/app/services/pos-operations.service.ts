import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CashRegisterShift,
  CloseShiftRequest,
  CreateOrderRequest,
  DailyZReportResponse,
  OpenShiftRequest,
  Payment,
  PaymentRequest,
  Refund,
  RefundRequest,
  SaleOrder,
  TicketDetail,
  TicketSummary
} from '../models/pos.model';

@Injectable({
  providedIn: 'root'
})
export class PosOperationsService {
  /** API de operaciones operativas del TPV (pedidos, cobros, caja, tickets). */
  private readonly apiUrl = 'http://localhost:8080/api/pos';

  constructor(private http: HttpClient) {}

  /** Crea/actualiza el pedido abierto de una mesa o barra. */
  openOrUpdateOrder(request: CreateOrderRequest): Observable<SaleOrder> {
    // Backend decide si crea o mergea líneas según la mesa.
    return this.http.post<SaleOrder>(`${this.apiUrl}/orders`, request);
  }

  /** Recupera pedidos abiertos para hidratar estado del carrito por mesa. */
  getOpenOrders(): Observable<SaleOrder[]> {
    return this.http.get<SaleOrder[]>(`${this.apiUrl}/orders/open`);
  }

  /** Registra el cobro final de una orden. */
  registerPayment(request: PaymentRequest): Observable<Payment> {
    // Al pagar, backend cambia estado de orden y actualiza acumulados de turno.
    return this.http.post<Payment>(`${this.apiUrl}/payments`, request);
  }

  /**
   * Limpia pedido abierto de una mesa.
   * Envía usuario/token/rol para que backend valide bloqueo de sesión.
   */
  clearOpenOrder(tableNumber: number, username: string, sessionToken: string): Observable<void> {
    // En borrado enviamos contexto de sesión para que backend valide
    // que quien limpia la orden tiene permiso real sobre la mesa.
    const role = sessionStorage.getItem('userRole') ?? '';
    const params = new HttpParams().set('username', username).set('sessionToken', sessionToken).set('role', role);
    return this.http.delete<void>(`${this.apiUrl}/orders/${tableNumber}`, { params });
  }

  /** Lista tickets cobrados con importes pendientes de devolución. */
  getTickets(): Observable<TicketSummary[]> {
    return this.http.get<TicketSummary[]>(`${this.apiUrl}/tickets`);
  }

  /** Obtiene detalle completo de un ticket por `paymentId`. */
  getTicketByPaymentId(paymentId: number): Observable<TicketDetail> {
    return this.http.get<TicketDetail>(`${this.apiUrl}/tickets/${paymentId}`);
  }

  /** Recupera histórico de devoluciones registradas. */
  getRefunds(): Observable<Refund[]> {
    return this.http.get<Refund[]>(`${this.apiUrl}/refunds`);
  }

  /** Registra una devolución parcial o total de un ticket. */
  registerRefund(request: RefundRequest): Observable<Refund> {
    // El tipo de devolución (total/parcial/producto) lo resuelve backend
    // según los campos informados en request.
    return this.http.post<Refund>(`${this.apiUrl}/refunds`, request);
  }

  /** Abre turno de caja para comenzar operación diaria. */
  openShift(request: OpenShiftRequest): Observable<CashRegisterShift> {
    return this.http.post<CashRegisterShift>(`${this.apiUrl}/shifts/open`, request);
  }

  /** Devuelve el turno de caja abierto actualmente (o null si no hay turno activo). */
  getCurrentShift(): Observable<CashRegisterShift | null> {
    return this.http.get<CashRegisterShift | null>(`${this.apiUrl}/shifts/current`);
  }

  /** Cierra turno de caja y consolida totales. */
  closeShift(request: CloseShiftRequest): Observable<CashRegisterShift> {
    return this.http.post<CashRegisterShift>(`${this.apiUrl}/shifts/close`, request);
  }

  /**
   * Recupera historial de turnos de caja para auditoría de beneficios.
   *
   * - 'startDate' y 'endDate' son opcionales y se envían en formato ISO (`yyyy-MM-dd`).
   * - Si no se envían filtros, backend devuelve el histórico completo.
   */
  getShiftHistory(startDate?: string, endDate?: string): Observable<CashRegisterShift[]> {
    let params = new HttpParams();

    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }

    return this.http.get<CashRegisterShift[]>(`${this.apiUrl}/shifts`, { params });
  }

  /** Recupera reporte Z diario para auditoría de caja. */
  getDailyZReport(date?: string): Observable<DailyZReportResponse> {
    // Si no se manda fecha, backend devuelve el día actual.
    let params = new HttpParams();
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<DailyZReportResponse>(`${this.apiUrl}/reports/z`, { params });
  }
}
