import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategoryService } from '../../../services/category.service';
import { Category, CategoryRequest } from '../../../models/category.model';
import { AccessibilityTheme, AccessibilityThemeService } from '../../../services/accessibility-theme.service';
import { CategoryColorAccessibilityService } from '../../../services/category-color-accessibility.service';
import { AuthService } from '../../../services/auth.service';
import { AuditService } from '../../../services/audit.service';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.css'
})
export class CategoryFormComponent implements OnInit {
  @Input() category: Category | null = null;
  @Output() formClosed = new EventEmitter<void>();
  @Output() formSubmitted = new EventEmitter<void>();

  form: FormGroup;
  categories: Category[] = [];
  isLoading = false;
  error: string | null = null;
  isEditMode = false;

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService,
    private accessibilityThemeService: AccessibilityThemeService,
    private categoryColorAccessibilityService: CategoryColorAccessibilityService,
    private authService: AuthService,
    private auditService: AuditService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required],
      color: ['#FF5733', Validators.required],
      parentCategoryId: [null]
    });
  }

  ngOnInit(): void {
    this.loadCategories();

    if (this.category) {
      this.isEditMode = true;
      this.form.patchValue({
        name: this.category.name,
        description: this.category.description,
        color: this.category.color,
        parentCategoryId: this.category.parentCategoryId
      });
    }
  }

  private loadCategories(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (categories) => {
        this.categories = this.isEditMode && this.category
          ? categories.filter((candidate) => candidate.id !== this.category!.id)
          : categories;
      },
      error: (err) => {
        console.error('Error cargando categorías para el formulario:', err);
      },
    });
  }

  /**
   * Env�a el formulario (crear o actualizar)
   */
  submit(): void {
    if (this.form.invalid) return;

    this.isLoading = true;
    this.error = null;
    const parentCategoryIdValue = this.form.value.parentCategoryId;
    const request: CategoryRequest = {
      ...this.form.value,
      parentCategoryId: parentCategoryIdValue === null || parentCategoryIdValue === ''
        ? null
        : Number(parentCategoryIdValue),
    };

    const operation = this.isEditMode
      ? this.categoryService.updateCategory(this.category!.id, request)
      : this.categoryService.createCategory(request);

    operation.subscribe({
      next: (savedCategory) => {
        // Reseteamos isLoading antes de emitir para que el botón no quede bloqueado
        // si el padre reutiliza el formulario sin destruirlo.
        if (!this.isEditMode) {
          const actor = this.authService.getCurrentUsername() || 'usuario';
          const parentName = this.categories.find((category) => category.id === request.parentCategoryId)?.name;
          this.auditService.recordCreated(
            'category',
            savedCategory.name || request.name,
            actor,
            parentName ? `Padre: ${parentName}` : 'Categoría raíz'
          );
        }
        this.isLoading = false;
        this.formSubmitted.emit();
      },
      error: (err) => {
        this.error = 'Error al guardar categoría';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  /**
   * Cierra el formulario
   */
  cancel(): void {
    this.formClosed.emit();
  }

  isColorAdaptedMode(): boolean {
    return this.accessibilityThemeService.getSavedTheme() !== 'default';
  }

  getAccessiblePreviewColor(): string {
    const rawColor = this.form.get('color')?.value as string;
    const theme = this.accessibilityThemeService.getSavedTheme() as AccessibilityTheme;
    return this.categoryColorAccessibilityService.getDisplayColor(rawColor, theme, 0);
  }
}
