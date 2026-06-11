/** Estado operativo de una mesa dentro del salón/barra. */
export type TableStatus = 'FREE' | 'OCCUPIED' | 'INACTIVE';
/** Estado de ciclo de vida de una orden de venta. */
export type OrderStatus = 'OPEN' | 'PAID' | 'CANCELLED';
/** Método de cobro soportado por TPV. */
export type PaymentMethod = 'CASH' | 'CARD' | 'OTHER';
/** Estado de turno de caja. */
export type CashShiftStatus = 'OPEN' | 'CLOSED';

// Mesas, pedidos, pagos, devoluciones, caja y reportes.
export interface BusinessTable {
  id: number;
  tableNumber: number;
  displayName: string;
  capacity: number;
  status: TableStatus;
  active: boolean;
  attendedBy?: string | null;
  lockedAt?: string | null;
  lockToken?: string | null;
}

/** Línea mínima para enviar items al backend al crear/actualizar pedido. */
export interface OrderItemRequest {
  productId: number;
  quantity: number;
}

/** Payload para abrir o modificar una orden en mesa/barra. */
export interface CreateOrderRequest {
  tableNumber: number;
  items: OrderItemRequest[];
  notes?: string;
  operatorUsername?: string;
  operatorSessionToken?: string;
}

/** Payload para mover una comanda abierta de una mesa origen a una mesa destino. */
export interface MoveTableRequest {
  fromTableNumber: number;
  toTableNumber: number;
  sessionToken: string;
}

/** Línea de venta ya calculada por backend. */
export interface SaleOrderLine {
  id: number;
  product?: { id: number };
  productName: string;
  quantity: number;
  vatPercent: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  costTotal: number;
  profit: number;
}

/** Orden completa con líneas e importes acumulados. */
export interface SaleOrder {
  id: number;
  table: BusinessTable;
  status: OrderStatus;
  openedAt: string;
  closedAt: string | null;
  subtotal: number;
  totalVat: number;
  total: number;
  totalCost: number;
  totalProfit: number;
  notes: string | null;
  orderLines: SaleOrderLine[];
}

/** Solicitud para registrar el cobro de una orden. */
export interface PaymentRequest {
  saleOrderId: number;
  paymentMethod: PaymentMethod;
  amount: number;
  /** Solo se usa cuando el cobro es en efectivo; representa el dinero entregado por el cliente. */
  receivedAmount?: number;
  /** Usuario que registra el cobro en caja. */
  cashierUsername?: string;
  /** Propina opcional del cliente. */
  tipAmount?: number;
}

/** Entidad de cobro realizada. */
export interface Payment {
  id: number;
  saleOrder: SaleOrder;
  paymentMethod: PaymentMethod;
  amount: number;
  /** Importe entregado, útil para efectivo y cálculo de cambio. */
  receivedAmount?: number | null;
  collectedBy?: string | null;
  tipAmount?: number;
  paidAt: string;
}

/** Vista resumida de ticket para listados. */
export interface TicketSummary {
  paymentId: number;
  saleOrderId: number;
  tableNumber: number | null;
  serviceLabel: string;
  paidAt: string;
  totalAmount: number;
  totalItems: number;
  paymentMethod: PaymentMethod;
  collectedBy?: string | null;
  tipAmount?: number;
  refundedAmount: number;
  refundableAmount: number;
}

/** Agregado de propinas por empleado para ranking. */
export interface TipLeaderboardEntry {
  username: string;
  totalTips: number;
  ticketsWithTip: number;
}

/** Línea de detalle de ticket. */
export interface TicketLine {
  lineId: number;
  productName: string;
  quantity: number;
  refundedQuantity: number;
  refundableQuantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** Detalle completo de ticket para modal/impresión/devolución. */
export interface TicketDetail extends TicketSummary {
  notes: string | null;
  lines: TicketLine[];
}

/** Entidad de devolución registrada. */
export interface Refund {
  id: number;
  saleOrder: SaleOrder;
  payment: Payment;
  saleOrderLine?: SaleOrderLine | null;
  refundedQuantity?: number | null;
  amount: number;
  reason: string | null;
  refundedBy: string;
  refundedAt: string;
  returnToStock?: boolean;
}

/** Solicitud para devolución parcial o total de un ticket. */
export interface RefundRequest {
  paymentId: number;
  saleOrderLineId?: number;
  quantity?: number;
  amount?: number;
  reason?: string;
  refundedBy: string;
  returnToStock?: boolean; // Si es devolución de producto, indica si retorna a stock o se considera desecho 
}

/** Datos requeridos para abrir turno de caja. */
export interface OpenShiftRequest {
  openingFloat: number;
  openedBy: string;
}

/** Datos requeridos para cerrar turno de caja. */
export interface CloseShiftRequest {
  closedBy: string;
}

/** Estado consolidado del turno actual/histórico. */
export interface CashRegisterShift {
  id: number;
  openedAt: string;
  closedAt: string | null;
  status: CashShiftStatus;
  openingFloat: number;
  cashSales: number;
  cardSales: number;
  otherSales: number;
  totalSales: number;
  totalProfit: number;
  openedBy: string | null;
  closedBy: string | null;
  closingStockSnapshot?: string | null;
}

/** Resumen de un producto vendido dentro de un turno de caja. */
export interface ShiftProductSale {
  productId: number;
  productName: string;
  quantitySold: number;
  totalSales: number;
  totalProfit: number;
  stockLossQuantity: number;
  stockLossAmount: number;
  stockAtOpen: number | null;
  stockAtClose: number | null;
}

/** Vista detallada de turno con productos vendidos y stock al cierre. */
export interface ShiftDetail {
  shift: CashRegisterShift;
  soldProducts: ShiftProductSale[];
}

/** Resumen Z diario de ventas y rentabilidad. */
export interface DailyZReportResponse {
  date: string;
  ticketsCount: number;
  totalSales: number;
  totalVat: number;
  totalCost: number;
  totalProfit: number;
  cashSales: number;
  cardSales: number;
  otherSales: number;
}
