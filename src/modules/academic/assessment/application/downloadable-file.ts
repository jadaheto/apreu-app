/** Binary document returned to the HTTP layer. */
export interface DownloadableFile {
  fileName: string;
  contentType: string;
  content: Uint8Array;
}
