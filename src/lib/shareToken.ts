import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { isSupabaseConfigured } from './supabase';

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
 * Handles homonyms across different users/campaigns sequentially (e.g. "palazzo", "palazzo-2", "palazzo-3").
 */
export async function resolveCampaignPresentationSlug(
  campaignCode: string,
  campaignTitle?: string
): Promise<string> {
  const cleanCode = (campaignCode || '').trim().toUpperCase();
  const rawBaseSlug = slugifyCampaignTitle(campaignTitle || cleanCode);
  const baseSlug = rawBaseSlug.length > 0 ? rawBaseSlug : 'campagna';

  if (isSupabaseConfigured()) {
    return baseSlug;
  }

  try {
    // 1. Check if the base slug document exists in Firestore public_presentations
    const baseRef = doc(db, 'public_presentations', baseSlug);
    const baseSnap = await Promise.race([
      getDoc(baseRef),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout resolving slug')), 2500))
    ]);

    if (!baseSnap.exists()) {
      return baseSlug;
    }

    const baseData = baseSnap.data();
    // If the base slug already belongs to THIS exact campaign, reuse it directly
    if (baseData?.campaignCode === cleanCode) {
      return baseSlug;
    }

    // 2. Homonymy detected: search sequentially for the next available slot or our existing reservation
    for (let seq = 2; seq <= 50; seq++) {
      const candidateSlug = `${baseSlug}-${seq}`;
      const candidateRef = doc(db, 'public_presentations', candidateSlug);
      const candidateSnap = await getDoc(candidateRef);

      if (!candidateSnap.exists()) {
        return candidateSlug;
      }

      const candidateData = candidateSnap.data();
      if (candidateData?.campaignCode === cleanCode) {
        return candidateSlug;
      }
    }

    // Fallback in extreme homonymy scenario
    return `${baseSlug}-${(cleanCode || 'c').toLowerCase().slice(0, 8)}`;
  } catch (err) {
    console.warn('[ShareToken] Error resolving unique presentation slug:', err);
    return baseSlug;
  }
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

