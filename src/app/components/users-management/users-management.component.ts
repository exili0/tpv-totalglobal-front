import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, UserEntity, CreateUserRequest, UpdateUserRequest } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

/** Modelo local del usuario para la tabla de gestión. */
interface User {
  cod: number;
  alias: string;
  name: string;
  lastname: string;
  email: string;
  date: string;
  active: boolean;
  restPassword: boolean;
  role?: string;
  firstLogin: boolean;
}

/**
 * Pantalla de gestión de usuarios (solo para administradores).
 * Permite listar, crear, editar, activar/desactivar y eliminar usuarios,
 * así como reactivar el flujo de primer acceso para que vuelvan a configurar su cuenta.
 */
@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [NavbarComponent, CommonModule, FormsModule],
  templateUrl: './users-management.component.html',
  styleUrl: './users-management.component.css',
})
export class UsersManagementComponent implements OnInit {
  users: User[] = [];
  isLoading = false;
  errorMessage = '';

  showAddUserModal = false;
  showEditUserModal = false;
  editingUserCod: number | null = null;
  originalEditDate = '';

  todayDate = new Date().toISOString().split('T')[0];
  newUserForm = {
    name: '',
    lastname: '',
    alias: '',
    email: '',
    date: this.todayDate,
    role: 'COMMON_USER',
  };

  editUserForm = {
    name: '',
    lastname: '',
    alias: '',
    email: '',
    date: '',
    role: 'COMMON_USER',
  };

  constructor(
    private readonly router: Router,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  gotoAdminView(): void {
    this.router.navigate(['/admin-view']);
  }

  /**
   * Normaliza el valor de fecha que devuelve el backend a formato YYYY-MM-DD.
   * El backend puede devolver Date, string ISO con hora o string solo fecha,
   * por lo que esta función unifica todos los casos.
   */
  private normalizeBackendDate(dateValue: unknown): string {
    if (!dateValue) {
      return '';
    }

    const toYmdLocal = (d: Date): string => {
      if (Number.isNaN(d.getTime())) {
        return '';
      }
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (dateValue instanceof Date) {
      return toYmdLocal(dateValue);
    }

    const raw = dateValue.toString().trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    if (raw.includes('T')) {
      return toYmdLocal(new Date(raw));
    }

    return raw;
  }

  loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // CORREGIDO: Tipado explícito de la respuesta asíncrona del backend
    this.userService.getAllUsers().subscribe({
      next: (backendUsers: UserEntity[]) => {
        this.users = backendUsers.map((bu: UserEntity) => ({
          cod: bu.id || 0,
          alias: bu.username,
          name: bu.name || '',
          lastname: bu.lastname || '',
          email: bu.email || '',
          date: this.normalizeBackendDate(bu.dateCreated),
          active: bu.active,
          restPassword: false,
          role: bu.role,
          firstLogin: bu.firstLogin ?? false,
        }));

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error al cargar usuarios:', error);
        this.errorMessage = 'Error al cargar los usuarios';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  /** Garantiza que la tabla siempre muestre al menos 6 filas, rellenando con filas vacías si hace falta. */
  get displayUsers(): User[] {
    const minRows = 6;
    if (this.users.length >= minRows) {
      return this.users;
    }
    const emptyRows = Array(minRows - this.users.length).fill({} as User);
    return [...this.users, ...emptyRows];
  }

  formatDisplayDate(date: string): string {
    if (!date) return '';
    const normalizedDate = date.includes('T') ? date.split('T')[0] : date;
    const [year, month, day] = normalizedDate.split('-');
    if (!year || !month || !day) return date;
    return `${day}-${month}-${year}`;
  }

  formatRole(role?: string): string {
    if (role === 'ADMIN') {
      return 'Admin';
    }

    if (role === 'COMMON_USER') {
      return 'Usuario comun';
    }

    return role || '-';
  }

  toggleUserActive(user: User): void {
    if (user.cod) {
      // CORREGIDO: Tipado explícito en la actualización de estado activo
      this.userService.toggleUserActive(user.cod, !user.active).subscribe({
        next: (updatedUser: UserEntity) => {
          user.active = updatedUser.active;
          this.users = [...this.users];
          this.cdr.detectChanges();
        },
        error: (error: any) => {
          console.error('Error al cambiar estado del usuario:', error);
          alert('Error al cambiar el estado del usuario');
        },
      });
    }
  }

  openAddUserModal(): void {
    this.todayDate = new Date().toISOString().split('T')[0];
    this.newUserForm = {
      name: '',
      lastname: '',
      alias: '',
      date: this.todayDate,
      email: '',
      role: 'COMMON_USER',
    };
    this.showAddUserModal = true;
  }

  closeAddUserModal(): void {
    this.showAddUserModal = false;
  }

  /**
   * Genera automáticamente el alias del usuario a partir de la inicial
   * del nombre y el apellido para facilitar el alta rápida.
   */
  updateAlias(): void {
    const name = this.newUserForm.name.trim();
    const lastname = this.newUserForm.lastname.trim();

    if (name && lastname) {
      const firstLetter = name.charAt(0).toLowerCase();
      const lastnameLower = lastname.toLowerCase().replace(/\s+/g, '');
      this.newUserForm.alias = firstLetter + lastnameLower;
    } else if (name) {
      this.newUserForm.alias = name.charAt(0).toLowerCase();
    } else {
      this.newUserForm.alias = '';
    }
  }

  saveNewUser(): void {
    const alias = this.newUserForm.alias.trim();
    const email = this.newUserForm.email.trim();
    const name = this.newUserForm.name.trim();
    const lastname = this.newUserForm.lastname.trim();
    const date = this.newUserForm.date?.trim();

    if (!alias || !email || !name || !lastname) {
      alert('Todos los campos son obligatorios');
      return;
    }

    const atIndex = email.indexOf('@');
    if (atIndex < 1 || !email.slice(atIndex + 1).includes('.')) {
      alert('El correo electrónico no es válido. Debe contener @ y un punto después.');
      return;
    }

    const createRequest: CreateUserRequest = {
      username: alias,
      name: name,
      lastname: lastname,
      email: email,
      date: date,
      role: this.newUserForm.role,
    };

    // CORREGIDO: Tipado explícito al guardar nuevo usuario
    this.userService.createUser(createRequest).subscribe({
      next: (newUser: UserEntity) => {
        this.users = [
          ...this.users,
          {
            cod: newUser.id || 0,
            alias: newUser.username,
            name: newUser.name || '',
            lastname: newUser.lastname || '',
            email: newUser.email || '',
            date: date || this.normalizeBackendDate(newUser.dateCreated) || new Date().toISOString().split('T')[0],
            active: newUser.active,
            restPassword: false,
            role: newUser.role,
            firstLogin: newUser.firstLogin ?? true,
          },
        ];
        this.cdr.detectChanges();
        this.closeAddUserModal();
      },
      error: (error: any) => {
        console.error('Error al crear usuario:', error);
        alert(error.error?.message || 'Error al crear el usuario');
      },
    });
  }

  openEditUserModal(user: User): void {
    this.editingUserCod = user.cod;
    this.originalEditDate = user.date;
    this.editUserForm = {
      name: user.name,
      lastname: user.lastname,
      alias: user.alias,
      email: user.email,
      date: user.date,
      role: user.role || 'COMMON_USER',
    };
    this.showEditUserModal = true;
  }

  closeEditUserModal(): void {
    this.showEditUserModal = false;
    this.editingUserCod = null;
    this.originalEditDate = '';
  }

  /**
   * Guarda el nuevo usuario. Si el administrador editó su propia cuenta,
   * actualiza la sesión activa y redirige al rol correspondiente.
   */
  saveEditUser(): void {
    const alias = this.editUserForm.alias.trim();
    const email = this.editUserForm.email.trim();
    const name = this.editUserForm.name.trim();
    const lastname = this.editUserForm.lastname.trim();
    const date = this.editUserForm.date?.trim();

    if (!alias || !email || !name || !lastname) {
      alert('Todos los campos son obligatorios');
      return;
    }

    const atIndexEdit = email.indexOf('@');
    if (atIndexEdit < 1 || !email.slice(atIndexEdit + 1).includes('.')) {
      alert('El correo electrónico no es válido. Debe contener @ y un punto después.');
      return;
    }

    if (this.editingUserCod === null) return;

    const updateRequest: UpdateUserRequest = {
      username: alias,
      name: name,
      lastname: lastname,
      email: email,
      role: this.editUserForm.role,
    };

    if (date && date !== this.originalEditDate) {
      updateRequest.date = date;
    }

    // CORREGIDO: Tipado explícito en la solicitud de edición
    this.userService.updateUser(this.editingUserCod, updateRequest).subscribe({
      next: (updatedUser: UserEntity) => {
        const previousEditingCod = this.editingUserCod;
        const currentUsername = this.authService.getCurrentUsername();
        const currentNormalized = currentUsername?.trim().toLowerCase() ?? null;
        const updatedNormalized = updatedUser.username?.trim().toLowerCase() ?? null;
        const editedLocalUser = this.users.find((u) => u.cod === previousEditingCod);
        const editedAliasNormalized = editedLocalUser?.alias?.trim().toLowerCase() ?? null;

        const isEditingCurrentUser =
          !!currentNormalized &&
          (currentNormalized === editedAliasNormalized || currentNormalized === updatedNormalized);

        const userIndex = this.users.findIndex((u) => u.cod === previousEditingCod);
        if (userIndex !== -1) {
          this.users[userIndex] = {
            ...this.users[userIndex],
            alias: updatedUser.username,
            name: updatedUser.name || '',
            lastname: updatedUser.lastname || '',
            email: updatedUser.email || '',
            date: date || this.normalizeBackendDate(updatedUser.dateCreated) || this.editUserForm.date,
            role: updatedUser.role,
            active: updatedUser.active,
          };
          this.users = [...this.users];
        }

        this.cdr.detectChanges();
        this.closeEditUserModal();

        if (isEditingCurrentUser) {
          if (updatedUser.role) this.authService.saveUserRole(updatedUser.role);
          if (updatedUser.username) this.authService.saveCurrentUsername(updatedUser.username);
          this.router.navigate([updatedUser.role === 'ADMIN' ? '/admin-view' : '/user-view']);
        }
      },
      error: (error: any) => {
        console.error('Error al actualizar usuario:', error);
        alert(error.error?.message || 'Error al actualizar el usuario');
      },
    });
  }

  triggerFirstLogin(user: User): void {
    if (!user.cod || user.firstLogin) return;

    if (!confirm(`¿Reactivar el proceso de alta para ${user.alias}? El usuario deberá volver a establecer su contraseña y preguntas de seguridad.`)) return;

    // CORREGIDO: Tipado explícito en el relanzamiento del flujo de primer acceso
    this.userService.resetToFirstLogin(user.cod).subscribe({
      next: (updatedUser: UserEntity) => {
        user.firstLogin = updatedUser.firstLogin ?? true;
        user.active = updatedUser.active;
        this.users = [...this.users];
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error al reactivar primer login:', error);
        alert(error.error?.message || 'Error al reactivar el proceso de alta');
      },
    });
  }

  deleteUser(user: User): void {
    if (user.cod) {
      if (confirm(`¿Estás seguro de eliminar al usuario ${user.alias}?`)) {
        this.userService.deleteUser(user.cod).subscribe({
          next: () => {
            this.users = this.users.filter((u) => u.cod !== user.cod);
            this.cdr.detectChanges();
          },
          error: (error: any) => {
            console.error('Error al eliminar usuario:', error);
            alert('Error al eliminar el usuario');
          },
        });
      }
    }
  }
}
