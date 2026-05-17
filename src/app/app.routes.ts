import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { AdminViewComponent } from './components/admin-view/admin-view.component';
import { UserViewComponent } from './components/user-view/user-view.component';
import { RestorePasswordComponent } from './components/restore-password/restore-password.component';
import { SetNewPasswordComponent } from './components/set-new-password/set-new-password.component';
import { UsersManagementComponent } from './components/users-management/users-management.component';
import { TpvMainComponent } from './components/tpv/tpv-main/tpv-main.component';
import { TableSelectorComponent } from './components/tpv/table-selector/table-selector.component';
import { CategoryManagementComponent } from './components/admin/category-management/category-management.component';
import { ProductManagementComponent } from './components/admin/product-management/product-management.component';
import { AccessibilitySettingsComponent } from './components/accessibility-settings/accessibility-settings.component';
import { TicketsHistoryComponent } from './components/tpv/tickets-history/tickets-history.component';
import { RefundsHistoryComponent } from './components/tpv/refunds-history/refunds-history.component';
import { adminGuard, userGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'restorePassword', component: RestorePasswordComponent },
  { path: 'setNewPassword', component: SetNewPasswordComponent },
  
  // TPV - Accesible por Admin y Usuario Común
  { path: 'tpv', component: TableSelectorComponent, canActivate: [userGuard] },
  { path: 'tpv/mesa/:tableNumber', component: TpvMainComponent, canActivate: [userGuard] },
  { path: 'tpv/tickets', component: TicketsHistoryComponent, canActivate: [userGuard] },
  { path: 'tpv/devoluciones', component: RefundsHistoryComponent, canActivate: [userGuard] },
  { path: 'accesibilidad', component: AccessibilitySettingsComponent, canActivate: [userGuard] },
  
  // Admin - Solo Admin
  { path: 'admin/categories', component: CategoryManagementComponent, canActivate: [adminGuard] },
  { path: 'admin/products', component: ProductManagementComponent, canActivate: [adminGuard] },
  { path: 'admin/users', component: UsersManagementComponent, canActivate: [adminGuard] },
  
  // Vistas heresrdadas (mantener por compatibilidad)
  { path: 'admin-view', component: AdminViewComponent, canActivate: [adminGuard] },
  { path: 'user-view', component: UserViewComponent, canActivate: [userGuard] },
  { path: 'usersManagament', component: UsersManagementComponent, canActivate: [adminGuard] },
  
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];
