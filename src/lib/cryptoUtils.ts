/**
 * Cryptographic utility for securing API Keys and sensitive credentials
 * client-side using AES-GCM 256-bit with PBKDF2 key derivation.
 * Ensures API keys are never stored in plaintext in Firestore or LocalStorage.
 */

const APP_PEPPER = 'chronicle_dnd_v1_vault_salt_8f9a2b';

async function deriveKey(saltStr: string): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return null;
  }
  try {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(APP_PEPPER),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode(saltStr),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (e) {
    console.warn('[CryptoUtils] WebCrypto deriveKey fallback:', e);
    return null;
  }
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Obfuscation fallback if WebCrypto subtle is unavailable in non-secure context
 */
function xorObfuscate(str: string, key = 'chronicle_arcane'): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return 'enc:xor:' + btoa(out);
}

function xorDeobfuscate(encoded: string, key = 'chronicle_arcane'): string {
  try {
    const raw = atob(encoded.replace('enc:xor:', ''));
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      out += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return out;
  } catch {
    return '';
  }
}

/**
 * Encrypts an API key string with AES-GCM 256-bit.
 * Returns formatted ciphertext string "enc:v1:<iv>:<data>"
 */
export async function encryptApiKey(plainText: string, salt = 'chronicle_default'): Promise<string> {
  if (!plainText || typeof plainText !== 'string') return '';
  const trimmed = plainText.trim();
  if (!trimmed) return '';
  // Avoid re-encrypting already encrypted keys
  if (trimmed.startsWith('enc:v1:') || trimmed.startsWith('enc:xor:')) return trimmed;

  const key = await deriveKey(salt);
  if (!key) {
    return xorObfuscate(trimmed, salt);
  }

  try {
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(trimmed)
    );

    return `enc:v1:${bufferToBase64(iv)}:${bufferToBase64(encrypted)}`;
  } catch (err) {
    console.warn('[CryptoUtils] Encryption fallback:', err);
    return xorObfuscate(trimmed, salt);
  }
}

/**
 * Decrypts an encrypted API key string.
 * Gracefully returns original text if not encrypted (legacy migration support).
 */
export async function decryptApiKey(
  cipherText: string,
  salt = 'chronicle_default',
  additionalSalts: string[] = []
): Promise<string> {
  if (!cipherText || typeof cipherText !== 'string') return '';
  const trimmed = cipherText.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('enc:xor:')) {
    return xorDeobfuscate(trimmed, salt);
  }

  if (!trimmed.startsWith('enc:v1:')) {
    // Unencrypted legacy key, return as-is
    return trimmed;
  }

  const parts = trimmed.split(':');
  if (parts.length !== 4) return '';

  const ivB64 = parts[2];
  const dataB64 = parts[3];

  // Try candidate salts in sequence (provided salt, uppercase, default, campaign, and additional salts)
  const candidateSalts = Array.from(new Set([
    salt,
    salt.toUpperCase(),
    salt.toLowerCase(),
    ...additionalSalts,
    ...additionalSalts.map((s) => s.toUpperCase()),
    ...additionalSalts.map((s) => s.toLowerCase()),
    'CAMPAIGN',
    'campaign',
    'chronicle_default',
  ].filter(Boolean)));

  for (const s of candidateSalts) {
    try {
      const key = await deriveKey(s);
      if (!key) continue;
      const iv = base64ToBuffer(ivB64);
      const data = base64ToBuffer(dataB64);
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as any },
        key,
        data as any
      );
      const dec = new TextDecoder();
      const res = dec.decode(decrypted);
      if (res && res.trim()) {
        return res.trim();
      }
    } catch {}
  }

  // Fallback obfuscation attempt if subtle crypto fails
  return xorDeobfuscate(trimmed, salt);
}
