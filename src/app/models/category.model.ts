/**
 * Modelo de Categoría de Productos para el TPV
 */
export interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  active: boolean;
  parentCategoryId?: number | null;
  subcategories?: Category[];
  products?: any[];
}

/**
 * Request DTO para crear/actualizar categorías
 */
export interface CategoryRequest {
  name: string;
  description: string;
  color: string;
  parentCategoryId?: number | null;
}
