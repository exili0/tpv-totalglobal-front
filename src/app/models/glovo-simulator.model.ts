export type GlovoPaymentMethod = 'DELAYED' | 'CASH';

export interface GlovoSimulatedOrderItemRequest {
  productId: number;
  quantity: number;
}

export interface GlovoSimulatedOrderRequest {
  glovoOrderId?: string;
  orderCode?: string;
  storeId?: string;
  customerName?: string;
  paymentMethod: GlovoPaymentMethod;
  specialRequirements?: string;
  operatorUsername?: string;
  items: GlovoSimulatedOrderItemRequest[];
}

export interface GlovoSimulationResponse {
  glovoOrderId: string | null;
  orderCode: string | null;
  tableNumber: number;
  serviceLabel: string;
  saleOrderId: number;
  paymentId: number | null;
  totalAmount: number;
  tpvPaymentMethod: string;
  paidAt: string | null;
  pendingCashPayment: boolean;
  message: string;
}
