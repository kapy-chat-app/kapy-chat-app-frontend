// polyfills/text-encoding.js
import { TextDecoder as TextDecoderPolyfill, TextEncoder as TextEncoderPolyfill } from 'text-encoding';

// Force override global TextDecoder
const OriginalTextDecoder = global.TextDecoder;

class CustomTextDecoder {
  constructor(encoding = 'utf-8', options = {}) {
    const normalizedEncoding = (encoding || 'utf-8').toLowerCase().replace(/[-_\s]/g, '');
    
    // Nếu là utf-16, LUÔN dùng polyfill
    if (normalizedEncoding.includes('utf16')) {
      return new TextDecoderPolyfill(encoding, options);
    }
    
    // Các encoding khác, thử native trước
    try {
      if (OriginalTextDecoder) {
        return new OriginalTextDecoder(encoding, options);
      }
    } catch (e) {
      // Fallback sang polyfill
    }
    
    return new TextDecoderPolyfill(encoding, options);
  }
}

// Force replace
global.TextDecoder = CustomTextDecoder;

// TextEncoder
if (!global.TextEncoder) {
  global.TextEncoder = TextEncoderPolyfill;
}

console.log('✅ TextDecoder polyfill force-loaded');