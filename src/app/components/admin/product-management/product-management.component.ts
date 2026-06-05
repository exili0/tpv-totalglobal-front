import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { ProductFormComponent } from '../product-form/product-form.component';
import { NavbarComponent } from '../../navbar/navbar.component';
import { AuditEvent, AuditService } from '../../../services/audit.service';

/**
 * Pantalla de gestión de productos del panel de administración.
 * Lista todos los productos y permite crearlos, editarlos, eliminarlos y
 * activar/desactivar su visibilidad en el TPV.
 */
@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [CommonModule, ProductFormComponent, NavbarComponent],
  templateUrl: './product-management.component.html',
  styleUrl: './product-management.component.css',
})
export class ProductManagementComponent implements OnInit {
  products: Product[] = [];
  isLoading = false;
  error: string | null = null;
  // Controla si el formulario de creación/edición está visible
  showForm = false;
  showAuditModal = false;
  // Producto que se está editando; null si es una creación nueva
  selectedProduct: Product | null = null;
  auditEntries: AuditEvent[] = [];

  constructor(
    private readonly router: Router,
    private readonly productService: ProductService,
    private readonly auditService: AuditService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  goBack(): void {
    this.router.navigate(['/admin-view']);
  }

  loadProducts(): void {
    this.isLoading = true;
    this.error = null;
    this.productService.getAllProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar productos';
        this.isLoading = false;
        console.error(err);
      },
    });
  }

  /** Abre el formulario en blanco para crear un nuevo producto. */
  openNewForm(): void {
    this.selectedProduct = null;
    this.showForm = true;
  }

  openAuditModal(): void {
    this.auditEntries = this.auditService.getEvents('product');
    this.showAuditModal = true;
  }

  closeAuditModal(): void {
    this.showAuditModal = false;
  }

  /** Abre el formulario precargado con los datos del producto a editar. */
  editProduct(product: Product): void {
    this.selectedProduct = product;
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.selectedProduct = null;
  }

  deleteProduct(id: number): void {
    if (confirm('¿Eliminar este producto?')) {
      this.productService.deleteProduct(id).subscribe({
        next: () => this.loadProducts(),
        error: (err) => {
          this.error = 'Error al eliminar producto';
          console.error(err);
        },
      });
    }
  }

  /** Alterna el estado activo/inactivo del producto para mostrarlo u ocultarlo en el TPV. */
  toggleActive(product: Product): void {
    this.productService.toggleProductActive(product.id, !product.active).subscribe({
      next: () => this.loadProducts(),
      error: (err) => {
        this.error = 'Error al actualizar producto';
        console.error(err);
      },
    });
  }
}
