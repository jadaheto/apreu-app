import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';
import type { ZipArchiverPort } from '../../../application/ports/zip-archiver.port.js';

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const VERSION = 20;
const UTF8_FLAG = 0x0800;
const DEFLATE = 8;
const STORED = 0;
/** 1980-01-01 00:00 in MS-DOS format: entries carry no timestamp so the ZIP is deterministic. */
const DOS_DATE = 0x21;
const DOS_TIME = 0;

export interface ZipEntry {
  name: string;
  content: Buffer;
}

/**
 * Minimal ZIP (PKWARE APPNOTE) writer/reader built on `node:zlib`, enough for
 * the DIAN exchange: one DEFLATE entry per submission, and reading the ZIP
 * returned by `GetStatusZip` (which the legacy never uncompressed).
 */
export class ZipArchiver implements ZipArchiverPort {
  zip(entryName: string, content: string | Buffer): Buffer {
    return writeZip([{ name: entryName, content: Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8') }]);
  }
}

/** Writes a ZIP with DEFLATE-compressed entries. */
export function writeZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.content);
    const checksum = crc32(entry.content) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(DEFLATE, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_HEADER, 0);
    central.writeUInt16LE(VERSION, 4);
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(DEFLATE, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

/** Reads every entry of a ZIP (stored or DEFLATE), using the central directory sizes. */
export function readZip(zip: Buffer): ZipEntry[] {
  const endOffset = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endOffset < 0) throw new Error('ZIP inválido: no se encontró el directorio central.');
  const count = zip.readUInt16LE(endOffset + 10);
  let cursor = zip.readUInt32LE(endOffset + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(cursor) !== CENTRAL_HEADER)
      throw new Error('ZIP inválido: entrada del directorio central corrupta.');
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.toString('utf8', cursor + 46, cursor + 46 + nameLength);

    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const data = zip.subarray(dataStart, dataStart + compressedSize);
    if (method !== STORED && method !== DEFLATE)
      throw new Error(`ZIP con método de compresión no soportado: ${method}.`);
    entries.push({ name, content: method === DEFLATE ? inflateRawSync(data) : Buffer.from(data) });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
