/**
 * Character set encoding/decoding pipes.
 *
 * Charset Decode: interprets input bytes as text in the specified encoding,
 *   outputs the decoded string as UTF-8 bytes.
 *   Uses TextDecoder for WHATWG-supported encodings (preserves the fatal flag),
 *   and iconv-lite for encodings not in the WHATWG Encoding spec (e.g. utf-32).
 *
 * Charset Encode: takes UTF-8 text bytes and re-encodes them to any of the
 *   supported target encodings using iconv-lite.
 *
 * Both pipes expose all encoding names supported by iconv-lite as options.
 */

import { Pipe, PipeConfig, PipeError } from '../../pipe.js';
import iconv from '../../../../vendor/iconv-lite.js';

// All encoding names supported by iconv-lite (canonical names plus well-known
// aliases), sorted alphabetically.  Generated from iconv-lite's encoding data
// plus friendly hyphenated forms for common standards.
export const ALL_ENCODINGS = [
  '10000', '10006', '10007', '10029', '10079', '10081', '1046', '1124',
  '1125', '1129', '1133', '1161', '1162', '1163', '1250', '1251', '1252',
  '1253', '1254', '1255', '1256', '1257', '1258', '20866', '21866', '28591',
  '28592', '28593', '28594', '28595', '28596', '28597', '28598', '28599',
  '28600', '28601', '28603', '28604', '28605', '28606', '437', '737', '775',
  '808', '850', '852', '855', '856', '857', '858', '860', '861', '862',
  '863', '864', '865', '866', '869', '874', '922', '932', '936', '949',
  '950', 'ansix34', 'ansix341968', 'ansix341986', 'arabic', 'arabic8',
  'armscii8', 'ascii', 'ascii8bit', 'asmo708', 'big5', 'big5hkscs', 'celtic',
  'celtic8', 'chinese', 'cn', 'cnbig5', 'cp1046', 'cp1124', 'cp1125',
  'cp1129', 'cp1133', 'cp1161', 'cp1162', 'cp1163', 'cp1250', 'cp1251',
  'cp1252', 'cp1253', 'cp1254', 'cp1255', 'cp1256', 'cp1257', 'cp1258',
  'cp20866', 'cp21866', 'cp28591', 'cp28592', 'cp28593', 'cp28594', 'cp28595',
  'cp28596', 'cp28597', 'cp28598', 'cp28599', 'cp28600', 'cp28601', 'cp28603',
  'cp28604', 'cp28605', 'cp28606', 'cp367', 'cp437', 'cp720', 'cp737',
  'cp775', 'cp808', 'cp819', 'cp850', 'cp852', 'cp855', 'cp856', 'cp857',
  'cp858', 'cp860', 'cp861', 'cp862', 'cp863', 'cp864', 'cp865', 'cp866',
  'cp869', 'cp874', 'cp922', 'cp932', 'cp936', 'cp949', 'cp950', 'cpgr',
  'csascii', 'csbig5', 'cseuckr', 'csgb2312', 'cshproman8', 'csibm1046',
  'csibm1124', 'csibm1125', 'csibm1129', 'csibm1133', 'csibm1161',
  'csibm1162', 'csibm1163', 'csibm437', 'csibm737', 'csibm775', 'csibm850',
  'csibm852', 'csibm855', 'csibm856', 'csibm857', 'csibm858', 'csibm860',
  'csibm861', 'csibm862', 'csibm863', 'csibm864', 'csibm865', 'csibm866',
  'csibm869', 'csibm922', 'csiso14jisc6220ro', 'csiso58gb231280',
  'csisolatin1', 'csisolatin2', 'csisolatin3', 'csisolatin4', 'csisolatin5',
  'csisolatin6', 'csisolatinarabic', 'csisolatincyrillic', 'csisolatingreek',
  'csisolatinhebrew', 'cskoi8r', 'csksc56011987', 'csmacintosh',
  'cspc775baltic', 'cspc850multilingual', 'cspc862latinhebrew',
  'cspc8codepage437', 'cspcp852', 'csshiftjis', 'cyrillic', 'ecma114',
  'ecma118', 'elot928', 'euc-jp', 'euc-kr', 'euccn', 'eucjp', 'euckr',
  'gb18030', 'gb198880', 'gb2312', 'gb23121980', 'gb231280', 'gbk',
  'georgianacademy', 'georgianps', 'greek', 'greek8', 'hebrew', 'hebrew8',
  'hproman8', 'ibm1046', 'ibm1051', 'ibm1124', 'ibm1125', 'ibm1129',
  'ibm1133', 'ibm1161', 'ibm1162', 'ibm1163', 'ibm1168', 'ibm367', 'ibm437',
  'ibm737', 'ibm775', 'ibm808', 'ibm819', 'ibm850', 'ibm852', 'ibm855',
  'ibm856', 'ibm857', 'ibm858', 'ibm860', 'ibm861', 'ibm862', 'ibm863',
  'ibm864', 'ibm865', 'ibm866', 'ibm869', 'ibm878', 'ibm922', 'iso-8859-1',
  'iso-8859-10', 'iso-8859-11', 'iso-8859-13', 'iso-8859-14', 'iso-8859-15',
  'iso-8859-16', 'iso-8859-2', 'iso-8859-3', 'iso-8859-4', 'iso-8859-5',
  'iso-8859-6', 'iso-8859-7', 'iso-8859-8', 'iso-8859-9', 'iso646cn',
  'iso646irv', 'iso646jp', 'iso646us', 'iso88591', 'iso885910', 'iso885911',
  'iso885913', 'iso885914', 'iso885915', 'iso885916', 'iso88592', 'iso88593',
  'iso88594', 'iso88595', 'iso88596', 'iso88597', 'iso88598', 'iso88598e',
  'iso88598i', 'iso88599', 'isoceltic', 'isoir100', 'isoir101', 'isoir109',
  'isoir110', 'isoir126', 'isoir127', 'isoir138', 'isoir14', 'isoir144',
  'isoir148', 'isoir149', 'isoir157', 'isoir166', 'isoir179', 'isoir199',
  'isoir203', 'isoir226', 'isoir57', 'isoir58', 'isoir6', 'jisc62201969ro',
  'jp', 'koi8-r', 'koi8-u', 'koi8r', 'koi8ru', 'koi8t', 'koi8u', 'korean',
  'ksc5601', 'ksc56011987', 'ksc56011989', 'l1', 'l10', 'l2', 'l3', 'l4',
  'l5', 'l6', 'l7', 'l8', 'l9', 'latin1', 'latin10', 'latin2', 'latin3',
  'latin4', 'latin5', 'latin6', 'latin7', 'latin8', 'latin9', 'mac',
  'maccenteuro', 'maccroatian', 'maccyrillic', 'macgreek', 'maciceland',
  'macintosh', 'macroman', 'macromania', 'macthai', 'macturkish', 'macukraine',
  'mik', 'ms31j', 'ms932', 'ms936', 'ms949', 'ms950', 'msansi', 'msarab',
  'mscyrl', 'msee', 'msgreek', 'mshebr', 'mskanji', 'msturk', 'pt154', 'r8',
  'rk1048', 'roman8', 'shift_jis', 'shiftjis', 'sjis', 'strk10482002',
  'tcvn', 'tcvn5712', 'tcvn57121', 'thai', 'thai8', 'tis620', 'tis6200',
  'tis62025291', 'tis62025330', 'turkish', 'turkish8', 'ucs2', 'ucs4',
  'ucs4be', 'ucs4le', 'unicode11utf7', 'unicode11utf8', 'us', 'usascii',
  'utf-16', 'utf-16be', 'utf-16le', 'utf-32be', 'utf-32le', 'utf-8', 'utf16',
  'utf16be', 'utf16le', 'utf32', 'utf32be', 'utf32le', 'utf7', 'utf7imap',
  'utf8', 'viscii', 'win1250', 'win1251', 'win1252', 'win1253', 'win1254',
  'win1255', 'win1256', 'win1257', 'win1258', 'win874', 'winbaltrim',
  'windows-1250', 'windows-1251', 'windows-1252', 'windows-1253',
  'windows-1254', 'windows-1255', 'windows-1256', 'windows-1257',
  'windows-1258', 'windows-874', 'windows1250', 'windows1251', 'windows1252',
  'windows1253', 'windows1254', 'windows1255', 'windows1256', 'windows1257',
  'windows1258', 'windows31j', 'windows874', 'windows932', 'windows936',
  'windows949', 'windows950', 'xgbk', 'xroman8', 'xsjis', 'xxbig5',
];

// Detect at runtime whether an encoding is supported by the WHATWG TextDecoder
// API (which honours the fatal flag).  Encodings not in the WHATWG Encoding
// spec fall through to iconv-lite for decoding.
function isWHATWGEncoding(enc) {
  try {
    new TextDecoder(enc);
    return true;
  } catch {
    return false;
  }
}

export class CharsetDecodePipe extends Pipe {
  static typeName = 'CharsetDecode';
  static typeDescription = 'Charset Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode bytes from a specified character encoding to UTF-8 text.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    const hasBom =
      (input.length >= 3 && input[0] === 0xEF && input[1] === 0xBB && input[2] === 0xBF) ||
      (input.length >= 4 && input[0] === 0x00 && input[1] === 0x00 &&
        input[2] === 0xFE && input[3] === 0xFF) ||
      (input.length >= 4 && input[0] === 0xFF && input[1] === 0xFE &&
        input[2] === 0x00 && input[3] === 0x00) ||
      (input.length >= 2 && input[0] === 0xFE && input[1] === 0xFF) ||
      (input.length >= 2 && input[0] === 0xFF && input[1] === 0xFE);
    return hasBom ? 10 : 0;
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'fromEncoding',
        description: 'Source character encoding of the input bytes',
        defaultValue: 'utf-8',
        type: 'select',
        options: ALL_ENCODINGS,
      }),
      new PipeConfig({
        name: 'fatal',
        description: 'Throw an error on invalid byte sequences',
        defaultValue: true,
        type: 'boolean',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const fromEnc = this.getConfig('fromEncoding')?.value ?? 'utf-8';
    const fatal = this.getConfig('fatal')?.value ?? true;

    let text;
    try {
      if (isWHATWGEncoding(fromEnc)) {
        // TextDecoder supports these encodings and honours the fatal flag.
        const decoder = new TextDecoder(fromEnc, { fatal });
        text = decoder.decode(data);
      } else {
        // Encodings not in the WHATWG Encoding spec (e.g. utf-32) — use iconv-lite.
        text = iconv.decode(data, fromEnc);
      }
    } catch (e) {
      if (e instanceof PipeError) throw e;
      throw new PipeError(`Cannot decode bytes as ${fromEnc}: ${e.message}`);
    }

    return new Map([['output', new TextEncoder().encode(text)]]);
  }
}

export class CharsetEncodePipe extends Pipe {
  static typeName = 'CharsetEncode';
  static typeDescription = 'Charset Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode UTF-8 text bytes to a target character encoding.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(input);
      return 0;
    } catch {
      return -10;
    }
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'toEncoding',
        description: 'Target character encoding for the output bytes',
        defaultValue: 'utf-8',
        type: 'select',
        options: ALL_ENCODINGS,
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const toEnc = this.getConfig('toEncoding')?.value ?? 'utf-8';

    // Decode input as UTF-8 first.
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch (e) {
      throw new PipeError(`Input bytes are not valid UTF-8: ${e.message}`);
    }

    if (!iconv.encodingExists(toEnc)) {
      throw new PipeError(`Encoding to '${toEnc}' is not supported`);
    }

    try {
      return new Map([['output', new Uint8Array(iconv.encode(text, toEnc))]]);
    } catch (e) {
      throw new PipeError(`Cannot encode text as ${toEnc}: ${e.message}`);
    }
  }
}
