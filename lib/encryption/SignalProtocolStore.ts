// lib/encryption/SignalProtocolStore.ts
import * as SecureStore from 'expo-secure-store';

/**
 * SignalProtocolStore - Storage implementation for libsignal-protocol
 */
export class SignalProtocolStore {
  private static IDENTITY_KEY = 'signal_identity_key';
  private static REGISTRATION_ID = 'signal_registration_id';
  private static SESSION_PREFIX = 'signal_session_';
  private static PREKEY_PREFIX = 'signal_prekey_';
  private static SIGNED_PREKEY_PREFIX = 'signal_signed_prekey_';

  // ==========================================
  // IDENTITY KEY STORE
  // ==========================================

  async getIdentityKeyPair(): Promise<any | undefined> {
    try {
      const data = await SecureStore.getItemAsync(SignalProtocolStore.IDENTITY_KEY);
      if (!data) return undefined;

      const parsed = JSON.parse(data);
      return {
        pubKey: new Uint8Array(parsed.pubKey).buffer,
        privKey: new Uint8Array(parsed.privKey).buffer,
      };
    } catch (error) {
      console.error('❌ Failed to get Identity Key:', error);
      return undefined;
    }
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    try {
      const id = await SecureStore.getItemAsync(SignalProtocolStore.REGISTRATION_ID);
      return id ? parseInt(id, 10) : undefined;
    } catch (error) {
      console.error('❌ Failed to get Registration ID:', error);
      return undefined;
    }
  }

  async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
    return true;
  }

  async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
    try {
      const key = `signal_identity_${identifier}`;
      await SecureStore.setItemAsync(
        key,
        JSON.stringify(Array.from(new Uint8Array(identityKey)))
      );
      return true;
    } catch (error) {
      console.error('❌ Failed to save identity:', error);
      return false;
    }
  }

  // ==========================================
  // SESSION STORE
  // ==========================================

  async loadSession(identifier: string): Promise<any | undefined> {
    try {
      const key = `${SignalProtocolStore.SESSION_PREFIX}${identifier}`;
      const data = await SecureStore.getItemAsync(key);
      if (!data) return undefined;
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Failed to load session:', error);
      return undefined;
    }
  }

  async storeSession(identifier: string, record: any): Promise<void> {
    try {
      const key = `${SignalProtocolStore.SESSION_PREFIX}${identifier}`;
      await SecureStore.setItemAsync(key, JSON.stringify(record));
      console.log('✅ Session stored:', identifier);
    } catch (error) {
      console.error('❌ Failed to store session:', error);
      throw error;
    }
  }

  // ==========================================
  // PREKEY STORE
  // ==========================================

  async loadPreKey(keyId: number): Promise<any | undefined> {
    try {
      const key = `${SignalProtocolStore.PREKEY_PREFIX}${keyId}`;
      const data = await SecureStore.getItemAsync(key);
      if (!data) return undefined;

      const parsed = JSON.parse(data);
      return {
        pubKey: new Uint8Array(parsed.pubKey).buffer,
        privKey: new Uint8Array(parsed.privKey).buffer,
      };
    } catch (error) {
      console.error('❌ Failed to load PreKey:', error);
      return undefined;
    }
  }

  async storePreKey(keyId: number, keyPair: any): Promise<void> {
    try {
      const key = `${SignalProtocolStore.PREKEY_PREFIX}${keyId}`;
      await SecureStore.setItemAsync(
        key,
        JSON.stringify({
          pubKey: Array.from(new Uint8Array(keyPair.pubKey)),
          privKey: Array.from(new Uint8Array(keyPair.privKey)),
        })
      );
    } catch (error) {
      console.error('❌ Failed to store PreKey:', error);
      throw error;
    }
  }

  async removePreKey(keyId: number): Promise<void> {
    try {
      const key = `${SignalProtocolStore.PREKEY_PREFIX}${keyId}`;
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('❌ Failed to remove PreKey:', error);
    }
  }

  // ==========================================
  // SIGNED PREKEY STORE
  // ==========================================

  async loadSignedPreKey(keyId: number): Promise<any | undefined> {
    try {
      const key = `${SignalProtocolStore.SIGNED_PREKEY_PREFIX}${keyId}`;
      const data = await SecureStore.getItemAsync(key);
      if (!data) return undefined;

      const parsed = JSON.parse(data);
      return {
        pubKey: new Uint8Array(parsed.pubKey).buffer,
        privKey: new Uint8Array(parsed.privKey).buffer,
      };
    } catch (error) {
      console.error('❌ Failed to load Signed PreKey:', error);
      return undefined;
    }
  }

  async storeSignedPreKey(keyId: number, keyPair: any): Promise<void> {
    try {
      const key = `${SignalProtocolStore.SIGNED_PREKEY_PREFIX}${keyId}`;
      await SecureStore.setItemAsync(
        key,
        JSON.stringify({
          pubKey: Array.from(new Uint8Array(keyPair.pubKey)),
          privKey: Array.from(new Uint8Array(keyPair.privKey)),
        })
      );
    } catch (error) {
      console.error('❌ Failed to store Signed PreKey:', error);
      throw error;
    }
  }

  async removeSignedPreKey(keyId: number): Promise<void> {
    try {
      const key = `${SignalProtocolStore.SIGNED_PREKEY_PREFIX}${keyId}`;
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('❌ Failed to remove Signed PreKey:', error);
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  async saveIdentityKeyPair(keyPair: any): Promise<void> {
    await SecureStore.setItemAsync(
      SignalProtocolStore.IDENTITY_KEY,
      JSON.stringify({
        pubKey: Array.from(new Uint8Array(keyPair.pubKey)),
        privKey: Array.from(new Uint8Array(keyPair.privKey)),
      })
    );
  }

  async saveRegistrationId(id: number): Promise<void> {
    await SecureStore.setItemAsync(
      SignalProtocolStore.REGISTRATION_ID,
      id.toString()
    );
  }

  async clearAllKeys(): Promise<void> {
    await SecureStore.deleteItemAsync(SignalProtocolStore.IDENTITY_KEY);
    await SecureStore.deleteItemAsync(SignalProtocolStore.REGISTRATION_ID);
  }

  async hasKeys(): Promise<boolean> {
    const identityKey = await this.getIdentityKeyPair();
    const registrationId = await this.getLocalRegistrationId();
    return identityKey !== undefined && registrationId !== undefined;
  }
}