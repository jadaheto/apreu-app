/** Packs the signed XML in a ZIP with a single entry (DIAN submission format). */
export interface ZipArchiverPort {
  zip(entryName: string, content: string | Buffer): Buffer;
}

export const ZIP_ARCHIVER = Symbol('ZipArchiverPort');
