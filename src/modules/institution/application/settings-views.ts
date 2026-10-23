import type { SettingType, SettingValue } from '../domain/settings/setting-definition.js';
import type { SettingsSectionDefinition, SettingsSectionKey } from '../domain/settings/settings-catalog.js';

/** Metadata of one field so the frontend can render the form. */
export interface SettingFieldView {
  key: string;
  label: string;
  type: SettingType;
  secret: boolean;
  readOnly: boolean;
  options: readonly string[] | null;
  min: number | null;
  max: number | null;
  maxLength: number | null;
}

export interface SettingsSectionMetadataView {
  key: SettingsSectionKey;
  label: string;
  fields: SettingFieldView[];
}

export interface SettingsSectionView {
  section: SettingsSectionKey;
  label: string;
  /** Secrets appear as a mask (or `null` when not configured). */
  values: Record<string, SettingValue>;
}

export const toSectionMetadata = (section: SettingsSectionDefinition): SettingsSectionMetadataView => ({
  key: section.key,
  label: section.label,
  fields: section.settings.map((setting) => ({
    key: setting.key,
    label: setting.label,
    type: setting.type,
    secret: setting.secret ?? false,
    readOnly: setting.readOnly ?? false,
    options: setting.options ?? null,
    min: setting.min ?? null,
    max: setting.max ?? null,
    maxLength: setting.maxLength ?? null,
  })),
});
