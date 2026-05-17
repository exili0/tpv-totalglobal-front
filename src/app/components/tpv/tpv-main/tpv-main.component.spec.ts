import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TpvMainComponent } from './tpv-main.component';

describe('TpvMainComponent', () => {
  let component: TpvMainComponent;
  let fixture: ComponentFixture<TpvMainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TpvMainComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TpvMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
