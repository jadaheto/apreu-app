import { APP_GUARD } from '@nestjs/core';
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { TENANTLESS_ROUTES } from '../../shared/infrastructure/tenancy/tenantless-routes.js';
import { ACCESS_LOG } from './application/ports/access-log.port.js';
import { ACCESS_LOG_QUERY } from './application/ports/access-log-query.port.js';
import { TEMPORARY_PASSWORD_GENERATOR } from './application/ports/temporary-password-generator.port.js';
import { TOKEN_ISSUER } from './application/ports/token-issuer.port.js';
import { ChangePasswordUseCase } from './application/change-password.use-case.js';
import { ChangeUserStatusUseCase } from './application/change-user-status.use-case.js';
import { CreateUserUseCase } from './application/create-user.use-case.js';
import { GetCurrentUserUseCase } from './application/get-current-user.use-case.js';
import { GetMyPermissionsUseCase } from './application/get-my-permissions.use-case.js';
import { GetUserStatsUseCase } from './application/get-user-stats.use-case.js';
import { GetUserUseCase } from './application/get-user.use-case.js';
import { ListAccessLogUseCase } from './application/list-access-log.use-case.js';
import { ListUsersUseCase } from './application/list-users.use-case.js';
import { RecordRequestAccessUseCase } from './application/record-request-access.use-case.js';
import { LoginUseCase } from './application/login.use-case.js';
import { LogoutUseCase } from './application/logout.use-case.js';
import { ManagedUserViewBuilder } from './application/managed-user-view.builder.js';
import { RefreshSessionUseCase } from './application/refresh-session.use-case.js';
import { ResetUserPasswordUseCase } from './application/reset-user-password.use-case.js';
import { UpdateUserUseCase } from './application/update-user.use-case.js';
import { EMPLOYMENT_DIRECTORY, EMPLOYMENT_STATUS } from './domain/employment-status.port.js';
import { MODULE_TOGGLES } from './domain/module-toggles.port.js';
import { USER_REPOSITORY } from './domain/user.repository.js';
import { AccessLogController } from './infrastructure/http/access-log.controller.js';
import { AuthController } from './infrastructure/http/auth.controller.js';
import { RequestAuditMiddleware } from './infrastructure/http/request-audit.middleware.js';
import { SessionController } from './infrastructure/http/session.controller.js';
import { UsersController } from './infrastructure/http/users.controller.js';
import {
  SqlAccessLogQuery,
  SqlEmploymentStatus,
  SqlModuleToggles,
  TypeOrmAccessLog,
  TypeOrmUserRepository,
} from './infrastructure/persistence/index.js';
import { CryptoTemporaryPasswordGenerator } from './infrastructure/security/crypto-temporary-password-generator.js';
import { JwtTokenIssuer } from './infrastructure/security/jwt-token-issuer.js';
import { ActiveSessionGuard } from './infrastructure/http/guards/active-session.guard.js';

/**
 * Identity context: authentication, session, users, roles/permissions and
 * access auditing (login/logout plus every authenticated API request through
 * {@link RequestAuditMiddleware}). Composition root binding the application
 * ports to their adapters.
 */
@Module({
  controllers: [AuthController, SessionController, UsersController, AccessLogController],
  providers: [
    { provide: APP_GUARD, useClass: ActiveSessionGuard },
    LoginUseCase,
    LogoutUseCase,
    RefreshSessionUseCase,
    GetCurrentUserUseCase,
    GetMyPermissionsUseCase,
    ChangePasswordUseCase,
    ListUsersUseCase,
    GetUserStatsUseCase,
    GetUserUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    ChangeUserStatusUseCase,
    ResetUserPasswordUseCase,
    ListAccessLogUseCase,
    RecordRequestAccessUseCase,
    ManagedUserViewBuilder,
    SqlEmploymentStatus,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: EMPLOYMENT_STATUS, useExisting: SqlEmploymentStatus },
    { provide: EMPLOYMENT_DIRECTORY, useExisting: SqlEmploymentStatus },
    { provide: MODULE_TOGGLES, useClass: SqlModuleToggles },
    { provide: ACCESS_LOG, useClass: TypeOrmAccessLog },
    { provide: ACCESS_LOG_QUERY, useClass: SqlAccessLogQuery },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    { provide: TEMPORARY_PASSWORD_GENERATOR, useClass: CryptoTemporaryPasswordGenerator },
  ],
  exports: [USER_REPOSITORY],
})
export class IdentityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestAuditMiddleware)
      .exclude(...TENANTLESS_ROUTES)
      .forRoutes('{*path}');
  }
}
