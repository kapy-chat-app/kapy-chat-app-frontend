// polyfills/text-encoding.d.ts
// Type definitions cho text-encoding polyfill

declare module 'text-encoding' {
  export class TextEncoder {
    constructor(encoding?: string);
    encode(input?: string): Uint8Array;
  }

  export class TextDecoder {
    constructor(encoding?: string, options?: TextDecoderOptions);
    decode(input?: ArrayBufferView | ArrayBuffer, options?: TextDecodeOptions): string;
    readonly encoding: string;
    readonly fatal: boolean;
    readonly ignoreBOM: boolean;
  }
}

interface TextDecoderOptions {
  fatal?: boolean;
  ignoreBOM?: boolean;
}

interface TextDecodeOptions {
  stream?: boolean;
}