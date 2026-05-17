import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, forkJoin, interval } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { NavbarComponent } from '../../navbar/navbar.component';
import { SaleOrder } from '../../../models/pos.model';
import { BusinessTable } from '../../../models/pos.model';
import { TableService } from '../../../services/table.service';
import { CartService } from '../../../services/cart.service';
import { AuthService } from '../../../services/auth.service';
import { PosOperationsService } from '../../../services/pos-operations.service';

@Component({
  selector: 'app-table-selector',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './table-selector.component.html',
  styleUrl: './table-selector.component.css',
})
export class TableSelectorComponent implements OnInit, OnDestroy {
  tables: BusinessTable[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  pendingOrderTableNumbers = new Set<number>();

  private refreshSubscription?: Subscription;
  private currentUsername: string | null = null;

  constructor(
    private readonly router: Router,
    private readonly tableService: TableService,
    private readonly cartService: CartService,
    private readonly authService: AuthService,
    private readonly posOperationsService: PosOperationsService
  ) {}

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
    this.isLoading = true;

    forkJoin({
      tables: this.tableService.getActiveTables(),
      openOrders: this.posOperationsService.getOpenOrders(),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ tables, openOrders }) => {
          this.tables = [...tables].sort((a, b) => a.tableNumber - b.tableNumber);
          // El estado OCCUPIED del backend no siempre basta:
          // si hay orden abierta con líneas, también tratamos la mesa como ocupada.
          this.pendingOrderTableNumbers = this.buildPendingOrderTableSet(openOrders);
        },
        error: () => {
          this.errorMessage = 'No se pudieron cargar las mesas';
        },
      });
  }

  openTable(table: BusinessTable): void {
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

  private getBlockedTableMessage(table: BusinessTable): string {
    if (table.attendedBy) {
      return `La mesa ${table.tableNumber} la atiende ${table.attendedBy}`;
    }
    return `No se puede abrir la mesa ${table.tableNumber}`;
  }

  private buildPendingOrderTableSet(openOrders: SaleOrder[]): Set<number> {
    const tableNumbers = new Set<number>();

    for (const order of openOrders) {
      const tableNumber = order.table?.tableNumber;
      if (typeof tableNumber !== 'number') {
        continue;
      }

      if (order.orderLines && order.orderLines.length > 0) {
        // Evitamos marcar como ocupadas mesas con órdenes vacías (estado transitorio).
        tableNumbers.add(tableNumber);
      }
    }

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
