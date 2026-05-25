import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export type QuantityMode = 'add' | 'subtract';

@Injectable({
  providedIn: 'root'
})
export class QuantitySelectorService {
  /** Estado reactivo de cantidad para keypad numérico del TPV. */
  private readonly quantity$ = new BehaviorSubject<number>(1);
  /** Modo de operación: sumar o restar unidades. */
  private readonly mode$ = new BehaviorSubject<QuantityMode>('add');
  /** Evento que avisa cuando la cantidad se consumió al seleccionar un producto. */
  private readonly selectionApplied$ = new Subject<void>();
  private hasCustomInput = false;

  getQuantity(): Observable<number> {
    return this.quantity$.asObservable();
  }

  getMode(): Observable<QuantityMode> {
    return this.mode$.asObservable();
  }

  getSelectionApplied(): Observable<void> {
    return this.selectionApplied$.asObservable();
  }

  getCurrentQuantity(): number {
    return this.quantity$.value;
  }

  getCurrentMode(): QuantityMode {
    return this.mode$.value;
  }

  /** Añade dígitos como si fuera una calculadora de TPV. */
  appendDigit(digit: number): void {
    const safeDigit = Math.max(0, Math.min(9, Math.trunc(digit)));
    const current = this.quantity$.value;
    const nextValue = !this.hasCustomInput && current === 1
      ? safeDigit
      : Number(`${current}${safeDigit}`);

    this.quantity$.next(Math.max(1, Math.min(nextValue, 999)));
    this.hasCustomInput = true;
  }

  /** Reinicia selector a estado base. */
  clear(): void {
    this.quantity$.next(1);
    this.hasCustomInput = false;
  }

  backspace(): void {
    const current = String(this.quantity$.value);
    const next = current.length > 1 ? Number(current.slice(0, -1)) : 1;
    this.quantity$.next(Math.max(1, next));
    this.hasCustomInput = next > 1 || current.length > 1;
  }

  /** Fuerza modo explícito (sumar/restar). */
  setMode(mode: QuantityMode): void {
    this.mode$.next(mode);
  }

  toggleMode(): void {
    this.mode$.next(this.mode$.value === 'add' ? 'subtract' : 'add');
  }

  getDisplayQuantity(): number {
    return this.mode$.value === 'subtract' ? -this.quantity$.value : this.quantity$.value;
  }

  /** Incrementa la cantidad un paso para controles compactos (+). */
  increment(step = 1): void {
    const safeStep = Math.max(1, Math.trunc(step));
    const next = Math.min(999, this.quantity$.value + safeStep);
    this.quantity$.next(next);
    this.hasCustomInput = true;
  }

  /** Reduce la cantidad un paso para controles compactos (-), con mínimo 1. */
  decrement(step = 1): void {
    const safeStep = Math.max(1, Math.trunc(step));
    const next = Math.max(1, this.quantity$.value - safeStep);
    this.quantity$.next(next);
    this.hasCustomInput = next > 1;
  }

  /**
   * Se invoca al añadir/quitar producto desde el grid:
   * resetea cantidad a 1, modo add y notifica a la UI para replegar el panel.
   */
  applySelectionAndReset(): void {
    this.mode$.next('add');
    this.clear();
    this.selectionApplied$.next();
  }
}
