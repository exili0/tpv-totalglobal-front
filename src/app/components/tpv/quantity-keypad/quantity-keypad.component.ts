import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuantityMode, QuantitySelectorService } from '../../../services/quantity-selector.service';

@Component({
  selector: 'app-quantity-keypad',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quantity-keypad.component.html',
  styleUrl: './quantity-keypad.component.css',
})
export class QuantityKeypadComponent implements OnInit {
  quantity = 1;
  mode: QuantityMode = 'add';
  readonly digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  constructor(private readonly quantitySelectorService: QuantitySelectorService) {}

  ngOnInit(): void {
    this.quantity = this.quantitySelectorService.getCurrentQuantity();
    this.mode = this.quantitySelectorService.getCurrentMode();
  }

  pressDigit(digit: number): void {
    this.quantitySelectorService.appendDigit(digit);
    this.quantity = this.quantitySelectorService.getCurrentQuantity();
  }

  pressAdd(): void {
    this.quantitySelectorService.setMode('add');
    this.mode = 'add';
  }

  pressSubtract(): void {
    this.quantitySelectorService.setMode('subtract');
    this.mode = 'subtract';
  }

  clear(): void {
    this.quantitySelectorService.clear();
    this.quantity = this.quantitySelectorService.getCurrentQuantity();
  }

  backspace(): void {
    this.quantitySelectorService.backspace();
    this.quantity = this.quantitySelectorService.getCurrentQuantity();
  }
}
