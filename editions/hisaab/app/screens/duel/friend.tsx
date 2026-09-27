/**
 * screens/duel/friend.tsx — Duel a Friend: the P2P lobby (bible §11.9) and the match it hands over to.
 *
 * No server of ours. The host's browser runs the real duel service; the guest sends ordinary duel
 * requests over a transport (ENGINE §12). Default transport: WebRTC via trystero (public Nostr relays
 * for the handshake, then a direct data channel). `?via=tab` switches both sides to the same-device
 * BroadcastChannel transport — two tabs of this site — which is how this lane tests the flow, since a
 * WebRTC pair cannot be formed in the test sandbox.
 *
 *   #/duel/friend                   join form (code + optional name), or "Host a room"
 *   #/duel/friend?code=ABCD-EFGH    the invite link: join form pre-filled
 *   #/duel/friend?host=1&mode=…     the setup's "Create room" (taken once from a one-shot intent)
 *
 * The lobby shows only real peer state: Waiting… / Connecting directly… / Connected · peer-to-peer /
 * Ready (from the transport's peer events, the protocol hello and the room's seats). Once both seats
 * are ready the shared Arena runs the match (`useDuel(session.request)` in a component keyed by the
 * session, ENGINE §12) and files it with `useRecordRoom`. A rematch is a tap on both phones: each
 * derives the same next room code from the first, so nothing else has to be exchanged.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy, Link2, MessageCircle, Share2, Wifi, WifiOff } from 'lucide-react';
import * as p2p from '../../../p2p/index.mjs';
import { getCircleStore } from '../../../circles/store.mjs';
import type { Circle } from '../../../circles/types';
import { useDuel } from '../../use-duel';
import { ANONYMOUS, BOT_NAME, seatName } from '../../data';
import { absoluteUrl, href, navigate, type AppRoute } from '../../router';
import { inviteText, shareInvite, shareText, whatsappUrl, type ShareOutcome } from '../../share';
import { useChrome, useScreenTitle } from '../../shell/chrome';
import { useAppPlayer, useRecordRoom } from '../../shell/player';
import { Button } from '../../ui/button';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { InlineNote, Page, ScreenHeader } from '../../ui/page';
import { Skeleton } from '../../ui/skeleton';
import { Arena, ConfirmLeave } from '../room/arena';
import { baselineOf, type Baseline } from '../room/result';
import { other, type Room } from '../room/lib';
import {
  configFor,
  FORMATS,
  formatLine,
  formatNameHi,
  formatOf,
  NAME_LIMIT,
  p2pErrorText,
  parseMode,
  parseTopic,
  readName,
  saveName,
  seatNameFor,
  sectorName,
  takeHostIntent,
  type DuelConfig,
  type P2PError,
} from './lib';
import type { DuelMode } from '../room/lib';
import './friend.css';

type Transport = {
  kind: string;
  send(message: unknown): void;
  onMessage(fn: (message: { t?: string; n?: number }) => void): () => void;
  onPeer(fn: (event: 'join' | 'leave') => void): () => void;
  close(): Promise<void> | void;
};
type Host = ReturnType<typeof p2p.createP2PHost>;
type Guest = ReturnType<typeof p2p.createP2PGuest>;
type Via = 'net' | 'tab';
type Session = {
  circleId?: string;
  role: 'host' | 'guest';
  /** This room's code (a rematch derives a new one from `first`). */
  code: string;
  /** The code the players shared. */
  first: string;
  n: number;
  api: Host | Guest;
  created: { room: Room };
  config: DuelConfig;
  /** A rematch: the tap that opened this room is also the "ready". */
  auto: boolean;
};
type Peer = 'none' | 'joined' | 'left';
type Stage = 'form' | 'opening' | 'joining' | 'session' | 'failed';

/** Our own lobby message (the protocol ignores unknown types): "I tapped Rematch n". */
const REMATCH = 'hd-rematch';

const timeoutFor = (via: Via) => (via === 'tab' ? 8000 : 15000);

async function openTransport(code: string, via: Via): Promise<Transport> {
  if (via === 'tab') return p2p.createBroadcastTransport(code) as Transport;
  return (await p2p.createTrysteroTransport(code)) as Transport;
}

async function closeTransport(transport: Transport) {
  try {
    await transport.close();
  } catch {
    /* already closed */
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The invite link for a code; test links (two tabs) carry `via=tab`. */
function inviteLink(code: string, via: Via, circleId?: string) {
  return absoluteUrl(`${href.friend(code)}${via === 'tab' ? '&via=tab' : ''}${circleId ? `&circle=${circleId}` : ''}`);
}

export function FriendLobby({ route }: { route: AppRoute }) {
  const { t, isHi } = useLang();
  const player = useAppPlayer();
  useScreenTitle(t('Duel a friend', 'दोस्त से मुक़ाबला'));
  const [intent] = useState(() => takeHostIntent());
  const [circle] = useState(() => (getCircleStore().getSnapshot().circles as Circle[]).find(c => c.id === route.query.circle));
  const via: Via = intent?.via ?? (route.query.via === 'tab' ? 'tab' : 'net');
  const [tab, setTab] = useState<'join' | 'host'>(
    intent || (route.query.host === '1' && !route.query.code) ? 'host' : 'join',
  );
  const [mode, setMode] = useState<DuelMode>(intent?.config.mode ?? parseMode(route.query.mode));
  const topic = intent?.config.topic ?? parseTopic(route.query.topic, mode);
  const [name, setName] = useState(() => circle?.nickname ?? intent?.name ?? readName());
  const [codeText, setCodeText] = useState(route.query.code ?? '');
  const [stage, setStage] = useState<Stage>(intent ? 'opening' : 'form');
  const [error, setError] = useState<P2PError>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [peer, setPeer] = useState<Peer>('none');
  const [hello, setHello] = useState(false);
  const [offer, setOffer] = useState(0);
  const [rematching, setRematching] = useState(false);
  const link = useRef<{ transport: Transport; shared: Transport; offs: (() => void)[] } | null>(null);
  const current = useRef<Session | null>(null);
  const alive = useRef(true);
  current.current = session;

  const closeAll = useCallback(async () => {
    const s = current.current;
    current.current = null;
    const l = link.current;
    link.current = null;
    try {
      await s?.api.close();
    } catch {
      /* already closed */
    }
    if (l) {
      for (const off of l.offs) off();
      try {
        await l.transport.close();
      } catch {
        /* already closed */
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      void closeAll();
    };
  }, [closeAll]);

  /** One real transport per lobby; sessions (and rematches) share it without closing it. */
  const attach = (transport: Transport) => {
    const offs = [
      transport.onPeer((e) => {
        if (!alive.current) return;
        setPeer(e === 'join' ? 'joined' : 'left');
        if (e === 'join') setHello(false);
      }),
      transport.onMessage((m) => {
        if (!alive.current || !m || typeof m !== 'object') return;
        if (m.t === 'hello') setHello(true);
        if (m.t === REMATCH && typeof m.n === 'number') setOffer(m.n);
      }),
    ];
    const shared: Transport = { ...transport, close: () => {} };
    link.current = { transport, shared, offs };
    return shared;
  };

  const host = useCallback(
    async (config: DuelConfig, who: string) => {
      setStage('opening');
      setError(null);
      try {
        const code = p2p.makeRoomCode();
        const transport = await openTransport(code, via);
        // Left while the room was opening: the unmount's closeAll() has already run and could not see
        // this transport, so close it here or it keeps announcing the code on the relays.
        if (!alive.current) return void (await closeTransport(transport));
        const shared = attach(transport);
        const api = p2p.createP2PHost({ transport: shared, code, name: seatNameFor(who), config });
        const created = (await api.start()) as { room: Room };
        if (!alive.current) {
          // `api.close()` only closes the shared wrapper (a no-op); closeAll() closes the real one.
          await Promise.resolve(api.close()).catch(() => {});
          return void (await closeAll());
        }
        setSession({ role: 'host', code, first: code, n: 0, api, created, config, auto: false, circleId: circle?.id });
        setStage('session');
      } catch (e) {
        await closeAll();
        setError({ code: 'p2p_unavailable', message: (e as Error)?.message });
        setStage('failed');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [via, closeAll],
  );

  // The setup's "Create room" tap: open the room once the profile has loaded.
  const opened = useRef(false);
  useEffect(() => {
    if (!intent || opened.current || !player.loaded) return;
    opened.current = true;
    void host(intent.config, intent.name);
  }, [intent, player.loaded, host]);

  const join = async () => {
    const code = p2p.normalizeCode(codeText);
    if (!code) {
      setError({ code: 'invalid_code' });
      return;
    }
    if (name.trim() && !circle) saveName(name);
    setStage('joining');
    setError(null);
    try {
      const transport = await openTransport(code, via);
      // Left while connecting: close the transport the unmount could not see (see host()).
      if (!alive.current) return void (await closeTransport(transport));
      const shared = attach(transport);
      const api = p2p.createP2PGuest({
        transport: shared,
        code,
        name: seatNameFor(name),
        timeoutMs: timeoutFor(via),
      });
      const created = (await api.join()) as { room: Room };
      if (!alive.current) {
        // We took seat 1 after the player had left: give it back (best effort, briefly — the host
        // also sees the transport leave), then close the real transport, not the shared wrapper.
        await Promise.race([api.request({ action: 'leave' }).catch(() => {}), wait(1500)]);
        await Promise.resolve(api.close()).catch(() => {});
        return void (await closeAll());
      }
      setSession({
        role: 'guest',
        code,
        first: code,
        n: 0,
        api,
        created,
        config: created.room.config as DuelConfig,
        auto: false,
        circleId: circle?.id,
      });
      setStage('session');
    } catch (e) {
      await closeAll();
      setError(e as P2PError);
      setStage('failed');
    }
  };

  const createFromForm = () => {
    if (name.trim() && !circle) saveName(name);
    void host(configFor(mode, topic), name);
  };

  const leave = async () => {
    await closeAll();
    navigate(circle ? href.circles(circle.id) : href.duel({ vs: 'friend' }));
  };

  /** Rematch n+1: tell the other side, then open (host) or join (guest) the next derived room. */
  const rematch = async () => {
    const s = current.current;
    const l = link.current;
    if (!s || !l || rematching) return;
    setRematching(true);
    setError(null);
    const n = s.n + 1;
    l.transport.send({ t: REMATCH, n });
    try {
      // Derived from the first room's stretched secret, not its short code (protocol.mjs).
      const code = await p2p.rematchCode(s.first, n);
      await s.api.close(); // detaches its listeners; the shared transport stays open
      if (s.role === 'host') {
        const api = p2p.createP2PHost({
          transport: l.shared,
          code,
          name: seatNameFor(name),
          config: s.config,
        });
        const created = (await api.start()) as { room: Room };
        if (!alive.current) return void api.close();
        setSession({ ...s, code, n, api, created, auto: true });
      } else {
        // The host opens the next room when they tap too; keep asking for up to a minute.
        let lastError: unknown = null;
        for (let i = 0; i < 6 && alive.current; i += 1) {
          const api = p2p.createP2PGuest({
            transport: l.shared,
            code,
            name: seatNameFor(name),
            timeoutMs: 10000,
          });
          try {
            const created = (await api.join()) as { room: Room };
            if (!alive.current) return void api.close();
            setSession({
              ...s,
              code,
              n,
              api,
              created,
              config: created.room.config as DuelConfig,
              auto: true,
            });
            lastError = null;
            break;
          } catch (e) {
            lastError = e;
            await api.close();
            if ((e as { code?: string })?.code !== 'p2p_timeout') break;
          }
        }
        if (lastError) throw lastError;
      }
    } catch (e) {
      setError(e as P2PError);
    } finally {
      if (alive.current) setRematching(false);
    }
  };

  if (stage === 'session' && session)
    return (
      <FriendMatch
        key={session.code}
        session={session}
        via={via}
        peer={peer}
        hello={hello}
        myName={name}
        offer={offer > session.n ? offer : 0}
        rematching={rematching}
        rematchError={error}
        onRematch={() => void rematch()}
        onLeave={() => void leave()}
      />
    );

  const f = formatOf(mode);
  return (
    <Page screen="duel-friend" width="read" className="h-friend">
      {circle && <Button variant="ghost" href={href.circles(circle.id)}>{t('Back to circle', 'मंडली में वापस')}</Button>}
      <ScreenHeader
        kicker="F.No. P2P/—"
        titleHi="दोस्त से मुक़ाबला"
        title={t('Duel a friend', 'Duel a friend')}
        lead={
          isHi ? (
            <span lang="hi">कोड भेजो, दोस्त बुलाओ। सीधा कनेक्शन — हमारे पास कुछ नहीं जाता।</span>
          ) : (
            'Code bhejo, dost bulao. Direct connection — hamare paas kuch nahi jaata.'
          )
        }
      />

      {circle && <InlineNote>{t(`Playing from ${circle.name} as ${circle.nickname}. Your profile name is unchanged.`, `${circle.name} में ${circle.nickname} के नाम से खेल रहे हैं। प्रोफ़ाइल नाम नहीं बदलेगा।`)}</InlineNote>}

      {stage === 'opening' || stage === 'joining' ? (
        <div className="h-friend__card" aria-busy="true">
          <LobbyChrome />
          <Skeleton
            lines={3}
            label={
              stage === 'opening'
                ? t('Opening a room…', 'रूम खुल रहा है…')
                : t('Connecting directly…', 'सीधे जुड़ रहे हैं…')
            }
          />
          <p className="h-friend__muted" role="status">
            {stage === 'opening'
              ? t('Opening a room on this phone…', 'इस फ़ोन पर रूम खुल रहा है…')
              : t('Connecting directly to your friend’s browser…', 'दोस्त के ब्राउज़र से सीधे जुड़ रहे हैं…')}
          </p>
        </div>
      ) : stage === 'failed' ? (
        <div className="h-friend__card h-friend__card--fail" role="alert">
          <p className="h-friend__failhead">
            <WifiOff aria-hidden="true" size={20} strokeWidth={2.4} />
            {t(
              'Couldn’t connect directly — some networks block this.',
              'सीधा कनेक्शन नहीं बना — कुछ नेटवर्क इसे रोकते हैं।',
            )}
          </p>
          <p>{p2pErrorText(error, t)}</p>
          <div className="h-friend__row">
            <Button variant="primary" onClick={() => setStage('form')} trailing={null}>
              {t('Try again', 'फिर कोशिश करें')}
            </Button>
            <Button variant="paper" size="s" href={href.pass()}>
              {t('Pass & Play instead', 'पास एंड प्ले करें')}
            </Button>
            <Button variant="paper" size="s" href={href.duel({ vs: 'bot' })}>
              {t(`Duel ${BOT_NAME}`, `${BOT_NAME} से मुक़ाबला`)}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="h-friend__tabs" role="group" aria-label={t('Join or host', 'जुड़ें या होस्ट करें')}>
            <button
              type="button"
              aria-pressed={tab === 'join'}
              className={cx('h-friend__tab', tab === 'join' && 'h-friend__tab--on')}
              onClick={() => setTab('join')}
            >
              {t('Join with a code', 'कोड से जुड़ें')}
            </button>
            <button
              type="button"
              aria-pressed={tab === 'host'}
              className={cx('h-friend__tab', tab === 'host' && 'h-friend__tab--on')}
              onClick={() => setTab('host')}
            >
              {t('Host a room', 'रूम होस्ट करें')}
            </button>
          </div>

          <form
            className="h-friend__card"
            onSubmit={(e) => {
              e.preventDefault();
              if (tab === 'join') void join();
              else createFromForm();
            }}
          >
            {tab === 'join' ? (
              <div className="h-field">
                <label className="h-field__label" htmlFor="h-friend-code">
                  {t('Room code', 'रूम कोड')}
                </label>
                <input
                  id="h-friend-code"
                  className="h-field__input h-field__input--code"
                  value={codeText}
                  onChange={(e) => {
                    setCodeText(e.target.value);
                    setError(null);
                  }}
                  placeholder="7K2Q-9FHM"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  inputMode="text"
                  maxLength={12}
                  aria-describedby="h-friend-code-help"
                  aria-invalid={error?.code === 'invalid_code' || undefined}
                />
                <p className="h-field__help" id="h-friend-code-help">
                  {error?.code === 'invalid_code'
                    ? p2pErrorText(error, t)
                    : t('8 characters, from your friend’s invite.', 'दोस्त के इनवाइट से 8 अक्षर।')}
                </p>
              </div>
            ) : (
              <fieldset className="h-friend__fmts">
                <legend className="h-field__label">{t('Format', 'फ़ॉर्मैट')}</legend>
                {FORMATS.map((x) => (
                  <label key={x.mode} className={cx('h-friend__fmt', mode === x.mode && 'h-friend__fmt--on')}>
                    <input
                      className="h-friend__fmtin"
                      type="radio"
                      name="h-friend-mode"
                      checked={mode === x.mode}
                      onChange={() => setMode(x.mode as DuelMode)}
                    />
                    <span className="h-friend__fmtname">
                      {isHi ? <span lang="hi">{formatNameHi(x.mode as DuelMode)}</span> : x.name}
                    </span>
                    <span className="h-mono h-friend__fmtnums">
                      {formatLine(x.mode as DuelMode, false, isHi)}
                    </span>
                  </label>
                ))}
                <p className="h-field__help">
                  {t('Topic', 'विषय')}: {topic === 'all' ? t('Mixed', 'मिला-जुला') : sectorName(topic, isHi)}{' '}
                  ·{' '}
                  <a className="h-link" href={href.duel({ vs: 'friend', mode })}>
                    {t('change in Muqabla', 'मुक़ाबला में बदलें')}
                  </a>
                </p>
              </fieldset>
            )}
            <div className="h-field">
              <label className="h-field__label" htmlFor="h-friend-name">
                {t('Your name (optional, shown to your friend)', 'आपका नाम (वैकल्पिक, दोस्त को दिखेगा)')}
              </label>
              <input
                id="h-friend-name"
                className="h-field__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={ANONYMOUS}
                autoComplete="nickname"
                maxLength={NAME_LIMIT}
              />
            </div>
            <Button variant="primary" type="submit" block disabled={!player.loaded}>
              {tab === 'join' ? t('Join room', 'रूम में जुड़ें') : t(`Create a ${f.name} room`, 'रूम बनाएँ')}
            </Button>
          </form>
        </>
      )}

      <TrustNote via={via} />
    </Page>
  );
}

/**
 * While a room is opening or connecting: the top bar only, no nav — a tab tap would abandon the
 * handshake half-way (the unmount still closes it; this keeps the tap from happening by accident).
 * A child component, so it unmounts before FriendMatch sets its own chrome (one override at a time).
 */
function LobbyChrome() {
  useChrome('top');
  return null;
}

function TrustNote({ via }: { via: Via }) {
  const { t } = useLang();
  return (
    <aside
      className="h-friend__trust"
      aria-label={t('How a friend duel works', 'दोस्त से मुक़ाबला कैसे चलता है')}
    >
      <p>
        <strong>{t(p2p.P2P_TRUST.label, 'दोस्ताना · भरोसे पर')}.</strong>{' '}
        {t(
          p2p.P2P_TRUST.body,
          'मैच होस्ट का ब्राउज़र चलाता है और हर ब्राउज़र अपना जवाब-समय ख़ुद बताता है, इसलिए बदला हुआ ब्राउज़र धोखा दे सकता है। दोस्तों के बीच ठीक है। कोई सिक्का नहीं, कोई रैंकिंग नहीं; हर डिवाइस अपना रिकॉर्ड रखता है।',
        )}
      </p>
      {via === 'tab' ? (
        <p>
          {t(
            'Test link: two tabs of this site on this device (BroadcastChannel). Nothing leaves the device.',
            'टेस्ट लिंक: इसी डिवाइस पर इस साइट के दो टैब। कुछ भी डिवाइस से बाहर नहीं जाता।',
          )}
        </p>
      ) : (
        <p>
          {t(
            'Both browsers find each other through public relays and public STUN servers (Google’s and Cloudflare’s), then talk directly and learn each other’s internet (IP) address, as in any video call. Some office and mobile networks block direct connections, and there is no relay server of ours to fall back on.',
            'दोनों ब्राउज़र पब्लिक रिले और पब्लिक STUN सर्वर (Google और Cloudflare के) से एक-दूसरे को ढूँढते हैं, फिर सीधे बात करते हैं और एक-दूसरे का इंटरनेट (IP) पता जान लेते हैं, जैसे किसी भी वीडियो कॉल में। कुछ दफ़्तर और मोबाइल नेटवर्क सीधा कनेक्शन रोकते हैं, और हमारा कोई रिले सर्वर नहीं है।',
          )}{' '}
          {t(
            p2p.P2P_TRUST.code,
            'रूम कोड ही रूम की अकेली चाबी है। पब्लिक रिले को इसका बदला और खींचा हुआ रूप दिखता है, जिसे उलटने में बहुत कंप्यूटिंग लगती है, पर जो इतना ख़र्च करे वह बाद में भी कोड निकाल सकता है, और उससे दोनों खिलाड़ियों के इंटरनेट (IP) पते। कोड सिर्फ़ अपने दोस्त को भेजें।',
          )}
        </p>
      )}
    </aside>
  );
}

// ---- the session: lobby → match → result → rematch ------------------------------------------------------

type FriendMatchProps = {
  session: Session;
  via: Via;
  peer: Peer;
  hello: boolean;
  myName: string;
  /** The friend tapped Rematch (their rematch number), 0 if not. */
  offer: number;
  rematching: boolean;
  rematchError: P2PError;
  onRematch: () => void;
  onLeave: () => void;
};

function FriendMatch({
  session,
  via,
  peer,
  hello,
  myName,
  offer,
  rematching,
  rematchError,
  onRematch,
  onLeave,
}: FriendMatchProps) {
  const { t } = useLang();
  const player = useAppPlayer();
  const { controller, snapshot } = useDuel(session.api.request);
  const [epoch, setEpoch] = useState<string | undefined>(undefined);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [calibrated, setCalibrated] = useState(false);
  const [fatal, setFatal] = useState<P2PError>(null);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const autoSent = useRef(false);
  const room = (snapshot?.room ?? null) as Room | null;
  useRecordRoom(room, epoch);
  const inLobby = !room || (room.phase === 'waiting' && !endReason && !fatal);
  // The lobby keeps the top bar (no nav: a tab tap would close the room); the match has no chrome.
  useChrome(inLobby ? 'top' : 'none');

  // Attach once per session: adopt the room, follow the peer's pokes, calibrate the clock.
  useEffect(() => {
    controller.adopt(session.created);
    setEpoch(player.epoch());
    setBaseline(baselineOf(player.progression));
    const offPoke = session.api.onPoke(() => void controller.refresh());
    const offError = session.api.onError((e: unknown) => setFatal(e as P2PError));
    let live = true;
    controller
      .calibrate(session.role === 'host' ? 3 : 5)
      .then(() => live && setCalibrated(true))
      .catch(() => live && setCalibrated(true));
    return () => {
      live = false;
      offPoke();
      offError();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, session]);

  const me = room?.seat ?? (session.role === 'host' ? 0 : 1);
  const them = other(me);
  const seated = !!room?.players[them];
  const meReady = !!room?.players[me]?.ready;

  // A rematch tap is the ready: send it once both seats are filled and the clock is calibrated.
  useEffect(() => {
    if (
      !session.auto ||
      autoSent.current ||
      !calibrated ||
      !room ||
      room.phase !== 'waiting' ||
      !seated ||
      meReady
    )
      return;
    autoSent.current = true;
    void controller.ready().catch(() => {
      autoSent.current = false;
    });
  }, [session.auto, calibrated, room, seated, meReady, controller]);

  // The guest checks every revealed question against its own copy of the seeded deal.
  useEffect(() => {
    if (session.role !== 'guest' || !room || endReason) return;
    if (!(session.api as Guest).verify(room)) {
      setEndReason('deal-mismatch');
      void controller.leave().catch(() => {});
    }
  }, [session, room, endReason, controller]);

  // The host's browser went away mid-match: wait 10 s, then say so (the guest cannot settle it).
  const settled = !!room?.settled;
  useEffect(() => {
    if (peer !== 'left' || settled || endReason || session.role !== 'guest') return;
    const id = setTimeout(() => setEndReason('connection-lost'), 10000);
    return () => clearTimeout(id);
  }, [peer, settled, endReason, session.role]);

  // The match is over on this screen (the host is gone, or the P2P link failed for good): stop polling
  // a peer that will not answer. Each poll would otherwise wait out the 15 s P2P timeout, fail and
  // reschedule until the player leaves, and nobody reads the result. A rematch builds a new session
  // (and a new controller), so nothing needs this one again.
  useEffect(() => {
    if (endReason !== 'connection-lost' && !fatal) return;
    controller.dispose();
  }, [endReason, fatal, controller]);

  // seatName: a friend who typed 'Babu-Bot · BOT' shows as Anonymous Janta (only the real bot is BOT).
  const friend = room ? seatName(room.players[them]) : t('your friend', 'आपका दोस्त');
  const lost = peer === 'left' && !settled && !endReason;
  const banner = lost ? (
    <p className="h-friend__banner" role="alert">
      <WifiOff aria-hidden="true" size={18} strokeWidth={2.4} />
      {t('Connection lost — waiting 10 s', 'कनेक्शन टूटा — 10 s इंतज़ार')}
    </p>
  ) : null;

  if (!room)
    return (
      <Page width="read" screen="duel-friend">
        <Skeleton lines={4} />
      </Page>
    );

  if (room.phase === 'waiting' && !endReason && !fatal)
    return (
      <>
        <RoomLobby
          session={session}
          room={room}
          via={via}
          peer={peer}
          hello={hello}
          friend={friend}
          myName={myName}
          calibrated={calibrated}
          busy={!!snapshot?.busy}
          error={snapshot?.error || null}
          onReady={() => void controller.ready().catch(() => {})}
          onLeave={() => setAsking(true)}
        />
        {asking ? (
          <ConfirmLeave
            body={t(
              'Your friend will see that you left. No match was played.',
              'दोस्त को दिखेगा कि आप चले गए। कोई मैच नहीं हुआ।',
            )}
            onStay={() => setAsking(false)}
            onLeave={() => {
              setAsking(false);
              void controller
                .leave()
                .catch(() => {})
                .finally(onLeave);
            }}
          />
        ) : null}
      </>
    );

  const rematchNote = rematchError
    ? p2pErrorText(rematchError, t)
    : rematching
      ? offer
        ? t('Opening the next room…', 'अगला रूम खुल रहा है…')
        : t(`Waiting for ${friend} to tap Rematch…`, `${friend} के Rematch दबाने का इंतज़ार…`)
      : offer
        ? t(`${friend} wants a rematch.`, `${friend} दोबारा खेलना चाहता है।`)
        : peer === 'left'
          ? t(`${friend} has left the room.`, `${friend} रूम छोड़ चुका है।`)
          : null;

  return (
    <Arena
      controller={controller}
      snapshot={snapshot}
      kind="friend"
      baseline={baseline}
      banner={banner}
      endReason={
        endReason ?? (fatal ? (fatal.code === 'p2p_mismatch' ? 'p2p-mismatch' : 'connection-lost') : null)
      }
      onRematch={peer === 'left' || endReason || fatal ? onLeave : onRematch}
      rematch={{
        busy: rematching,
        note: rematchNote,
        label: rematching
          ? t('Waiting…', 'इंतज़ार…')
          : peer === 'left' || endReason || fatal
            ? t('New duel', 'नया मुक़ाबला')
            : undefined,
      }}
      onExit={onLeave}
      onLeave={() => {
        void controller
          .leave()
          .catch(() => {})
          .finally(onLeave);
      }}
      countdownNote={<p>{t('Peer-to-peer · casual · trust-based', 'पीयर-टू-पीयर · दोस्ताना · भरोसे पर')}</p>}
    />
  );
}

// ---- the lobby card ----------------------------------------------------------------------------------------

type RoomLobbyProps = {
  session: Session;
  room: Room;
  via: Via;
  peer: Peer;
  hello: boolean;
  friend: string;
  myName: string;
  calibrated: boolean;
  busy: boolean;
  error: string | null;
  onReady: () => void;
  onLeave: () => void;
};

function RoomLobby({
  session,
  room,
  via,
  peer,
  hello,
  friend,
  myName,
  calibrated,
  busy,
  error,
  onReady,
  onLeave,
}: RoomLobbyProps) {
  const { t, isHi } = useLang();
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [shared, setShared] = useState<ShareOutcome | null>(null);
  const me = room.seat;
  const them = other(me);
  const f = formatOf(room.config.mode);
  const seated = !!room.players[them];
  const meReady = !!room.players[me]?.ready;
  const theyReady = !!room.players[them]?.ready;
  const code = session.first;
  const invite = inviteLink(code, via, session.circleId);
  // No one has arrived for 30 s over the network: say what may be happening (never a fake status).
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (seated || peer !== 'none' || via === 'tab') {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), 30000);
    return () => clearTimeout(id);
  }, [seated, peer, via]);
  const text =
    via === 'tab' || session.circleId
      ? `Muqabla? ${f.name} on HISAAB DO. Room ${code}: ${invite}`
      : inviteText(code, { format: f.name });

  const friendState: { text: string; icon: ReactNode; tone: 'wait' | 'ok' | 'ready' | 'off' } =
    peer === 'left'
      ? { text: t('Disconnected', 'डिस्कनेक्ट'), icon: <WifiOff size={16} strokeWidth={2.4} />, tone: 'off' }
      : theyReady
        ? { text: t('Ready', 'तैयार'), icon: <span aria-hidden="true">✓</span>, tone: 'ready' }
        : seated || hello
          ? {
              text: t('Connected · peer-to-peer', 'जुड़ गए · पीयर-टू-पीयर'),
              icon: <Wifi size={16} strokeWidth={2.4} />,
              tone: 'ok',
            }
          : peer === 'joined'
            ? {
                text: t('Connecting directly…', 'सीधे जुड़ रहे हैं…'),
                icon: <Wifi size={16} strokeWidth={2.4} />,
                tone: 'wait',
              }
            : { text: t('Waiting…', 'इंतज़ार…'), icon: <span aria-hidden="true">…</span>, tone: 'wait' };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };
  const share = async () =>
    setShared(via === 'tab' || session.circleId ? await shareText(text) : await shareInvite(code, { format: f.name }));

  const primary = meReady
    ? t(`Waiting for ${friend}`, `${friend} का इंतज़ार`)
    : t("I'm ready", 'मैं तैयार हूँ');
  const hint = !seated
    ? session.role === 'host'
      ? t(
          'Send the code. “I’m ready” opens once your friend joins.',
          'कोड भेजें। दोस्त के जुड़ते ही “मैं तैयार हूँ” खुलेगा।',
        )
      : t('Joining the room…', 'रूम में जुड़ रहे हैं…')
    : meReady
      ? t(
          'The question comes after a 3 · 2 · 1 once both are ready.',
          'दोनों तैयार होते ही 3 · 2 · 1 के बाद सवाल आएगा।',
        )
      : null;

  return (
    <Page screen="duel-lobby" className="h-lobby">
      <ScreenHeader
        kicker={`F.No. P2P/${code}`}
        titleHi="दोस्त से मुक़ाबला"
        title={t('Duel a friend', 'Duel a friend')}
        lead={isHi ? <span lang="hi">कोड भेजो, दोस्त बुलाओ।</span> : 'Code bhejo, dost bulao.'}
      />
      <div className="h-lobby__grid">
        <section className="h-lobby__code" aria-labelledby="h-lobby-code">
          <p className="h-kicker" id="h-lobby-code">
            {t('ROOM CODE', 'रूम कोड')}
          </p>
          {/* A paragraph takes no aria-label: the code is hidden from screen readers here and spelled out
              in the line after it. The big line's text stays exactly the code (copy-select, tests). */}
          <p className="h-lobby__big h-mono" aria-hidden="true">
            {code}
          </p>
          <p className="h-sr">{code.split('').join(' ')}</p>
          {session.role === 'host' && session.n === 0 ? (
            <div className="h-lobby__invite">
              <Button
                variant="paper"
                size="s"
                href={whatsappUrl(text)}
                target="_blank"
                rel="noopener noreferrer"
                icon={<MessageCircle size={18} strokeWidth={2.4} />}
              >
                WhatsApp
              </Button>
              <Button
                variant="paper"
                size="s"
                onClick={() => void copy()}
                icon={copied === 'ok' ? null : <Copy size={18} strokeWidth={2.4} />}
              >
                {copied === 'ok'
                  ? t('Copied ✓', 'कॉपी ✓')
                  : copied === 'fail'
                    ? t('Copy failed', 'कॉपी नहीं हुआ')
                    : t('Copy link', 'लिंक कॉपी करें')}
              </Button>
              <Button
                variant="paper"
                size="s"
                onClick={() => void share()}
                icon={<Share2 size={18} strokeWidth={2.4} />}
              >
                {shared?.ok
                  ? shared.method === 'clipboard'
                    ? t('Copied ✓', 'कॉपी ✓')
                    : t('Shared ✓', 'शेयर ✓')
                  : t('Share', 'शेयर')}
              </Button>
            </div>
          ) : (
            <p className="h-friend__muted">
              <Link2 aria-hidden="true" size={16} strokeWidth={2.4} />{' '}
              {session.n
                ? t(`Rematch ${session.n}`, `दोबारा ${session.n}`)
                : t('You joined with this code.', 'आप इस कोड से जुड़े।')}
            </p>
          )}
          <p className="h-lobby__summary">
            {isHi ? <span lang="hi">{formatNameHi(f.mode)}</span> : f.name} ·{' '}
            <span className="h-mono">{formatLine(f.mode, false, isHi)}</span> ·{' '}
            {room.config.topic && room.config.topic !== 'all'
              ? sectorName(room.config.topic, isHi)
              : t('Mixed', 'मिला-जुला')}
          </p>
        </section>

        <section className="h-lobby__seats" aria-labelledby="h-lobby-seats">
          <h2 className="h-lobby__h2" id="h-lobby-seats">
            {t('Seats', 'सीटें')}
          </h2>
          <ul className="h-lobby__list" aria-live="polite">
            <li className="h-seat">
              <span className="h-seat__who">
                {/* What the room was sent (seatNameFor): never a bot-like name, else as typed. */}
                <span className="h-seat__name">{seatNameFor(myName)}</span>
                <span className="h-seat__role">
                  {t('You', 'आप')} · {session.role === 'host' ? t('host', 'होस्ट') : t('guest', 'मेहमान')}
                </span>
              </span>
              <span className={cx('h-seat__state', meReady ? 'h-seat__state--ready' : 'h-seat__state--ok')}>
                {meReady ? <span aria-hidden="true">✓</span> : null}
                {meReady ? t('Ready', 'तैयार') : t('Here', 'यहाँ')}
              </span>
            </li>
            <li className="h-seat">
              <span className="h-seat__who">
                <span className="h-seat__name">{seated ? friend : t('Friend', 'दोस्त')}</span>
                <span className="h-seat__role">
                  {session.role === 'host' ? t('guest', 'मेहमान') : t('host', 'होस्ट')}
                </span>
              </span>
              <span className={cx('h-seat__state', `h-seat__state--${friendState.tone}`)}>
                <span className="h-seat__icon" aria-hidden="true">
                  {friendState.icon}
                </span>
                {friendState.text}
              </span>
            </li>
          </ul>
          {peer === 'left' ? (
            <InlineNote tone="wait">{t(`${friend} left the room.`, `${friend} रूम छोड़ गया।`)}</InlineNote>
          ) : null}
          {error ? <InlineNote tone="wait">{error}</InlineNote> : null}
          {slow ? (
            <InlineNote tone="wait">
              {t(
                'No one has connected yet. If your friend has the link open and nothing changes, a network may be blocking direct connections.',
                'अभी तक कोई नहीं जुड़ा। अगर दोस्त ने लिंक खोला है और कुछ नहीं बदलता, तो शायद नेटवर्क सीधा कनेक्शन रोक रहा है।',
              )}{' '}
              <a className="h-link" href={href.pass()}>
                {t('Pass & Play', 'पास एंड प्ले')}
              </a>{' '}
              ·{' '}
              <a className="h-link" href={href.duel({ vs: 'bot' })}>
                {BOT_NAME}
              </a>
            </InlineNote>
          ) : null}
          <TrustNote via={via} />
        </section>
      </div>

      <div className="h-lobby__bar">
        <div className="h-lobby__barin">
          {hint ? (
            <p className="h-lobby__hint" role="status">
              {hint}
            </p>
          ) : null}
          <div className="h-lobby__actions">
            <Button variant="ghost" onClick={onLeave} trailing={null}>
              {t('Leave', 'छोड़ें')}
            </Button>
            <Button
              variant="primary"
              onClick={onReady}
              disabled={!seated || meReady || !calibrated || peer === 'left'}
              busy={busy}
              trailing={null}
            >
              {primary}
            </Button>
          </div>
        </div>
      </div>
    </Page>
  );
}
