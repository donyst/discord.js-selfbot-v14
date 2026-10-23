export type EncryptFn = (plaintext: Uint8Array, additionalData: Uint8Array, nonce: Uint8Array, key: Uint8Array) => Uint8Array;
export type DecryptFn = (ciphertext: Uint8Array, additionalData: Uint8Array, nonce: Uint8Array, key: Uint8Array) => Uint8Array;

export interface SecretboxMethods {
  crypto_aead_xchacha20poly1305_ietf_encrypt: EncryptFn;
  crypto_aead_xchacha20poly1305_ietf_decrypt: DecryptFn;
}

function NoLib(): never {
  throw new Error(
    'Cannot play audio as no valid encryption package is installed.\n- Install sodium, libsodium-wrappers, or @stablelib/xchacha20poly1305.',
  );
}

export const methods: SecretboxMethods = {
  crypto_aead_xchacha20poly1305_ietf_encrypt: NoLib,
  crypto_aead_xchacha20poly1305_ietf_decrypt: NoLib,
};

const libs: Record<string, (mod: unknown) => SecretboxMethods> = {
  sodium: (sodium: unknown) => ({
    crypto_aead_xchacha20poly1305_ietf_encrypt: (plaintext, additionalData, nonce, key) =>
      (sodium as { api: { crypto_aead_xchacha20poly1305_ietf_encrypt(p: Uint8Array, ad: Uint8Array, n: null, no: Uint8Array, k: Uint8Array): Uint8Array } }).api.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, additionalData, null, nonce, key),
    crypto_aead_xchacha20poly1305_ietf_decrypt: (plaintext, additionalData, nonce, key) =>
      (sodium as { api: { crypto_aead_xchacha20poly1305_ietf_decrypt(p: Uint8Array, ad: Uint8Array, n: null, no: Uint8Array, k: Uint8Array): Uint8Array } }).api.crypto_aead_xchacha20poly1305_ietf_decrypt(plaintext, additionalData, null, nonce, key),
  }),
  'libsodium-wrappers': (sodium: unknown) => ({
    crypto_aead_xchacha20poly1305_ietf_encrypt: (plaintext, additionalData, nonce, key) =>
      (sodium as { crypto_aead_xchacha20poly1305_ietf_encrypt(p: Uint8Array, ad: Uint8Array, n: null, no: Uint8Array, k: Uint8Array): Uint8Array }).crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, additionalData, null, nonce, key),
    crypto_aead_xchacha20poly1305_ietf_decrypt: (plaintext, additionalData, nonce, key) =>
      (sodium as { crypto_aead_xchacha20poly1305_ietf_decrypt(n: null, p: Uint8Array, ad: Uint8Array, no: Uint8Array, k: Uint8Array): Uint8Array }).crypto_aead_xchacha20poly1305_ietf_decrypt(null, plaintext, additionalData, nonce, key),
  }),
  '@stablelib/xchacha20poly1305': (stablelib: unknown) => ({
    crypto_aead_xchacha20poly1305_ietf_encrypt(cipherText, additionalData, nonce, key) {
      const Ctor = (stablelib as { XChaCha20Poly1305: new (k: Uint8Array) => { seal(n: Uint8Array, c: Uint8Array, ad: Uint8Array): Uint8Array } }).XChaCha20Poly1305;
      const crypto = new Ctor(key);
      return crypto.seal(nonce, cipherText, additionalData);
    },
    crypto_aead_xchacha20poly1305_ietf_decrypt(plaintext, additionalData, nonce, key) {
      const Ctor = (stablelib as { XChaCha20Poly1305: new (k: Uint8Array) => { open(n: Uint8Array, p: Uint8Array, ad: Uint8Array): Uint8Array } }).XChaCha20Poly1305;
      const crypto = new Ctor(key);
      return crypto.open(nonce, plaintext, additionalData);
    },
  }),
};

async function importModule(name: string): Promise<unknown> {
  const mod = await import(name);
  return (mod as { default?: unknown }).default ?? mod;
}

void (async (): Promise<void> => {
  for (const libName of Object.keys(libs)) {
    try {
      const lib = await importModule(libName);
      if (libName === 'libsodium-wrappers' && (lib as { ready?: Promise<void> }).ready) {
        await (lib as { ready: Promise<void> }).ready;
      }
      const created = libs[libName]!(lib);
      methods.crypto_aead_xchacha20poly1305_ietf_encrypt = created.crypto_aead_xchacha20poly1305_ietf_encrypt;
      methods.crypto_aead_xchacha20poly1305_ietf_decrypt = created.crypto_aead_xchacha20poly1305_ietf_decrypt;
      break;
    } catch {}
  }
})();

export default { methods };
