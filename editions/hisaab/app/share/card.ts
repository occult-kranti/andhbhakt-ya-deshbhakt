/**
 * share/card.ts — the 1080 × 1350 (4:5) PNG cards, drawn with the Canvas 2D API (design bible §8.4,
 * §11.14). No DOM capture library, no network, no server: fonts are the self-hosted faces the page
 * already uses, colours are read from the LIGHT theme tokens (tokens.css stays the only source of
 * truth — there is no colour literal in this file), and the result is a Blob.
 *
 *   const blob = await renderReceiptCard(item, 'challenge', { link });   // question + four options, NO answer
 *   const blob = await renderReceiptCard(item, 'receipt', { link });     // answer + SOURCE + STATUS + as of
 *   const blob = await renderCertificateCard({ name, band, receipts, issuedOn });
 *
 * Honesty rules held here, whatever the caller does:
 *  - an item with a legal `status` prints it VERBATIM with its as-of date, in the neutral legal block,
 *    on BOTH variants (charter §2.2: a card about a case never travels without the case's status);
 *  - an item with an `otherSide` clause (charter §2.3; the optional one-clause bank field) prints it as
 *    the OTHER SIDE row after STATUS on both variants — on the challenge card only if it does not give
 *    the answer away, else a pointer to the receipt;
 *  - the challenge variant never prints or marks the answer;
 *  - every receipt card says "Satire. Every question sourced."; the certificate says "Satire. Not a
 *    government document." and prints `certificateName(name)` ("Anonymous Janta" for anyone in the bank);
 *  - both are always light-theme images (they are forwarded, not viewed in the app).
 * Nothing funny is drawn inside a receipt.
 */
import {
  asOfText,
  certificateName,
  formatNumber,
  govtText,
  labelDisplay,
  LADDER_DISPLAY,
  otherSideOf,
  sourceHost,
  sourceKind,
  stateName,
  statusLine,
  type BankItem,
} from '../data';
import { loadHandFont } from '../ui/fonts';
import { stampAngle } from '../ui/seed';
import { activeCompetitionTitle } from '../../engine/labels.mjs';
import type { TitleGrant } from '../../online/types';
import { online } from '../../online/runtime';
import { certificateArt, honourLine, mascotAsset, spriteCrop } from './certificate-art.mjs';

export const CARD_W = 1080;
export const CARD_H = 1350;

export type CardVariant = 'challenge' | 'receipt';

// ---- tokens -----------------------------------------------------------------------------------------

const TOKEN_NAMES = [
  'ground',
  'ground-2',
  'paper',
  'receipt',
  'ink',
  'ink-2',
  'line',
  'hair',
  'shadow-ink',
  'syahi',
  'syahi-text',
  'syahi-soft',
  'syahi-ink',
  'legal',
  'legal-ink',
  'manila',
  'tape',
  'slot-a',
  'slot-b',
  'slot-c',
  'slot-d',
  'font-display',
  'font-ui',
  'font-mono',
  'font-hand',
] as const;
type TokenName = (typeof TOKEN_NAMES)[number];
type Tokens = Record<TokenName, string>;

/** The light theme's tokens, resolved by the browser from tokens.css (a detached light subtree). */
function lightTokens(): Tokens {
  const probe = document.createElement('div');
  probe.setAttribute('data-theme', 'light');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out = {} as Tokens;
  for (const name of TOKEN_NAMES) out[name] = cs.getPropertyValue(`--h-${name}`).trim();
  probe.remove();
  // A stylesheet that failed to load would leave these empty: fall back to canvas-safe keywords.
  const fallback: Partial<Tokens> = {
    ground: 'white',
    'ground-2': 'gainsboro',
    paper: 'white',
    receipt: 'white',
    ink: 'black',
    'ink-2': 'dimgray',
    line: 'black',
    hair: 'silver',
    'shadow-ink': 'black',
    syahi: 'rebeccapurple',
    'syahi-text': 'rebeccapurple',
    'syahi-soft': 'lavender',
    'syahi-ink': 'white',
    legal: 'gainsboro',
    'legal-ink': 'black',
    manila: 'wheat',
    tape: 'firebrick',
    'slot-a': 'lavender',
    'slot-b': 'lightblue',
    'slot-c': 'wheat',
    'slot-d': 'mistyrose',
    'font-display': 'sans-serif',
    'font-ui': 'sans-serif',
    'font-mono': 'monospace',
    'font-hand': 'cursive',
  };
  for (const name of TOKEN_NAMES) if (!out[name]) out[name] = fallback[name] ?? 'black';
  return out;
}

// ---- canvas helpers ---------------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;
type FontRole = 'display' | 'ui' | 'mono' | 'hand';

function fontOf(t: Tokens, role: FontRole, weight: number, size: number) {
  return `${weight} ${Math.round(size)}px ${t[`font-${role}`]}`;
}

/** Wait for every face the card draws with (only the subsets its text needs are fetched). */
async function loadFaces(t: Tokens, uses: ReadonlyArray<[FontRole, number, string]>) {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.all(uses.map(([role, weight, text]) => document.fonts.load(fontOf(t, role, weight, 40), text || 'A').catch(() => [])));
}

function setSpacing(ctx: Ctx, px: number) {
  const c = ctx as Ctx & { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Greedy word wrap; a word wider than the line (a URL) is broken by characters. */
function wrap(ctx: Ctx, text: string, max: number): string[] {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const pushLong = (word: string) => {
    let part = '';
    for (const ch of Array.from(word)) {
      if (part && ctx.measureText(part + ch).width > max) {
        lines.push(part);
        part = ch;
      } else part += ch;
    }
    return part;
  };
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= max) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = ctx.measureText(word).width > max ? pushLong(word) : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

type Run = { text: string; font: string; color: string };

/** Wrap several differently-styled runs as one paragraph (word by word). */
function wrapRuns(ctx: Ctx, runs: readonly Run[], max: number) {
  type Piece = { text: string; font: string; color: string; w: number; space: number };
  const pieces: Piece[] = [];
  for (const run of runs) {
    ctx.font = run.font;
    const space = ctx.measureText(' ').width;
    const words = run.text.split(/(\s+)/);
    let pendingSpace = false;
    for (const w of words) {
      if (!w) continue;
      if (/^\s+$/.test(w)) {
        pendingSpace = true;
        if (pieces.length) pieces[pieces.length - 1].space = space;
        continue;
      }
      pieces.push({ text: w, font: run.font, color: run.color, w: ctx.measureText(w).width, space: 0 });
      pendingSpace = false;
    }
    void pendingSpace;
  }
  const lines: Piece[][] = [];
  let cur: Piece[] = [];
  let width = 0;
  for (const p of pieces) {
    const prev = cur[cur.length - 1];
    const add = (prev ? prev.space : 0) + p.w;
    if (cur.length && width + add > max) {
      lines.push(cur);
      cur = [p];
      width = p.w;
    } else {
      cur.push(p);
      width += add;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function drawRunLine(ctx: Ctx, line: ReadonlyArray<{ text: string; font: string; color: string; w: number; space: number }>, x: number, y: number) {
  let cx = x;
  line.forEach((p, i) => {
    ctx.font = p.font;
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, cx, y);
    cx += p.w + (i < line.length - 1 ? p.space : 0);
  });
}

/** A rubber stamp (bible §5 h-stamp): double border, seeded tilt, multiply ink. */
function drawStamp(ctx: Ctx, t: Tokens, text: string, cx: number, cy: number, seed: string, size: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((stampAngle(seed) * Math.PI) / 180);
  ctx.globalCompositeOperation = 'multiply';
  ctx.font = fontOf(t, 'display', 700, size);
  setSpacing(ctx, size * 0.08);
  const w = ctx.measureText(text).width;
  const padX = size * 0.5;
  const h = size * 1.35;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(4, size * 0.12);
  roundRect(ctx, -w / 2 - padX, -h / 2, w + padX * 2, h, size * 0.25);
  ctx.stroke();
  ctx.lineWidth = Math.max(2, size * 0.05);
  const o = size * 0.22;
  roundRect(ctx, -w / 2 - padX - o, -h / 2 - o, w + (padX + o) * 2, h + o * 2, size * 0.32);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.05);
  ctx.restore();
  setSpacing(ctx, 0);
}

/** The four answer shapes (▲ ◆ ● ■), the colour-blind twin of each slot. */
function drawShape(ctx: Ctx, index: number, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  if (index === 0) {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy + r * 0.85);
    ctx.lineTo(cx - r, cy + r * 0.85);
  } else if (index === 1) {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
  } else if (index === 2) {
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
  } else {
    ctx.rect(cx - r * 0.82, cy - r * 0.82, r * 1.64, r * 1.64);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function newCanvas(): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png-failed'))), 'image/png'));
}

/** 'https://occult-kranti.github.io/andhbhakt-ya-deshbhakt/#q=hsc001' → without the scheme, for print. */
export const printableLink = (link: string) => link.replace(/^https?:\/\//, '');

// ---- the receipt card ---------------------------------------------------------------------------------

const LETTERS = ['A', 'B', 'C', 'D'];
const SLOT_TOKENS: TokenName[] = ['slot-a', 'slot-b', 'slot-c', 'slot-d'];
const FOOTER = 'Satire. Every question sourced.';

export type ReceiptCardOptions = {
  /** The absolute taster link printed on the card (…/hisaab/#q=<id>). */
  link: string;
};

/** The item's one-clause "other side" (data.ts — one reader for the receipt and the cards). */
export { otherSideOf };

const wordSet = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);

/**
 * Whether `text` would give a challenge's answer away: it uses a word of the correct option that neither
 * the question nor any wrong option uses (so "Joshi has denied wrongdoing" gives away "Mahesh Joshi").
 */
export function givesAnswerAway(item: BankItem, text: string): boolean {
  const shared = wordSet([item.question, ...item.options.filter((_, i) => i !== item.correctIndex)].join(' '));
  const said = wordSet(text);
  for (const w of wordSet(item.options[item.correctIndex] ?? '')) if (!shared.has(w) && said.has(w)) return true;
  return false;
}

/** The pointer a challenge prints in place of an other-side clause that would name the answer. */
export const OTHER_SIDE_ON_RECEIPT = 'On the receipt: it names the answer.';

/** The OTHER SIDE line a card or its text prints for `variant`, or null. */
export function otherSideLine(item: BankItem, variant: CardVariant): string | null {
  const other = otherSideOf(item);
  if (!other) return null;
  return variant === 'challenge' && givesAnswerAway(item, other) ? OTHER_SIDE_ON_RECEIPT : other;
}

/** The kicker line: sector · state · year (plain facts, mono caps). */
function cardKicker(item: BankItem) {
  return [item.topic, stateName(item.state), String(item.year)].join(' · ').toUpperCase();
}

/**
 * Lay the receipt card out at text scale `s` (1 = full size). With `draw` false it only measures and
 * returns the bottom y of the content, so the caller can shrink `s` until everything fits.
 */
function layoutReceipt(ctx: Ctx, t: Tokens, item: BankItem, variant: CardVariant, link: string, s: number, draw: boolean): number {
  const M = 64; // page margin
  const panelX = M;
  const panelY = 176;
  const panelW = CARD_W - M * 2;
  const pad = 52;
  const x = panelX + pad;
  const maxW = panelW - pad * 2;
  let y = panelY + pad;
  const status = statusLine(item);
  const other = otherSideLine(item, variant);

  const text = (value: string, role: FontRole, weight: number, size: number, color: string, lh = 1.3, width = maxW, left = x) => {
    ctx.font = fontOf(t, role, weight, size);
    const lines = wrap(ctx, value, width);
    for (const line of lines) {
      y += size * lh;
      if (draw) {
        ctx.fillStyle = color;
        ctx.fillText(line, left, y - size * (lh - 1) * 0.5 - size * 0.18);
      }
    }
    return lines.length;
  };

  // kicker
  ctx.font = fontOf(t, 'mono', 700, 24);
  setSpacing(ctx, 3);
  y += 24;
  if (draw) {
    ctx.fillStyle = t['ink-2'];
    ctx.fillText(`F.NO. ${item.id.toUpperCase()} · ${cardKicker(item)}`.slice(0, 70), x, y);
  }
  setSpacing(ctx, 0);
  y += 22;

  if (variant === 'challenge') {
    text(item.question, 'ui', 600, 50 * s, t.ink, 1.28);
    y += 26 * s;
    // the four options, fixed order, no answer marked
    const tab = 92;
    item.options.forEach((opt, i) => {
      ctx.font = fontOf(t, 'ui', 400, 36 * s);
      const lines = wrap(ctx, opt, maxW - tab - 40);
      const h = Math.max(96 * s, lines.length * 36 * s * 1.3 + 40 * s);
      if (draw) {
        roundRect(ctx, x, y, maxW, h, 20);
        ctx.fillStyle = t.paper;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = t.line;
        ctx.stroke();
        // left tab: letter over shape on the slot tint
        ctx.save();
        roundRect(ctx, x, y, maxW, h, 20);
        ctx.clip();
        ctx.fillStyle = t[SLOT_TOKENS[i]];
        ctx.fillRect(x, y, tab, h);
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(x + tab, y);
        ctx.lineTo(x + tab, y + h);
        ctx.strokeStyle = t.line;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.font = fontOf(t, 'display', 700, 34);
        ctx.fillStyle = t.ink;
        ctx.textAlign = 'center';
        ctx.fillText(LETTERS[i], x + tab / 2, y + h / 2 + 3);
        ctx.textAlign = 'left';
        drawShape(ctx, i, x + tab / 2, y + h / 2 + 19, 8, t.ink);
        ctx.font = fontOf(t, 'ui', 400, 36 * s);
        ctx.fillStyle = t.ink;
        const block = lines.length * 36 * s * 1.3;
        let ly = y + (h - block) / 2 + 36 * s;
        for (const line of lines) {
          ctx.fillText(line, x + tab + 24, ly);
          ly += 36 * s * 1.3;
        }
      }
      y += h + 18 * s;
    });
    y += 6 * s;
    text('Jawab + receipt: open the link. No account needed.', 'ui', 600, 30 * s, t['syahi-text'], 1.3);
  } else {
    text(item.question, 'ui', 400, 34 * s, t['ink-2'], 1.32, maxW - 40);
    y += 22 * s;
    ctx.font = fontOf(t, 'mono', 700, 22);
    setSpacing(ctx, 3);
    y += 22;
    if (draw) {
      ctx.fillStyle = t['ink-2'];
      ctx.fillText('ANSWER', x, y);
    }
    setSpacing(ctx, 0);
    y += 8;
    text(item.options[item.correctIndex], 'ui', 600, 50 * s, t.ink, 1.22, maxW - 260);
    if (draw) drawStamp(ctx, t, 'SOURCED', x + maxW - 118, y - 44 * s, `share-${item.id}`, 34, t.syahi);
    y += 20 * s;
  }

  // rows: SOURCE · STATUS (both variants) · OTHER SIDE (both variants) · GOVT THEN
  const rule = () => {
    y += 22 * s;
    if (draw) {
      ctx.save();
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = t.hair;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + maxW, y);
      ctx.stroke();
      ctx.restore();
    }
    y += 10 * s;
  };
  const key = (k: string) => {
    ctx.font = fontOf(t, 'mono', 700, 22);
    setSpacing(ctx, 3);
    y += 30 * s;
    if (draw) {
      ctx.fillStyle = t['ink-2'];
      ctx.fillText(k, x, y);
    }
    setSpacing(ctx, 0);
    y += 6 * s;
  };
  const chip = (label: string, cx: number, cy: number, fill: string, stroke: string, ink: string, dashed = false) => {
    ctx.font = fontOf(t, 'mono', 700, 22);
    setSpacing(ctx, 2);
    const w = ctx.measureText(label).width + 28;
    if (draw) {
      ctx.save();
      if (dashed) ctx.setLineDash([8, 6]);
      roundRect(ctx, cx, cy, w, 42, 10);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = ink;
      ctx.fillText(label, cx + 14, cy + 29);
    }
    setSpacing(ctx, 0);
    return w;
  };

  if (variant === 'receipt' || status || other) rule();
  if (variant === 'receipt') {
    key('SOURCE');
    y += 6 * s;
    const cw = chip(sourceKind(item), x, y, t.receipt, t.line, t.ink);
    ctx.font = fontOf(t, 'mono', 400, 22);
    if (draw) {
      ctx.fillStyle = t['ink-2'];
      ctx.fillText(sourceHost(item.sourceUrl), x + cw + 16, y + 29);
    }
    y += 42;
    text(item.sourceLabel, 'ui', 400, 30 * s, t.ink, 1.3);
  }
  if (status) {
    if (variant === 'receipt') rule();
    key('STATUS');
    y += 8 * s;
    // the neutral legal block: every status looks the same (never red for alleged, green for acquitted)
    ctx.font = fontOf(t, 'ui', 400, 29 * s);
    const lines = wrap(ctx, status, maxW - 48);
    const blockH = 42 + 20 * s + lines.length * 29 * s * 1.4 + 28 * s;
    const top = y;
    if (draw) {
      roundRect(ctx, x, top, maxW, blockH, 14);
      ctx.fillStyle = t.legal;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = t['legal-ink'];
      ctx.stroke();
    }
    const cw = chip('LEGAL STATUS', x + 20, top + 18 * s, t.receipt, t['legal-ink'], t['legal-ink']);
    ctx.font = fontOf(t, 'mono', 400, 24);
    if (draw) {
      ctx.fillStyle = t['legal-ink'];
      ctx.fillText(asOfText(item.asOf), x + 20 + cw + 16, top + 18 * s + 30);
    }
    let ly = top + 18 * s + 42 + 20 * s;
    ctx.font = fontOf(t, 'ui', 400, 29 * s);
    for (const line of lines) {
      ly += 29 * s * 1.4;
      if (draw) {
        ctx.fillStyle = t['legal-ink'];
        ctx.fillText(line, x + 24, ly - 29 * s * 0.3);
      }
    }
    y = top + blockH;
  }
  if (other) {
    // charter §2.3: the other side's answer is part of the fact — plain ink, nothing funny
    if (variant === 'receipt' || status) rule();
    key('OTHER SIDE');
    y += 4 * s;
    text(other, 'ui', 400, 29 * s, t.ink, 1.35);
  }
  if (variant === 'receipt') {
    rule();
    y += 12 * s;
    ctx.font = fontOf(t, 'mono', 700, 22);
    setSpacing(ctx, 3);
    if (draw) {
      ctx.fillStyle = t['ink-2'];
      ctx.fillText('GOVT THEN', x, y + 29);
    }
    const kw = ctx.measureText('GOVT THEN').width;
    setSpacing(ctx, 0);
    chip(govtText(item.govt).replace(/^Govt then: /, ''), x + kw + 24, y, t['ground-2'], t.line, t.ink, true);
    y += 42;
  }
  return y + pad;
}

function drawReceiptFrame(ctx: Ctx, t: Tokens, bottom: number, link: string) {
  const M = 64;
  const panelX = M;
  const panelY = 176;
  const panelW = CARD_W - M * 2;
  // ground
  ctx.fillStyle = t.ground;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // Long standalone title stays on two deliberate baselines; no header collision.
  ctx.font = fontOf(t, 'display', 700, 43);
  ctx.fillStyle = t['syahi-text'];
  ctx.fillText('अंधभक्त या देशभक्त', M, 74);
  ctx.font = fontOf(t, 'display', 700, 39);
  ctx.fillStyle = t.ink;
  ctx.fillText('ANDHBHAKT YA DESHBHAKT', M, 118);
  ctx.font = fontOf(t, 'mono', 700, 20);
  ctx.textAlign = 'right'; ctx.fillText('EVERY ANSWER', CARD_W - M, 78); ctx.fillText('A RECEIPT.', CARD_W - M, 107); ctx.textAlign = 'left';
  ctx.fillStyle = t.tape; ctx.fillRect(M, 139, 180, 8);

  // the receipt panel: hard shadow, outline, zig-zag bottom (bible §5 h-receipt)
  const tooth = 32;
  const panelBottom = Math.min(bottom, CARD_H - 190);
  const path = (dx: number, dy: number) => {
    const x0 = panelX + dx;
    const y0 = panelY + dy;
    const x1 = x0 + panelW;
    const yb = panelBottom + dy;
    const r = 20;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.lineTo(x1 - r, y0);
    ctx.arcTo(x1, y0, x1, y0 + r, r);
    ctx.lineTo(x1, yb);
    const teeth = Math.floor(panelW / tooth);
    const step = panelW / teeth;
    for (let i = 0; i < teeth; i++) {
      const xr = x1 - i * step;
      ctx.lineTo(xr - step / 2, yb + tooth / 2);
      ctx.lineTo(xr - step, yb);
    }
    ctx.lineTo(x0, y0 + r);
    ctx.arcTo(x0, y0, x0 + r, y0, r);
    ctx.closePath();
  };
  path(10, 10);
  ctx.fillStyle = t['shadow-ink'];
  ctx.fill();
  path(0, 0);
  ctx.fillStyle = t.receipt;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = t.line;
  ctx.stroke();

  // footer
  ctx.font = fontOf(t, 'ui', 600, 34);
  ctx.fillStyle = t.ink;
  ctx.fillText(FOOTER, M, CARD_H - 92);
  ctx.font = fontOf(t, 'mono', 400, 22);
  ctx.fillStyle = t['ink-2'];
  const lines = wrap(ctx, printableLink(link), CARD_W - M * 2);
  lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, M, CARD_H - 52 + i * 28));
}

/** The receipt share card as a PNG blob (1080 × 1350, light). */
export async function renderReceiptCard(item: BankItem, variant: CardVariant, opts: ReceiptCardOptions): Promise<Blob> {
  const t = lightTokens();
  const sample = [item.question, ...item.options, item.status ?? '', otherSideLine(item, variant) ?? '', item.sourceLabel].join(' ');
  await loadFaces(t, [
    ['display', 700, 'अंधभक्त या देशभक्त Andhbhakt ya Deshbhakt ABCD SOURCED'],
    ['ui', 400, sample],
    ['ui', 600, `${item.question} ${item.options[item.correctIndex]} ${FOOTER}`],
    ['mono', 400, `${opts.link} as of 0123456789`],
    ['mono', 700, 'F.NO. SOURCE STATUS OTHER SIDE GOVT THEN LEGAL'],
  ]);
  const { canvas, ctx } = newCanvas();
  const { scale, bottom } = fitReceipt(ctx, t, item, variant, opts.link);
  drawReceiptFrame(ctx, t, bottom, opts.link);
  layoutReceipt(ctx, t, item, variant, opts.link, scale, true);
  return toBlob(canvas);
}

/** Where the receipt panel must end (the footer sits below it). */
const RECEIPT_LIMIT = CARD_H - 190;

/** The fit loop: the largest text scale (≥ 0.5, in 0.04 steps) at which the content ends above the footer. */
function fitReceipt(ctx: Ctx, t: Tokens, item: BankItem, variant: CardVariant, link: string) {
  let scale = 1;
  for (; scale > 0.5; scale -= 0.04) if (layoutReceipt(ctx, t, item, variant, link, scale, false) <= RECEIPT_LIMIT) break;
  const bottom = layoutReceipt(ctx, t, item, variant, link, scale, false);
  return { scale, bottom };
}

/**
 * The card audit: how a receipt card fits without drawing it — the text scale the fit loop settles on,
 * the content's bottom and whether it ends above the footer. `fits: false` means text would run past the
 * panel even at the smallest scale. Browser-only (it measures with the page's fonts).
 */
export async function receiptCardFit(item: BankItem, variant: CardVariant, link: string): Promise<{ scale: number; bottom: number; limit: number; fits: boolean }> {
  const t = lightTokens();
  await loadFaces(t, [
    ['ui', 400, [item.question, ...item.options, item.status ?? '', otherSideLine(item, variant) ?? '', item.sourceLabel].join(' ')],
    ['ui', 600, `${item.question} ${item.options[item.correctIndex]}`],
  ]);
  const { ctx } = newCanvas();
  const { scale, bottom } = fitReceipt(ctx, t, item, variant, link);
  return { scale: Math.round(scale * 100) / 100, bottom: Math.round(bottom), limit: RECEIPT_LIMIT, fits: bottom <= RECEIPT_LIMIT };
}

// ---- the certificate ------------------------------------------------------------------------------------

export type CertificateCardInput = {
  name: string | null | undefined;
  band: number;
  /** Null for an earlier rung (the count at promotion is not on record): the clause is left out. */
  receipts: number | null;
  /** Null when the promotion date is not on record: the stamp says ISSUED with no date. */
  issuedOn: Date | number | null;
  /** Printed in the footer (no scheme). */
  site: string;
  /** Footer line; default the certificate's own. */
  footer: string;
  fno?: string;
  portrait?: string | null;
  competitionTitle?: TitleGrant | null;
};

const CERT_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const certDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${CERT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** Largest size (≤ max) at which `text` fits `width` on at most `maxLines` lines. */
function fitSize(ctx: Ctx, t: Tokens, role: FontRole, weight: number, text: string, width: number, max: number, min: number, maxLines: number) {
  for (let size = max; size > min; size -= 2) {
    ctx.font = fontOf(t, role, weight, size);
    const lines = wrap(ctx, text, width);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= width)) return { size, lines };
  }
  ctx.font = fontOf(t, role, weight, min);
  return { size: min, lines: wrap(ctx, text, width) };
}

/** Decode same-origin generated art or a locally normalized portrait, never a remote photo URL. */
async function certificateImage(source: string): Promise<HTMLImageElement | null> {
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = source; });
    return image;
  } catch { return null; }
}

/** The Certificate of Labelling as a PNG blob (1080 × 1350, ALWAYS light). */
export async function renderCertificateCard(input: CertificateCardInput): Promise<Blob> {
  const t = lightTokens();
  const honour = activeCompetitionTitle(input.competitionTitle, online.now());
  const rung = labelDisplay(input.band);
  const label = honour ? { ...rung, en: honour.label, hi: honour.labelHi, aside: undefined } : rung;
  const art = certificateArt(input.band, !!honour);
  const name = certificateName(input.name);
  const date = input.issuedOn === null ? null : new Date(input.issuedOn);
  const receipts = input.receipts === null ? null : Math.max(0, Math.floor(input.receipts));
  const fno = input.fno ?? `L-${rung.band}/${(date ?? new Date()).getFullYear()}-${String(receipts ?? 0).padStart(4, '0')}`;
  const stampText = date ? `ISSUED · ${certDate(date)}` : 'ISSUED';
  const latin = label.en.toUpperCase();
  const base = (import.meta as ImportMeta & { env: { BASE_URL?: string } }).env?.BASE_URL || '/';
  const [mascot, portrait] = await Promise.all([
    certificateImage(mascotAsset(base)),
    input.portrait?.startsWith('data:image/jpeg;base64,') ? certificateImage(input.portrait) : Promise.resolve(null),
    loadFaces(t, [
      ['display', 700, `${label.hi} ${latin} ${name.toUpperCase()} ANDHBHAKT YA DESHBHAKT.`],
      ['ui', 400, `${art.caption} ${label.aside ?? ''} has earned the label`],
      ['mono', 700, `CERTIFICATE OF LABELLING F.No. ${fno} ${stampText} ${input.footer} ${honourLine(honour)} ${input.site} 0123456789 ★`],
    ]),
  ]);
  const { canvas, ctx } = newCanvas();
  ctx.fillStyle = t.ground; ctx.fillRect(0, 0, CARD_W, CARD_H);
  const x = 86, w = 908;
  roundRect(ctx, 50, 50, 980, 1250, 24); ctx.fillStyle = t.syahi; ctx.fill();
  roundRect(ctx, 38, 38, 980, 1250, 24); ctx.fillStyle = t.receipt; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = t.line; ctx.stroke();
  ctx.fillStyle = t.ink; ctx.font = fontOf(t, 'display', 700, 39); ctx.fillText('ANDHBHAKT', x, 86); ctx.fillText('YA DESHBHAKT.', x, 124);
  ctx.font = fontOf(t, 'mono', 700, 20); ctx.textAlign = 'right'; ctx.fillText('CERTIFICATE OF LABELLING', x + w, 88); ctx.fillText(`F.No. ${fno}`, x + w, 116); ctx.textAlign = 'left';
  ctx.fillRect(x, 139, w, 3);
  // Fixed image strip: an exact 30:70 → 90:10 split, independent of the title or optional portrait.
  const top = 160, height = 365, pw = w * art.portrait / 100, mw = w - pw;
  ctx.fillStyle = t['syahi-soft']; ctx.fillRect(x, top, pw, height);
  ctx.save(); ctx.beginPath(); ctx.rect(x, top, pw, height); ctx.clip();
  if (portrait) {
    const scale = Math.max(pw / portrait.width, height / portrait.height);
    ctx.drawImage(portrait, x + (pw - portrait.width * scale) / 2, top + (height - portrait.height * scale) * 0.38, portrait.width * scale, portrait.height * scale);
  } else {
    ctx.fillStyle = t['syahi-text']; ctx.font = fontOf(t, 'display', 700, 125); ctx.textAlign = 'center';
    ctx.fillText(name.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase(), x + pw / 2, top + height / 2 + 40); ctx.textAlign = 'left';
  }
  ctx.restore(); ctx.fillStyle = t.paper; ctx.fillRect(x + pw, top, mw, height);
  if (mascot) {
    const crop = spriteCrop(art.frame, mascot.width, mascot.height); const size = Math.min(mw, height);
    ctx.drawImage(mascot, crop.x, crop.y, crop.width, crop.height, x + pw + (mw - size) / 2, top + (height - size) / 2, size, size);
  }
  ctx.fillStyle = t.line; ctx.fillRect(x + pw - 1, top, 2, height); ctx.fillRect(x, top + height, w, 3);
  ctx.fillStyle = t.ink; ctx.fillRect(x, top + height - 27, 82, 27); ctx.fillStyle = t.paper; ctx.font = fontOf(t, 'mono', 700, 18); ctx.fillText('JANTA', x + 10, top + height - 8);
  ctx.fillStyle = t.ink; ctx.font = fontOf(t, 'mono', 700, 16); ctx.fillText('SATIRE', x + pw + 7, top + height - 8);
  ctx.beginPath(); ctx.arc(x + w - 65, top + height + 4, 53, 0, Math.PI * 2); ctx.fillStyle = honour ? t.syahi : t.manila; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = t.ink; ctx.stroke();
  ctx.fillStyle = honour ? t['syahi-ink'] : t.ink; ctx.textAlign = 'center'; ctx.font = fontOf(t, 'display', 700, 54); ctx.fillText(art.medal, x + w - 65, top + height + 22); ctx.textAlign = 'left';
  const nameFit = fitSize(ctx, t, 'display', 700, name.toUpperCase(), w - 125, 64, 38, 1);
  ctx.fillStyle = t.ink; ctx.font = fontOf(t, 'display', 700, nameFit.size); ctx.fillText(name.toUpperCase(), x, 606);
  ctx.font = fontOf(t, 'ui', 400, 28); ctx.fillText('has earned the label', x, 643);
  let y = 662;
  const hi = fitSize(ctx, t, 'display', 700, label.hi, w, 55, 38, 1); ctx.font = fontOf(t, 'display', 700, hi.size); ctx.fillStyle = t['syahi-text'];
  for (const line of hi.lines) { y += hi.size * 1.18; ctx.fillText(line, x, y); }
  y += 15;
  const en = fitSize(ctx, t, 'display', 700, latin, w, latin.length > 18 ? 76 : 104, 58, 2); ctx.font = fontOf(t, 'display', 700, en.size); ctx.fillStyle = t.ink;
  for (const line of en.lines) { y += en.size * 1.02; ctx.fillText(line, x, y); }
  if (label.aside) { y += 31; ctx.font = fontOf(t, 'ui', 400, 26); ctx.fillText(label.aside, x, y); }
  y += 42; ctx.font = fontOf(t, 'ui', 400, 31); ctx.fillStyle = t['ink-2'];
  for (const line of wrap(ctx, art.caption, w)) { ctx.fillText(line, x, y); y += 36; }
  ctx.font = fontOf(t, 'mono', 700, 22); ctx.fillStyle = t.ink;
  ctx.fillText(receipts === null ? 'RECEIPTS ON RECORD' : `${formatNumber(receipts)} SOURCED ${receipts === 1 ? 'RECEIPT' : 'RECEIPTS'}`, x, 1045);
  ctx.textAlign = 'right'; ctx.fillText(stampText, x + w, 1045); ctx.textAlign = 'left';
  if (honour) {
    ctx.font = fontOf(t, 'mono', 700, 21); ctx.fillStyle = t['syahi-text']; wrap(ctx, honourLine(honour), w).forEach((line, i) => ctx.fillText(line, x, 1085 + i * 28));
  } else {
    LADDER_DISPLAY.forEach((r, i) => { ctx.beginPath(); ctx.arc(x + 10 + i * 30, 1085, 9, 0, Math.PI * 2); ctx.fillStyle = r.band <= rung.band ? t.syahi : t.paper; ctx.fill(); ctx.strokeStyle = t.line; ctx.lineWidth = 2; ctx.stroke(); });
    ctx.fillStyle = t.ink; ctx.font = fontOf(t, 'mono', 700, 21); ctx.fillText(`${rung.band + 1} / ${LADDER_DISPLAY.length} earned`, x + 300, 1093);
  }
  ctx.strokeStyle = t.line; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(x, 1140); ctx.lineTo(x + w, 1140); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = fontOf(t, 'mono', 700, 24); ctx.fillStyle = t.ink;
  wrap(ctx, input.footer, w).forEach((line, i) => ctx.fillText(line, x, 1180 + i * 30));
  ctx.font = fontOf(t, 'mono', 400, 21); ctx.fillStyle = t['ink-2']; ctx.fillText(`${input.site} · Can you out-read me?`, x, 1250);
  return toBlob(canvas);
}
