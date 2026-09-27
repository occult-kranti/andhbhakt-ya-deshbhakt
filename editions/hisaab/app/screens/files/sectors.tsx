/**
 * screens/files/sectors.tsx — Sector Files (bible §11.4): 13 manila files in a cabinet, one per sector
 * (Media & Speech is Kiska Media?'s press file). Phone: the files stack and a tap expands the brief
 * inline under that file — the next unfinished one starts expanded. ≥ 900px: a cabinet grid with a
 * sticky side brief. The brief holds the ONE primary action, Open file (→ #/route/:id).
 */
import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Banknote,
  Briefcase,
  Building2,
  Coins,
  Construction,
  GraduationCap,
  HeartPulse,
  Mountain,
  Newspaper,
  Shield,
  Tractor,
  Vote,
  Zap,
} from 'lucide-react';
import { useJuice } from '@/components/fx';
import { routesOfKind, type Route } from '../../../edition';
import { SECTOR_LIST, SECTOR_NAMES_HI, BANK_ITEMS } from '../../data';
import { href, Link, navigate, type AppRoute } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { Button } from '../../ui/button';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { Meter } from '../../ui/meter';
import { Page, ScreenHeader } from '../../ui/page';
import { Skeleton } from '../../ui/skeleton';
import { bestText, CARDS, fileNo, fileStatus, nextUnfinished, openWords, revealIfHidden, statusWords, useMedia, usePlayerFiles, type FileStatus } from './lib';
import { FileCover } from './cover';
import { FilesTabs } from './tabs';
import '../../ui/file-card.css';
import './sectors.css';

const MEDIA = 'Media & Speech';

const ICONS: Readonly<Record<string, ReactNode>> = {
  'Welfare & Subsidies': <Coins size={24} strokeWidth={2.2} />,
  'Farm & Food': <Tractor size={24} strokeWidth={2.2} />,
  Health: <HeartPulse size={24} strokeWidth={2.2} />,
  'Education & Exams': <GraduationCap size={24} strokeWidth={2.2} />,
  Infrastructure: <Construction size={24} strokeWidth={2.2} />,
  'Banking & Finance': <Banknote size={24} strokeWidth={2.2} />,
  'Energy & Mining': <Zap size={24} strokeWidth={2.2} />,
  'Defence & Security': <Shield size={24} strokeWidth={2.2} />,
  'Elections & Funding': <Vote size={24} strokeWidth={2.2} />,
  'Media & Speech': <Newspaper size={24} strokeWidth={2.2} />,
  'Governance & Institutions': <Building2 size={24} strokeWidth={2.2} />,
  'Jobs & Economy': <Briefcase size={24} strokeWidth={2.2} />,
  'Environment & Land': <Mountain size={24} strokeWidth={2.2} />,
};

/** The same lines in Devanagari for the Hindi locale (draft — a Hindi reader reviews). */
const QUIPS_HI: Readonly<Record<string, string>> = {
  'Welfare & Subsidies': 'किसको मिला, कितना मिला।',
  'Farm & Food': 'खेत से थाली तक, हिसाब किसका।',
  Health: 'इलाज का बिल, भरा किसने।',
  'Education & Exams': 'पेपर से रिज़ल्ट तक, फ़ाइल कहाँ।',
  Infrastructure: 'पुल, सड़क, और उनका बिल।',
  'Banking & Finance': 'लोन लिया किसने, चुकाया किसने।',
  'Energy & Mining': 'कोयला, बिजली, और आवंटन।',
  'Defence & Security': 'सौदा किसका, फ़ाइल कहाँ।',
  'Elections & Funding': 'चंदा आया कहाँ से।',
  'Media & Speech': 'चैनल किसका, पैसा किसका।',
  'Governance & Institutions': 'फ़ाइल किसने रोकी, किसने चलाई।',
  'Jobs & Economy': 'नौकरी के आँकड़े, किसके पास।',
  'Environment & Land': 'ज़मीन किसकी, जंगल किसका।',
};

/** One deadpan Hinglish line per sector (Latin script). Questions, never accusations. */
const QUIPS: Readonly<Record<string, string>> = {
  'Welfare & Subsidies': 'Kisko mila, kitna mila.',
  'Farm & Food': 'Khet se thali tak, hisaab kiska.',
  Health: 'Ilaaj ka bill, bhara kisne.',
  'Education & Exams': 'Paper se result tak, file kahan.',
  Infrastructure: 'Pul, sadak, aur unka bill.',
  'Banking & Finance': 'Loan liya kisne, chukaya kisne.',
  'Energy & Mining': 'Koyla, bijli, aur allocation.',
  'Defence & Security': 'Sauda kiska, file kahan.',
  'Elections & Funding': 'Chanda aaya kahan se.',
  'Media & Speech': 'Channel kiska, paisa kiska.',
  'Governance & Institutions': 'File kisne roki, kisne chalayi.',
  'Jobs & Economy': 'Naukri ke aankde, kiske paas.',
  'Environment & Land': 'Zameen kiski, jungle kiska.',
};

const slugOf = (sector: string) =>
  sector
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

type Folder = { sector: string; slug: string; route: Route | null; status: FileStatus; pool: number };

export function SectorsView({ route }: { route: AppRoute }) {
  const { t } = useLang();
  useScreenTitle('Sector Files');
  const juice = useJuice();
  const { journeys, loaded } = usePlayerFiles();
  const wide = useMedia('(min-width: 900px)');
  const sideRef = useRef<HTMLElement>(null);

  const folders = useMemo<Folder[]>(() => {
    const bySector = new Map(routesOfKind('sector').map((r) => [r.sector ?? r.topic, r]));
    const kiska = routesOfKind('media')[0] ?? null;
    return SECTOR_LIST.map((sector) => {
      const r = sector === MEDIA ? kiska : (bySector.get(sector) ?? null);
      return {
        sector,
        slug: slugOf(sector),
        route: r,
        status: fileStatus(r, journeys),
        pool: BANK_ITEMS.filter((q) => q.topic === sector).length,
      };
    });
  }, [journeys]);

  const fallback = useMemo(() => {
    const next = nextUnfinished(
      folders.flatMap((f) => (f.route ? [f.route] : [])),
      journeys,
    );
    return folders.find((f) => f.route && f.route === next)?.slug ?? folders[0]?.slug;
  }, [folders, journeys]);
  const [closed, setClosed] = useState(false);
  const asked = route.query.f;
  const selected = folders.find((f) => f.slug === asked)?.slug ?? fallback;
  const current = folders.find((f) => f.slug === selected) ?? null;
  const cleared = folders.filter((f) => f.status.state === 'cleared').length;

  const choose = (slug: string) => {
    juice.sound('tap');
    juice.haptic('light');
    if (!wide && slug === selected && !closed) {
      setClosed(true);
      return;
    }
    setClosed(false);
    navigate(href.files('sectors', { f: slug }), { replace: true });
    if (wide) return;
    requestAnimationFrame(() => revealIfHidden(document.getElementById(`h-sect-${slug}`)));
  };

  return (
    <Page screen="files-sectors" className="h-sect">
      <FilesTabs current="sectors" />
      <ScreenHeader
        kicker={`F.No. X/ALL · ${folders.length} ${t('files', 'फ़ाइलें')}`}
        titleHi="सेक्टर फ़ाइलें"
        title="Sector Files"
        lead={t('One file per sector, from the Centre and the states. Six cards each.', 'हर सेक्टर की एक फ़ाइल — केंद्र और राज्यों से। हर फ़ाइल में छह कार्ड।')}
      />
      <p className="h-sect__tally">
        {cleared ? (
          <>
            <span className="h-mono">
              {cleared}/{folders.length}
            </span>{' '}
            {t('files cleared', 'फ़ाइलें क्लियर')}
          </>
        ) : (
          t('Koi file clear nahi. Abhi tak.', 'कोई फ़ाइल क्लियर नहीं। अभी तक।')
        )}
      </p>

      <div className="h-sect__layout">
        <ul className="h-sect__cabinet" aria-label={t('Sector files', 'सेक्टर फ़ाइलें')}>
          {folders.map((f) => {
            const isSel = f.slug === selected;
            const expanded = !wide && isSel && !closed;
            return (
              <li key={f.slug} className={cx('h-sect__slot', expanded && 'h-sect__slot--open')} id={`h-sect-${f.slug}`}>
                {f.route ? (
                  <FolderButton folder={f} selected={isSel} expanded={expanded} wide={wide} onChoose={() => choose(f.slug)} />
                ) : (
                  <div className="h-typing">
                    <span className="h-typing__k">F.No. X/{f.slug.toUpperCase().slice(0, 8)}</span>
                    <span className="h-typing__t">{f.sector}</span>
                    <span>
                      {t(
                        'This practice file is being prepared.',
                        'यह अभ्यास फ़ाइल तैयार हो रही है।',
                      )}
                    </span>
                  </div>
                )}
                {expanded && f.route ? <SectorBrief folder={f} loaded={loaded} inline /> : null}
              </li>
            );
          })}
        </ul>
        {wide ? (
          <aside className="h-sect__side" ref={sideRef}>
            {current?.route ? <SectorBrief folder={current} loaded={loaded} /> : null}
          </aside>
        ) : null}
      </div>
    </Page>
  );
}

function FolderButton({ folder, selected, expanded, wide, onChoose }: { folder: Folder; selected: boolean; expanded: boolean; wide: boolean; onChoose: () => void }) {
  const { t, isHi } = useLang();
  const { route: r, status, sector } = folder;
  if (!r) return null;
  const isMedia = sector === MEDIA;
  return (
    <FileCover
      className="h-sect__file"
      fno={fileNo(r)}
      icon={ICONS[sector]}
      titleHi={SECTOR_NAMES_HI[sector]}
      title={isMedia ? (isHi ? 'किसका मीडिया?' : 'Kiska Media?') : sector}
      meta={`${isMedia ? `${t('Media & Speech', 'मीडिया और अभिव्यक्ति')} · ` : ''}${CARDS} ${t('cards', 'कार्ड')}${status.best ? ` · ${bestText(status.best)}` : ''}`}
      state={status.state === 'progress' ? 'open' : status.state}
      seed={r.id}
      progress={status.running ? { value: status.done, max: CARDS, ticks: CARDS, label: t(`${status.done} of ${CARDS} answered`, `${status.done}/${CARDS} जवाब`) } : undefined}
      expanded={wide ? undefined : expanded}
      pressed={wide ? selected : undefined}
      controls={wide ? 'h-sect-brief' : undefined}
      onClick={onChoose}
    />
  );
}

function SectorBrief({ folder, loaded, inline }: { folder: Folder; loaded: boolean; inline?: boolean }) {
  const { t, isHi } = useLang();
  const headId = useId();
  const { route: r, status, sector } = folder;
  if (!r) return null;
  if (!loaded) return <Skeleton lines={4} label={t('Opening the file', 'फ़ाइल खुल रही है')} />;
  const isMedia = sector === MEDIA;
  return (
    <section
      id={inline ? undefined : 'h-sect-brief'}
      className={cx('h-sect__brief', inline && 'h-sect__brief--inline')}
      aria-labelledby={headId}
    >
      <p className="h-kicker">{t('File brief', 'फ़ाइल का ब्योरा')}</p>
      <h2 className="h-sect__brieftitle" id={headId}>
        {isHi && SECTOR_NAMES_HI[sector] ? <span lang="hi">{SECTOR_NAMES_HI[sector]}</span> : isMedia ? 'Kiska Media?' : sector}
      </h2>
      <p className="h-quip">
        {isHi ? (
          <span lang="hi">
            {isMedia ? 'किसका मीडिया?' : (SECTOR_NAMES_HI[sector] ?? sector)}: {QUIPS_HI[sector]}
          </span>
        ) : (
          <>
            {isMedia ? 'Kiska Media?' : sector}: {QUIPS[sector]}
          </>
        )}
      </p>
      <p className="h-sect__status">{statusWords(status, t)}</p>
      {status.running ? (
        <Meter value={status.done} max={CARDS} ticks={CARDS} label={t('Cards answered', 'जवाब दिए कार्ड')} valueText={`${status.done} of ${CARDS} answered`} />
      ) : null}
      <dl className="h-sect__facts">
        <div>
          <dt>{t('Cards', 'कार्ड')}</dt>
          <dd>
            {CARDS} {t('cards', 'कार्ड')}
          </dd>
        </div>
        <div>
          <dt>{t('Chapters', 'अध्याय')}</dt>
          <dd>{r.chapters.join(' → ')}</dd>
        </div>
        {status.best ? (
          <div>
            <dt>{t('Best', 'सर्वश्रेष्ठ')}</dt>
            <dd className="h-mono">{bestText(status.best).replace(/^Best /, '')}</dd>
          </div>
        ) : null}
      </dl>
      <Button variant="primary" block href={href.online('play', { file: isMedia ? 'media' : sector === 'Welfare & Subsidies' ? 'subsidies' : 'all' })}>{t('Find a human duel', 'इंसानी मुक़ाबला ढूँढ़ो')}</Button>
      <Button variant="paper" block href={href.route(r.id)}>
        {isMedia && !status.running && status.state !== 'cleared' ? t('Practice the press file', 'प्रेस फ़ाइल का अभ्यास') : openWords(status, t)}
      </Button>
      {isMedia ? (
        <Link to={href.files('media')} className="h-link h-link--tap">
          {t('Who owns what: the Kiska Media? room', 'किसका मीडिया? — कौन किसका मालिक')}
        </Link>
      ) : null}
    </section>
  );
}
