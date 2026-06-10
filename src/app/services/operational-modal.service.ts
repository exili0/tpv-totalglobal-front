import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Bus de eventos ligero para abrir el modal Z con una fecha concreta
 * desde cualquier vista (turnos, navbar, etc.).
 */
@Injectable({
  providedIn: 'root'
})
export class OperationalModalService {
  private readonly zReportRequestSubject = new Subject<string>();

  get zReportRequests$(): Observable<string> {
    return this.zReportRequestSubject.asObservable();
  }

  requestZReportForDate(dateIso: string): void {
    this.zReportRequestSubject.next(dateIso);
  }
}
