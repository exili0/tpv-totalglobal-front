import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CashRegisterShift,
  CloseShiftRequest,
  CreateOrderRequest,
  MoveTableRequest,
  DailyZReportResponse,
  OpenShiftRequest,
  Payment,
  PaymentRequest,
  Refund,
  RefundRequest,
  SaleOrder,
  ShiftDetail,
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

  private buildRefundHeaders(metadata?: { idempotencyKey?: string; clientAttemptAt?: string }): HttpHeaders | undefined {
    let headers = new HttpHeaders();

    if (metadata?.idempotencyKey) {
      headers = headers.set('X-Idempotency-Key', metadata.idempotencyKey);
    }

    if (metadata?.clientAttemptAt) {
      headers = headers.set('X-Client-Attempt-At', metadata.clientAttemptAt);
    }

    return headers.keys().length > 0 ? headers : undefined;
  }

  /** Crea/actualiza el pedido abierto de una mesa o barra. */
  openOrUpdateOrder(request: CreateOrderRequest): Observable<SaleOrder> {
    // Backend decide si crea o mergea líneas según la mesa.
    return this.http.post<SaleOrder>(`${this.apiUrl}/orders`, request);
  }

  /** Recupera pedidos abiertos para hidratar estado del carrito por mesa. */
  getOpenOrders(): Observable<SaleOrder[]> {
    return this.http.get<SaleOrder[]>(`${this.apiUrl}/orders/open`);
  }

  /** Mueve una comanda abierta desde una mesa origen a una mesa destino. */
  moveOpenOrderBetweenTables(request: MoveTableRequest): Observable<SaleOrder> {
    return this.http.post<SaleOrder>(`${this.apiUrl}/orders/move-table`, request);
  }

  /** Registra el cobro final de una orden. */
  registerPayment(request: PaymentRequest): Observable<Payment> {
    // Al pagar, backend cambia estado de orden y actualiza acumulados de turno.
    return this.http.post<Payment>(`${this.apiUrl}/payments`, request);
  }

  /**
   * Limpia pedido abierto de una mesa.
   * Envía token de sesión operativo; identidad y rol vienen del JWT.
   */
  clearOpenOrder(tableNumber: number, sessionToken: string): Observable<void> {
    // El backend obtiene operador/rol del JWT; aquí solo enviamos token de sesión de mesa.
    const params = new HttpParams().set('sessionToken', sessionToken);
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
  registerRefund(request: RefundRequest, metadata?: { idempotencyKey?: string; clientAttemptAt?: string }): Observable<Refund> {
    // El tipo de devolución (total/parcial/producto) lo resuelve backend
    // según los campos informados en request.
    const headers = this.buildRefundHeaders(metadata);
    return this.http.post<Refund>(`${this.apiUrl}/refunds`, request, headers ? { headers } : undefined);
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

  /** Devuelve el detalle de un turno con productos vendidos y stock al cierre. */
  getShiftDetail(shiftId: number): Observable<ShiftDetail> {
    return this.http.get<ShiftDetail>(`${this.apiUrl}/shifts/${shiftId}/detail`);
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
