/**
 * screens/me/certificate-view.tsx — #/me/certificate: the Certificate of Labelling, one per rung held
 * (design bible §8.4, §11.14). Preview (always light), the optional name, and the ONE violet action:
 * Share certificate (a 1080 × 1350 PNG through Web Share, else downloaded with its text copied).
 * "Satire. Not a government document." is on the certificate itself.
 */
import { useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { standing } from '../../../edition';
import { labelDisplay, LADDER_DISPLAY } from '../../data';
import { goBack, href, navigate, queryString, type AppRoute } from '../../router';
import { certificateBlob, shareCertificate, ShareButton } from '../../share';
import { useScreenTitle } from '../../shell/chrome';
import { useAppPlayer } from '../../shell/player';
import { Button } from '../../ui/button';
import { Certificate } from '../../ui/certificate';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { Page, ScreenHeader } from '../../ui/page';
import { Skeleton } from '../../ui/skeleton';
import { countReceipts } from '../receipts/lib';
import { promotionDates, shortDate, usePlayerName, type ProgressionLike } from './lib';
import { NameField } from './name-field';
import { PhotoField, usePortrait } from './photo-field';
import { useCompetitionTitle } from './competition-title';
import { usePersonalXp } from './personal-xp';
import { honourLine } from '../../share/certificate-art.mjs';
import './me.css';

export function CertificateView({ route }: { route: AppRoute }) {
  const player = useAppPlayer();
  const personalXp = usePersonalXp(player.progression?.xp ?? 0);
  const { t } = useLang();
  const name = usePlayerName();
  const portrait = usePortrait();
  const competitionTitle = useCompetitionTitle();
  const [saved, setSaved] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  useScreenTitle(t('Certificate', 'प्रमाण पत्र'));

  if (!player.loaded) {
    return (
      <Page screen="certificate" width="read">
        <Skeleton lines={8} label={t('Printing your certificate', 'प्रमाण पत्र छप रहा है')} />
      </Page>
    );
  }

  const prog = player.progression as ProgressionLike;
  const s = standing(personalXp);
  const asked = Number(route.query.band);
  // Only a rung the player holds can be certified.
  const band = Number.isInteger(asked) && asked >= 0 && asked <= s.band ? asked : s.band;
  const label = labelDisplay(band);
  const dates = promotionDates(prog);
  // Only what is on record: the promotion date (else the stamp says ISSUED with no date), and the
  // receipts count only for the rung held now (today's count is not what an earlier rung was earned with).
  const receipts = band === s.band ? countReceipts(player.journal) : null;
  const issuedOn = dates.get(band) ?? null;
  const honour = route.query.honour === '1' ? competitionTitle : null;
  const input = { name, band, receipts, issuedOn, portrait, competitionTitle: honour };

  const download = async () => {
    setSaved('busy');
    try {
      const blob = await certificateBlob(input);
      const link = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = link;
      a.download = `andhbhakt-ya-deshbhakt-certificate-${label.en.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(link), 4000);
      setSaved('done');
    } catch {
      setSaved('failed');
    }
  };

  return (
    <Page screen="certificate" className="h-certview">
      <div>
        <Button variant="ghost" icon={<ArrowLeft size={18} strokeWidth={2.4} />} trailing={null} onClick={() => goBack(href.me())}>
          {t('Back to your label', 'अपने लेबल पर वापस')}
        </Button>
      </div>
      <ScreenHeader
        kicker={`F.No. L-${band} · ${t('Certificate of labelling', 'लेबल का प्रमाण पत्र')}`}
        titleHi="प्रमाण पत्र"
        title="Certificate"
        lead={t('One per rung you hold. Satire. Not a government document.', 'आपकी हर सीढ़ी का एक। व्यंग्य है, सरकारी काग़ज़ नहीं।')}
      />
      <div className="h-certview__grid">
        <div className="h-certview__preview">
          <Certificate {...input} id="h-certificate" />
        </div>
        <div className="h-certview__side">
          {s.band > 0 ? (
            <fieldset className="h-rungpick">
              <legend className="h-rungpick__legend">{t('Rung', 'सीढ़ी')}</legend>
              <div className="h-rungpick__list">
                {LADDER_DISPLAY.filter((r) => r.band <= s.band).map((r) => (
                  <label key={r.band} className={cx('h-rungpick__opt', r.band === band && 'h-rungpick__opt--on')}>
                    <input
                      type="radio"
                      name="h-rung"
                      className="h-rungpick__radio"
                      checked={r.band === band}
                      onChange={() => navigate(`${href.certificate()}${queryString({ band: r.band === s.band ? undefined : r.band })}`, { replace: true })}
                    />
                    <span className="h-rungpick__en">{r.en}</span>
                    <span className="h-rungpick__meta">
                      {dates.get(r.band) ? shortDate(dates.get(r.band)!) : r.band === 0 ? t('Everyone starts here', 'सब यहीं से शुरू') : t('Issued', 'जारी')}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="h-me__fine">
              {t(
                'Everyone starts as Andhbhakt — of anyone, for anything. Receipts get you out, and each rung you reach gets its own certificate.',
                'सब अंधभक्त से शुरू करते हैं। रसीदें बाहर निकालती हैं, और हर नई सीढ़ी का अपना प्रमाण पत्र।',
              )}
            </p>
          )}
          {competitionTitle && <label className="h-certview__honourpick"><input type="checkbox" checked={!!honour} onChange={event => navigate(`${href.certificate()}${queryString({ band: band === s.band ? undefined : band, honour: event.target.checked ? '1' : undefined })}`, { replace: true })} /><span><strong>{competitionTitle.name || 'Certified Anti-National'}</strong><small>{honourLine(competitionTitle)}</small></span></label>}
          <NameField />
          <PhotoField />
          <ShareButton variant="primary" block run={() => shareCertificate(input)}>
            {t('Share certificate', 'प्रमाण पत्र भेजो')}
          </ShareButton>
          <Button variant="paper" block icon={<Download size={20} strokeWidth={2.4} />} busy={saved === 'busy'} onClick={() => void download()}>
            <span aria-live="polite">
              {saved === 'done' ? t('Saved ✓', 'सेव हो गया ✓') : saved === 'failed' ? t('Could not save. Try again', 'सेव नहीं हुआ। फिर कोशिश करो') : t('Save as image', 'तस्वीर सेव करो')}
            </span>
          </Button>
          <p className="h-me__fine">
            {t(
              'Your photo stays on this device. The certificate includes your chosen name, photo and label only when you choose to share it. Every image says it is satire.',
              'तस्वीर आपके फ़ोन पर बनती है, कहीं अपलोड नहीं होती। हर शेयर पर लिखा है कि यह व्यंग्य है।',
            )}
          </p>
        </div>
      </div>
    </Page>
  );
}
