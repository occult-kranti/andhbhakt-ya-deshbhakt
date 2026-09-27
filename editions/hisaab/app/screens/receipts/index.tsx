/**
 * screens/receipts/index.tsx — the Receipts Vault (design bible §11.15; notification rules §9).
 *
 * Every receipt the player has collected, newest first: TIJORI header (the true count) → the primary
 * and the status-age note → filters (sector, state, where you played it / which file, status, source
 * type, search) → the list of receipt minis (short stem, mini stamp, source chip, legal chip + as of and
 * the status line itself, "Status older than 6 months"). Tap = the full receipt: a sheet on phones, the
 * detail pane from 900px (filters | list | detail from 1200px).
 *
 * ONE violet primary (bible §11.15): "Re-check N due" runs Dobara Jaanch — the engine's review queue,
 * the only thing called "due" here — when it has cards; else "Open today's file", or "Duel Babu-Bot"
 * once today's file is filed (as Home does). A status older than six months is a neutral note about the
 * bank, never "due". Quiet: the Vault raises no toast or ceremony.
 */
import { useMemo, useState } from 'react';
import { History, RotateCcw, Scale } from 'lucide-react';
import { todaysFive } from '../../../edition';
import { asOfText, formatNumber } from '../../data';
import { href, navigate, type ScreenProps } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { useAppPlayer } from '../../shell/player';
import { sceneCapability, Tijori } from '../../three';
import { Button } from '../../ui/button';
import { Chip, SourceChip } from '../../ui/chip';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { EmptyState, InlineNote, Page, ScreenHeader } from '../../ui/page';
import { Skeleton } from '../../ui/skeleton';
import { Stamp } from '../../ui/stamp';
import { dailyStatus } from '../home/home-data';
import { useMediaQuery } from '../me/lib';
import { Dobara } from './dobara';
import { ReceiptDetail, receiptKicker } from './detail';
import { VaultFilters } from './filters';
import { applyFilters, collectReceipts, filtersFromQuery, filtersToQuery, reviewQueue, STALE_MONTHS, type Filters, type ReceiptRow } from './lib';
import { Sheet } from './sheet';
import './receipts.css';

// Opening a receipt pushes a history entry on phones, so Back closes the sheet; this remembers that
// we did, so Close can pop it instead of stacking another entry.
let pushedOpen = false;

/**
 * The Vault header's tijori (bible §11.15): static 2D art with the true count, and "Open tijori" (a tap,
 * outside the role=img box) for the 3D safe on a capable device — it never loads by itself here.
 */
function VaultTijori({ count, wide }: { count: number; wide: boolean }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const capable = useMemo(() => sceneCapability().ok, []);
  return (
    <div className="h-vhead__tijori">
      {open ? (
        <Tijori count={count} height={wide ? 260 : 240} trigger="mount" />
      ) : (
        <Tijori count={count} height={wide ? 200 : 180} scene={null} />
      )}
      {capable && count > 0 ? (
        <Button variant="paper" size="s" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? t('Close tijori', 'तिजोरी बंद करो') : t('Open tijori', 'तिजोरी खोलो')}
        </Button>
      ) : null}
    </div>
  );
}

function ReceiptMini({ row, selected, onSelect }: { row: ReceiptRow; selected: boolean; onSelect: () => void }) {
  const { t, locale } = useLang();
  return (
    <li className="h-vrow-wrap">
      <button type="button" className={cx('h-vrow', selected && 'h-vrow--on')} aria-current={selected || undefined} onClick={onSelect}>
        <span className="h-vrow__top">
          <span className="h-kicker h-vrow__kicker">{receiptKicker(row)}</span>
          {row.lastCorrect !== null && !row.withdrawn ? (
            <Stamp
              kind={row.lastCorrect ? 'pass' : 'fail'}
              seed={row.id}
              size="s"
              text={row.lastCorrect ? 'WAAH WAAH' : 'GALAT'}
              label={row.lastCorrect ? t('Last answer right', 'पिछला जवाब सही') : t('Last answer missed', 'पिछला जवाब ग़लत')}
              className="h-vrow__stamp"
            />
          ) : null}
        </span>
        {row.withdrawn ? (
          <span className="h-vrow__q h-vrow__q--gone">{t('Withdrawn question', 'हटाया गया सवाल')}</span>
        ) : (
          <span className="h-vrow__q">{row.question}</span>
        )}
        <span className="h-vrow__meta">
          {/* A withdrawn receipt keeps only its file number and the flag: no verdict stamp, no source. */}
          {row.withdrawn ? null : <SourceChip kind={row.sourceKind} />}
          {row.status && row.asOf ? (
            <>
              <Chip kind="legal" icon={<Scale size={12} strokeWidth={2.6} />}>
                {t('Legal status', 'क़ानूनी स्थिति')} · {asOfText(row.asOf, locale)}
              </Chip>
              {/* Charter §2.2: the STATUS row travels verbatim with its as-of — the whole line, wrapping,
                  never clipped (the shared legal-line type from ui/chip.css). */}
              <span className="h-vrow__status h-legal__line" lang="en">
                {row.status}
              </span>
            </>
          ) : null}
          {row.stale ? (
            <span className="h-vrow__flag">
              <History size={14} strokeWidth={2.6} aria-hidden="true" />
              {t(`Status older than ${STALE_MONTHS} months`, `${STALE_MONTHS} महीने से पुरानी स्थिति`)}
            </span>
          ) : null}
          {row.updated ? <span className="h-vrow__flag">{t('Updated', 'बदली')}</span> : null}
          {row.withdrawn ? <span className="h-vrow__flag">{t('Withdrawn', 'हटाई गई')}</span> : null}
        </span>
      </button>
    </li>
  );
}

export default function ReceiptsScreen({ route }: ScreenProps) {
  const player = useAppPlayer();
  const { t } = useLang();
  const wide = useMediaQuery('(min-width: 900px)');
  const [dobara, setDobara] = useState<readonly string[] | null>(null);
  useScreenTitle(t('Receipts', 'रसीदें'));

  const journal = player.journal;
  const rows = useMemo(() => collectReceipts(journal), [journal]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const filters = filtersFromQuery(route.query);
  const shown = useMemo(() => applyFilters(rows, filters), [rows, filters.q, filters.sector, filters.state, filters.mode, filters.status, filters.src]); // eslint-disable-line react-hooks/exhaustive-deps
  const aged = rows.filter((r) => r.stale).length;
  const queue = useMemo(() => reviewQueue(journal, rows), [journal, rows]);
  // Receipts first filed today wait for tomorrow's re-check (reviewQueue): say so when the queue is empty.
  const newToday = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return rows.some((r) => (r.firstAt ?? 0) >= start);
  }, [rows]);
  // Today's file, read the way Home reads it, so the fallback primary matches Home's.
  const todayFiled = useMemo(() => {
    const daily = todaysFive();
    return dailyStatus(journal, daily.day, daily.cards.length).done;
  }, [journal]);
  const selectedId = route.query.id ?? null;
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  if (!player.loaded) {
    return (
      <Page screen="receipts">
        <Skeleton lines={8} label={t('Opening the vault', 'तिजोरी खुल रही है')} />
      </Page>
    );
  }

  const setFilters = (next: Filters) => {
    navigate(href.receipts(filtersToQuery(next, { id: wide ? (selectedId ?? undefined) : undefined })), { replace: true });
  };
  const open = (id: string) => {
    // The engine logs the first open of each receipt (Stamp Register: "Reads the noting").
    void player.dispatch({ type: 'open', factId: id });
    const target = href.receipts(filtersToQuery(filters, { id }));
    if (wide || selectedId) navigate(target, { replace: true });
    else {
      pushedOpen = true;
      navigate(target);
    }
  };
  const close = () => {
    if (pushedOpen) {
      pushedOpen = false;
      history.back();
    } else navigate(href.receipts(filtersToQuery(filters)), { replace: true });
  };

  const header = (
    <div className="h-vhead">
      <ScreenHeader
        kicker={`F.No. V/${formatNumber(rows.length)} · ${t('On this device', 'इसी फ़ोन पर')}`}
        titleHi="रसीदें"
        title="Receipts Vault"
        lead={t('Every answer files a receipt here — with its source and its status, dated.', 'हर जवाब की रसीद यहाँ — स्रोत और तारीख़ वाली स्थिति के साथ।')}
      />
      <VaultTijori count={rows.length} wide={wide} />
    </div>
  );

  if (!rows.length) {
    return (
      <Page screen="receipts" className="h-vault">
        {header}
        <EmptyState
          line={t('No receipts yet. Every answer files one here.', 'अभी कोई रसीद नहीं। हर जवाब की रसीद यहाँ आती है।')}
          action={
            <Button variant="primary" href={href.aaj()}>
              {t("Open today's file", 'आज की फ़ाइल खोलो')}
            </Button>
          }
        />
      </Page>
    );
  }

  const detailRow = selected ?? (wide ? (shown[0] ?? null) : null);

  return (
    <Page screen="receipts" className="h-vault">
      {header}

      <div className="h-vactions">
        <div className="h-vactions__row">
          {queue.length ? (
            <Button variant="primary" icon={<RotateCcw size={20} strokeWidth={2.4} />} onClick={() => setDobara([...queue])}>
              {t(`Re-check ${queue.length} due`, `${queue.length} दोबारा जाँचो`)}
            </Button>
          ) : todayFiled ? (
            <Button variant="primary" href={href.online()}>
              {t('Find a human duel', 'किसी खिलाड़ी से मुक़ाबला')}
            </Button>
          ) : (
            <Button variant="primary" href={href.aaj()}>
              {t("Open today's file", 'आज की फ़ाइल खोलो')}
            </Button>
          )}
        </div>
        <p className="h-vactions__fine">
          {queue.length
            ? t(
                'Dobara Jaanch: the cards your memory is due to see again today, untimed. Misses come back sooner.',
                'दोबारा जाँच: आज दोबारा देखने लायक़ कार्ड, बिना टाइमर। छूटे हुए जल्दी लौटते हैं।',
              )
            : newToday
              ? t(
                  'Nothing due for Dobara Jaanch yet. Today’s new receipts come back for a re-check from tomorrow.',
                  'दोबारा जाँच के लिए अभी कुछ नहीं। आज की नई रसीदें कल से दोबारा जाँच में लौटेंगी।',
                )
              : t('Nothing due for Dobara Jaanch today. Cards come back as your memory needs them.', 'आज दोबारा जाँच के लिए कुछ नहीं। कार्ड ज़रूरत के हिसाब से लौटते हैं।')}
        </p>
        {aged > 0 ? (
          <p className="h-vaged" role="note">
            <History size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>
              <strong>
                {formatNumber(aged)} {aged === 1 ? t('receipt', 'रसीद') : t('receipts', 'रसीदें')}: {t(`status older than ${STALE_MONTHS} months`, `${STALE_MONTHS} महीने से पुरानी स्थिति`)}
              </strong>{' '}
              —{' '}
              {t(
                'last verified before then. Open the source and tell us if a case has moved on.',
                'स्रोत खोलें, मामला आगे बढ़ा हो तो बताएँ।',
              )}
            </span>
          </p>
        ) : (
          <p className="h-vaged h-vaged--ok">
            {t(`Every status here was verified in the last ${STALE_MONTHS} months.`, `यहाँ हर स्थिति पिछले ${STALE_MONTHS} महीनों में जाँची गई।`)}
          </p>
        )}
      </div>

      <div className={cx('h-vgrid', wide && 'h-vgrid--wide')}>
        <aside className="h-vgrid__filters" aria-label={t('Filters', 'फ़िल्टर')}>
          <VaultFilters rows={rows} value={filters} onChange={setFilters} open={wide} shown={shown.length} />
        </aside>
        <section className="h-vgrid__list" aria-label={t('Your receipts', 'आपकी रसीदें')}>
          {shown.length ? (
            <ol className="h-vlist">
              {shown.map((row) => (
                <ReceiptMini key={row.id} row={row} selected={!!detailRow && detailRow.id === row.id && wide} onSelect={() => open(row.id)} />
              ))}
            </ol>
          ) : (
            <EmptyState
              line={
                filters.status === 'due'
                  ? t(`No status here is older than ${STALE_MONTHS} months.`, `यहाँ कोई स्थिति ${STALE_MONTHS} महीने से पुरानी नहीं।`)
                  : t('No receipt matches these filters.', 'इन फ़िल्टरों से कोई रसीद नहीं मिली।')
              }
              action={
                <Button variant="paper" size="s" onClick={() => setFilters({ q: '', sector: '', state: '', mode: '', status: '', src: '' })}>
                  {t('Clear filters', 'फ़िल्टर हटाओ')}
                </Button>
              }
            />
          )}
        </section>
        {wide ? (
          <section className="h-vgrid__detail" aria-label={t('Receipt', 'रसीद')}>
            {detailRow ? (
              <ReceiptDetail key={detailRow.id} row={detailRow} headingLevel={2} />
            ) : (
              <InlineNote>{t('Pick a receipt to read it in full.', 'पूरी पढ़ने के लिए कोई रसीद चुनो।')}</InlineNote>
            )}
          </section>
        ) : null}
      </div>

      {!wide ? (
        <Sheet open={!!selected} onClose={close} title={t('Receipt', 'रसीद')} kicker={t('Receipts Vault', 'रसीदों की तिजोरी')} visitKey="receipt-sheet">
          {selected ? <ReceiptDetail row={selected} /> : null}
        </Sheet>
      ) : null}

      <Sheet
        open={!!dobara}
        onClose={() => setDobara(null)}
        title={t('Dobara Jaanch', 'दोबारा जाँच')}
        kicker={t('Untimed · first answer locks', 'बिना टाइमर · पहला जवाब लॉक')}
        visitKey="dobara"
        className="h-vsheet--play"
      >
        {dobara ? <Dobara queue={dobara} rows={byId} onDone={() => setDobara(null)} /> : null}
      </Sheet>
    </Page>
  );
}
