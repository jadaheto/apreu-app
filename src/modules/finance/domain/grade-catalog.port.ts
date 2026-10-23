/** Existence check of grades (academic context), used to validate tuition rates. */
export interface GradeCatalogPort {
  existingIds(ids: number[]): Promise<number[]>;
}

export const GRADE_CATALOG = Symbol('GradeCatalogPort');
