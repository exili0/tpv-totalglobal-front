import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable, Subject } from 'rxjs';
import { catchError, debounceTime, switchMap, take } from 'rxjs/operators';
import { CartItem, CartSummary } from '../models/cart.model';
import { SaleOrder, SaleOrderLine } from '../models/pos.model';
import { Product } from '../models/product.model';
import { PosOperationsService } from './pos-operations.service';
import { AuthService } from './auth.service';
import { TableService } from './table.service';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  /** Estado reactivo del carrito activo (mesa seleccionada). */
  private cartItems$ = new BehaviorSubject<CartItem[]>([]);
  private cartSummary$ = new BehaviorSubject<CartSummary>(this.getEmptySummary());
  /** Mesa actualmente operada en TPV. */
  private activeTableNumber$ = new BehaviorSubject<number | null>(null);
  /** Bloquea edición del carrito cuando el pedido pertenece a Glovo. */
  private isCartLocked$ = new BehaviorSubject<boolean>(false);
  /** Carritos independientes por número de mesa para mantener contexto. */
  private tableCarts: Record<number, CartItem[]> = {};
  /** Cola reactiva para sincronización diferida con backend. */
  private syncRequests$ = new Subject<void>();
  /** Evita bucles cuando el origen del cambio es hidratación desde backend. */
  private isHydratingFromBackend = false;

  constructor(
    private posOperationsService: PosOperationsService,
    private authService: AuthService,
    private tableService: TableService
  ) {
    this.loadCartsFromStorage();
    this.initializeAutoSync();
  }

  getActiveTableNumber(): Observable<number | null> {
    return this.activeTableNumber$.asObservable();
  }

  getCurrentActiveTableNumber(): number | null {
    return this.activeTableNumber$.value;
  }

  getCartLocked(): Observable<boolean> {
    return this.isCartLocked$.asObservable();
  }

  isCurrentCartLocked(): boolean {
    return this.isCartLocked$.value;
  }

  /** Cambia mesa activa y refresca su estado desde backend. */
  setActiveTable(tableNumber: number): void {
    this.activeTableNumber$.next(tableNumber);
    this.resolveCartLockFromTable(tableNumber);
    const items = this.cloneItems(this.tableCarts[tableNumber] ?? []);
    this.updateSubjects(items);
    // Primero mostramos estado local para respuesta instantánea en UI,
    // luego reconciliamos con backend.
    this.refreshTableFromBackend(tableNumber);
  }

  /** Fuerza recarga de la mesa activa para reconciliar estado local/remoto. */
  refreshActiveTableFromBackend(): void {
    const activeTable = this.activeTableNumber$.value;
    if (activeTable !== null) {
      this.refreshTableFromBackend(activeTable);
    }
  }

  /**
   * Hidrata carrito de una mesa desde su pedido abierto en backend.
   * Es clave para no perder cambios entre sesiones o recargas.
   */
  refreshTableFromBackend(tableNumber: number): void {
    this.posOperationsService.getOpenOrders().pipe(take(1)).subscribe({
      next: (openOrders) => {
        const order = openOrders.find((candidate) => candidate.table?.tableNumber === tableNumber);
        const backendItems = this.mapOrderToCartItems(order);
        const localItems = this.tableCarts[tableNumber] ?? [];
        const reconciledItems = this.reconcileItemsKeepingNotes(backendItems, localItems);
        this.updateCartLockState(tableNumber, order?.table?.displayName ?? null);

        // Bandera clave: si no la levantamos, la hidratación dispara sync
        // y terminamos empujando al backend lo mismo que acabamos de leer.
        this.isHydratingFromBackend = true;
        this.tableCarts[tableNumber] = this.cloneItems(reconciledItems);

        if (this.activeTableNumber$.value === tableNumber) {
          this.updateSubjects(this.cloneItems(reconciledItems));
        }

        this.saveCartsToStorage();
        this.isHydratingFromBackend = false;
      },
      error: (error) => {
        console.error('Error sincronizando mesa desde backend:', error);
      }
    });
  }

  /**
   * Obtiene los items del carrito como Observable reactivo
   */
  getCartItems(): Observable<CartItem[]> {
    return this.cartItems$.asObservable();
  }

  /**
   * Obtiene el resumen del carrito (totales, cantidades) como Observable
   */
  getCartSummary(): Observable<CartSummary> {
    return this.cartSummary$.asObservable();
  }

  /**
   * Agrega un producto al carrito o incrementa cantidad si ya existe
   */
  addToCart(product: Product, quantity: number = 1): void {
    if (!this.ensureCartEditable()) {
      return;
    }

    const tableNumber = this.activeTableNumber$.value;
    if (tableNumber === null) {
      return;
    }

    // Clonamos antes de mutar: si modificamos this.cartItems$.value directamente,
    // la emisión anterior y la nueva comparten referencia y Angular no detecta el cambio.
    const currentItems = this.cloneItems(this.cartItems$.value);
    const existingItem = currentItems.find(
      (item) => item.productId === product.id && this.normalizeNote(item.note) === ''
    );

    if (existingItem) {
      // Flujo principal: sumar sobre la línea existente.
      existingItem.quantity += quantity;
    } else {
      const cartItem: CartItem = {
        lineId: this.createLineId(),
        productId: product.id,
        productName: product.name,
        note: '',
        quantity,
        unitPrice: product.price,
        vatPercent: product.vatPercent,
        subtotal: 0,
        vat: 0,
        total: 0
      };
      currentItems.push(cartItem);
    }

    this.updateCartItems(currentItems, tableNumber);
  }

  subtractFromCart(product: Product, quantity: number = 1): void {
    if (!this.ensureCartEditable()) {
      return;
    }

    const tableNumber = this.activeTableNumber$.value;
    if (tableNumber === null) {
      return;
    }

    const currentItems = this.cloneItems(this.cartItems$.value);
    const existingItem = currentItems
      .filter((item) => item.productId === product.id)
      .sort((a, b) => this.normalizeNote(a.note).localeCompare(this.normalizeNote(b.note)))[0];
    if (!existingItem) {
      return;
    }

    existingItem.quantity -= quantity;
    if (existingItem.quantity <= 0) {
      this.updateCartItems(currentItems.filter(item => item.productId !== product.id), tableNumber);
      return;
    }

    this.updateCartItems(currentItems, tableNumber);
  }

  /**
   * Actualiza la cantidad de un item en el carrito
   */
  updateItemQuantity(productId: number, quantity: number): void {
    if (!this.ensureCartEditable()) {
      return;
    }

    const tableNumber = this.activeTableNumber$.value;
    if (tableNumber === null) {
      return;
    }

    // Mismo patrón que addToCart: clonar antes de mutar para no alterar
    // la referencia viva del BehaviorSubject y garantizar detección de cambios.
    const currentItems = this.cloneItems(this.cartItems$.value);
    const item = currentItems.find((i) => i.productId === productId && this.normalizeNote(i.note) === '')
      ?? currentItems.find((i) => i.productId === productId);

    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        item.quantity = quantity;
        this.updateCartItems(currentItems, tableNumber);
      }
    }
  }

  /**
   * Elimina un item del carrito
   */
  removeFromCart(productId: number): void {
    if (!this.ensureCartEditable()) {
      return;
    }

    const tableNumber = this.activeTableNumber$.value;
    if (tableNumber === null) {
      return;
    }

    const currentItems = this.cloneItems(this.cartItems$.value);
    const index = currentItems.findIndex((item) => item.productId === productId && this.normalizeNote(item.note) === '');
    const fallbackIndex = index >= 0 ? index : currentItems.findIndex((item) => item.productId === productId);
    if (fallbackIndex < 0) {
      return;
    }

    currentItems.splice(fallbackIndex, 1);
    this.updateCartItems(currentItems, tableNumber);
  }

  removeFromCartByLine(lineId: string): void {
    if (!this.ensureCartEditable()) {
      return;
    }

    const tableNumber = this.activeTableNumber$.value;
    if (tableNumber === null) {
      return;
    }

    const currentItems = this.cloneItems(this.cartItems$.value).filter((item) => item.lineId !== lineId);
    this.updateCartItems(currentItems, tableNumber);
  }

  updateItemQuantityByLine(lineId: string, quantity: number): void {
    if (!this.ensureCartEditable()) {
      return;
    }

    const tableNumber = this.activeTableNumber$.value;
    if (tableNumber === null) {
      return;
    }

    const currentItems = this.cloneItems(this.cartItems$.value);
    const item = currentItems.find((candidate) => candidate.lineId === lineId);
    if (!item) {
      return;
    }

    if (quantity <= 0) {
      this.updateCartItems(currentItems.filter((candidate) => candidate.lineId !== lineId), tableNumber);
      return;
    }

    item.quantity = quantity;
    this.updateCartItems(currentItems, tableNumber);
  }

  updateItemNote(lineId: string, note: string): void {
    if (!this.ensureCartEditable()) {
      return;
    }

    const tableNumber = this.activeTableNumber$.value;
    if (tableNumber === null) {
      return;
    }

    const currentItems = this.cloneItems(this.cartItems$.value);
    const item = currentItems.find((candidate) => candidate.lineId === lineId);
    if (!item) {
      return;
    }

    const normalized = this.normalizeNote(note);
    if (item.quantity > 1 && normalized.length > 0) {
      item.quantity -= 1;
      const existingNotedLine = currentItems.find(
        (candidate) =>
          candidate.productId === item.productId
          && candidate.lineId !== lineId
          && this.normalizeNote(candidate.note) === normalized
      );

      if (existingNotedLine) {
        existingNotedLine.quantity += 1;
      } else {
        currentItems.push({
          ...item,
          lineId: this.createLineId(),
          quantity: 1,
          note: normalized,
        });
      }

      this.updateCartItems(currentItems, tableNumber);
      return;
    }

    item.note = normalized;
    this.mergeDuplicatedLines(currentItems);
    this.updateCartItems(currentItems, tableNumber);
  }

  /**
   * Limpia completamente el carrito
   */
  clearCart(): void {
    if (!this.ensureCartEditable()) {
      return;
    }

    const tableNumber = this.activeTableNumber$.value;
    if (tableNumber === null) {
      return;
    }

    this.updateCartItems([], tableNumber);
  }

  /**
   * Restaura un snapshot completo del carrito activo (lineas, cantidades y notas).
   * Se usa para implementar la accion de deshacer tras vaciar pedido.
   */
  restoreCartSnapshot(items: CartItem[]): void {
    if (!this.ensureCartEditable()) {
      return;
    }

    const tableNumber = this.activeTableNumber$.value;
    if (tableNumber === null) {
      return;
    }

    const restoredItems = this.cloneItems(items).map((item) => ({
      ...item,
      lineId: item.lineId && item.lineId.trim().length > 0 ? item.lineId : this.createLineId(),
    }));

    this.updateCartItems(restoredItems, tableNumber);
  }

  /**
   * Calcula totales y actualiza el estado del carrito
   */
  private updateCartItems(items: CartItem[], tableNumber: number): void {
    // Precio de producto con IVA incluido:
    // - total = PVP * cantidad
    // - VAT/subtotal se extraen solo para métricas internas
    items.forEach(item => {
      const grossTotal = item.unitPrice * item.quantity;
      const vatRate = item.vatPercent > 0 ? item.vatPercent : 0;
      const vat = vatRate > 0 ? grossTotal * (vatRate / (100 + vatRate)) : 0;
      item.vat = vat;
      item.subtotal = grossTotal - vat;
      item.total = grossTotal;
    });

    this.tableCarts[tableNumber] = this.cloneItems(items);
    this.updateSubjects(this.tableCarts[tableNumber]);
    this.saveCartsToStorage();

    if (!this.isHydratingFromBackend) {
      this.syncRequests$.next();
    }
  }

  private initializeAutoSync(): void {
    this.syncRequests$.pipe(
      // Evita tormenta de requests cuando el usuario toca varias veces el keypad.
      debounceTime(350),
      switchMap(() => this.pushActiveTableToBackend())
    ).subscribe();
  }

  /**
   * Sincroniza cambios del carrito activo.
   * Si queda vacío, limpia orden abierta; si no, actualiza/crea pedido.
   */
  private pushActiveTableToBackend(): Observable<SaleOrder | void> {
    if (this.isCartLocked$.value) {
      return EMPTY;
    }

    const tableNumber = this.activeTableNumber$.value;
    if (tableNumber === null) {
      return EMPTY;
    }

    const operatorUsername = this.authService.getCurrentUsername();
    if (!operatorUsername) {
      return EMPTY;
    }

    const items = this.tableCarts[tableNumber] ?? [];

    if (items.length === 0) {
      // Carrito vacío = también limpiamos orden abierta para no dejar basura operativa.
      return this.posOperationsService.clearOpenOrder(
        tableNumber,
        this.authService.getSessionToken()
      ).pipe(
        catchError((error) => {
          console.error('Error limpiando pedido en backend:', error);
          return EMPTY;
        })
      );
    }

    const groupedItems = this.groupItemsForBackend(items);
    return this.posOperationsService.openOrUpdateOrder({
      tableNumber,
      items: groupedItems,
      notes: this.buildOrderNotes(items),
      operatorUsername,
      operatorSessionToken: this.authService.getSessionToken()
    }).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 409) {
          // Conflicto de concurrencia: dos operaciones intentaron modificar el stock del mismo
          // producto a la vez. JPA rechazó la segunda gracias al campo @Version en Product.
          // El usuario verá el error si ocurre durante el cobro (order-summary lo muestra).
          console.warn('Conflicto de concurrencia en stock al sincronizar carrito (HTTP 409):', error.error?.message);
        } else {
          console.error('Error sincronizando pedido en backend:', error);
        }
        return EMPTY;
      })
    );
  }

  private mapOrderToCartItems(order: SaleOrder | undefined): CartItem[] {
    if (!order || !order.orderLines || order.orderLines.length === 0) {
      return [];
    }

    return order.orderLines.map((line: SaleOrderLine, index: number) => {
      const quantity = Number(line.quantity) || 0;
      const unitPrice = Number(line.unitPrice) || 0;
      const total = Number(line.total) || (quantity * unitPrice);
      const vat = Number(line.vatAmount) || 0;
      const subtotal = Number(line.subtotal) || (total - vat);

      return {
        lineId: line.id ? `backend-${line.id}` : `backend-${line.product?.id ?? 0}-${index}`,
        productId: line.product?.id ?? 0,
        productName: line.productName,
        note: '',
        quantity,
        unitPrice,
        vatPercent: Number(line.vatPercent) || 0,
        subtotal,
        vat,
        total
      };
      // Si backend devuelve líneas "huérfanas" sin productId, no entran al carrito local.
    }).filter((item) => item.productId > 0);
  }

  private updateSubjects(items: CartItem[]): void {
    this.cartItems$.next(items);

    // Actualizar resumen
    const summary: CartSummary = {
      items,
      subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
      totalVat: items.reduce((sum, item) => sum + item.vat, 0),
      total: items.reduce((sum, item) => sum + item.total, 0),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
    };

    this.cartSummary$.next(summary);
  }

  /**
   * Guarda el carrito en localStorage para persistencia
   */
  private saveCartsToStorage(): void {
    try {
      localStorage.setItem('tpv_cart_by_table', JSON.stringify(this.tableCarts));
    } catch (error) {
      console.error('Error guardando carrito en storage:', error);
    }
  }

  /**
   * Carga el carrito desde localStorage
   */
  private loadCartsFromStorage(): void {
    try {
      const stored = localStorage.getItem('tpv_cart_by_table');
      if (stored) {
        this.tableCarts = JSON.parse(stored) as Record<number, CartItem[]>;
        // Defensa mínima ante datos antiguos/corruptos.
        if (!this.tableCarts || typeof this.tableCarts !== 'object') {
          this.tableCarts = {};
        }

        for (const tableKey of Object.keys(this.tableCarts)) {
          this.tableCarts[Number(tableKey)] = (this.tableCarts[Number(tableKey)] || []).map((item) => ({
            ...item,
            lineId: item.lineId || this.createLineId(),
            note: this.normalizeNote(item.note),
          }));
        }
      }
    } catch (error) {
      console.error('Error cargando carrito desde storage:', error);
      this.tableCarts = {};
    }
  }

  private cloneItems(items: CartItem[]): CartItem[] {
    return items.map((item) => ({ ...item }));
  }

  private createLineId(): string {
    return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private normalizeNote(value: string | null | undefined): string {
    return (value ?? '').trim();
  }

  private mergeDuplicatedLines(items: CartItem[]): void {
    for (let i = 0; i < items.length; i += 1) {
      const base = items[i];
      for (let j = items.length - 1; j > i; j -= 1) {
        const candidate = items[j];
        if (candidate.productId === base.productId && this.normalizeNote(candidate.note) === this.normalizeNote(base.note)) {
          base.quantity += candidate.quantity;
          items.splice(j, 1);
        }
      }
    }
  }

  private groupItemsForBackend(items: CartItem[]): Array<{ productId: number; quantity: number }> {
    const grouped = new Map<number, number>();
    for (const item of items) {
      const previous = grouped.get(item.productId) ?? 0;
      grouped.set(item.productId, previous + item.quantity);
    }

    return Array.from(grouped.entries()).map(([productId, quantity]) => ({ productId, quantity }));
  }

  private buildOrderNotes(items: CartItem[]): string {
    const notedLines = items.filter((item) => this.normalizeNote(item.note).length > 0);
    if (notedLines.length === 0) {
      return 'Sincronizado desde TPV';
    }

    const details = notedLines
      .map((item) => `${item.productName} x${item.quantity}: ${this.normalizeNote(item.note)}`)
      .join(' | ');

    return `Notas de carrito: ${details}`;
  }

  private reconcileItemsKeepingNotes(backendItems: CartItem[], localItems: CartItem[]): CartItem[] {
    const localByProduct = new Map<number, CartItem[]>();
    for (const localItem of localItems) {
      if (!localByProduct.has(localItem.productId)) {
        localByProduct.set(localItem.productId, []);
      }
      localByProduct.get(localItem.productId)?.push({ ...localItem });
    }

    const reconciled: CartItem[] = [];

    for (const backendItem of backendItems) {
      const localLines = localByProduct.get(backendItem.productId) ?? [];
      const notedLines = localLines.filter((line) => this.normalizeNote(line.note).length > 0);
      const notedQty = notedLines.reduce((sum, line) => sum + line.quantity, 0);

      let remaining = backendItem.quantity;
      for (const noted of notedLines) {
        if (remaining <= 0) {
          break;
        }

        const qty = Math.min(noted.quantity, remaining);
        reconciled.push({
          ...backendItem,
          lineId: noted.lineId || this.createLineId(),
          note: this.normalizeNote(noted.note),
          quantity: qty,
        });
        remaining -= qty;
      }

      if (remaining > 0) {
        reconciled.push({
          ...backendItem,
          lineId: this.createLineId(),
          note: '',
          quantity: remaining,
        });
      }

      if (notedQty === 0 && remaining <= 0) {
        // no-op: backend quantity ya quedó cubierto por notas locales
      }
    }

    return reconciled;
  }

  private ensureCartEditable(): boolean {
    return !this.isCartLocked$.value;
  }

  private resolveCartLockFromTable(tableNumber: number): void {
    this.tableService.getActiveTables().pipe(take(1)).subscribe({
      next: (tables) => {
        const table = tables.find((candidate) => candidate.tableNumber === tableNumber);
        this.updateCartLockState(tableNumber, table?.displayName ?? null);
      },
      error: () => {
        // Fallback de seguridad: mantener criterio por numeración técnica de mesas virtuales.
        this.updateCartLockState(tableNumber, null);
      },
    });
  }

  private updateCartLockState(tableNumber: number, displayName: string | null): void {
    const normalizedName = (displayName ?? '').trim().toUpperCase();
    const isGlovoByName = normalizedName.startsWith('GLOVO ');
    const isGlovoByRange = tableNumber >= 1000;
    this.isCartLocked$.next(isGlovoByName || isGlovoByRange);
  }

  /**
   * Retorna un resumen vacío
   */
  private getEmptySummary(): CartSummary {
    return {
      items: [],
      subtotal: 0,
      totalVat: 0,
      total: 0,
      itemCount: 0
    };
  }
}
