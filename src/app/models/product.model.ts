import { Category } from './category.model';

/**
 * Modelo de Producto para el TPV
 */
export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  costPrice?: number;
  vatPercent: number;
  barcode?: string;
  imageUrl?: string;
  active: boolean;
  stock?: number;
  categoryId?: number;
  category?: Category;
}

/**
 * Request DTO para crear/actualizar productos
 */
export interface ProductRequest {
  name: string;
  description: string;
  price: number;
  costPrice?: number;
  vatPercent: number;
  barcode?: string;
  imageUrl?: string;
  stock?: number;
  categoryId: number;
}
