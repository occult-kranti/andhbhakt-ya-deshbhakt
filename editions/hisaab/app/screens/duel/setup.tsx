/**
 * screens/duel/setup.tsx — "Muqabla", the duel setup (bible §11.8).
 *
 * One scroll: Opponent (Babu-Bot · BOT / Friend / Pass & Play) → Format (the engine's real numbers:
 * Quick Draw 1 q · 10 s, Triple Threat best of 3 · 7 s, The Gauntlet 5 q · 5 s) → Topic (Mixed or a
 * sector whose pool holds enough questions for the format; the rest are shown disabled with their
 * real count) → the Babu-rank strip and the rule line. The sticky launch bar holds the screen's one
 * violet button: Start vs Babu-Bot / Create room / Start pass & play. Choices live in the URL query
 * (replace, so Back does not walk through them) — Home links here with `?vs=bot`.
 *
 * Quiet screen (bible §9): no toast, no ceremony, no presence counts.
 */
import { useMemo } from 'react';
import { Bot, KeyRound, Smartphone, Users } from 'lucide-react';
import { P2P_TRUST } from '../../../p2p/protocol.mjs';
import { BABU_RANK_LADDER, babuRank, BOT_LINE, BOT_LINE_HI, BOT_NAME, formatNumber } from '../../data';
import { href, navigate, queryString, type AppRoute } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { useAppPlayer } from '../../shell/player';
import { Button } from '../../ui/button';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { Page, ScreenHeader } from '../../ui/page';
import {
  configFor,
  FORMATS,
  formatLine,
  formatNameHi,
  formatRule,
  parseMode,
  parseOpponent,
  parseTopic,
  poolFits,
  readName,
  sectorName,
  sectorPools,
  startBot,
  startHost,
  totalPool,
  type Opponent,
} from './lib';
import type { DuelMode } from '../room/lib';
import './setup.css';
import '../online/online.css';

type Rank = { points: number; tier: string };

export function DuelSetup({ route }: { route: AppRoute }) {
  const { t, isHi } = useLang();
  const player = useAppPlayer();
  useScreenTitle(t('Muqabla', 'मुक़ाबला'));
  const vs = parseOpponent(route.query.vs);
  const mode = parseMode(route.query.mode);
  const topic = parseTopic(route.query.topic, mode);
  const pools = useMemo(() => sectorPools(), []);
  const total = useMemo(() => totalPool(), []);
  const via = route.query.via === 'tab' ? 'tab' : undefined;

  const set = (next: Partial<{ vs: Opponent; mode: DuelMode; topic: string }>) => {
    const m = next.mode ?? mode;
    const q = { vs: next.vs ?? vs, mode: m, topic: parseTopic(next.topic ?? topic, m), via };
    navigate(
      href.duel(
        Object.fromEntries(Object.entries(q).filter(([, v]) => v && v !== 'all')) as Record<string, string>,
      ),
      { replace: true },
    );
  };

  const launch = () => {
    const config = configFor(mode, topic);
    if (vs === 'bot') {
      startBot(config, readName());
      navigate(href.room());
    } else if (vs === 'friend') {
      startHost(config, readName(), via === 'tab' ? 'tab' : 'net');
      navigate(
        `${href.friend()}${queryString({ host: '1', mode, topic: topic === 'all' ? undefined : topic, via })}`,
      );
    } else {
      navigate(`${href.pass()}${queryString({ mode, topic: topic === 'all' ? undefined : topic })}`);
    }
  };

  const rank = (player.progression as { rank?: Rank } | undefined)?.rank;
  const tierMin = rank ? (BABU_RANK_LADDER.find((x) => x.id === rank.tier)?.min ?? 0) : 0;
  const next = rank ? BABU_RANK_LADDER.find((x) => x.min > rank.points) : null;

  const opponents: { id: Opponent; icon: typeof Bot; name: string; line: string }[] = [
    { id: 'bot', icon: Bot, name: BOT_NAME, line: t(BOT_LINE, BOT_LINE_HI) },
    {
      id: 'friend',
      icon: Users,
      name: t('Friend', 'दोस्त'),
      line: t('Peer-to-peer room code. No server of ours.', 'पीयर-टू-पीयर रूम कोड। हमारा कोई सर्वर नहीं।'),
    },
    {
      id: 'pass',
      icon: Smartphone,
      name: t('Pass & Play', 'पास एंड प्ले'),
      line: t('Two players, one phone, untimed.', 'दो खिलाड़ी, एक फ़ोन, बिना टाइमर।'),
    },
  ];
  const primary =
    vs === 'bot'
      ? t('Start vs Babu-Bot', 'बाबू-बॉट से शुरू करें')
      : vs === 'friend'
        ? t('Create room', 'रूम बनाएँ')
        : t('Start pass & play', 'पास एंड प्ले शुरू करें');
  const topicText = topic === 'all' ? t('Mixed', 'मिला-जुला') : sectorName(topic, isHi);
  const f = FORMATS.find((x) => x.mode === mode)!;

  return (
    <Page screen="duel-setup" className="h-setup">
      <ScreenHeader
        kicker="F.No. M/2026"
        titleHi="मुक़ाबला"
        title="Muqabla"
        lead={
          isHi ? (
            <span lang="hi">मुक़ाबला करो। बाबू-बॉट बिना पढ़े ठप्पा लगाता है।</span>
          ) : (
            'Muqabla karo. Babu-Bot bina padhe stamp lagata hai.'
          )
        }
        aside={
          <a className="h-link h-link--tap h-setup__join" href={href.friend()}>
            <KeyRound aria-hidden="true" size={18} strokeWidth={2.4} />
            {t('Have a code? Join', 'कोड है? जुड़ें')}
          </a>
        }
      />

      <section className="h-online-launch" aria-label={t('Online beta', 'ऑनलाइन बीटा')}>
        <div><p className="h-kicker">{t('THE LIVE EDITION · ONLINE BETA', 'लाइव संस्करण · ऑनलाइन बीटा')}</p><strong>{t('Same question. Real opponent.', 'एक सवाल। असली प्रतिद्वंद्वी।')}</strong><p>{t('Join a public table, invite a friend, or play a tournament. The server records the answers and score.', 'सार्वजनिक बैठक, दोस्त या टूर्नामेंट। जवाब और स्कोर सर्वर दर्ज करेगा।')}</p></div>
        <Button href={href.online()}>{t('Play online', 'ऑनलाइन खेलें')}</Button>
      </section>
      <div className="h-setup__grid">
        <fieldset className="h-setup__group">
          <legend className="h-setup__legend">{t('Opponent', 'सामने कौन')}</legend>
          <div className="h-setup__cards">
            {opponents.map((o) => (
              <label key={o.id} className={cx('h-pickcard', vs === o.id && 'h-pickcard--on')}>
                <input
                  className="h-pickcard__input"
                  type="radio"
                  name="h-vs"
                  value={o.id}
                  checked={vs === o.id}
                  onChange={() => set({ vs: o.id })}
                />
                <o.icon className="h-pickcard__icon" aria-hidden="true" size={24} strokeWidth={2.2} />
                <span className="h-pickcard__text">
                  <span className="h-pickcard__name">{o.name}</span>
                  <span className="h-pickcard__line">{o.line}</span>
                </span>
              </label>
            ))}
          </div>
          {vs === 'friend' ? (
            <p className="h-setup__trust">
              <strong>{t(P2P_TRUST.label, 'दोस्ताना · भरोसे पर')}.</strong>{' '}
              {t(
                P2P_TRUST.body,
                'मैच होस्ट का ब्राउज़र चलाता है और हर ब्राउज़र अपना जवाब-समय ख़ुद बताता है, इसलिए बदला हुआ ब्राउज़र धोखा दे सकता है। दोस्तों के बीच ठीक है। कोई सिक्का नहीं, कोई रैंकिंग नहीं; हर डिवाइस अपना रिकॉर्ड रखता है।',
              )}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="h-setup__group">
          <legend className="h-setup__legend">{t('Format', 'फ़ॉर्मैट')}</legend>
          <div className="h-setup__cards">
            {FORMATS.map((x) => (
              <label
                key={x.mode}
                className={cx('h-pickcard', 'h-pickcard--fmt', mode === x.mode && 'h-pickcard--on')}
              >
                <input
                  className="h-pickcard__input"
                  type="radio"
                  name="h-mode"
                  value={x.mode}
                  checked={mode === x.mode}
                  onChange={() => set({ mode: x.mode as DuelMode })}
                />
                <span className="h-pickcard__text">
                  <span className="h-pickcard__name">
                    {isHi ? <span lang="hi">{formatNameHi(x.mode as DuelMode)}</span> : x.name}
                  </span>
                  <span className="h-pickcard__nums h-mono">
                    {formatLine(x.mode as DuelMode, vs === 'pass', isHi)}
                  </span>
                  <span className="h-pickcard__line">{formatRule(x.mode as DuelMode, isHi)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="h-setup__group h-setup__group--topics">
          <legend className="h-setup__legend">{t('Topic', 'विषय')}</legend>
          <div className="h-setup__chips">
            <label className={cx('h-topicchip', topic === 'all' && 'h-topicchip--on')}>
              <input
                className="h-topicchip__input"
                type="radio"
                name="h-topic"
                value="all"
                checked={topic === 'all'}
                onChange={() => set({ topic: 'all' })}
              />
              <span>{t('Mixed', 'मिला-जुला')}</span>
              <span className="h-topicchip__n h-mono">{formatNumber(total)}</span>
            </label>
            {pools.map((p) => {
              const fits = poolFits(p.count, mode);
              return (
                <label
                  key={p.topic}
                  className={cx(
                    'h-topicchip',
                    topic === p.topic && 'h-topicchip--on',
                    !fits && 'h-topicchip--off',
                  )}
                >
                  <input
                    className="h-topicchip__input"
                    type="radio"
                    name="h-topic"
                    value={p.topic}
                    checked={topic === p.topic}
                    disabled={!fits}
                    onChange={() => set({ topic: p.topic })}
                  />
                  <span lang={isHi ? 'hi' : undefined}>{sectorName(p.topic, isHi)}</span>
                  <span className="h-topicchip__n h-mono">{formatNumber(p.count)}</span>
                  {!fits ? (
                    <span className="h-sr">
                      {t(`Too few questions for ${f.name}`, `${f.name} के लिए सवाल कम हैं`)}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
          <p className="h-setup__hint">
            {t(
              'Numbers are the questions in each file. A sector needs one per round.',
              'संख्या = हर फ़ाइल के सवाल। हर राउंड के लिए एक सवाल चाहिए।',
            )}
          </p>
        </fieldset>
      </div>

      <div className="h-setup__facts">
        {vs !== 'pass' ? (
          <p className="h-setup__rule">
            {t(
              'Faster correct answer wins; within 0.15 s is a tie.',
              'तेज़ सही जवाब जीतता है; 0.15 s के अंदर बराबर।',
            )}
          </p>
        ) : (
          <p className="h-setup__rule">
            {t(
              'Untimed. Both right is a shared round — no point to either.',
              'बिना टाइमर। दोनों सही तो साझा राउंड — किसी को अंक नहीं।',
            )}
          </p>
        )}
        {rank ? (
          <p className="h-setup__rank">
            <span className="h-setup__rankname">
              {t('Babu rank', 'बाबू रैंक')}: <strong>{babuRank(rank.tier)}</strong>
            </span>
            <span className="h-mono">
              {formatNumber(rank.points - tierMin)}
              {next ? `/${formatNumber(next.min - tierMin)}` : ''}
            </span>
            <span className="h-setup__muted">· {t('on this device', 'इसी डिवाइस पर')}</span>
          </p>
        ) : null}
      </div>

      <div className="h-setup__launch">
        <div className="h-setup__launchin">
          <p className="h-setup__summary">
            {opponents.find((o) => o.id === vs)?.name} ·{' '}
            {isHi ? <span lang="hi">{formatNameHi(mode)}</span> : f.name} · {topicText}
          </p>
          <Button variant="primary" onClick={launch} disabled={!player.loaded && vs === 'bot'}>
            {primary}
          </Button>
        </div>
      </div>
    </Page>
  );
}
