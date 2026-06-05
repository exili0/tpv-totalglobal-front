import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { CashRegisterShift } from '../../../models/pos.model';
import { PosOperationsService } from '../../../services/pos-operations.service';
import { NavbarComponent } from '../../navbar/navbar.component';

@Component({
  selector: 'app-shift-profit-view',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './shift-profit-view.component.html',
  styleUrl: './shift-profit-view.component.css',
})
export class ShiftProfitViewComponent implements OnInit {
  // Fuente completa recibida desde backend.
  shifts: CashRegisterShift[] = [];
  // Resultado visible tras aplicar filtros locales.
  filteredShifts: CashRegisterShift[] = [];

  isLoading = false;
  errorMessage: string | null = null;
  infoMessage: string | null = null;

  startDate = '';
  endDate = '';
  showOpenShifts = true;

  ngOnInit(): void {
    this.loadShifts();
  }

  constructor(
    private readonly posOperationsService: PosOperationsService,
    private readonly router: Router
  ) {}

  goBack(): void {
    this.router.navigate(['/admin-view']);
  }

  /**
   * Carga el histórico de turnos y resetea estados visuales de feedback
   * Si backend aún no expone /shifts, se muestra un mensaje guiado
   */
  loadShifts(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.infoMessage = null;

    this.posOperationsService
      .getShiftHistory(this.startDate || undefined, this.endDate || undefined)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (shifts) => {
          this.shifts = [...shifts].sort((a, b) => this.asTime(b.openedAt) - this.asTime(a.openedAt));
          this.applyFilters();
          if (this.shifts.length === 0) {
            this.infoMessage = 'No hay turnos registrados para el rango seleccionado.';
          }
        },
        error: (error: unknown) => {
          if (this.isNotImplementedError(error)) {
            this.errorMessage = 'La vista está lista, pero falta exponer en backend el endpoint GET /api/pos/shifts.';
            return;
          }
          this.errorMessage = this.getErrorMessage(error, 'No se pudieron cargar los turnos de caja.');
        },
      });
  }

  /** Aplica filtros en memoria para no repetir llamadas HTTP innecesarias.*/
  applyFilters(): void {
    this.filteredShifts = this.shifts.filter((shift) => this.showOpenShifts || shift.status === 'CLOSED');
  }

  /** Reaplica filtros cuando cambia el checkbox de turnos abiertos*/
  onFilterChange(): void {
    this.applyFilters();
  }

  /** Beneficio total acumulado de los turnos actualmente visibles. */
  get totalProfit(): number {
    return this.filteredShifts.reduce((acc, shift) => acc + (shift.totalProfit || 0), 0);
  }

  /** Ventas totales acumuladas de los turnos actualmente visibles. */
  get totalSales(): number {
    return this.filteredShifts.reduce((acc, shift) => acc + (shift.totalSales || 0), 0);
  }

  /** Beneficio promedio por turno del resultado filtrado. */
  get averageProfit(): number {
    if (this.filteredShifts.length === 0) {
      return 0;
    }
    return this.totalProfit / this.filteredShifts.length;
  }

  getShiftStatusLabel(status: CashRegisterShift['status']): string {
    return status === 'OPEN' ? 'Abierto' : 'Cerrado';
  }

  getShiftStatusClass(status: CashRegisterShift['status']): string {
    return status === 'OPEN' ? 'status-open' : 'status-closed';
  }

  viewShiftDetails(shiftId: number): void {
    this.router.navigate(['/admin/shift-details', shiftId]);
  }

  /** Normaliza fecha textual a epoch ms para ordenar sin errores de parseo. */
  private asTime(value: string | null): number {
    if (!value) {
      return 0;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /** PRUEBA para el back(identifica si el endpoint no está implementado) */
  private isNotImplementedError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const status = (error as { status?: unknown }).status;
    return status === 404 || status === 405;
  }

  /** Extrae mensaje útil del error HTTP con fallback para UI. */
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
