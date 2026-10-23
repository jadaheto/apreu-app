import { Inject, Injectable } from '@nestjs/common';
import { crc32, deflateRawSync } from 'node:zlib';
import { CLOCK, type ClockPort } from '../../../../../shared/application/ports/clock.port.js';
import type { ArchiveEntry, DocumentArchiverPort } from '../../application/ports/document-archiver.port.js';

const UTF8_FLAG = 0x0800;
const DEFLATE = 8;
const VERSION = 20;

/** MS-DOS date/time fields used by the ZIP format. */
const dosDateTime = (date: Date): { date: number; time: number } => ({
  date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
});

/** ZIP (deflate) writer built on `node:zlib`, so no archiving library is needed. */
@Injectable()
export class ZipDocumentArchiver implements DocumentArchiverPort {
  constructor(@Inject(CLOCK) private readonly clock: ClockPort) {}

  async archive(entries: readonly ArchiveEntry[]): Promise<Uint8Array> {
    const { date, time } = dosDateTime(this.clock.now());
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
      const name = Buffer.from(entry.fileName, 'utf8');
      const data = Buffer.from(entry.content);
      const compressed = deflateRawSync(data);
      const checksum = crc32(data);

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(VERSION, 4);
      local.writeUInt16LE(UTF8_FLAG, 6);
      local.writeUInt16LE(DEFLATE, 8);
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(checksum, 14);
      local.writeUInt32LE(compressed.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);

      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(VERSION, 4);
      central.writeUInt16LE(VERSION, 6);
      central.writeUInt16LE(UTF8_FLAG, 8);
      central.writeUInt16LE(DEFLATE, 10);
      central.writeUInt16LE(time, 12);
      central.writeUInt16LE(date, 14);
      central.writeUInt32LE(checksum, 16);
      central.writeUInt32LE(compressed.length, 20);
      central.writeUInt32LE(data.length, 24);
      central.writeUInt16LE(name.length, 28);
      central.writeUInt32LE(offset, 42);

      locals.push(local, name, compressed);
      centrals.push(central, name);
      offset += local.length + name.length + compressed.length;
    }

    const centralDirectory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);

    return new Uint8Array(Buffer.concat([...locals, centralDirectory, end]));
  }
}
