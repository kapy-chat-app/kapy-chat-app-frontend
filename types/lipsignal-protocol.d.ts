// types/libsignal-protocol.d.ts
declare module 'libsignal-protocol' {
  export class SignalProtocolAddress {
    constructor(name: string, deviceId: number);
    getName(): string;
    getDeviceId(): number;
  }

  export class SessionBuilder {
    constructor(storage: any, remoteAddress: SignalProtocolAddress);
    processPreKey(device: any): Promise<void>;
  }

  export class SessionCipher {
    constructor(storage: any, remoteAddress: SignalProtocolAddress);
    encrypt(buffer: ArrayBuffer): Promise<any>;
    decryptPreKeyWhisperMessage(
      buffer: ArrayBuffer | string,
      encoding?: string
    ): Promise<ArrayBuffer>;
    decryptWhisperMessage(
      buffer: ArrayBuffer | string,
      encoding?: string
    ): Promise<ArrayBuffer>;
  }

  export class KeyHelper {
    static generateIdentityKeyPair(): Promise<{
      pubKey: ArrayBuffer;
      privKey: ArrayBuffer;
    }>;
    
    static generateRegistrationId(): number;
    
    static generatePreKeys(
      start: number,
      count: number
    ): Promise<Array<{
      keyId: number;
      keyPair: { pubKey: ArrayBuffer; privKey: ArrayBuffer };
    }>>;
    
    static generateSignedPreKey(
      identityKeyPair: { pubKey: ArrayBuffer; privKey: ArrayBuffer },
      keyId: number
    ): Promise<{
      keyId: number;
      keyPair: { pubKey: ArrayBuffer; privKey: ArrayBuffer };
      signature: ArrayBuffer;
    }>;
  }
}