import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { DailyZReportResponse } from '../../../models/pos.model';
import { PosOperationsService } from '../../../services/pos-operations.service';

/**
 * Modal del reporte de cierre Z diario.
 * Muestra un resumen de ventas, ingresos y métodos de pago para la fecha elegida.
 * Por defecto carga los datos del día actual al abrirse.
 */
@Component({
  selector: 'app-daily-z-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './daily-z-report.component.html',
  styleUrl: './daily-z-report.component.css',
})
export class DailyZReportComponent implements OnInit {
  // La fecha seleccionada arranca con el día de hoy en formato ISO (YYYY-MM-DD)
  selectedDate = this.getTodayIso();
  report: DailyZReportResponse | null = null;
  isLoading = false;
  errorMessage: string | null = null;

  constructor(private readonly posOperationsService: PosOperationsService) {}

  ngOnInit(): void {
    // Cargamos el reporte del día al abrir el modal
    this.loadReport();
  }

  /** Solicita el reporte Z al backend para la fecha seleccionada en el selector. */
  loadReport(): void {
    this.errorMessage = null;
    this.isLoading = true;

    this.posOperationsService
      .getDailyZReport(this.selectedDate)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (report) => {
          this.report = report;
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo cargar el reporte Z');
        },
      });
  }

  /** Devuelve la fecha actual en formato ISO YYYY-MM-DD para inicializar el selector. */
  private getTodayIso(): string {
    return new Date().toISOString().split('T')[0];
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
