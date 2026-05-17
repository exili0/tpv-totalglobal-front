import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategoryService } from '../../../services/category.service';
import { Category, CategoryRequest } from '../../../models/category.model';
import { AccessibilityTheme, AccessibilityThemeService } from '../../../services/accessibility-theme.service';
import { CategoryColorAccessibilityService } from '../../../services/category-color-accessibility.service';

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
  isLoading = false;
  error: string | null = null;
  isEditMode = false;

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService,
    private accessibilityThemeService: AccessibilityThemeService,
    private categoryColorAccessibilityService: CategoryColorAccessibilityService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required],
      color: ['#FF5733', Validators.required],
      parentCategoryId: [null]
    });
  }

  ngOnInit(): void {
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

  /**
   * Env�a el formulario (crear o actualizar)
   */
  submit(): void {
    if (this.form.invalid) return;

    this.isLoading = true;
    this.error = null;
    const request: CategoryRequest = this.form.value;

    const operation = this.isEditMode
      ? this.categoryService.updateCategory(this.category!.id, request)
      : this.categoryService.createCategory(request);

    operation.subscribe({
      next: () => {
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
