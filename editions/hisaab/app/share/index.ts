/**
 * share/index.ts — "Forward this — it's actually sourced" (design bible §8.4). Server-free sharing:
 *
 *   await shareReceipt(item, 'receipt');                 // PNG card: answer + SOURCE + STATUS + as of (+ OTHER SIDE)
 *   await shareReceipt(item, 'challenge');               // PNG card: the question and four options, NO answer
 *   await shareDailyGrid({ day: '2026-09-25', results: [true, true, false, true, true], label: 'RTI Warrior' });
 *   await shareCertificate({ name, band: 4, receipts: 214, issuedOn: Date.now() });   // PNG, always light
 *   await shareInvite('7K2Q-9F3A', { format: 'Triple Threat' });
 *
 * How an image travels: the 1080 × 1350 card is drawn on a canvas (share/card.ts) and handed to the
 * Web Share API Level 2 (`navigator.share({ files })`) where the browser can share files. Elsewhere
 * the PNG is DOWNLOADED and the text twin is COPIED (outcome method 'download'). If the canvas itself
 * is unavailable, the text alone is shared (Web Share → clipboard). Nothing is ever uploaded: there is
 * no server.
 *
 * Honesty rules, enforced HERE so no screen can forget them:
 *  - an item with a legal `status` carries it verbatim with its as-of date — in the image AND the text,
 *    on BOTH variants (charter §2.2; a card naming a case never travels without its status);
 *  - the other side's answer travels too (charter §2.3; a share is a republication): the receipt text
 *    carries the full noting, and an item's `otherSide` clause prints as OTHER SIDE on both cards and
 *    both texts (on a challenge, only when it doesn't give the answer away — see card.otherSideLine);
 *  - a share never states a wrong option as fact (the challenge variant has no answer at all);
 *  - every receipt share says "Satire. Every question sourced.";
 *  - a certificate name that matches anyone in the bank prints "Anonymous Janta" (data.certificateName).
 * Confirmations are inline on the button ("Copied ✓" — see `shareOutcomeWords` and <ShareButton>),
 * never a toast — callers read the outcome.
 */
import { EDITION } from '../../edition';
import { certificateName, labelDisplay, monthLabel, statusWithAsOf, type BankItem } from '../data';
import { absoluteUrl, href } from '../router';
import { CERT_FOOTER, CERT_SITE } from '../ui/certificate';
import { otherSideLine, renderCertificateCard, renderReceiptCard } from './card';
import { activeCompetitionTitle } from '../../engine/labels.mjs';
import { online } from '../../online/runtime';
import type { TitleGrant } from '../../online/types';
import { honourLine } from './certificate-art.mjs';

export type ShareMethod = 'share' | 'clipboard' | 'download' | 'none';
export type ShareOutcome = Readonly<{
  ok: boolean;
  method: ShareMethod;
  reason?: 'cancelled' | 'unsupported' | 'failed' | 'not-implemented';
  /** 'download' only: whether the text twin also reached the clipboard (the button says so only if it did). */
  copied?: boolean;
}>;
export type ReceiptShareVariant = 'challenge' | 'receipt';

export const SHARE_CTA = "Forward this — it's actually sourced";
export const SHARE_CTA_HINGLISH = 'Forward karo — iska source hai.';
export const SHARE_CTA_HI = 'फ़ॉरवर्ड करो — इसका सोर्स है';
export const SHARE_FOOTER = 'Satire. Every question sourced.';

const LETTERS = ['A', 'B', 'C', 'D'];
const url = (hash: string) => absoluteUrl(hash, EDITION.base);

/** The link a receipt card prints and shares: the one-card taster (bible §8.4 `…/hisaab/#q=<id>`). */
export const receiptLink = (item: BankItem) => url(href.taster(item.id));

/**
 * The text of a receipt share. 'challenge' = question + options, no answer; 'receipt' = the answer
 * with its receipt and the noting (which holds the other side's answer, charter §2.3). Both carry the
 * legal status line with its as-of date when the item has one, and its OTHER SIDE clause when it has one.
 */
export function receiptShareText(item: BankItem, variant: ReceiptShareVariant): string {
  const lines = [`HISAAB DO · ${item.topic}`, item.question];
  const status = statusWithAsOf(item);
  const other = otherSideLine(item, variant);
  if (variant === 'challenge') {
    item.options.forEach((o, i) => lines.push(`${LETTERS[i]}. ${o}`));
    if (status) lines.push(`Legal status: ${status}`);
    if (other) lines.push(`Other side: ${other}`);
    lines.push('Jawab + receipt:');
  } else {
    lines.push(`Answer: ${item.options[item.correctIndex]}`);
    lines.push(`Source: ${item.sourceLabel} ${item.sourceUrl}`);
    if (status) lines.push(`Status: ${status}`);
    if (other) lines.push(`Other side: ${other}`);
    lines.push(`Noting: ${item.explanation}`);
    lines.push(`Govt then: ${item.govt}`);
  }
  lines.push(receiptLink(item));
  lines.push(SHARE_FOOTER);
  return lines.join('\n');
}

/** The daily grid (bible §8.4): '✅✅❌✅✅ 4/5' — ✅ ❌ only, no other emoji. */
export function dailyGridText(input: { day: string; results: readonly boolean[]; label: string }): string {
  const [y, m, d] = input.day.split('-');
  const date = `${Number(d)} ${monthLabel(`${y}-${m}`)}`;
  const right = input.results.filter(Boolean).length;
  return [
    `HISAAB DO · Aaj Ka Hisaab · ${date}`,
    `${input.results.map((r) => (r ? '✅' : '❌')).join('')} ${right}/${input.results.length}`,
    `Label: ${input.label}`,
    `Har sawaal ka source hai. Khud check karo: ${url(href.aaj())}`,
  ].join('\n');
}

/** The duel invite text (bible §8.4). */
export function inviteText(code: string, opts: { format?: string } = {}): string {
  return `Muqabla? ${opts.format ?? 'A duel'} on HISAAB DO. Room ${code}: ${url(href.friend(code))}`;
}

/** A WhatsApp share link for a text (wa.me; opens the app or WhatsApp Web). */
export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

// ---- transports -------------------------------------------------------------------------------------

const isAbort = (e: unknown) => (e as Error)?.name === 'AbortError';

async function copyText(text: string): Promise<boolean> {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  if (!nav?.clipboard?.writeText) return false;
  try {
    await nav.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Save a blob as a file (an <a download> click). False where there is no DOM. */
function downloadBlob(blob: Blob, filename: string): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return false;
  try {
    const link = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = link;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(link), 4000);
    return true;
  } catch {
    return false;
  }
}

/** Share text through the Web Share API, else copy it. Never throws. */
export async function shareText(text: string, title = EDITION.name): Promise<ShareOutcome> {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  if (nav?.share) {
    try {
      await nav.share({ title, text });
      return { ok: true, method: 'share' };
    } catch (e) {
      if (isAbort(e)) return { ok: false, method: 'share', reason: 'cancelled' };
      /* fall through to the clipboard */
    }
  }
  if (nav?.clipboard?.writeText) {
    return (await copyText(text)) ? { ok: true, method: 'clipboard' } : { ok: false, method: 'clipboard', reason: 'failed' };
  }
  return { ok: false, method: 'none', reason: 'unsupported' };
}

/**
 * Share an image with its text twin: Web Share Level 2 (files) where the browser can, else download the
 * PNG and copy the text. Never throws.
 */
export async function shareImage(blob: Blob, filename: string, text: string, title = EDITION.name): Promise<ShareOutcome> {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  let file: File | null = null;
  try {
    file = new File([blob], filename, { type: blob.type || 'image/png' });
  } catch {
    file = null;
  }
  if (file && nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text });
      return { ok: true, method: 'share' };
    } catch (e) {
      if (isAbort(e)) return { ok: false, method: 'share', reason: 'cancelled' };
      /* NotAllowedError (the gesture expired while the card was drawn) and the rest: save it instead */
    }
  }
  const saved = downloadBlob(blob, filename);
  const copied = await copyText(text);
  if (saved) return { ok: true, method: 'download', copied };
  if (copied) return { ok: true, method: 'clipboard' };
  return { ok: false, method: 'none', reason: 'unsupported' };
}

const canDraw = () => typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined';

/** Share one receipt card: a 1080 × 1350 PNG (challenge or receipt variant) with its text twin. */
export async function shareReceipt(item: BankItem, variant: ReceiptShareVariant): Promise<ShareOutcome> {
  const text = receiptShareText(item, variant);
  if (!canDraw()) return shareText(text);
  let blob: Blob;
  try {
    blob = await renderReceiptCard(item, variant, { link: receiptLink(item) });
  } catch {
    return shareText(text);
  }
  return shareImage(blob, `hisaab-do-${variant}-${item.id}.png`, text);
}

/** Share today's grid (text, by design). */
export async function shareDailyGrid(input: { day: string; results: readonly boolean[]; label: string }): Promise<ShareOutcome> {
  return shareText(dailyGridText(input));
}

export type CertificateShareInput = {
  name: string | null | undefined;
  band: number;
  /** Null for an earlier rung (the count at promotion is not on record). */
  receipts: number | null;
  /** Null when the promotion date is not on record (the stamp says ISSUED, no date). */
  issuedOn: Date | number | null;
  portrait?: string | null;
  competitionTitle?: TitleGrant | null;
  /** Unused since the card is drawn from data (kept for callers written against the stub). */
  node?: HTMLElement | null;
};

/** The certificate's text twin (and the caption of the PNG). */
export function certificateShareText(input: CertificateShareInput): string {
  const honour = activeCompetitionTitle(input.competitionTitle, online.now());
  const rung = labelDisplay(input.band);
  const label = honour ? { ...rung, en: honour.label, line: 'Receipts out. Tears in.' } : rung;
  return [
    input.receipts === null
      ? `${certificateName(input.name)} has been officially labelled ${label.en.toUpperCase()}.`
      : `${certificateName(input.name)} has been officially labelled ${label.en.toUpperCase()} after ${input.receipts} sourced ${input.receipts === 1 ? 'receipt' : 'receipts'}.`,
    `"${label.line}"`,
    ...(honour ? [honourLine(honour)] : []),
    `${url(href.home())}`,
    CERT_FOOTER,
  ].join('\n');
}

/** The certificate PNG (1080 × 1350, always the light theme), for a preview or a download. */
export async function certificateBlob(input: CertificateShareInput): Promise<Blob> {
  // A cached top-ten grant may have been displaced. Re-check at the moment of export.
  let grant = null;
  if (input.competitionTitle) {
    const identity = online.session?.id;
    const current = await online.request('profile');
    grant = current.session?.title ?? null;
    if (!identity || identity !== online.session?.id || !activeCompetitionTitle(grant, online.now())) throw new Error('This honour is no longer active. Choose your earned label.');
    input.competitionTitle = grant;
  }
  const blob = await renderCertificateCard({
    name: input.name,
    band: input.band,
    receipts: input.receipts,
    issuedOn: input.issuedOn,
    site: CERT_SITE,
    footer: CERT_FOOTER,
    portrait: input.portrait,
    competitionTitle: grant,
  });
  if (grant && !activeCompetitionTitle(grant, online.now())) throw new Error('This honour expired while the image was being prepared. Choose your earned label.');
  return blob;
}

/** Share the certificate: the PNG with its text twin (download + copy where files can't be shared). */
export async function shareCertificate(input: CertificateShareInput): Promise<ShareOutcome> {
  if (!canDraw()) return input.competitionTitle ? { ok: false, method: 'none', reason: 'unsupported' } : shareText(certificateShareText(input));
  let blob: Blob;
  try {
    blob = await certificateBlob(input);
  } catch {
    return input.competitionTitle ? { ok: false, method: 'none', reason: 'failed' } : shareText(certificateShareText(input));
  }
  const text = certificateShareText(input);
  const slug = labelDisplay(input.band)
    .en.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return shareImage(blob, `hisaab-do-certificate-${slug}.png`, text);
}

/** Share a P2P room invite (text + link). */
export async function shareInvite(code: string, opts: { format?: string } = {}): Promise<ShareOutcome> {
  return shareText(inviteText(code, opts));
}

/**
 * The inline words for a share outcome, for the button that started it (never a toast):
 * 'Shared ✓' · 'Copied ✓' · 'Image saved · text copied ✓' · 'Could not share. Try again'.
 * Null for a cancelled share (the button just goes back to its label).
 */
export function shareOutcomeWords(outcome: ShareOutcome, t: (en: string, hi?: string) => string = (en) => en): string | null {
  if (outcome.ok) {
    if (outcome.method === 'clipboard') return t('Copied ✓', 'कॉपी हो गया ✓');
    // Never claim the text was copied when the clipboard refused it.
    if (outcome.method === 'download')
      return outcome.copied ? t('Image saved · text copied ✓', 'तस्वीर सेव · टेक्स्ट कॉपी ✓') : t('Image saved ✓', 'तस्वीर सेव ✓');
    return t('Shared ✓', 'भेज दिया ✓');
  }
  if (outcome.reason === 'cancelled') return null;
  return t('Could not share. Try again', 'भेज नहीं पाए। फिर कोशिश करो');
}

export { ShareButton, type ShareButtonProps } from './share-button';
