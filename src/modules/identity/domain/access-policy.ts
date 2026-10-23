import { Role } from '../../../shared/domain/role.js';
import type { ToggleableModule } from './module-toggles.port.js';

/**
 * Fine-grained permissions of the new architecture (analysis 01 §5.3).
 *
 * Replaces the three overlapping legacy mechanisms (`enforcePageAccess`,
 * `checkPortalAccess` and the never-used `hasPermission`) with a single
 * matrix. `superadmin` holds every permission.
 */
export enum Permission {
  SESSION = 'auth.session',
  DASHBOARD_VIEW = 'dashboard.admin.view',
  USERS_READ = 'users.read',
  USERS_MANAGE = 'users.manage',
  ACCESS_LOG_READ = 'audit.access-log.read',
  API_KEYS_MANAGE = 'api-keys.manage',
  INSTITUTION_READ = 'institution.read',
  INSTITUTION_UPDATE = 'institution.update',
  BRANDING_READ = 'settings.branding.read',
  SETTINGS_ACADEMIC = 'settings.academic.manage',
  SETTINGS_DIAN = 'settings.dian.manage',
  SETTINGS_PAYMENTS = 'settings.payments.manage',
  SETTINGS_PAYROLL = 'settings.payroll.manage',
  SETTINGS_BRANDING = 'settings.branding.manage',
  SETTINGS_MODULES = 'settings.modules.manage',
  SETTINGS_INTEGRATIONS = 'settings.integrations.manage',
  SETTINGS_AI = 'settings.ai.manage',
  AI_CHAT = 'ai.chat',
  AI_HISTORY_OWN = 'ai.history.own',
  AI_LOGS_ALL = 'ai.logs.all',
  STICKERS_MANAGE_ANY = 'stickers.manage.any',
  STICKERS_OWN = 'stickers.own',
  NOTIFICATIONS_OWN = 'notifications.own',
}

const EVERYONE: readonly Role[] = Object.values(Role);
const STAFF: readonly Role[] = [Role.ADMIN, Role.FINANCE, Role.HR, Role.TEACHER, Role.EMPLOYEE];

/** Roles granted each permission (superadmin is implicit). */
const PERMISSION_MATRIX: Record<Permission, readonly Role[]> = {
  [Permission.SESSION]: EVERYONE,
  [Permission.DASHBOARD_VIEW]: [Role.ADMIN, Role.FINANCE, Role.HR],
  [Permission.USERS_READ]: [Role.ADMIN],
  [Permission.USERS_MANAGE]: [Role.ADMIN],
  [Permission.ACCESS_LOG_READ]: [Role.ADMIN],
  [Permission.API_KEYS_MANAGE]: [Role.ADMIN],
  [Permission.INSTITUTION_READ]: [Role.ADMIN, Role.FINANCE, Role.HR],
  [Permission.INSTITUTION_UPDATE]: [Role.ADMIN],
  [Permission.BRANDING_READ]: EVERYONE,
  [Permission.SETTINGS_ACADEMIC]: [Role.ADMIN],
  [Permission.SETTINGS_DIAN]: [Role.ADMIN, Role.FINANCE],
  [Permission.SETTINGS_PAYMENTS]: [Role.ADMIN, Role.FINANCE],
  [Permission.SETTINGS_PAYROLL]: [Role.ADMIN, Role.HR],
  [Permission.SETTINGS_BRANDING]: [Role.ADMIN],
  [Permission.SETTINGS_MODULES]: [Role.ADMIN],
  [Permission.SETTINGS_INTEGRATIONS]: [Role.ADMIN],
  [Permission.SETTINGS_AI]: [Role.ADMIN],
  [Permission.AI_CHAT]: EVERYONE,
  [Permission.AI_HISTORY_OWN]: EVERYONE,
  [Permission.AI_LOGS_ALL]: [],
  [Permission.STICKERS_MANAGE_ANY]: [Role.ADMIN, Role.HR],
  [Permission.STICKERS_OWN]: STAFF,
  [Permission.NOTIFICATIONS_OWN]: EVERYONE,
};

/** An entry of the application menu. */
export interface NavigationModule {
  key: string;
  label: string;
  /** Angular route of the module. */
  route: string;
  /** Icon metaphor (Heroicons outline name). */
  icon: string;
  /** Roles that may open the module; empty = superadmin only. */
  roles: readonly Role[];
  /** School-level switch that can hide the module. */
  toggle?: ToggleableModule;
}

const ADMIN_FINANCE: readonly Role[] = [Role.ADMIN, Role.FINANCE];
const ADMIN_HR: readonly Role[] = [Role.ADMIN, Role.HR];
const BACK_OFFICE: readonly Role[] = [Role.ADMIN, Role.FINANCE, Role.HR];
const EMPLOYEE_PORTAL: readonly Role[] = [Role.TEACHER, Role.EMPLOYEE];
const FAMILY_PORTAL: readonly Role[] = [Role.STUDENT, Role.PARENT];

/**
 * Menu catalog (legacy `includes/sidebar.php`). Unlike the legacy sidebar,
 * modules are only listed to roles that can actually open them (bug B18) and
 * the destination guards of every context use the same roles.
 * "Mi grupo" / "Boletines de grupo" depend on data (group director) and are
 * resolved by the academic context, not by this static catalog.
 */
export const NAVIGATION: readonly NavigationModule[] = [
  { key: 'dashboard', label: 'Dashboard', route: '/admin', icon: 'home', roles: BACK_OFFICE },
  { key: 'students', label: 'Alumnos', route: '/students', icon: 'users', roles: [Role.ADMIN] },
  { key: 'academic', label: 'Gestión académica', route: '/academic', icon: 'academic-cap', roles: [Role.ADMIN] },
  {
    key: 'academic-periods',
    label: 'Períodos académicos',
    route: '/academic/periods',
    icon: 'calendar',
    roles: [Role.ADMIN],
  },
  { key: 'finance', label: 'Finanzas y caja', route: '/finance', icon: 'banknotes', roles: ADMIN_FINANCE },
  {
    key: 'e-invoicing',
    label: 'Facturación electrónica',
    route: '/finance/e-invoicing',
    icon: 'document-check',
    roles: ADMIN_FINANCE,
  },
  { key: 'hr', label: 'Capital humano', route: '/hr', icon: 'briefcase', roles: ADMIN_HR },
  {
    key: 'payroll',
    label: 'Nómina electrónica',
    route: '/hr/payroll',
    icon: 'wallet',
    roles: BACK_OFFICE,
    toggle: 'payroll',
  },
  { key: 'inventory', label: 'Inventario', route: '/inventory', icon: 'archive-box', roles: [Role.ADMIN] },
  {
    key: 'accounting',
    label: 'Contabilidad',
    route: '/accounting',
    icon: 'calculator',
    roles: ADMIN_FINANCE,
    toggle: 'accounting',
  },
  { key: 'incidents', label: 'Incidencias', route: '/incidents', icon: 'exclamation-triangle', roles: ADMIN_HR },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    route: '/communications/whatsapp',
    icon: 'chat-bubble-left-right',
    roles: BACK_OFFICE,
  },
  { key: 'email', label: 'Correos', route: '/communications/email', icon: 'envelope', roles: BACK_OFFICE },
  { key: 'stickers', label: 'Stickers', route: '/stickers', icon: 'tag', roles: BACK_OFFICE },
  { key: 'users', label: 'Usuarios', route: '/admin/users', icon: 'key', roles: [Role.ADMIN] },
  {
    key: 'access-log',
    label: 'Auditoría de accesos',
    route: '/admin/audit',
    icon: 'shield-check',
    roles: [Role.ADMIN],
  },
  { key: 'settings', label: 'Configuración', route: '/admin/settings', icon: 'cog-6-tooth', roles: BACK_OFFICE },
  { key: 'ai-logs', label: 'Monitor IA', route: '/admin/ai-logs', icon: 'cpu-chip', roles: [] },
  {
    key: 'marketing-ai',
    label: 'Marketing IA',
    route: '/marketing',
    icon: 'megaphone',
    roles: [Role.ADMIN, Role.EMPLOYEE],
  },
  { key: 'employee-home', label: 'Mi portal', route: '/employee', icon: 'home', roles: EMPLOYEE_PORTAL },
  {
    key: 'payslips',
    label: 'Desprendibles de pago',
    route: '/employee/payslips',
    icon: 'banknotes',
    roles: EMPLOYEE_PORTAL,
  },
  {
    key: 'employment-certificate',
    label: 'Certificado laboral',
    route: '/employee/certificate',
    icon: 'document-text',
    roles: EMPLOYEE_PORTAL,
  },
  {
    key: 'leaves',
    label: 'Permisos y novedades',
    route: '/employee/leaves',
    icon: 'calendar-days',
    roles: EMPLOYEE_PORTAL,
  },
  { key: 'my-stickers', label: 'Mis stickers', route: '/employee/stickers', icon: 'tag', roles: EMPLOYEE_PORTAL },
  {
    key: 'employee-ai-history',
    label: 'Mi historial IA',
    route: '/employee/ai-history',
    icon: 'cpu-chip',
    roles: EMPLOYEE_PORTAL,
  },
  { key: 'qr-scanner', label: 'Lector QR', route: '/employee/qr-scanner', icon: 'qr-code', roles: [Role.TEACHER] },
  {
    key: 'grades-entry',
    label: 'Calificar grupos',
    route: '/academic/grades-entry',
    icon: 'pencil-square',
    roles: [Role.TEACHER],
  },
  {
    key: 'my-groups',
    label: 'Mis grupos asignados',
    route: '/employee/groups',
    icon: 'user-group',
    roles: [Role.TEACHER],
  },
  { key: 'student-home', label: 'Mi portal', route: '/student', icon: 'home', roles: FAMILY_PORTAL },
  {
    key: 'student-card',
    label: 'Carnet digital',
    route: '/student/card',
    icon: 'identification',
    roles: FAMILY_PORTAL,
  },
  { key: 'my-payments', label: 'Mis pagos', route: '/student/payments', icon: 'banknotes', roles: FAMILY_PORTAL },
  {
    key: 'my-invoices',
    label: 'Mis facturas',
    route: '/student/invoices',
    icon: 'document-text',
    roles: FAMILY_PORTAL,
  },
  { key: 'bulletins', label: 'Boletines', route: '/student/bulletins', icon: 'chart-bar', roles: FAMILY_PORTAL },
  { key: 'my-grades', label: 'Mis notas', route: '/student/grades', icon: 'chart-bar', roles: FAMILY_PORTAL },
  {
    key: 'student-certificate',
    label: 'Certificado',
    route: '/student/certificate',
    icon: 'document-text',
    roles: FAMILY_PORTAL,
  },
  { key: 'profile', label: 'Mi perfil', route: '/student/profile', icon: 'user', roles: FAMILY_PORTAL },
  { key: 'attendance', label: 'Asistencia QR', route: '/student/attendance', icon: 'qr-code', roles: [Role.STUDENT] },
  {
    key: 'my-incidents',
    label: 'Mis incidencias',
    route: '/student/incidents',
    icon: 'exclamation-triangle',
    roles: FAMILY_PORTAL,
  },
  {
    key: 'student-ai-history',
    label: 'Apreu IA',
    route: '/student/ai-history',
    icon: 'cpu-chip',
    roles: FAMILY_PORTAL,
  },
];

/** Single source of truth for "what can this role do / see". */
export const AccessPolicy = {
  /** True when the role holds the permission (`superadmin` holds all). */
  can(role: Role, permission: Permission): boolean {
    return role === Role.SUPERADMIN || PERMISSION_MATRIX[permission].includes(role);
  },

  permissionsFor(role: Role): Permission[] {
    return Object.values(Permission).filter((permission) => AccessPolicy.can(role, permission));
  },

  /**
   * Menu entries the role can open, in display order, without the modules the
   * school disabled. The superadmin sees the administrative menu (every module
   * an admin sees plus the superadmin-only ones), not the portal menus.
   */
  modulesFor(role: Role, disabled: ReadonlySet<ToggleableModule> = new Set()): NavigationModule[] {
    return NAVIGATION.filter((module) =>
      role === Role.SUPERADMIN
        ? module.roles.length === 0 || module.roles.includes(Role.ADMIN)
        : module.roles.includes(role),
    ).filter((module) => !module.toggle || !disabled.has(module.toggle));
  },
};
