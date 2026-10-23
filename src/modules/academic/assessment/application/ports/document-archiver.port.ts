export interface ArchiveEntry {
  fileName: string;
  content: Uint8Array;
}

/** Packs several files into one downloadable archive (ZIP). */
export interface DocumentArchiverPort {
  archive(entries: readonly ArchiveEntry[]): Promise<Uint8Array>;
}

export const DOCUMENT_ARCHIVER = Symbol('DocumentArchiverPort');
