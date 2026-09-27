/**
 * screens/home/index.tsx — Home (design bible §11.2; notification rules §9).
 *
 * Phone, top to bottom: the label block (label + meter with goal-gradient copy + streak and CL) →
 * Today's file → continue where you left → Your tijori → Aaj ke 3 kaam → the records room (Rajya,
 * Sector, Kiska Media?, Forward Court) and the money trail (Seedha Khaate Mein, Rahat Kosh, Chunav Se
 * Pehle, Saal-dar-Saal) → the Muqabla strip. Desktop (≥ 900px): a 12-column grid, bible §11.2.
 *
 * ONE violet primary: Open / Continue today's file → once done, Resume <file> → else Duel Babu-Bot.
 * Quiet by design: Home raises no toast or ceremony itself (the shell's progression watcher owns the
 * one CL / quests toast and a pending label ceremony); streak, quests, tijori and meter update in place.
 * Never "come back" or streak-risk copy. A fresh profile is sent to the first-run poster once a session.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, CalendarDays, Check, ChevronRight, Flame, FolderOpen, Scale, Share2, Users, WifiOff, X } from 'lucide-react';
import { dayKey } from '@/lib/journal.mjs';
import { dailyQuests } from '@/lib/progression.mjs';
import { ROUTES, standing, todaysFive } from '../../../edition';
import { PENDING_LABEL, useActivity, useBudget } from '../../budget';
import { formatNumber, labelDisplay, labelLine, SECTOR_NAMES_HI, stateNameHi } from '../../data';
import { href, type ScreenProps } from '../../router';
import { shareDailyGrid } from '../../share';
import { useAppPlayer } from '../../shell/player';
import { usePersonalXp } from '../me/personal-xp';
import { sceneCapability, Tijori, TijoriArt, tijoriLabel } from '../../three';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { cx } from '../../ui/cx';
import { FileCard } from '../../ui/file-card';
import { useLang } from '../../ui/lang';
import { Meter } from '../../ui/meter';
import { Masthead } from '../../ui/masthead';
import { AdSlot, PublicationLinks } from '../../ads/ad-slot';
import { InlineNote, Page } from '../../ui/page';
import { Skeleton } from '../../ui/skeleton';
import { LandingPreference } from './landing-preference';
import { LabelCard } from '../start/label-card';
import { FileEntries } from './file-entries';
import {
  dailyStatus,
  questView,
  receiptStats,
  resumeRun,
  type DailyStatus,
  type QuestItem,
  type ResumeRun,
} from './home-data';
import { usePressCue } from './press-cue';
import './home.css';


// ---- small shared hooks ---------------------------------------------------------------------------

const subscribeOnline = (fn: () => void) => {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => {
    window.removeEventListener('online', fn);
    window.removeEventListener('offline', fn);
  };
};
/** navigator.onLine, live. Solo modes work offline (the bank ships in the build). */
function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/** The local day key, refreshed when the tab comes back after midnight. */
function useToday() {
  const [day, setDay] = useState(() => dayKey(Date.now()));
  useEffect(() => {
    const check = () => setDay(dayKey(Date.now()));
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return day;
}

type Streak = { current: number; best: number; lastDay: string | null; shields: number };

/**
 * The streak as it truly stands today. The stored `current` is only rewritten on the next play, so a
 * run already broken (more missed days than CL can cover) reads 0 here instead of a stale number.
 */
function liveStreak(s: Streak | undefined, today: string): { days: number; shields: number; best: number } {
  if (!s || !s.lastDay) return { days: 0, shields: s?.shields ?? 0, best: s?.best ?? 0 };
  const [a, b] = [s.lastDay, today].map((k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  });
  const gap = Math.round((b - a) / 864e5);
  const missed = Math.max(0, gap - 1);
  const alive = missed === 0 || s.shields >= missed;
  return { days: alive ? s.current : 0, shields: s.shields, best: s.best };
}

const subscribeVisibility = (fn: () => void) => {
  document.addEventListener('visibilitychange', fn);
  return () => document.removeEventListener('visibilitychange', fn);
};

/**
 * The shell's progression watcher logs a promotion that lands while this tab is hidden (earned in
 * another tab) to Activity with kind PENDING_LABEL ({ band }) instead of opening its ceremony. Bible §9 (Home):
 * such a promotion, earned elsewhere and not yet shown, opens the `label` ceremony here — once, and
 * only if no label ceremony has been raised since. Ceremonies raised while a round was live are queued
 * by the budget itself and need nothing from Home.
 */
const handledLabelNotes = new Set<string>();
function usePendingLabel(loaded: boolean, band: number) {
  const activity = useActivity();
  const budget = useBudget();
  const { t, isHi } = useLang();
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => false,
  );
  useEffect(() => {
    if (!loaded || !visible) return;
    const latest = activity.find((e) => e.kind === 'ceremony:label' || e.kind === PENDING_LABEL);
    if (!latest || latest.kind !== PENDING_LABEL || handledLabelNotes.has(latest.id)) return;
    handledLabelNotes.add(latest.id);
    const l = labelDisplay(band);
    budget.ceremony({
      kind: 'label',
      kicker: t('Label promotion', 'लेबल प्रमोशन'),
      title: l.en,
      titleHi: l.hi,
      subtitle: labelLine(l, isHi),
      stamp: `ISSUED · ${l.en.toUpperCase()}`,
      seed: `band-${l.band}`,
    });
  }, [loaded, visible, activity, band, budget, t, isHi]);
}

// ---- the screen -----------------------------------------------------------------------------------

export default function HomeScreen(_props: ScreenProps) {
  const player = useAppPlayer();
  const { t } = useLang();
  const online = useOnline();
  const today = useToday();
  const onPointerDown = usePressCue();
  const profile = player.profile;

  const daily = useMemo(() => todaysFive(), [today]); // eslint-disable-line react-hooks/exhaustive-deps
  const status = useMemo(
    () => dailyStatus(profile.journal, daily.day, daily.cards.length),
    [profile.journal, daily],
  );
  const receipts = useMemo(() => receiptStats(profile.journal), [profile.journal, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const resume = useMemo(() => resumeRun(profile.journeys, ROUTES), [profile.journeys]);
  const xp = usePersonalXp(player.progression?.xp ?? 0);
  const s = standing(xp);
  const streak = liveStreak(player.progression?.streak as Streak | undefined, today);
  usePendingLabel(player.loaded, s.band);
  const quests = useMemo<QuestItem[]>(() => {
    const q = player.progression?.quests as { day: string | null; items: QuestItem[] } | undefined;
    if (q && q.day === today && q.items.length) return q.items;
    // Not rolled yet today: the engine deals exactly these on the first answer (same seed), at 0.
    return (dailyQuests(profile.epoch ?? 'initial', today) as { items: QuestItem[] }).items;
  }, [player.progression?.quests, profile.epoch, today]);

  if (!player.loaded) {
    return (
      <Page screen="home">
        <h1 className="h-sr">{t('Home', 'होम')}</h1>
        <Skeleton lines={6} label={t('Opening your files…', 'आपकी फ़ाइलें खुल रही हैं…')} />
      </Page>
    );
  }


  return (
    <Page screen="home" className={cx('h-home', !resume && 'h-home--noresume')}>
      <h1 className="h-sr">{t('Home — Andhbhakt ya Deshbhakt', 'होम — अंधभक्त या देशभक्त')}</h1>
      <Masthead day={today} />
      {!online || player.storageError ? (
        <div className="h-home__notes">
          {!online ? (
            <InlineNote tone="wait">
              <WifiOff aria-hidden="true" size={16} className="h-home__noteicon" />
              {t(
                'No network. The files are already on your phone.',
                'नेटवर्क नहीं है। फ़ाइलें आपके फ़ोन में ही हैं।',
              )}
            </InlineNote>
          ) : null}
          {player.storageError ? <InlineNote tone="wait">{player.storageError}</InlineNote> : null}
        </div>
      ) : null}
      <div className="h-home__root" onPointerDown={onPointerDown}>
        <section className="h-home__duel" aria-labelledby="h-home-duel"><DuelStrip /></section>
        <section className="h-home__today" aria-label={t("Today's file", 'आज की फ़ाइल')}>
          <p className="h-home__sectionline"><span>{t('TODAY’S FILE', 'आज की फ़ाइल')}</span><span>{t('NEW EACH DAY', 'हर दिन नई')}</span></p>
          <h2 className="h-home__headline">{t('A fresh file. Every day.', 'हर दिन। नया हिसाब।')}</h2>
          <p className="h-home__standfirst">{t('Public money. Big claims. Five questions with the sources to back them up.', 'जनता का पैसा। बड़े दावे। पाँच सवाल — हर जवाब के साथ उसका स्रोत।')}</p>
          <TodayCard day={daily.day} status={status} primary={false} band={s.band} />
          <LandingPreference />
        </section>

        <section className="h-home__who" aria-labelledby="h-home-label">
          <p className="h-home__sectionline"><span>{t('YOUR READER’S DESK', 'आपकी डेस्क')}</span></p>
          <LabelCard
            xp={xp}
            intro={s.band === 0 && s.level <= 1}
            headingId="h-home-label"
            footer={<StreakRow days={streak.days} shields={streak.shields} best={streak.best} />}
          />
        </section>

        <section className="h-home__circles" aria-labelledby="h-home-circles">
          <div className="h-home__circlemark" aria-hidden="true"><Users size={30} strokeWidth={1.5} /></div>
          <div className="h-home__circlecopy">
            <p className="h-kicker">{t('FRIENDS & FAMILY', 'दोस्त और परिवार')}</p>
            <h2 id="h-home-circles">{t('Same circle. Different opinions.', 'अपना सर्कल। सबकी अपनी राय।')}</h2>
            <p>{t('Make a circle, choose your nickname and bring the debate home.', 'अपना सर्कल बनाओ, अपना निकनेम चुनो और दोस्तों या परिवार को बुलाओ।')}</p>
          </div>
          <Button variant="paper" href="#/circles" icon={<ArrowUpRight size={18} />}>{t('Your circles', 'आपके सर्कल')}</Button>
        </section>

        {resume ? (
          <section className="h-home__resume" aria-label={t('Continue where you left', 'जहाँ छोड़ा था')}>
            <ResumeCard run={resume} primary={false} />
          </section>
        ) : null}

        <section className="h-home__tijori" aria-labelledby="h-home-tijori">
          <TijoriPanel count={receipts.count} today={receipts.today} />
        </section>

        <section className="h-home__quests" aria-labelledby="h-home-quests">
          <Quests items={quests} />
        </section>

        <section className="h-home__files" aria-labelledby="h-home-files">
          <FileEntries journeys={profile.journeys} />
        </section>

      </div>
      <AdSlot placement="home-footer" screen="home" />
      <PublicationLinks />
    </Page>
  );
}

// ---- label block: streak + CL ---------------------------------------------------------------------

function StreakRow({ days, shields, best }: { days: number; shields: number; best: number }) {
  const { t } = useLang();
  const dayWord = days === 1 ? t('day', 'दिन') : t('days', 'दिन');
  return (
    <>
      <p className="h-home__streak">
        <Flame aria-hidden="true" size={18} strokeWidth={2.4} className="h-home__flame" />
        <span>
          {t('Streak', 'स्ट्रीक')}: <strong className="h-tnum">{formatNumber(days)}</strong> {dayWord}
          {best > days ? (
            <span className="h-home__best">
              {' '}
              · {t('best', 'सबसे लंबी')} {formatNumber(best)}
            </span>
          ) : null}
        </span>
      </p>
      <Chip
        kind="plain"
        className="h-home__cl"
        title={t(
          'Casual leave: covers a missed day on its own. 1 per 7-day streak, max 2.',
          'आकस्मिक अवकाश: छूटा दिन अपने आप ढक लेता है।',
        )}
      >
        <span aria-hidden="true">CL</span>
        <span className="h-home__cltext">
          {shields > 0 ? t(`${shields} in hand`, `${shields} बाकी`) : t('1 per 7 days', 'हर 7 दिन पर 1')}
        </span>
        <span className="h-sr">
          {t('Casual leave covers a missed day automatically.', 'आकस्मिक अवकाश छूटा दिन अपने आप ढक लेता है।')}
        </span>
      </Chip>
    </>
  );
}

// ---- Today's file ---------------------------------------------------------------------------------

function TodayCard({
  day,
  status,
  primary,
  band,
}: {
  day: string;
  status: DailyStatus;
  primary: boolean;
  band: number;
}) {
  const { t } = useLang();
  const [shared, setShared] = useState<string | null>(null);
  const state = status.done ? 'cleared' : status.answered > 0 ? 'open' : 'sealed';
  const label = !status.done
    ? status.answered > 0
      ? t("Continue daily practice", 'आज का अभ्यास जारी रखो')
      : t("Practice today’s file", 'आज की फ़ाइल का अभ्यास')
    : t("See today's file", 'आज की फ़ाइल देखो');

  const share = async () => {
    const results = status.results.map((r) => r === true);
    const outcome = await shareDailyGrid({ day, results, label: labelDisplay(band).en });
    setShared(
      outcome.ok
        ? outcome.method === 'clipboard'
          ? t('Copied ✓', 'कॉपी हो गया ✓')
          : t('Shared ✓', 'भेज दिया ✓')
        : outcome.reason === 'cancelled'
          ? null
          : t('Could not share', 'भेज नहीं पाए'),
    );
  };

  return (
    <FileCard
      fno={`F.No. D/${day}`}
      titleHi="आज का हिसाब"
      title={t("Today's file", 'आज की फ़ाइल')}
      icon={<CalendarDays size={24} strokeWidth={2.2} />}
      state={state}
      emphasis
      seed={`daily-${day}`}
      clearedText={`${status.right}/${status.size}`}
      meta={
        status.done
          ? t('Aaj ka hisaab ho gaya. Kal naya file.', 'आज का हिसाब हो गया। कल नई फ़ाइल।')
          : t(
              `${status.size} questions · same for everyone today`,
              `${status.size} सवाल · आज सबके लिए एक जैसे`,
            )
      }
    >
      {status.done ? (
        <span className="h-home__grid" role="img" aria-label={`${status.right} of ${status.size} right`}>
          {status.results.map((r, i) => (
            <span key={i} className={cx('h-home__cell', r ? 'h-home__cell--pass' : 'h-home__cell--fail')}>
              {r ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
            </span>
          ))}
          <span className="h-home__gridscore h-mono">
            {status.right}/{status.size}
          </span>
        </span>
      ) : status.answered > 0 ? (
        <Meter
          as="span"
          className="h-home__todaymeter"
          value={status.answered}
          max={status.size}
          ticks={status.size}
          label={t("Today's file progress", 'आज की फ़ाइल')}
          valueText={`${status.answered} of ${status.size} answered`}
          copy={t(
            `${status.answered} of ${status.size} answered`,
            `${status.size} में से ${status.answered} हो गए`,
          )}
        />
      ) : (
        <span className="h-home__ready">{t('Correct answers: under 8s · 30 XP / under 15s · 20 XP / 15s+ · 10 XP', 'सही जवाब: 8 सेकंड से कम · 30 XP / 15 से कम · 20 XP / 15 या ज़्यादा · 10 XP')}</span>
      )}
      <span className="h-home__actions">
        <Button variant="paper" block href={href.online('play', { file: 'today' })}>{t('Duel today’s file', 'आज की फ़ाइल पर मुक़ाबला')}</Button>
        {status.done ? (
          <>
            <Button variant="paper" size="s" icon={<Share2 size={18} />} onClick={share} aria-live="polite">
              {shared ?? t('Share grid', 'ग्रिड भेजो')}
            </Button>
            <Button variant="ghost" size="s" href={href.aaj()}>
              {label}
            </Button>
          </>
        ) : (
          <Button variant={primary ? 'primary' : 'paper'} block href={href.aaj()}>
            {label}
          </Button>
        )}
      </span>
      {status.done ? (
        <span className="h-home__next">{t('New file at midnight.', 'नई फ़ाइल आधी रात को।')}</span>
      ) : null}
    </FileCard>
  );
}

// ---- continue where you left ----------------------------------------------------------------------

function ResumeCard({ run, primary }: { run: ResumeRun; primary: boolean }) {
  const { t } = useLang();
  const { route, answered, total } = run;
  const titleHi =
    route.kind === 'state' && route.state
      ? stateNameHi(route.state)
      : route.kind === 'sector' && route.topic
        ? SECTOR_NAMES_HI[route.topic]
        : undefined;
  return (
    <FileCard
      fno={`F.No. ${route.code}`}
      title={route.title}
      titleHi={titleHi}
      icon={<FolderOpen size={24} strokeWidth={2.2} />}
      state="open"
      meta={t('Continue where you left.', 'जहाँ छोड़ा था, वहीं से।')}
    >
      <Meter
        as="span"
        className="h-home__resumemeter"
        value={answered}
        max={total}
        ticks={total}
        label={t(`${route.title}: file progress`, `${route.title}: फ़ाइल`)}
        valueText={`${answered} of ${total} answered`}
        copy={t(`${answered} of ${total} answered`, `${total} में से ${answered} हो गए`)}
      />
      <span className="h-home__actions">
        <Button variant={primary ? 'primary' : 'paper'} block={primary} href={href.route(route.id)}>
          {t(`Resume ${route.title}`, `${titleHi ?? route.title} जारी रखो`)}
        </Button>
      </span>
    </FileCard>
  );
}

// ---- Your tijori -----------------------------------------------------------------------------------

function TijoriPanel({ count, today }: { count: number; today: number }) {
  const { t, locale } = useLang();
  const [open, setOpen] = useState(false);
  const capable = useMemo(() => sceneCapability().ok, []);
  return (
    <div className="h-home__panel h-home__tijoripanel">
      <div className="h-home__panelhead">
        <h2 className="h-home__h2" id="h-home-tijori">
          <span className="h-home__h2hi" lang="hi">
            आपकी तिजोरी
          </span>
          <span className="h-home__h2en">Your tijori</span>
        </h2>
        {today > 0 ? (
          <span className="h-home__today-n h-mono">
            +{formatNumber(today)} {t('today', 'आज')}
          </span>
        ) : null}
      </div>
      {count === 0 ? (
        <p className="h-home__empty">
          {t('Tijori khaali hai. First receipt goes here.', 'तिजोरी ख़ाली है। पहली रसीद यहीं आएगी।')}
        </p>
      ) : null}
      {open ? (
        <Tijori count={count} newCount={today} height={280} trigger="mount" className="h-home__scene" />
      ) : (
        <div className="h-home__tijoriart" role="img" aria-label={tijoriLabel(count, locale)}>
          <TijoriArt count={count} />
        </div>
      )}
      <div className="h-home__row">
        {capable && count > 0 ? (
          <Button variant="paper" size="s" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? t('Close tijori', 'तिजोरी बंद करो') : t('Open tijori', 'तिजोरी खोलो')}
          </Button>
        ) : null}
        <a className="h-link h-link--tap" href={href.receipts()}>
          {t('All receipts', 'सारी रसीदें')}
        </a>
      </div>
    </div>
  );
}

// ---- Aaj ke 3 kaam -----------------------------------------------------------------------------------

function Quests({ items }: { items: QuestItem[] }) {
  const { t, isHi } = useLang();
  const done = items.filter((q) => q.done).length;
  return (
    <div className="h-home__panel">
      <div className="h-home__panelhead">
        <h2 className="h-home__h2" id="h-home-quests">
          <span className="h-home__h2hi" lang="hi">
            आज के 3 काम
          </span>
          <span className="h-home__h2en">Aaj ke 3 kaam</span>
        </h2>
        {/* A span takes no aria-label (and '1/3' would be read as "one third"): words for screen readers. */}
        <span className="h-home__questcount h-mono">
          <span aria-hidden="true">
            {done}/{items.length}
          </span>
          <span className="h-sr">{t(`${done} of ${items.length} done`, `${items.length} में से ${done} पूरे`)}</span>
        </span>
      </div>
      {items.length ? (
        <ol className="h-home__quests-list">
          {items.map((q) => {
            const view = questView(q);
            const words = isHi ? view.hi : view.en;
            const body = (
              <>
                <span className={cx('h-home__tick', q.done && 'h-home__tick--done')} aria-hidden="true">
                  {q.done ? (
                    <Check size={18} strokeWidth={3} />
                  ) : (
                    <span className="h-mono">
                      {Math.min(q.progress, q.target)}/{q.target}
                    </span>
                  )}
                </span>
                <span className="h-home__questtext">
                  <span className="h-home__questlabel">{words}</span>
                  <span className="h-home__questmeta">
                    {q.done ? (
                      <span className="h-home__questdone">{t('Done', 'हो गया')}</span>
                    ) : (
                      <span className="h-sr">
                        {Math.min(q.progress, q.target)} {t('of', 'में से')} {q.target}.
                      </span>
                    )}
                    <span className="h-home__xp h-mono">+{q.xp} XP</span>
                  </span>
                </span>
                {q.done ? null : <ChevronRight aria-hidden="true" size={20} className="h-home__chev" />}
              </>
            );
            return (
              <li key={q.id} className={cx('h-home__quest', q.done && 'h-home__quest--done')}>
                {q.done ? (
                  <div className="h-home__questrow">{body}</div>
                ) : (
                  <a className="h-home__questrow h-home__questrow--link" href={view.to}>
                    {body}
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="h-home__empty">
          {t('Quests arrive with your first answer today.', 'आज के पहले जवाब के साथ काम आएँगे।')}
        </p>
      )}
      <p className="h-meta h-home__questnote">
        {t(
          'Quests are optional. They reset at midnight; nothing is lost.',
          'काम ज़रूरी नहीं हैं। आधी रात को नए आते हैं।',
        )}
      </p>
    </div>
  );
}

// ---- Muqabla strip ---------------------------------------------------------------------------------

function DuelStrip() {
  const { t } = useLang();
  return <div className="h-home__panel h-home__duelstrip">
    <div className="h-home__duelcopy">
      <p className="h-kicker">{t('THE PUBLIC TABLE · HUMAN VS HUMAN', 'सार्वजनिक बैठक · इंसान बनाम इंसान')}</p>
      <h2 className="h-home__headline" id="h-home-duel">{t('Big claims.\nBring receipts.', 'दावे बड़े?\nरसीद लाओ।')}</h2>
      <p className="h-home__standfirst">{t('Same question. Real opponent. Let the facts do the talking.', 'एक सवाल। असली प्रतिद्वंद्वी। अब तथ्य बोलेंगे।')}</p>
      <p className="h-meta">{t('Optional coin stake. Zero coins? Your seat is still open.', 'सिक्के लगाना आपकी मर्ज़ी। शून्य सिक्के? खेलना फिर भी जारी।')}</p>
    </div>
    <div className="h-home__duelacts">
      <Button variant="primary" block href={href.online()} icon={<Scale size={19} />}>{t('Find a duel', 'मुक़ाबला ढूँढ़ो')}</Button>
      <div className="h-home__row">
        <Button variant="paper" size="s" href={href.friend()}>{t('Invite a friend', 'दोस्त को बुलाओ')}</Button>
        <Button variant="ghost" size="s" href={href.pass()}>{t('Two people · one phone', 'दो खिलाड़ी · एक फ़ोन')}</Button>
      </div>
      <a className="h-link" href={href.online('standings', { period: 'savings' })}>{t('UPI tax savings · leaderboard', 'UPI टैक्स बचत · रैंकिंग')} ↗</a>
      <p className="h-meta">{t('Simulated coins. No UPI payment, cash value or withdrawal.', 'खेल के सिक्के। UPI भुगतान, नक़द मूल्य या निकासी नहीं।')}</p>
    </div>
  </div>;
}
