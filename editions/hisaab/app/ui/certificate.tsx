/** A satirical personal achievement card. The portrait expands only inside the art strip. */
import type { CSSProperties } from 'react';
import { certificateName, formatNumber, labelDisplay, LADDER_DISPLAY } from '../data';
import { absoluteUrl } from '../router';
import { activeCompetitionTitle } from '../../engine/labels.mjs';
import type { TitleGrant } from '../../online/types';
import { online } from '../../online/runtime';
import { certificateArt, honourLine, mascotAsset } from '../share/certificate-art.mjs';
import { cx } from './cx';
import './certificate.css';

export const CERT_FOOTER = 'Satire. Not a government document. Name and photo chosen by the player.';
export const CERT_SITE = absoluteUrl('#/').replace(/^https?:\/\//, '').replace(/\/#\/$/, '') || 'HISAAB DO';
export type CertificateProps = {
  name: string | null | undefined; receipts: number | null; band: number; issuedOn: Date | number | null;
  portrait?: string | null; competitionTitle?: TitleGrant | null; fno?: string; id?: string; className?: string;
};
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const certificateDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
export const certificateStamp = (d: Date | null) => (d ? `ISSUED · ${certificateDate(d)}` : 'ISSUED');
export const certificateFno = (band: number, d: Date | null, receipts: number | null) =>
  `L-${band}/${(d ?? new Date()).getFullYear()}-${String(Math.max(0, receipts ?? 0)).padStart(4, '0')}`;
const asset = mascotAsset((import.meta as ImportMeta & { env: { BASE_URL?: string } }).env?.BASE_URL || '/');

export function Certificate({ name, receipts, band, issuedOn, portrait, competitionTitle, fno, id, className }: CertificateProps) {
  const honour = activeCompetitionTitle(competitionTitle, online.now());
  const rung = labelDisplay(band);
  const label = honour ? { ...rung, en: honour.label, hi: honour.labelHi, aside: undefined } : rung;
  const art = certificateArt(band, !!honour);
  const date = issuedOn === null ? null : new Date(issuedOn);
  const shownName = certificateName(name);
  const initials = shownName.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase();
  const style = { '--h-photo-share': `${art.portrait}%`, '--h-mascot-x': `${(art.frame % 3) * 50}%`, '--h-mascot-y': `${Math.floor(art.frame / 3) * 100}%`, '--h-mascot-image': `url("${asset}")` } as CSSProperties;
  return <div data-theme="light" className={cx('h-certwrap', className)}>
    <article className="h-cert" id={id} style={style} data-band={art.band} data-honour={!!honour} aria-label={`Certificate of labelling: ${shownName}, ${label.en}`}>
      <header className="h-cert__head"><strong>HISAAB DO.</strong><span>CERTIFICATE OF LABELLING<br />F.No. {fno ?? certificateFno(rung.band, date, receipts)}</span></header>
      <div className="h-cert__art" aria-label={`${art.portrait}% player portrait, ${art.mascot}% satirical caricature`}>
        <div className="h-cert__portrait">{portrait ? <img src={portrait} alt="Player-selected portrait" /> : <span className="h-cert__initials" aria-label="No photo selected">{initials}</span>}<span className="h-cert__portraitlabel">JANTA</span></div>
        <div className="h-cert__mascot"><span className="h-cert__mascotface" role="img" aria-label={`Original political caricature, ${art.expression}`} /><span className="h-cert__mascotlabel">SATIRE</span></div>
        <span className="h-cert__medal" aria-label={honour ? 'Competition honour' : `Rung ${rung.ordinal}`}>{art.medal}</span>
      </div>
      <p className="h-cert__certify"><strong className="h-cert__name">{shownName}</strong><span>has earned the label</span></p>
      <h2 className={cx('h-cert__label', label.en.length > 18 && 'h-cert__label--long')}><span className="h-cert__labelhi" lang="hi">{label.hi}</span><span className="h-cert__labelen">{label.en}{label.aside && <small>{label.aside}</small>}</span></h2>
      <p className="h-cert__line">{art.caption}</p>
      <div className="h-cert__evidence"><span>{receipts === null ? 'RECEIPTS ON RECORD' : `${formatNumber(receipts)} SOURCED ${receipts === 1 ? 'RECEIPT' : 'RECEIPTS'}`}</span><span>{certificateStamp(date)}</span></div>
      {honour ? <p className="h-cert__honour">{honourLine(honour)}</p> : <p className="h-cert__rungs">{LADDER_DISPLAY.map(r => <span key={r.band} className={cx('h-cert__dot', r.band <= rung.band && 'h-cert__dot--on')} aria-hidden="true" />)}<span className="h-cert__rungtext">{rung.band + 1} / {LADDER_DISPLAY.length} earned</span></p>}
      <footer className="h-cert__foot"><strong>{CERT_FOOTER}</strong><span>{CERT_SITE} · Can you out-read me?</span></footer>
    </article>
  </div>;
}
