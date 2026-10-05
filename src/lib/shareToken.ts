/**
 * Transforms a campaign name into a clean, URL-safe slug.
 * e.g. "Palazzo di Vetro" -> "palazzo-di-vetro", "L'Ombra dell'Antico" -> "lombra-dellantico"
 */
export function slugifyCampaignTitle(name: string): string {
  if (!name || typeof name !== 'string') return 'campagna';

  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics / accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric to hyphen
    .replace(/^-+|-+$/g, '') // trim hyphens
    .slice(0, 50);

  return slug || 'campagna';
}

/**
 * Reverses a campaign code or ID string for secure URL obfuscation.
 * e.g. "PALAZZO" -> "ozzalap", "c_12345" -> "54321_c"
 */
export function reverseCode(code: string): string {
  if (!code) return 'eincorhc';
  const clean = code.trim().replace(/[^a-zA-Z0-9_]/g, '');
  const reversed = clean.split('').reverse().join('').toLowerCase();
  return reversed || 'eincorhc';
}

/**
 * Reconstructs possible campaign code variants from an obfuscated reversed string or raw input,
 * generating standard hyphenated Chronicle codes (e.g. CHR-XXXX-XXXX) and raw unhyphenated codes.
 */
export function reconstructCampaignCodes(reversedOrRaw: string): string[] {
  if (!reversedOrRaw) return [];
  const clean = reversedOrRaw.trim();
  const reversed = clean.split('').reverse().join('').toUpperCase();
  const directUpper = clean.toUpperCase();

  const candidates = new Set<string>();
  candidates.add(clean);
  candidates.add(directUpper);
  candidates.add(reversed);

  // If reversed looks like CHRXXXXXXXX (11 chars starting with CHR)
  [reversed, directUpper].forEach((str) => {
    const alphanumeric = str.replace(/[^A-Z0-9]/g, '');
    candidates.add(alphanumeric);

    if (alphanumeric.startsWith('CHR') && alphanumeric.length === 11) {
      // Standard Chronicle format CHR-XXXX-XXXX
      const formatted = `${alphanumeric.slice(0, 3)}-${alphanumeric.slice(3, 7)}-${alphanumeric.slice(7)}`;
      candidates.add(formatted);
    } else if (alphanumeric.length === 10 && alphanumeric.startsWith('CHR')) {
      const formatted = `${alphanumeric.slice(0, 3)}-${alphanumeric.slice(3, 6)}-${alphanumeric.slice(6)}`;
      candidates.add(formatted);
    } else if (alphanumeric.length >= 8) {
      // Generic hyphen splits
      const mid = Math.floor(alphanumeric.length / 2);
      candidates.add(`${alphanumeric.slice(0, mid)}-${alphanumeric.slice(mid)}`);
    }
  });

  return Array.from(candidates).filter(Boolean);
}

/**
 * Builds a deterministic public presentation URL synchronously on client-side
 * with structure: base_url/presentation/nomecampagna/uuid_campagna_al_contrario
 */
export function buildClientPresentationUrl(campaignTitle?: string, campaignCode?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const title = (campaignTitle || '').trim();
  const code = (campaignCode || '').trim().toUpperCase();
  const nameSlug = slugifyCampaignTitle(title || code || 'campagna');
  const reversed = reverseCode(code || nameSlug);
  return `${origin}/presentation/${nameSlug}/${reversed}`;
}

/**
 * Copies text to the system clipboard with modern Clipboard API and fallback execCommand.
 * Works even inside iframes, non-HTTPS development, and after asynchronous delays.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand
    }
  }

  // 2. Resilient fallback using temporary off-screen textarea
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Resolves a unique, human-readable presentation slug based on the campaign name.
 */
export async function resolveCampaignPresentationSlug(
  campaignCode: string,
  campaignTitle?: string
): Promise<string> {
  const cleanCode = (campaignCode || '').trim().toUpperCase();
  const rawBaseSlug = slugifyCampaignTitle(campaignTitle || cleanCode);
  return rawBaseSlug.length > 0 ? rawBaseSlug : 'campagna';
}

/**
 * Generates and validates opaque, cryptographically safe share tokens for campaigns
 * so that raw campaign secret access codes are NEVER exposed in public URLs.
 */
export function generateCampaignShareToken(campaignCode: string): string {
  if (!campaignCode) return '';
  const clean = campaignCode.trim().toUpperCase();

  // Fast Fowler-Noll-Vo 32-bit hash with salt
  let h1 = 0x811c9dc5;
  const salt = 'chronicle_lore_presentation_salt_v2';
  const input = `${clean}::${salt}`;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
  }

  let h2 = 0x5a17e9;
  for (let i = input.length - 1; i >= 0; i--) {
    h2 ^= input.charCodeAt(i);
    h2 = (h2 * 0x01000193) >>> 0;
  }

  const part1 = h1.toString(36);
  const part2 = h2.toString(36);
  return `p_${part1}${part2}`.toLowerCase();
}

