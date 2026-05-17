/**
 * Modelo de Item en el Carrito del TPV
 */
export interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  vatPercent: number;
  subtotal: number; // precio * cantidad
  vat: number; // subtotal * (vatPercent / 100)
  total: number; // subtotal + vat
}

/**
 * Resumen del Carrito/Ticket
 */
export interface CartSummary {
  items: CartItem[];
  subtotal: number;
  totalVat: number;
  total: number;
  itemCount: number;
}
