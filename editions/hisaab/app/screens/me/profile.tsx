/**
 * screens/me/profile.tsx — Profile "Me" (design bible §11.14, notification rules §9).
 *
 * Phone: the ladder is the hero (current rung expanded with the band meter, the certificate thumbnail,
 * the name field and the ONE violet action, Share certificate) → stats → duel performance → Stamp Register
 * → Activity. Desktop (≥ 900px): ladder (5 cols) | certificate preview (7 cols), the rest below.
 * Quiet: this screen raises nothing; every number updates in place.
 */
import { Activity as ActivityIcon, ArrowRight, BookOpen, Flame, Landmark, Receipt as ReceiptIcon, Settings, Stamp as StampIcon, Target } from 'lucide-react';
import { standing } from '../../../edition';
import { useActivity } from '../../budget';
import { formatNumber, goalCopy, bandProgress, labelDisplay } from '../../data';
import { href } from '../../router';
import { shareCertificate, ShareButton } from '../../share';
import { useScreenTitle } from '../../shell/chrome';
import { useAppPlayer } from '../../shell/player';
import { Button } from '../../ui/button';
import { Certificate } from '../../ui/certificate';
import { Meter } from '../../ui/meter';
import { Page, ScreenHeader } from '../../ui/page';
import { Skeleton } from '../../ui/skeleton';
import { useLang } from '../../ui/lang';
import { Link } from '../../router';
import { countReceipts } from '../receipts/lib';
import { Ladder } from './ladder';
import { babuRankView, duelPerformance, filesCleared, promotionDates, shortDate, stampRegister, useMediaQuery, usePlayerName, type ProgressionLike, type RegisterEntry } from './lib';
import { CertThumb } from './cert-thumb';
import { NameField } from './name-field';
import { PhotoField, usePortrait } from './photo-field';
import { useCompetitionTitle } from './competition-title';
import { usePersonalXp } from './personal-xp';
import { AccountCard } from './account-card';
import './me.css';

function Stat({ icon, k, v, sub, to }: { icon: React.ReactNode; k: string; v: React.ReactNode; sub?: React.ReactNode; to?: string }) {
  const body = (
    <>
      <span className="h-stat__k">
        <span className="h-stat__icon" aria-hidden="true">
          {icon}
        </span>
        {k}
      </span>
      <span className="h-stat__v">{v}</span>
      {sub ? <span className="h-stat__sub">{sub}</span> : null}
    </>
  );
  return to ? (
    <Link to={to} className="h-stat h-stat--link">
      {body}
    </Link>
  ) : (
    <div className="h-stat">{body}</div>
  );
}

const timeOf = (at: number) => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function Profile() {
  const player = useAppPlayer();
  const personalXp = usePersonalXp(player.progression?.xp ?? 0);
  const { t, isHi } = useLang();
  const wide = useMediaQuery('(min-width: 900px)');
  const name = usePlayerName();
  const portrait = usePortrait();
  const competitionTitle = useCompetitionTitle();
  const activity = useActivity();
  useScreenTitle(t('Me', 'मैं'));

  if (!player.loaded) {
    return (
      <Page screen="me">
        <Skeleton lines={8} label={t('Opening your file', 'आपकी फ़ाइल खुल रही है')} />
      </Page>
    );
  }

  const prog = player.progression as ProgressionLike;
  const xp = personalXp;
  const s = standing(xp);
  const label = labelDisplay(s.band);
  const dates = promotionDates(prog);
  const receipts = countReceipts(player.journal);
  // The promotion date when it is on record; else the certificate says ISSUED with no date.
  const issuedOn = dates.get(s.band) ?? null;
  const meter = bandProgress(xp);
  const states = filesCleared(player.profile?.journeys, ['state']);
  const sectors = filesCleared(player.profile?.journeys, ['sector']);
  const others = filesCleared(player.profile?.journeys, ['media', 'forward', 'distribution', 'relief', 'pre-election', 'year']);
  const rank = babuRankView(prog);
  const performance = duelPerformance(prog);
  const register = stampRegister(prog);
  const earnedEntries = register.entries.filter((e) => e.at !== null);
  const waiting = register.entries.filter((e) => e.at === null);
  const earned = earnedEntries.length;
  const registerRow = (e: RegisterEntry) => (
    <li key={e.id} className={e.at ? 'h-register__row h-register__row--on' : 'h-register__row'}>
      <span className="h-register__mark" aria-hidden="true">
        {e.at ? <StampIcon size={16} strokeWidth={2.6} /> : null}
      </span>
      <span className="h-register__text">
        <strong className="h-register__name">{e.name}</strong>
        <span className="h-register__desc">{e.description}</span>
      </span>
      <span className="h-register__when">
        {e.at ? (
          <>
            <span className="h-sr">{t('Stamped', 'दर्ज')} </span>
            <span className="h-mono">{shortDate(e.at)}</span>
          </>
        ) : (
          <span className="h-register__not">{t('Not yet', 'अभी नहीं')}</span>
        )}
      </span>
    </li>
  );
  const streak = prog?.streak ?? { current: 0, best: 0, shields: 0, lastDay: null };

  const share = (
    <ShareButton
      variant="primary"
      block
      run={() => shareCertificate({ name, band: s.band, receipts, issuedOn, portrait })}
    >
      {t('Share certificate', 'प्रमाण पत्र भेजो')}
    </ShareButton>
  );

  const currentBody = (
    <>
      <Meter
        value={meter.value}
        max={meter.max}
        ticks={5}
        label={t(`Progress through ${label.en}`, `${label.hi} में प्रगति`)}
        valueText={`Level ${s.level}. ${goalCopy(xp)}`}
        copy={goalCopy(xp, isHi ? 'hi' : 'en')}
      />
      <p className="h-rung__xp">
        <span className="h-mono">LV {s.level}</span> · <span className="h-mono">{formatNumber(xp)} XP</span>
      </p>
      {!wide ? (
        <>
          <Link to={href.certificate()} className="h-me__thumbrow" aria-label={t('Open your certificate', 'अपना प्रमाण पत्र खोलो')}>
            <CertThumb width={112} portrait={portrait} name={name} receipts={receipts} band={s.band} issuedOn={issuedOn} />
            <span className="h-me__thumbtext">
              <strong>{t('Your certificate', 'आपका प्रमाण पत्र')}</strong>
              <span>{t('Satire. Not a government document.', 'व्यंग्य है, सरकारी काग़ज़ नहीं।')}</span>
              <span className="h-me__thumbopen">
                {t('Open and pick a rung', 'खोलो, सीढ़ी चुनो')} <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </span>
            </span>
          </Link>
          <NameField compact />
          <PhotoField />
          {share}
        </>
      ) : null}
    </>
  );

  return (
    <Page screen="me" className="h-me">
      <ScreenHeader
        kicker={`F.No. P/LV-${s.level} · ${t('On this device', 'इसी फ़ोन पर')}`}
        titleHi="आपका लेबल"
        title="Your label"
        lead={
          <>
            {t('Aapka label, aapki receipts.', 'आपका लेबल, आपकी रसीदें।')}{' '}
            <button type="button" className="h-link h-me__jump" onClick={() => document.getElementById('h-rung-current')?.scrollIntoView({ block: 'center' })}>
              {t(`You are ${label.en}, level ${s.level}`, `आप ${label.hi} हैं, लेवल ${s.level}`)}
            </button>
          </>
        }
      />

      <AccountCard />
      {competitionTitle && <p className="h-me__fine"><Link to={`${href.certificate()}?honour=1`}>{t("Your competition honour is ready to share", "आपका प्रतियोगिता सम्मान शेयर करने के लिए तैयार है")}</Link></p>}
      <div className="h-me__grid">
        <section className="h-me__ladder" aria-labelledby="h-me-ladder">
          <h2 className="h-me__h2" id="h-me-ladder">
            {t('The ladder', 'सीढ़ी')} <span className="h-me__h2sub">{t('Andhbhakt to Deshbhakt', 'अंधभक्त से देशभक्त तक')}</span>
          </h2>
          <Ladder band={s.band} dates={dates} current={currentBody} />
          <p className="h-me__fine">
            {t(
              'Labels are the joke, aimed at labelling and blind devotion — never at a party, its voters or anyone real.',
              'लेबल मज़ाक़ हैं — लेबल लगाने और अंधभक्ति पर; किसी पार्टी, उसके वोटरों या असली व्यक्ति पर नहीं।',
            )}
          </p>
        </section>
        {wide ? (
          <aside className="h-me__cert" aria-labelledby="h-me-cert">
            <h2 className="h-me__h2" id="h-me-cert">
              {t('Your certificate', 'आपका प्रमाण पत्र')}
            </h2>
            <div className="h-me__certbody">
              <Link to={href.certificate()} className="h-me__certlink" aria-label={t('Open your certificate', 'अपना प्रमाण पत्र खोलो')}>
                <Certificate portrait={portrait} name={name} receipts={receipts} band={s.band} issuedOn={issuedOn} />
              </Link>
              <div className="h-me__certctl">
                <NameField />
                <PhotoField />
                {share}
                <Button variant="ghost" href={href.certificate()} trailing={<ArrowRight size={18} />}>
                  {t('Every rung you hold', 'आपकी हर सीढ़ी')}
                </Button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      <section className="h-me__section" aria-labelledby="h-me-stats">
        <h2 className="h-me__h2" id="h-me-stats">
          {t('Your file, in numbers', 'आपकी फ़ाइल, आँकड़ों में')}
        </h2>
        <div className="h-me__stats">
          <Stat
            icon={<ReceiptIcon size={18} strokeWidth={2.4} />}
            k={t('Receipts', 'रसीदें')}
            v={<span className="h-mono">{formatNumber(receipts)}</span>}
            sub={t('sourced, in your vault', 'स्रोत सहित, आपकी तिजोरी में')}
            to={href.receipts()}
          />
          <Stat
            icon={<Landmark size={18} strokeWidth={2.4} />}
            k={t('State files', 'राज्य फ़ाइलें')}
            v={
              <span className="h-mono">
                {states.cleared}/{states.total}
              </span>
            }
            sub={t('cleared at least once', 'कम से कम एक बार पूरी')}
            to={href.files('states')}
          />
          <Stat
            icon={<BookOpen size={18} strokeWidth={2.4} />}
            k={t('Sector files', 'सेक्टर फ़ाइलें')}
            v={
              <span className="h-mono">
                {sectors.cleared}/{sectors.total}
              </span>
            }
            sub={others.total ? t(`+ ${others.cleared}/${others.total} other files`, `+ ${others.cleared}/${others.total} अन्य फ़ाइलें`) : undefined}
            to={href.files('sectors')}
          />
          <Stat
            icon={<Flame size={18} strokeWidth={2.4} />}
            k={t('Streak', 'लगातार')}
            v={
              <span className="h-mono">
                {streak.current} {streak.current === 1 ? t('day', 'दिन') : t('days', 'दिन')}
              </span>
            }
            sub={`${streak.shields} CL ${t('in hand', 'बाक़ी')} · ${t('best', 'सबसे लंबा')} ${streak.best}`}
          />
          <Stat
            icon={<StampIcon size={18} strokeWidth={2.4} />}
            k={t('Babu rank', 'बाबू रैंक')}
            v={rank.label}
            sub={
              <>
                <span className="h-mono">{formatNumber(rank.points)}</span> {t('points · on this device', 'अंक · इसी फ़ोन पर')}
                {rank.next ? (
                  <Meter
                    className="h-stat__meter"
                    value={rank.into}
                    max={rank.toNext}
                    label={t(`Babu rank progress to ${rank.next}`, `${rank.next} तक बाबू रैंक`)}
                    valueText={`${rank.into} of ${rank.toNext} points to ${rank.next}`}
                    copy={`${formatNumber(rank.toNext - rank.into)} ${t('to', 'बाक़ी:')} ${rank.next}`}
                    as="span"
                  />
                ) : null}
              </>
            }
          />
          <Stat
            icon={<StampIcon size={18} strokeWidth={2.4} />}
            k={t('Stamp Register', 'ठप्पा रजिस्टर')}
            v={
              <span className="h-mono">
                {earned}/{register.entries.length + register.hiddenLeft}
              </span>
            }
            sub={t('entries stamped', 'दर्ज')}
          />
        </div>
      </section>

      <section className="h-me__section" aria-labelledby="h-me-performance">
        <h2 className="h-me__h2" id="h-me-performance">
          <Target size={20} strokeWidth={2.4} aria-hidden="true" /> {t('Your duel record', 'आपके मुक़ाबलों का रिकॉर्ड')}
        </h2>
        <p className="h-me__lead">
          {t('Recorded duel rounds on this device. Daily and file answers are not included.', 'इसी फ़ोन पर दर्ज मुक़ाबले। आज के सवाल और फ़ाइलों के जवाब इनमें शामिल नहीं हैं।')}
        </p>
        {performance.rounds ? (
          <div className="h-me__stats">
            <Stat
              icon={<Target size={18} strokeWidth={2.4} />}
              k={t('Accuracy', 'सही जवाब')}
              v={<span className="h-mono">{performance.accuracy}%</span>}
              sub={t(`${formatNumber(performance.correct)} correct in ${formatNumber(performance.rounds)} rounds`, `${formatNumber(performance.rounds)} राउंड में ${formatNumber(performance.correct)} सही`)}
            />
            <Stat
              icon={<Target size={18} strokeWidth={2.4} />}
              k={t('Fastest correct answer', 'सबसे तेज़ सही जवाब')}
              v={performance.fastestCorrectMs === null ? '—' : <span className="h-mono">{(performance.fastestCorrectMs / 1000).toFixed(2)} s</span>}
              sub={performance.fastestCorrectMs === null ? t('No recorded correct-answer time yet', 'अभी सही जवाब का समय दर्ज नहीं हुआ') : t('Your recorded best', 'आपका दर्ज सबसे अच्छा समय')}
            />
          </div>
        ) : (
          <p className="h-me__empty">
            {t('Play a duel to start your accuracy and pace record.', 'सही जवाब और रफ़्तार का रिकॉर्ड शुरू करने के लिए एक मुक़ाबला खेलो।')}
          </p>
        )}
      </section>

      <div className="h-me__pair">
        <section className="h-me__section" aria-labelledby="h-me-register">
          <h2 className="h-me__h2" id="h-me-register">
            <StampIcon size={20} strokeWidth={2.4} aria-hidden="true" /> {t('Stamp Register', 'ठप्पा रजिस्टर')}
          </h2>
          <p className="h-me__lead">{t('Entries are stamped quietly. No pop-ups, no medals.', 'एंट्री चुपचाप दर्ज होती है। कोई पॉप-अप नहीं।')}</p>
          {earnedEntries.length ? (
            <ul className="h-register">{earnedEntries.map(registerRow)}</ul>
          ) : (
            <p className="h-me__empty">{t('No entries yet. The register fills itself as you play.', 'अभी कोई एंट्री नहीं।')}</p>
          )}
          {waiting.length ? (
            <details className="h-register__more">
              <summary className="h-register__moresum">
                {t(`Not stamped yet (${waiting.length})`, `अभी बाक़ी (${waiting.length})`)}
              </summary>
              <ul className="h-register">{waiting.map(registerRow)}</ul>
            </details>
          ) : null}
          {register.hiddenLeft ? (
            <p className="h-me__fine">
              {t(`+ ${register.hiddenLeft} entries that appear once stamped.`, `+ ${register.hiddenLeft} एंट्री जो दर्ज होने पर दिखेंगी।`)}
            </p>
          ) : null}
        </section>

        <section className="h-me__section" aria-labelledby="h-me-activity">
          <h2 className="h-me__h2" id="h-me-activity">
            <ActivityIcon size={20} strokeWidth={2.4} aria-hidden="true" /> {t('Activity', 'गतिविधि')}
          </h2>
          <p className="h-me__lead">
            {t(
              'Updates we kept off your screen, and toasts you may have missed. This visit only; nothing here is stored.',
              'जो अपडेट स्क्रीन पर नहीं दिखाए, वे यहाँ हैं। सिर्फ़ इस बार के लिए; कुछ सेव नहीं होता।',
            )}
          </p>
          {activity.length ? (
            <ol className="h-activity">
              {activity.map((a) => (
                <li key={a.id} className="h-activity__row">
                  <span className="h-mono h-activity__time">{timeOf(a.at)}</span>
                  <span className="h-activity__text">
                    <strong>{a.title}</strong>
                    {a.body ? <span className="h-activity__body">{a.body}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="h-me__empty">{t('Nothing yet this visit. Babu is also waiting.', 'इस बार अभी कुछ नहीं। बाबू भी इंतज़ार में है।')}</p>
          )}
        </section>
      </div>

      <nav className="h-me__links" aria-label={t('More', 'और')}>
        <Button variant="paper" size="s" href={href.settings()} icon={<Settings size={18} strokeWidth={2.4} />}>
          {t('Settings', 'सेटिंग्स')}
        </Button>
        <Button variant="paper" size="s" href={href.rules()} icon={<BookOpen size={18} strokeWidth={2.4} />}>
          {t('Rules & Sources', 'नियम और स्रोत')}
        </Button>
      </nav>
    </Page>
  );
}
