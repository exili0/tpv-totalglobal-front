import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefundStockModalComponent } from './refund-stock-modal.component';

describe('RefundStockModalComponent', () => {
  let component: RefundStockModalComponent;
  let fixture: ComponentFixture<RefundStockModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RefundStockModalComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RefundStockModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
