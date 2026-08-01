import { describe, expect, it } from 'vitest';
import { Asn1ParserPipe } from '../src/pipes/builtin/parsing/asn1-parser.js';
import { decode } from './helpers.js';

describe('Asn1ParserPipe', () => {
  it('has expected static metadata', () => {
    expect(Asn1ParserPipe.typeName).toBe('Asn1Parser');
    expect(Asn1ParserPipe.category).toBe('Data Formats');
  });

  it('parses a DER INTEGER value', async () => {
    const pipe = new Asn1ParserPipe();
    const bytes = new Uint8Array([0x02, 0x01, 0x05]);
    const result = await pipe.process(new Map([['input', bytes]]));
    const json = JSON.parse(decode(result.get('json')));

    expect(json.blockName).toBe('INTEGER');
    expect(json.valueBlock.valueDec).toBe(5);
  });

  it('parses a DER SEQUENCE with nested INTEGER', async () => {
    const pipe = new Asn1ParserPipe();
    const bytes = new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x05]);
    const result = await pipe.process(new Map([['input', bytes]]));
    const json = JSON.parse(decode(result.get('json')));

    expect(json.blockName).toBe('SEQUENCE');
    expect(json.valueBlock.value[0].blockName).toBe('INTEGER');
    expect(json.valueBlock.value[0].valueBlock.valueDec).toBe(5);
  });

  it('throws PipeError for empty input', async () => {
    const pipe = new Asn1ParserPipe();
    await expect(pipe.process(new Map([['input', new Uint8Array(0)]]))).rejects
      .toMatchObject({ message: 'Input is empty' });
  });

  it('throws PipeError for invalid BER data', async () => {
    const pipe = new Asn1ParserPipe();
    await expect(pipe.process(new Map([['input', new Uint8Array([0x30])]]))).rejects
      .toMatchObject({ message: expect.stringContaining('ASN.1 parse error') });
  });

  it('throws PipeError for trailing bytes', async () => {
    const pipe = new Asn1ParserPipe();
    await expect(pipe.process(new Map([['input', new Uint8Array([0x02, 0x01, 0x05, 0x00])]]))).rejects
      .toMatchObject({ message: expect.stringContaining('trailing bytes') });
  });

  it('scores input appropriateness', () => {
    expect(Asn1ParserPipe.getInputAppropriateness(null)).toBe(0);
    expect(Asn1ParserPipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(Asn1ParserPipe.getInputAppropriateness(new Uint8Array([0x02, 0x01, 0x05]))).toBe(10);
    expect(Asn1ParserPipe.getInputAppropriateness(new Uint8Array([0x30]))).toBe(-10);
  });
});
