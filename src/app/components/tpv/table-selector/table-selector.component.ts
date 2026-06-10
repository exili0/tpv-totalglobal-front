import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, forkJoin, interval } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { NavbarComponent } from '../../navbar/navbar.component';
import { SaleOrder } from '../../../models/pos.model';
import { BusinessTable } from '../../../models/pos.model';
import { CashRegisterShift } from '../../../models/pos.model';
import { TableService } from '../../../services/table.service';
import { CartService } from '../../../services/cart.service';
import { AuthService } from '../../../services/auth.service';
import { PosOperationsService } from '../../../services/pos-operations.service';

@Component({
  selector: 'app-table-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, CurrencyPipe],
  templateUrl: './table-selector.component.html',
  styleUrl: './table-selector.component.css',
})
export class TableSelectorComponent implements OnInit, OnDestroy {
  tables: BusinessTable[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  infoMessage: string | null = null;
  pendingOrderTableNumbers = new Set<number>();
  /** Importe total pendiente (€) por número de mesa, actualizado en cada carga. */
  pendingOrderAmounts = new Map<number, number>();
  currentShift: CashRegisterShift | null = null;
  isMoveMode = false;
  isTableManageOpen = false;
  selectedSourceTableNumber: number | null = null;
  newTableNumber: number | null = null;
  newTableName = '';

  private refreshSubscription?: Subscription;
  private currentUsername: string | null = null;

  constructor(
    private readonly router: Router,
    private readonly tableService: TableService,
    private readonly cartService: CartService,
    private readonly authService: AuthService,
    private readonly posOperationsService: PosOperationsService
  ) {}

  get isAdmin(): boolean {
    return this.authService.getUserRole() === 'ADMIN';
  }

  ngOnInit(): void {
    this.currentUsername = this.authService.getCurrentUsername();
    this.loadTables();
    // Refresco suave para no depender de navegación manual cuando otra caja
    // ocupa/libera mesas en paralelo.
    this.refreshSubscription = interval(6000).subscribe(() => {
      this.loadTables();
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  loadTables(): void {
    this.errorMessage = null;
    this.infoMessage = null;
    this.isLoading = true;

    forkJoin({
      tables: this.tableService.getActiveTables(),
      openOrders: this.posOperationsService.getOpenOrders(),
      shift: this.posOperationsService.getCurrentShift(),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ tables, openOrders, shift }) => {
          this.tables = [...tables].sort((a, b) => a.tableNumber - b.tableNumber);
          this.currentShift = shift;
          // El estado OCCUPIED del backend no siempre basta:
          // si hay orden abierta con líneas, también tratamos la mesa como ocupada.
          this.pendingOrderTableNumbers = this.buildPendingOrderTableSet(openOrders);

          // Si la mesa origen seleccionada deja de ser válida, la reseteamos.
          if (this.selectedSourceTableNumber !== null && !this.pendingOrderTableNumbers.has(this.selectedSourceTableNumber)) {
            this.selectedSourceTableNumber = null;
          }

          if (this.isMoveMode && this.selectedSourceTableNumber === null && this.movableSourceTables.length > 0) {
            this.selectedSourceTableNumber = this.movableSourceTables[0].tableNumber;
          }

          if (!this.isCashShiftOpen()) {
            this.errorMessage = 'La caja está cerrada. Debes abrir turno para acceder a mesas y pedidos.';
          }
        },
        error: () => {
          this.errorMessage = 'No se pudieron cargar las mesas';
        },
      });
  }

  openTable(table: BusinessTable): void {
    if (this.isMoveMode) {
      this.moveOrderToTable(table);
      return;
    }

    if (!this.isCashShiftOpen()) {
      this.errorMessage = 'La caja está cerrada. Abre turno antes de tomar una mesa.';
      return;
    }

    if (this.isTableLockedByOther(table)) {
      this.errorMessage = this.getBlockedTableMessage(table);
      return;
    }

    const username = this.authService.getCurrentUsername();
    if (!username) {
      this.errorMessage = 'No se pudo identificar el usuario actual';
      return;
    }

    this.tableService.claimTable(table.tableNumber, username).subscribe({
      next: () => {
        this.errorMessage = null;
        this.cartService.setActiveTable(table.tableNumber);
        this.router.navigate(['/tpv/mesa', table.tableNumber]);
      },
      error: (error: unknown) => {
        this.errorMessage = this.getErrorMessage(error, 'No se pudo tomar la mesa');
      },
    });
  }

  get movableSourceTables(): BusinessTable[] {
    return this.tables.filter((table) => this.hasPendingOrder(table) && !this.isTableLockedByOther(table));
  }

  toggleMoveMode(): void {
    if (!this.isCashShiftOpen()) {
      this.errorMessage = 'La caja está cerrada. Abre turno antes de mover una comanda.';
      return;
    }

    this.errorMessage = null;
    this.infoMessage = null;
    this.isMoveMode = !this.isMoveMode;

    if (!this.isMoveMode) {
      this.selectedSourceTableNumber = null;
      return;
    }

    if (this.movableSourceTables.length === 0) {
      this.errorMessage = 'No hay mesas con comandas abiertas disponibles para mover';
      this.isMoveMode = false;
      return;
    }

    this.selectedSourceTableNumber = this.movableSourceTables[0].tableNumber;
    this.infoMessage = 'Modo mover mesa activo: selecciona una mesa destino libre';
  }

  toggleTableManage(): void {
    this.isTableManageOpen = !this.isTableManageOpen;
  }

  createTable(): void {
    if (!this.isAdmin) {
      this.errorMessage = 'Solo ADMIN puede crear mesas';
      return;
    }

    if (this.newTableNumber === null || this.newTableNumber < 1) {
      this.errorMessage = 'Indica un número de mesa válido (mínimo 1)';
      return;
    }

    this.errorMessage = null;
    this.infoMessage = null;

    this.tableService.createTable({
      tableNumber: this.newTableNumber,
      displayName: this.newTableName?.trim() || `Mesa ${this.newTableNumber}`,
      capacity: 4
    }).subscribe({
      next: () => {
        this.infoMessage = `Mesa ${this.newTableNumber} creada correctamente`;
        this.newTableNumber = null;
        this.newTableName = '';
        this.isTableManageOpen = false;
        this.loadTables();
      },
      error: (error: unknown) => {
        this.errorMessage = this.getErrorMessage(error, 'No se pudo crear la mesa');
      }
    });
  }

  deleteTable(table: BusinessTable, event: MouseEvent): void {
    event.stopPropagation();

    if (!this.isAdmin) {
      this.errorMessage = 'Solo ADMIN puede eliminar mesas';
      return;
    }

    if (this.isTableOccupied(table)) {
      this.errorMessage = `No se puede eliminar "${this.getTableDisplayName(table)}": tiene una comanda activa`;
      return;
    }

    if (!confirm(`¿Desactivar ${this.getTableDisplayName(table)}?`)) {
      return;
    }

    this.errorMessage = null;
    this.infoMessage = null;

    this.tableService.deleteTable(table.tableNumber).subscribe({
      next: () => {
        this.infoMessage = `Mesa ${table.tableNumber} desactivada`;
        this.loadTables();
      },
      error: (error: unknown) => {
        this.errorMessage = this.getErrorMessage(error, 'No se pudo desactivar la mesa');
      }
    });
  }

  private moveOrderToTable(destinationTable: BusinessTable): void {
    this.errorMessage = null;
    this.infoMessage = null;

    if (!this.isCashShiftOpen()) {
      this.errorMessage = 'La caja está cerrada. Abre turno antes de mover una comanda.';
      return;
    }

    if (this.selectedSourceTableNumber === null) {
      this.errorMessage = 'Selecciona una mesa origen para mover la comanda';
      return;
    }

    if (this.selectedSourceTableNumber === destinationTable.tableNumber) {
      this.errorMessage = 'La mesa destino debe ser diferente de la mesa origen';
      return;
    }

    if (this.isTableOccupied(destinationTable)) {
      this.errorMessage = 'La mesa destino ya está ocupada';
      return;
    }

    if (this.isTableLockedByOther(destinationTable)) {
      this.errorMessage = this.getBlockedTableMessage(destinationTable);
      return;
    }

    this.posOperationsService
      .moveOpenOrderBetweenTables({
        fromTableNumber: this.selectedSourceTableNumber,
        toTableNumber: destinationTable.tableNumber,
        sessionToken: this.authService.getSessionToken(),
      })
      .subscribe({
        next: () => {
          this.isMoveMode = false;
          this.infoMessage = `Comanda movida de mesa ${this.selectedSourceTableNumber} a mesa ${destinationTable.tableNumber}`;
          this.selectedSourceTableNumber = null;
          this.cartService.setActiveTable(destinationTable.tableNumber);
          this.router.navigate(['/tpv/mesa', destinationTable.tableNumber]);
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo mover la comanda entre mesas');
        },
      });
  }

  getStatusLabel(status: BusinessTable['status']): string {
    if (status === 'OCCUPIED') return 'Ocupada';
    if (status === 'INACTIVE') return 'Inactiva';
    return 'Libre';
  }

  getAttendantLabel(table: BusinessTable): string {
    if (!table.attendedBy) return '';
    return `Atiende: ${table.attendedBy}`;
  }

  getTableDisplayName(table: BusinessTable): string {
    const rawName = (table.displayName ?? '').trim();
    if (!rawName || /^table\b/i.test(rawName)) {
      return `Mesa ${table.tableNumber}`;
    }
    return rawName;
  }

  hasPendingOrder(table: BusinessTable): boolean {
    return this.pendingOrderTableNumbers.has(table.tableNumber);
  }

  /** Devuelve el importe total pendiente de cobro de la mesa, o null si no hay pedido. */
  getPendingAmount(table: BusinessTable): number | null {
    return this.pendingOrderAmounts.get(table.tableNumber) ?? null;
  }

  isTableOccupied(table: BusinessTable): boolean {
    return table.status === 'OCCUPIED' || this.hasPendingOrder(table);
  }

  isTableLockedByOther(table: BusinessTable): boolean {
    if (!table.attendedBy) {
      return false;
    }

    // Solo bloqueamos si realmente la atiende otro usuario.
    return this.currentUsername !== null && table.attendedBy !== this.currentUsername;
  }

  getTableStatusLabel(table: BusinessTable): string {
    if (table.status === 'INACTIVE') return 'Inactiva';
    if (this.hasPendingOrder(table)) return 'Ocupada';
    if (table.status === 'OCCUPIED') return 'Ocupada';
    return 'Libre';
  }

  isCashShiftOpen(): boolean { 
    // Si el turno de caja no está abierto, no se puede operar con mesas ni pedidos
    return this.currentShift?.status === 'OPEN';
  }

  private getBlockedTableMessage(table: BusinessTable): string {
    if (table.attendedBy) {
      return `La mesa ${table.tableNumber} la atiende ${table.attendedBy}`;
    }
    return `No se puede abrir la mesa ${table.tableNumber}`;
  }

  private buildPendingOrderTableSet(openOrders: SaleOrder[]): Set<number> {
    const tableNumbers = new Set<number>();
    const amounts = new Map<number, number>();

    for (const order of openOrders) {
      const tableNumber = order.table?.tableNumber;
      if (typeof tableNumber !== 'number') {
        continue;
      }

      if (order.orderLines && order.orderLines.length > 0) {
        // Evitamos marcar como ocupadas mesas con órdenes vacías (estado transitorio).
        tableNumbers.add(tableNumber);
        amounts.set(tableNumber, order.total ?? 0);
      }
    }

    this.pendingOrderAmounts = amounts;
    return tableNumbers;
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') {
      const raw = (error as { error?: unknown }).error;
      if (typeof raw === 'string' && raw.trim().length > 0) {
        return raw;
      }
      if (raw && typeof raw === 'object' && 'message' in raw) {
        const msg = (raw as { message?: unknown }).message;
        if (typeof msg === 'string' && msg.trim().length > 0) {
          return msg;
        }
      }
    }
    return fallback;
  }
}
