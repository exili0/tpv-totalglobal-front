import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StockService } from '../../services/stock.service';
import { ProductService } from '../../services/product.service';

/**
 * Dashboard de estadísticas de stock automatizado.
 * Muestra resumen de pérdidas, movimientos de stock y análisis de desechos.
 */
@Component({
  selector: 'app-stock-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './stock-dashboard.component.html',
  styleUrls: ['./stock-dashboard.component.css'],
})
export class StockDashboardComponent implements OnInit {
  totalWaste: number = 0;
  wasteSummary: Record<string, number> = {};
  wasteList: any[] = [];
  movementsList: any[] = [];
  selectedProduct: any = null;
  selectedProductWaste: any[] = [];

  startDate: string = '';
  endDate: string = '';

  loading: boolean = false;
  productMap: Map<number, any> = new Map();

  displayedColumns: string[] = ['reason', 'quantity', 'createdAt'];

  get wasteSummaryEntries(): Array<{ key: number; value: number }> {
    return Object.entries(this.wasteSummary).map(([key, value]) => ({
      key: Number(key),
      value: Number(value),
    }));
  }

  get maxWasteValue(): number {
    const first = this.wasteSummaryEntries[0];
    return first?.value || 1;
  }

  constructor(
    private readonly stockService: StockService,
    private readonly productService: ProductService
  ) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    this.endDate = this.formatDate(today);
    this.startDate = this.formatDate(thirtyDaysAgo);
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadAllData();
  }

  loadAllData(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }
    this.loading = true;

    // forkJoin espera a que las 4 llamadas completen antes de resetear el spinner.
    // catchError en cada rama evita que un fallo individual cancele las demás.
    forkJoin([
      this.stockService.getTotalWaste().pipe(catchError(() => of(null))),
      this.stockService.getWasteSummary().pipe(catchError(() => of(null))),
      this.stockService.getWasteStatistics(this.startDate, this.endDate).pipe(catchError(() => of(null))),
      this.stockService.getMovementsByDateRange(this.startDate, this.endDate).pipe(catchError(() => of(null))),
    ]).subscribe({
      next: ([totalWasteRes, wasteSummaryRes, wasteStatsRes, movementsRes]) => {
        this.totalWaste = Number((totalWasteRes as any)?.totalWaste ?? 0);
        this.wasteSummary = (wasteSummaryRes ?? {}) as Record<string, number>;
        this.wasteList = Array.isArray(wasteStatsRes) ? wasteStatsRes : [];
        this.movementsList = Array.isArray(movementsRes) ? movementsRes : [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  getTotalWaste(): void {
    this.stockService.getTotalWaste().subscribe({
      next: (response: any) => {
        this.totalWaste = Number(response?.totalWaste ?? 0);
      },
      error: (error) => {
        console.error('Error al obtener total de pérdidas:', error);
      },
    });
  }

  getWasteSummary(): void {
    this.stockService.getWasteSummary().subscribe({
      next: (response: any) => {
        this.wasteSummary = (response ?? {}) as Record<string, number>;
      },
      error: (error) => {
        console.error('Error al obtener resumen de pérdidas:', error);
      },
    });
  }

  getWasteStatistics(): void {
    if (!this.startDate || !this.endDate) {
      this.loading = false;
      return;
    }

    this.stockService.getWasteStatistics(this.startDate, this.endDate).subscribe({
      next: (response: any) => {
        this.wasteList = Array.isArray(response) ? response : [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al obtener estadísticas de pérdidas:', error);
        this.loading = false;
      },
    });
  }

  getMovements(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }

    this.stockService.getMovementsByDateRange(this.startDate, this.endDate).subscribe({
      next: (response: any) => {
        this.movementsList = Array.isArray(response) ? response : [];
      },
      error: (error) => {
        console.error('Error al obtener movimientos:', error);
      },
    });
  }

  loadProducts(): void {
    this.productService.getAllProducts().subscribe({
      next: (response: any) => {
        const products = Array.isArray(response) ? response : [];
        products.forEach((product: any) => {
          if (product?.id != null) {
            this.productMap.set(product.id, product);
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar productos:', error);
      },
    });
  }

  selectProduct(productId: number): void {
    this.selectedProduct = this.productMap.get(productId) ?? null;

    if (!this.selectedProduct) {
      this.selectedProductWaste = [];
      return;
    }

    this.stockService.getProductWasteHistory(productId).subscribe({
      next: (response: any) => {
        this.selectedProductWaste = Array.isArray(response) ? response : [];
      },
      error: (error) => {
        console.error('Error al obtener histórico de desechos:', error);
      },
    });
  }

  applyDateFilter(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }
    this.loading = true;

    // Mismo patrón que loadAllData: forkJoin garantiza que loading se resetea
    // solo cuando ambas llamadas han terminado, sin importar cuál acabe primero.
    forkJoin([
      this.stockService.getWasteStatistics(this.startDate, this.endDate).pipe(catchError(() => of(null))),
      this.stockService.getMovementsByDateRange(this.startDate, this.endDate).pipe(catchError(() => of(null))),
    ]).subscribe({
      next: ([wasteStatsRes, movementsRes]) => {
        this.wasteList = Array.isArray(wasteStatsRes) ? wasteStatsRes : [];
        this.movementsList = Array.isArray(movementsRes) ? movementsRes : [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  getProductName(productId: number): string {
    return this.productMap.get(productId)?.name || `Producto ${productId}`;
  }

  getWastePercentage(productId: number): number {
    if (this.totalWaste === 0) return 0;
    const waste = Number(this.wasteSummary[productId] ?? this.wasteSummary[String(productId)] ?? 0);
    return Math.round((waste / this.totalWaste) * 100);
  }

  downloadReport(): void {
    let csv = 'Producto,Cantidad perdida,Porcentaje\n';
    Object.entries(this.wasteSummary).forEach(([productId, quantity]) => {
      const id = Number(productId);
      const productName = this.getProductName(id);
      const percentage = this.getWastePercentage(id);
      csv += `"${productName}",${quantity},${percentage}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-waste-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
