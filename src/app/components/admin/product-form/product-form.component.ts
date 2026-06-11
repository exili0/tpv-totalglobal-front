import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductService } from '../../../services/product.service';
import { CategoryService } from '../../../services/category.service';
import { Product, ProductRequest } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import { AuthService } from '../../../services/auth.service';
import { AuditService } from '../../../services/audit.service';

/**
 * Formulario reactivo para crear o editar un producto.
 * Recibe el producto a editar vía @Input; si no se pasa ninguno, opera en modo creación.
 * Emite eventos al padre cuando el formulario se guarda o se cancela.
 */
@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.css',
})
export class ProductFormComponent implements OnInit {
  // Producto existente para editar; null si es creación nueva
  @Input() product: Product | null = null;
  @Output() formClosed = new EventEmitter<void>();
  @Output() formSubmitted = new EventEmitter<void>();

  form: FormGroup;
  isLoading = false;
  error: string | null = null;
  isEditMode = false;
  categories: Category[] = [];
  showCostCalculator = false;
  packageUnits = 1;
  packagePrice = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly productService: ProductService,
    private readonly categoryService: CategoryService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService
  ) {
    // Definimos la estructura del formulario con sus validaciones en el constructor
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0.01)]],
      costPrice: [0, [Validators.min(0)]],
      vatPercent: [21, [Validators.required, Validators.min(0), Validators.max(100)]],
      barcode: [''],
      imageUrl: [''],
      stock: [0, Validators.min(0)],
      categoryId: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadCategories();
    if (this.product) {
      // Si nos pasan un producto, entramos en modo edición y rellenamos el formulario
      this.isEditMode = true;
      const resolvedCategoryId = this.product.categoryId ?? this.product.category?.id ?? '';
      this.form.patchValue({
        name: this.product.name,
        description: this.product.description,
        price: this.product.price,
        costPrice: this.product.costPrice ?? 0,
        vatPercent: this.product.vatPercent,
        barcode: this.product.barcode,
        imageUrl: this.product.imageUrl,
        stock: this.product.stock,
        categoryId: resolvedCategoryId,
      });
    }

  }

  private loadCategories(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (err) => {
        console.error('Error cargando categorías:', err);
      },
    });
  }

  /** Valida el formulario y llama al servicio para crear o actualizar el producto. */
  submit(): void {
    if (this.form.invalid) return;

    this.isLoading = true;
    this.error = null;
    const request: ProductRequest = this.form.value;

    // Elegimos la operación según si estamos editando o creando
    const operation = this.isEditMode
      ? this.productService.updateProduct(this.product!.id, request)
      : this.productService.createProduct(request);

    operation.subscribe({
      next: (savedProduct) => {
        // Reseteamos isLoading antes de emitir para que el botón no quede bloqueado
        // si el padre reutiliza el formulario sin destruirlo.
        if (!this.isEditMode) {
          const actor = this.authService.getCurrentUsername() || 'usuario';
          const categoryName = this.categories.find((category) => category.id === request.categoryId)?.name;
          this.auditService.recordCreated(
            'product',
            savedProduct.name || request.name,
            actor,
            categoryName ? `Categoría: ${categoryName}` : undefined
          );
        }
        this.isLoading = false;
        this.formSubmitted.emit();
      },
      error: (err) => {
        this.error = 'Error al guardar producto';
        this.isLoading = false;
        console.error(err);
      },
    });
  }

  cancel(): void {
    this.formClosed.emit();
  }

  openCostCalculator(): void {
    this.showCostCalculator = true;
    this.packageUnits = 1;
    this.packagePrice = 0;
  }

  closeCostCalculator(): void {
    this.showCostCalculator = false;
  }

  get calculatedUnitCost(): number {
    if (!Number.isFinite(this.packageUnits) || this.packageUnits <= 0) {
      return 0;
    }

    if (!Number.isFinite(this.packagePrice) || this.packagePrice < 0) {
      return 0;
    }

    return Number((this.packagePrice / this.packageUnits).toFixed(4));
  }

  applyUnitCost(): void {
    this.form.patchValue({ costPrice: this.calculatedUnitCost });
    this.closeCostCalculator();
  }
}
