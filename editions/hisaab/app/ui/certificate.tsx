/**
 * ui/certificate.tsx — `h-cert`, the Certificate of Labelling frame (bible §11.14). Always the LIGHT
 * theme (it is an export), 4:5 (1080 × 1350 when exported), scaling with its container.
 *
 *   <Certificate name={player.name} receipts={214} band={4} issuedOn={Date.now()} />
 *
 * The name passes through data.ts `certificateName`: empty or matching anyone in the bank's `people` /
 * `enactedBy` → "Anonymous Janta", so nobody can certify a real politician. The footer always says
 * "Satire. Not a government document." — no emblem, seal or letterhead imitation.
 */
import { useEffect, useState } from 'react';
import { certificateName, formatNumber, labelDisplay, LADDER_DISPLAY } from '../data';
import { absoluteUrl } from '../router';
import { loadHandFont } from './fonts';
import { Stamp } from './stamp';
import { cx } from './cx';
import './certificate.css';

/** The footer: satire, not official, and the name is the player's own choice (not a finding about anyone). */
export const CERT_FOOTER = 'Satire. Not a government document. Name as entered by the player. Every question sourced.';
/** Current host + edition base; PNG exports must promote the site the player is actually using. */
export const CERT_SITE = absoluteUrl('#/').replace(/^https?:\/\//, '').replace(/\/#\/$/, '') || 'HISAAB DO';

export type CertificateProps = {
  /** The player's name as typed; the frame applies the certificate name rule itself. */
  name: string | null | undefined;
  /**
   * Sourced receipts collected (the real journal count). Null for an earlier rung: the count the player
   * had when promoted is not on record, so the certificate leaves the clause out rather than print
   * today's count against an old label.
   */
  receipts: number | null;
  /** The band being certified (0–8). */
  band: number;
  /**
   * The promotion date. Null when it is not on record (it dropped out of the progression log, or band
   * 0, which nobody is promoted to): the stamp then says ISSUED with no date — never today's date as if
   * it were the day of the label.
   */
  issuedOn: Date | number | null;
  /** File number; default `L-<band>/<year>-<receipts>`. */
  fno?: string;
  /** DOM id, for the share lane's PNG capture. */
  id?: string;
  className?: string;
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const certificateDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
/** The stamp's words: 'ISSUED · 25 SEP 2026', or just 'ISSUED' when the promotion date is not on record. */
export const certificateStamp = (d: Date | null) => (d ? `ISSUED · ${certificateDate(d)}` : 'ISSUED');
/** 'L-4/2026-0214': band, the year (of the promotion; else of printing), receipts (0000 when not on record). */
export const certificateFno = (band: number, d: Date | null, receipts: number | null) =>
  `L-${band}/${(d ?? new Date()).getFullYear()}-${String(Math.max(0, receipts ?? 0)).padStart(4, '0')}`;

/** Labels longer than this (in Latin characters) print one size down. */
const LONG_LABEL = 18;

export function Certificate({ name, receipts, band, issuedOn, fno, id, className }: CertificateProps) {
  const label = labelDisplay(band);
  const date = issuedOn === null ? null : new Date(issuedOn);
  const shownName = certificateName(name);
  const number = fno ?? certificateFno(label.band, date, receipts);
  const [hand, setHand] = useState(false);
  useEffect(() => {
    let live = true;
    void loadHandFont().then(() => live && setHand(true));
    return () => {
      live = false;
    };
  }, []);
  return (
    <div data-theme="light" className={cx('h-certwrap', className)}>
      <article className="h-cert" id={id} aria-label={`Certificate of labelling: ${shownName}, ${label.en}`}>
        <header className="h-cert__head">
          <span>CERTIFICATE OF LABELLING</span>
          <span>F.No. {number}</span>
        </header>
        <p className="h-cert__certify">
          {receipts === null ? (
            <>
              This is to certify that <strong className="h-cert__name">{shownName}</strong> has been officially labelled
            </>
          ) : (
            <>
              This is to certify that <strong className="h-cert__name">{shownName}</strong> has, after{' '}
              <strong>{`${formatNumber(receipts)} sourced ${receipts === 1 ? 'receipt' : 'receipts'}`}</strong>, been officially labelled
            </>
          )}
        </p>
        {/* Long rungs ('WhatsApp University Fresher') step down a size so the 4:5 frame keeps its room. */}
        <h2 className={cx('h-cert__label', label.en.length > LONG_LABEL && 'h-cert__label--long')}>
          <span className="h-cert__labelhi" lang="hi">
            {label.hi}
          </span>
          <span className="h-cert__labelen">
            {label.en}
            {label.aside ? <small> {label.aside}</small> : null}
          </span>
        </h2>
        <p className="h-cert__line">{label.line}</p>
        <div className="h-cert__stamprow">
          <Stamp kind="noted" seed={`cert-${label.band}`} text={certificateStamp(date)} size="l" className="h-cert__stamp" />
          <p className={cx('h-cert__hand', hand && 'h-cert__hand--ready')}>Noted. Pl. forward.</p>
        </div>
        {/* A paragraph takes no aria-label: the rung is said in screen-reader words. */}
        <p className="h-cert__rungs">
          {LADDER_DISPLAY.map((r) => (
            <span key={r.band} className={cx('h-cert__dot', r.band <= label.band && 'h-cert__dot--on')} aria-hidden="true" />
          ))}
          <span className="h-cert__rungtext" aria-hidden="true">
            {label.band + 1} of {LADDER_DISPLAY.length}
          </span>
          <span className="h-sr">
            Rung {label.band + 1} of {LADDER_DISPLAY.length}
          </span>
        </p>
        <footer className="h-cert__foot">
          <span>{CERT_FOOTER}</span>
          <span>{CERT_SITE}</span>
        </footer>
      </article>
    </div>
  );
}
