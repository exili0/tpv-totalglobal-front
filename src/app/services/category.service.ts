import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category, CategoryRequest } from '../models/category.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private apiUrl = 'http://localhost:8080/api/categories';

  constructor(private http: HttpClient) { }

  /**
   * Obtiene todas las categorías (incluidas inactivas) - para admin
   */
  getAllCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.apiUrl);
  }

  /**
   * Obtiene solo las categorías activas - para TPV
   */
  getActiveCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/active`);
  }

  /**
   * Obtiene las categorías raíz activas (sin padre) - para menú principal TPV
   */
  getRootCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/roots`);
  }

  /**
   * Obtiene una categoría por ID
   */
  getCategoryById(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crea una nueva categoría
   */
  createCategory(request: CategoryRequest): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, request);
  }

  /**
   * Actualiza una categoría existente
   */
  updateCategory(id: number, request: CategoryRequest): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/${id}`, request);
  }

  /**
   * Activa o desactiva una categoría
   */
  toggleCategoryActive(id: number, active: boolean): Observable<Category> {
    return this.http.patch<Category>(`${this.apiUrl}/${id}/active`, { active });
  }

  /**
   * Elimina una categoría
   */
  deleteCategory(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
