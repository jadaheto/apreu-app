import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  INSTITUTION_PROFILE_REPOSITORY,
  type InstitutionProfileRepository,
} from '../domain/institution-profile.repository.js';
import { SETTINGS_CATALOG } from '../domain/settings/settings-catalog.js';
import { SettingsSection } from '../domain/settings/settings-section.js';
import { SETTINGS_REPOSITORY, type SettingsRepository } from '../domain/settings/settings.repository.js';
import { LOGO_URL } from './institution-profile-view.js';

/** Theme of the school applied by every screen, including the login page. */
export interface PublicBrandingView {
  schoolName: string;
  logoUrl: string | null;
  logoSize: number;
  colorPrimary: string;
  colorHeaderBg: string;
  colorHeaderBar: string;
  academicYear: number;
}

const DEFAULT_SCHOOL_NAME = 'Apreu ERP';

/**
 * Branding read by the shell (legacy `includes/header.php`): colors, logo,
 * school name and the active academic year from settings — not the
 * hard-coded `ACADEMIC_YEAR` (bug B13). Contains no sensitive data, so it is
 * served without authentication for the school given in `X-Tenant`.
 */
@Injectable()
export class GetPublicBrandingUseCase implements UseCase<void, PublicBrandingView> {
  constructor(
    @Inject(SETTINGS_REPOSITORY) private readonly settings: SettingsRepository,
    @Inject(INSTITUTION_PROFILE_REPOSITORY) private readonly profiles: InstitutionProfileRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<PublicBrandingView> {
    const sections = [SETTINGS_CATALOG.branding, SETTINGS_CATALOG.academic];
    const [stored, profile] = await Promise.all([
      this.settings.findMany(sections.flatMap((section) => SettingsSection.keysOf(section))),
      this.profiles.find(),
    ]);
    const context = { now: this.clock.now() };
    const branding = SettingsSection.load(SETTINGS_CATALOG.branding, stored, context).values();
    const academic = SettingsSection.load(SETTINGS_CATALOG.academic, stored, context).values();
    return {
      schoolName: profile?.name ?? DEFAULT_SCHOOL_NAME,
      logoUrl: profile?.logoPath ? LOGO_URL : null,
      logoSize: branding.logo_size as number,
      colorPrimary: branding.color_primary as string,
      colorHeaderBg: branding.color_header_bg as string,
      colorHeaderBar: branding.color_header_bar as string,
      academicYear: (academic.academic_year as number | null) ?? context.now.getFullYear(),
    };
  }
}
