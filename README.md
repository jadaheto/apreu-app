# apreu-api

API del ERP escolar Apreu. NestJS 12 · TypeORM · PostgreSQL 16 (driver `pg`) · arquitectura hexagonal · multi-tenant (una BD por colegio).

## Ejecutar
```bash
cp .env.example .env      # ajuste credenciales y JWT_SECRET
npm ci
npm run start:dev         # http://localhost:3000, Swagger en http://localhost:3000/docs
```
Cada petición a `/api/**` debe incluir `X-Tenant: <slug-del-colegio>` (en desarrollo puede usar `DEFAULT_TENANT`).

| Script | Uso |
|---|---|
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:cov` | Cobertura |
| `npm run build` / `npm run start:prod` | Compilar y ejecutar |
| `npm run lint` | oxlint |
| `npm run test:e2e` / `test/run-e2e.sh` | Pruebas E2E contra PostgreSQL (ver abajo) |

## Pruebas E2E (`test/`)
Arrancan el `AppModule` real con el mismo pipeline HTTP de `main.ts` (`src/app-setup.ts`) y lo ejercitan con supertest
contra PostgreSQL: sin mocks de persistencia, guards ni middleware. Solo los puertos de sistemas externos se reemplazan
por dobles (`test/support/external-doubles.ts`): DIAN (`DIAN_GATEWAY`), SMTP (`EMAIL_SENDER`), WhatsApp
(`WHATSAPP_GATEWAY`) e IA/n8n (`AI_ASSISTANT`, `MARKETING_GENERATOR`).

- **BD desechables.** El `globalSetup` (`test/support/global-setup.ts`) clona `apreu_demo` → `apreu_e2e_demo` y
  `apreu_master` → `apreu_e2e_master` con `CREATE DATABASE … TEMPLATE`, registra en la maestra clonada los colegios
  `e2e-demo` y `e2e-suspendible` (ambos con `db_name = 'apreu_e2e_demo'`) y al terminar borra los clones
  (`DROP DATABASE … WITH (FORCE)`). Las BD de desarrollo nunca se modifican. `TEMPLATE` exige que nadie esté conectado
  a `apreu_demo`/`apreu_master` (detenga la API de desarrollo). `E2E_KEEP_DB=1` conserva los clones para inspeccionarlos.
- **Cómo correrlas.** El sandbox no deja llegar del host a Docker por TCP, así que se corren dentro de un contenedor que
  comparte la red de `apreu-dev-pg` (PostgreSQL en `127.0.0.1:5432`):
  ```bash
  test/run-e2e.sh                                  # toda la suite
  test/run-e2e.sh test/finance.e2e-spec.ts         # un archivo (admite cualquier argumento de vitest)
  NO_COLOR=1 E2E_KEEP_DB=1 test/run-e2e.sh -t "recibo"
  ```
  Equivale a `docker run --rm --network container:apreu-dev-pg -v <apreu-v2>:/work -w /work/apreu-api node:24-alpine npx vitest run --config vitest.config.e2e.ts`.
  Con un PostgreSQL alcanzable directamente: `TENANT_DB_HOST=… TENANT_DB_PORT=… npm run test:e2e`.
- **Entorno.** `vitest.config.e2e.ts` fija `NODE_ENV=test`, `JWT_SECRET`, `MASTER_DB_NAME=apreu_e2e_master`,
  `INTERNAL_API_TOKEN`, `TENANT_STATUS_TTL_SECONDS=60` (para que la suspensión solo aplique tras la invalidación),
  `UPLOADS_DIR=/tmp/apreu-e2e-uploads` y la clave de facturación; las credenciales de BD se toman de `TENANT_DB_*`.
- **Límites.** El login permite 10 intentos/min por IP: cada archivo arranca su propia app (contadores propios) y
  reutiliza tokens. Los archivos corren en serie (`fileParallelism: false`) sobre el mismo clon, por eso cada prueba crea
  sus datos con sufijos únicos (`uniqueSuffix`, `uniqueDocument`) y no depende del orden de los archivos.
- **Ayudas.** `createE2eApp()` (app + dobles + `api(token)` con `X-Tenant`), `createUser`/`takeOverUser` (cuentas con
  clave conocida pasando por el cambio obligatorio), `enrollStudent`, `withTenantDb`/`withMasterDb` (aserciones directas en
  SQL), `expectStatus` (muestra el cuerpo si el estado no coincide) y `asBuffer`/`isPdf`/`isZip` para descargas.

## Arquitectura
```
src/
├── main.ts                 # Bootstrap: Helmet, CORS, ValidationPipe, filtro de errores, Swagger
├── app.module.ts           # Registra los módulos de cada contexto
├── shared/                 # Kernel compartido
│   ├── domain/             # Entity, ValueObject, DomainError, Guard, Money, Email, Role, paginación
│   ├── application/        # UseCase, AuthenticatedActor, puertos: Clock, UnitOfWork, PasswordHasher, EventBus
│   ├── infrastructure/     # Config, tenancy, TypeORM por tenant, guards JWT/roles, filtro de errores, eventos
│   └── testing/            # Dobles reutilizables para pruebas
└── modules/<contexto>/     # domain / application / infrastructure (ver docs/guia-modulos-backend.md)
```

### Flujo de una petición
1. `TenantMiddleware` resuelve `X-Tenant` contra la BD maestra (con caché) y rechaza colegios inexistentes o suspendidos. El registro completo se cachea `TENANT_CACHE_TTL_SECONDS`; el `status` se vuelve a consultar cada `TENANT_STATUS_TTL_SECONDS` (corto) y `POST /api/internal/tenants/{slug}/invalidate` borra la entrada al instante.
2. `JwtAuthGuard` valida el token y que pertenezca al mismo colegio; `RolesGuard` aplica `@Roles(...)`.
3. El controller valida el DTO y llama a un caso de uso.
4. El caso de uso usa puertos; los repositorios TypeORM obtienen la conexión del colegio activo mediante `TenantDataSource`.
5. `DomainExceptionFilter` traduce los errores a `{ statusCode, code, message, details }`.
6. `RequestAuditMiddleware` (identity) registra en `access_log` del colegio, al terminar la respuesta y sin bloquearla, cada petición autenticada a `/api/**` (usuario, rol, `MÉTODO /ruta` sin query string, módulo = primer segmento, `allowed = false` si respondió 403, IP). Se excluyen health, docs, `/api/internal/**`, archivos estáticos, login/logout (que ya se auditan en sus casos de uso) y las lecturas automáticas del frontend `GET /api/notifications` (campana, cada 60 s) y `GET /api/institution/branding`.

### API interna (superadmin-api → apreu-api)
`POST /api/internal/tenants/{slug}/invalidate` con la cabecera `X-Internal-Token: <INTERNAL_API_TOKEN>` (sin `X-Tenant` ni JWT; 204, idempotente). Debe llamarse tras suspender, reactivar o editar un colegio. Con varias instancias, la llamada solo invalida la instancia que la recibe; las demás aplican el cambio de estado en máximo `TENANT_STATUS_TTL_SECONDS`. Si `INTERNAL_API_TOKEN` está vacío el endpoint responde 403 `INTERNAL_API_DISABLED`.

### Documentos y exportaciones
- PDF con [pdfmake](https://pdfmake.github.io/docs/) (JS puro, fuente Roboto embebida, sin navegador). Kit compartido en `src/shared/infrastructure/documents/`: `renderPdf` (bloquea URLs remotas y archivos locales), `institutionalDocument` (membrete con logo/NIT/color del colegio, pie con página y código de verificación + QR) y `DocumentBrandingProvider` (logo subido en `institutions.logo`, PNG/JPEG; `settings.color_primary`). Lo usan boletines, certificados laborales/de ingresos, desprendibles, certificados de estudio y los reportes contables.
- **Verificación pública (QR).** El QR del pie lleva `DOCUMENT_VERIFY_URL_TEMPLATE` con `{tenant}` (slug), `{kind}` y `{code}` reemplazados (vacío = solo el código). Valor recomendado, que abre la página pública `/verificar/:code` de apreu-web:
  `DOCUMENT_VERIFY_URL_TEMPLATE=https://{tenant}.apreu.co/verificar/{code}?tipo={kind}`

  | `{kind}` | Documento (renderer) | Endpoint público que lo verifica (sin JWT, solo `X-Tenant: {tenant}`, 30 req/min por IP) |
  |---|---|---|
  | `estudiantil` | Certificado de estudios (`students/.../pdf-certificate.renderer.ts`) | `GET /api/public/certificates/verify/{code}` → `{valid, status, type, schoolName, studentName, document (solo últimos 4 dígitos), gradeName, academicYear, issuedAt}` |
  | `laboral` | Certificado laboral (`hr/.../pdf-document-renderer.ts`) | `GET /api/hr/documents/verify/{code}` → `{code, type, employeeName, issuedAt, institutionName}` (sin salario ni documento) |

  Ambos responden 404 `NOT_FOUND` si el código no existe. Boletines, desprendibles, certificados de ingresos y reportes contables no llevan código de verificación.
- **Facturas DIAN en el portal.** `GET /api/e-invoicing/portal/students/{studentId}/documents` y `.../documents/{id}/{pdf|xml}` (roles `student`/`parent`, misma regla de vínculo que `/api/finance/portal`). El PDF es la representación gráfica (CUFE/CUDE, QR de la DIAN, autorización de numeración) y el XML el `AttachedDocument`; ambos solo para documentos validados por la DIAN.
- XLSX con [exceljs](https://github.com/exceljs/exceljs) en `GET /api/accounting/reports/{report}/export?format=csv|xlsx|pdf`.

### OpenAPI
`docs/api/apreu-api.openapi.json` es el documento de Swagger (`/docs-json` con `NODE_ENV≠production`). Para regenerarlo sin BD: arranque la API en desarrollo y descargue `http://localhost:3000/docs-json`, o compile a una carpeta temporal y ejecute `SwaggerModule.createDocument` sobre `AppModule` con el mismo `DocumentBuilder` de `main.ts`.

### Base de datos (PostgreSQL, ADR-0008)
- Una BD por colegio (`apreu_<slug>`, esquema `database/postgres/tenant-schema.sql`) y la BD maestra `apreu_master`. Puerto por defecto `5432` (`TENANT_DB_PORT`/`MASTER_DB_PORT`).
- `TenantConnectionManager` abre un pool `pg` por colegio bajo demanda (máx. 10 conexiones, `idleTimeoutMillis` 30 s) con `TimeZone=America/Bogota`; la BD maestra usa `UTC`. Un pool sin uso durante `TENANT_POOL_IDLE_MINUTES` (30 por defecto, `0` = nunca) se cierra; nunca se cierra uno con conexiones en uso.
- SQL escrito a mano: helpers en `src/shared/infrastructure/persistence/sql.ts` — `SqlParams` (numeración `$n` de filtros dinámicos), `likePattern` + `unaccentLike` (búsquedas sin mayúsculas ni tildes: `f_unaccent(col) ILIKE f_unaccent($n)`; para nombre completo use `first_name || ' ' || last_name`, la expresión de los índices trigram), `toNumber` (`numeric`/`bigint`/`COUNT` llegan como string), `isUniqueViolation` (SQLSTATE `23505`), `queryReturning`/`rowsOf`/`affectedRowsOf` (TypeORM devuelve `[filas, total]` en `UPDATE`/`DELETE`) y `advisoryXactLock` (en lugar de `GET_LOCK`). Listas: `= ANY($n)` con un arreglo. Alias camelCase entre comillas dobles (`AS "studentName"`).

### Variables de entorno
Ver `.env.example`. Ningún secreto tiene valor por defecto en el código.
