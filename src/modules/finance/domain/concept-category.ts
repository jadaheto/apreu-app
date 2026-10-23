/** Categories of a billing concept (`billing_concepts.category` ENUM). */
export const CONCEPT_CATEGORIES = [
  'matricula',
  'pension',
  'mensualidad',
  'servicios',
  'materiales',
  'transporte',
  'alimentacion',
  'certificado',
  'recargo',
  'inscripcion',
  'otro',
] as const;

export type ConceptCategory = (typeof CONCEPT_CATEGORIES)[number];
