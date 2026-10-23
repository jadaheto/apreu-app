import { inflateRawSync } from 'node:zlib';
import { readZip, writeZip, ZipArchiver } from './zip-archiver.js';

describe('ZipArchiver', () => {
  it('creates a single-entry DEFLATE ZIP that round-trips', () => {
    const xml = '<?xml version="1.0"?><Invoice>ñandú</Invoice>'.repeat(50);
    const zip = new ZipArchiver().zip('fv0900123456000263b023381.xml', xml);
    expect(zip.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(zip.readUInt16LE(8)).toBe(8); // DEFLATE
    expect(zip.length).toBeLessThan(Buffer.byteLength(xml));
    const [entry, ...rest] = readZip(zip);
    expect(rest).toEqual([]);
    expect(entry.name).toBe('fv0900123456000263b023381.xml');
    expect(entry.content.toString('utf8')).toBe(xml);
    const nameLength = zip.readUInt16LE(26);
    const compressed = zip.subarray(30 + nameLength, 30 + nameLength + zip.readUInt32LE(18));
    expect(inflateRawSync(compressed).toString('utf8')).toBe(xml);
  });

  it('reads several entries and rejects invalid data', () => {
    const zip = writeZip([
      { name: 'a.xml', content: Buffer.from('<a/>') },
      { name: 'b.xml', content: Buffer.from('<b/>') },
    ]);
    expect(readZip(zip).map((e) => [e.name, e.content.toString()])).toEqual([
      ['a.xml', '<a/>'],
      ['b.xml', '<b/>'],
    ]);
    expect(() => readZip(Buffer.from('no zip'))).toThrow('ZIP inválido');
  });
});
