import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ShiftDetail } from '../../../models/pos.model';
import { PosOperationsService } from '../../../services/pos-operations.service';
import { NavbarComponent } from '../../navbar/navbar.component';

@Component({
  selector: 'app-shift-detail-view',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './shift-detail-view.component.html',
  styleUrl: './shift-detail-view.component.css',
})
export class ShiftDetailViewComponent implements OnInit {
  isLoading = false;
  errorMessage: string | null = null;
  detail: ShiftDetail | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly posOperationsService: PosOperationsService
  ) {}

  ngOnInit(): void {
    this.loadShiftDetail();
  }

  goBack(): void {
    this.router.navigate(['/admin/shift-profits']);
  }

  private loadShiftDetail(): void {
    const shiftId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(shiftId) || shiftId <= 0) {
      this.errorMessage = 'El turno solicitado no es válido.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    this.posOperationsService
      .getShiftDetail(shiftId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (detail) => {
          this.detail = detail;
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error, 'No se pudo cargar el detalle del turno.');
        },
      });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') { 
      const raw = (error as { error?: unknown }).error;
      if (typeof raw === 'string' && raw.trim().length > 0) {
        return raw;
      }
      if (raw && typeof raw === 'object' && 'message' in raw){
        const msg = (raw as { message?: unknown }).message;
        if (typeof msg === 'string' && msg.trim().length > 0) {
          return msg;
        }
      }
    }

    return fallback;
  }
}
