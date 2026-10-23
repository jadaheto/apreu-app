import { StreamableFile } from '@nestjs/common';
import { Role } from '../../../../shared/domain/role.js';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { GetIncomeCertificateUseCase } from '../../application/documents/get-income-certificate.use-case.js';
import { RenderIncomeCertificateUseCase } from '../../application/documents/render-income-certificate.use-case.js';
import { GetPayslipUseCase } from '../../application/documents/get-payslip.use-case.js';
import { IssueEmploymentCertificateUseCase } from '../../application/documents/issue-employment-certificate.use-case.js';
import { ListPayslipsUseCase } from '../../application/documents/list-payslips.use-case.js';
import { RenderIssuedDocumentUseCase } from '../../application/documents/render-issued-document.use-case.js';
import { RenderPayslipUseCase } from '../../application/documents/render-payslip.use-case.js';
import { VerifyIssuedDocumentUseCase } from '../../application/documents/verify-issued-document.use-case.js';
import { SELF_SERVICE_ROLES } from '../../application/hr-access.js';
import { CancelLeaveUseCase } from '../../application/leaves/cancel-leave.use-case.js';
import { ListMyLeavesUseCase } from '../../application/leaves/list-my-leaves.use-case.js';
import { RequestLeaveUseCase } from '../../application/leaves/request-leave.use-case.js';
import { GetMyDashboardUseCase } from '../../application/self-service/get-my-dashboard.use-case.js';
import { GetMyEmployeeProfileUseCase } from '../../application/self-service/get-my-employee-profile.use-case.js';
import { UpdateMyContactInfoUseCase } from '../../application/self-service/update-my-contact-info.use-case.js';
import { CreateStickerUseCase } from '../../application/stickers/create-sticker.use-case.js';
import { DeleteStickerUseCase } from '../../application/stickers/delete-sticker.use-case.js';
import { GetStickerStatsUseCase } from '../../application/stickers/get-sticker-stats.use-case.js';
import { ListMyPendingStickersUseCase } from '../../application/stickers/list-my-pending-stickers.use-case.js';
import { ListStickersUseCase } from '../../application/stickers/list-stickers.use-case.js';
import { MarkStickerReadUseCase } from '../../application/stickers/mark-sticker-read.use-case.js';
import { buildController, isPublic, rolesOf } from '../../testing/controller-test-utils.js';
import { actor } from '../../testing/hr-test-context.js';
import { ListStickersQueryDto } from './dto/sticker.dto.js';
import { HrDocumentsController } from './hr-documents.controller.js';
import { MyEmployeeController } from './my-employee.controller.js';
import { StickersController } from './stickers.controller.js';

const teacher = actor(Role.TEACHER, 9);
const page = { page: 1, limit: 20 };

describe('MyEmployeeController', () => {
  let ctx: Awaited<ReturnType<typeof buildController<MyEmployeeController>>>;

  beforeEach(async () => {
    ctx = await buildController(MyEmployeeController, [
      GetMyEmployeeProfileUseCase,
      UpdateMyContactInfoUseCase,
      GetMyDashboardUseCase,
      ListPayslipsUseCase,
      GetPayslipUseCase,
      RenderPayslipUseCase,
      ListMyLeavesUseCase,
      RequestLeaveUseCase,
      CancelLeaveUseCase,
      IssueEmploymentCertificateUseCase,
      GetIncomeCertificateUseCase,
      RenderIncomeCertificateUseCase,
    ]);
  });

  it('is open to staff roles but not to students or guardians', () => {
    const roles = rolesOf(MyEmployeeController, 'profile');
    expect(roles).toEqual(SELF_SERVICE_ROLES);
    expect(roles).not.toContain(Role.STUDENT);
    expect(roles).not.toContain(Role.PARENT);
  });

  it('always acts on the actor (no employee id from the client)', async () => {
    await ctx.controller.profile(teacher);
    expect(ctx.mock(GetMyEmployeeProfileUseCase).execute).toHaveBeenCalledWith(teacher);
    await ctx.controller.contact(teacher, { phone: '300' });
    expect(ctx.mock(UpdateMyContactInfoUseCase).execute).toHaveBeenCalledWith({
      actor: teacher,
      contact: { phone: '300' },
    });
    await ctx.controller.dashboard(teacher);
    expect(ctx.mock(GetMyDashboardUseCase).execute).toHaveBeenCalledWith(teacher);
    await ctx.controller.payslips(teacher, new PaginationQueryDto());
    expect(ctx.mock(ListPayslipsUseCase).execute).toHaveBeenCalledWith({ actor: teacher, page });
    await ctx.controller.payslip(teacher, 3);
    expect(ctx.mock(GetPayslipUseCase).execute).toHaveBeenCalledWith({ actor: teacher, paymentId: 3 });
    ctx
      .mock(RenderPayslipUseCase)
      .execute.mockResolvedValue({ contentType: 'application/pdf', fileName: 'x.pdf', body: 'b' });
    await expect(ctx.controller.payslipDocument(teacher, 3, { setHeader: vi.fn() } as never)).resolves.toBeInstanceOf(
      StreamableFile,
    );
    await ctx.controller.leaves(teacher, new PaginationQueryDto());
    expect(ctx.mock(ListMyLeavesUseCase).execute).toHaveBeenCalledWith({ actor: teacher, page });
    const leave = { leaveType: 'calamidad' as const, startDate: '2026-04-01', endDate: '2026-04-01', reason: 'x' };
    await ctx.controller.requestLeaveFor(teacher, leave);
    expect(ctx.mock(RequestLeaveUseCase).execute).toHaveBeenCalledWith({ actor: teacher, ...leave });
    await ctx.controller.cancel(teacher, 4);
    expect(ctx.mock(CancelLeaveUseCase).execute).toHaveBeenCalledWith({ actor: teacher, leaveId: 4 });
    await ctx.controller.certificate(teacher, { includeSalary: false });
    expect(ctx.mock(IssueEmploymentCertificateUseCase).execute).toHaveBeenCalledWith({
      actor: teacher,
      includeSalary: false,
      addressee: undefined,
    });
    await ctx.controller.income(teacher, { year: 2025 });
    expect(ctx.mock(GetIncomeCertificateUseCase).execute).toHaveBeenCalledWith({ actor: teacher, year: 2025 });
    ctx
      .mock(RenderIncomeCertificateUseCase)
      .execute.mockResolvedValue({ contentType: 'application/pdf', fileName: 'i.pdf', body: 'i' });
    await expect(
      ctx.controller.incomeDocument(teacher, { year: 2025 }, { setHeader: vi.fn() } as never),
    ).resolves.toBeInstanceOf(StreamableFile);
    expect(ctx.mock(RenderIncomeCertificateUseCase).execute).toHaveBeenCalledWith({ actor: teacher, year: 2025 });
  });
});

describe('HrDocumentsController', () => {
  it('exposes a public verification and a protected printable copy', async () => {
    expect(isPublic(HrDocumentsController, 'verify')).toBe(true);
    expect(isPublic(HrDocumentsController, 'document')).toBe(false);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', HrDocumentsController.prototype.verify)).toBe(30);
    const ctx = await buildController(HrDocumentsController, [
      RenderIssuedDocumentUseCase,
      VerifyIssuedDocumentUseCase,
    ]);
    await ctx.controller.verify('ABCD');
    expect(ctx.mock(VerifyIssuedDocumentUseCase).execute).toHaveBeenCalledWith('ABCD');
    ctx
      .mock(RenderIssuedDocumentUseCase)
      .execute.mockResolvedValue({ contentType: 'application/pdf', fileName: 'c.pdf', body: 'c' });
    await expect(ctx.controller.document(teacher, 'ABCD', { setHeader: vi.fn() } as never)).resolves.toBeInstanceOf(
      StreamableFile,
    );
    expect(ctx.mock(RenderIssuedDocumentUseCase).execute).toHaveBeenCalledWith({ actor: teacher, code: 'ABCD' });
  });
});

describe('StickersController', () => {
  it('delegates every endpoint with the actor', async () => {
    const ctx = await buildController(StickersController, [
      ListStickersUseCase,
      GetStickerStatsUseCase,
      ListMyPendingStickersUseCase,
      CreateStickerUseCase,
      MarkStickerReadUseCase,
      DeleteStickerUseCase,
    ]);
    await ctx.controller.list(teacher, new ListStickersQueryDto());
    expect(ctx.mock(ListStickersUseCase).execute).toHaveBeenCalledWith({
      actor: teacher,
      filter: 'all',
      employeeId: undefined,
      page,
    });
    await ctx.controller.stats(teacher);
    expect(ctx.mock(GetStickerStatsUseCase).execute).toHaveBeenCalledWith(teacher);
    await ctx.controller.pending(teacher);
    expect(ctx.mock(ListMyPendingStickersUseCase).execute).toHaveBeenCalledWith(teacher);
    await ctx.controller.create(teacher, { employeeId: 1, title: 'Hola' });
    expect(ctx.mock(CreateStickerUseCase).execute).toHaveBeenCalledWith({
      actor: teacher,
      employeeId: 1,
      title: 'Hola',
    });
    await ctx.controller.read(teacher, 2);
    expect(ctx.mock(MarkStickerReadUseCase).execute).toHaveBeenCalledWith({ actor: teacher, stickerId: 2 });
    await ctx.controller.remove(teacher, 2);
    expect(ctx.mock(DeleteStickerUseCase).execute).toHaveBeenCalledWith({ actor: teacher, stickerId: 2 });
  });
});
