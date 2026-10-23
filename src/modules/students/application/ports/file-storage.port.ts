/** Stores binary files (student photos) outside any publicly executable folder. */
export interface FileStoragePort {
  /** Saves the content and returns its relative storage path (e.g. `students/student_1_ab12.jpg`). */
  save(directory: string, fileName: string, content: Uint8Array): Promise<string>;
  /** Reads a file previously returned by {@link save}. Throws `NotFoundError` when missing. */
  read(path: string): Promise<Uint8Array>;
  /** Deletes a stored file; missing files are ignored. */
  remove(path: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FileStoragePort');
