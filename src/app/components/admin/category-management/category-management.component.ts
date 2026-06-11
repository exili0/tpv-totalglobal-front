import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CategoryService } from '../../../services/category.service';
import { Category } from '../../../models/category.model';
import { CategoryFormComponent } from '../category-form/category-form.component';
import { NavbarComponent } from '../../navbar/navbar.component';
import { AccessibilityTheme, AccessibilityThemeService } from '../../../services/accessibility-theme.service';
import { CategoryColorAccessibilityService } from '../../../services/category-color-accessibility.service';
import { AuditEvent, AuditService } from '../../../services/audit.service';

/**
 * Pantalla de gestión de categorías del panel de administración.
 * Lista todas las categorías y permite crearlas, editarlas, eliminarlas y
 * activarlas/desactivarlas. Los colores se adaptan al tema de accesibilidad activo.
 */
@Component({
  selector: 'app-category-management',
  standalone: true,
  imports: [CommonModule, FormsModule, CategoryFormComponent, NavbarComponent],
  templateUrl: './category-management.component.html',
  styleUrl: './category-management.component.css',
})
export class CategoryManagementComponent implements OnInit {
  categories: Category[] = [];
  isLoading = false;
  error: string | null = null;
  // Controla si el formulario de creación/edición está visible
  showForm = false;
  showAuditModal = false;
  auditFilter = '';
  // Categoría que se está editando; null si es una creación nueva
  selectedCategory: Category | null = null;
  auditEntries: AuditEvent[] = [];

  constructor(
    private readonly router: Router,
    private readonly categoryService: CategoryService,
    private readonly accessibilityThemeService: AccessibilityThemeService,
    private readonly categoryColorAccessibilityService: CategoryColorAccessibilityService,
    private readonly auditService: AuditService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  goBack(): void {
    this.router.navigate(['/admin-view']);
  }

  loadCategories(): void {
    this.isLoading = true;
    this.error = null;
    this.categoryService.getAllCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar categorías';
        this.isLoading = false;
        console.error(err);
      },
    });
  }

  /** Abre el formulario en blanco para crear una nueva categoría. */
  openNewForm(): void {
    this.selectedCategory = null;
    this.showForm = true;
  }

  openAuditModal(): void {
    this.auditFilter = '';
    this.auditEntries = this.auditService
      .getEvents('category')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.showAuditModal = true;
  }

  closeAuditModal(): void {
    this.showAuditModal = false;
  }

  get filteredAuditEntries(): AuditEvent[] {
    const term = this.auditFilter.trim().toLowerCase();
    if (!term) {
      return this.auditEntries;
    }

    return this.auditEntries.filter((entry) => {
      const values = [
        entry.entityName,
        entry.actor,
        entry.details ?? '',
        this.formatAuditDate(entry.createdAt),
      ];
      return values.some((value) => value.toLowerCase().includes(term));
    });
  }

  formatAuditDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /** Abre el formulario precargado con los datos de la categoría a editar. */
  editCategory(category: Category): void {
    this.selectedCategory = category;
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.selectedCategory = null;
  }

  deleteCategory(id: number): void {
    if (confirm('¿Eliminar esta categoría?')) {
      this.categoryService.deleteCategory(id).subscribe({
        next: () => this.loadCategories(),
        error: (err) => {
          this.error = err?.error?.message || err?.message || 'Error al eliminar categoría';
          console.error(err);
        },
      });
    }
  }

  /** Alterna el estado activo/inactivo de la categoría para mostrarla u ocultarla en el TPV. */
  toggleActive(category: Category): void {
    this.categoryService.toggleCategoryActive(category.id, !category.active).subscribe({
      next: () => this.loadCategories(),
      error: (err) => {
        this.error = 'Error al actualizar categoría';
        console.error(err);
      },
    });
  }

  /**
   * Devuelve el color adaptado al tema de accesibilidad activo.
   * Necesario para que los colores de las categorías sean distinguibles
   * por usuarios con daltonismo.
   */
  getAccessibleColor(hexColor: string, index: number): string {
    const theme = this.accessibilityThemeService.getSavedTheme() as AccessibilityTheme;
    return this.categoryColorAccessibilityService.getDisplayColor(hexColor, theme, index);
  }
}
