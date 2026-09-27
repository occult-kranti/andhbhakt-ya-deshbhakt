/**
 * screens/settings/index.tsx — Settings (design bible §11.16; charter §7).
 *
 * Everything applies the moment it is touched and is stored on this device only. Language · Theme
 * (Day edition / Night edition / Match phone) · Sound + volume · Haptics · Effects (Full /
 * Reduced / Off) · Toasts · Quiet everything · Name · Data (export, delete with a Delete / Keep
 * confirm) · "We never send notifications." · Rules & Sources, Corrections, Report a problem.
 * The ONE violet action is Done. Confirmations are inline ("Exported ✓"), never toasts.
 */
import { useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BellOff, BookOpen, Check, Download, Flag, History, Moon, Newspaper, RefreshCw, Smartphone, Sun, Trash2, Volume2 } from 'lucide-react';
import { useJuice } from '@/components/fx';
import { getPrefs, setPref, subscribePrefs, type MotionPref } from '@/lib/fx/prefs';
import { budget, useBudgetSnapshot } from '../../budget';
import { goBack, href, queryString, type ScreenProps } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { useAppPlayer } from '../../shell/player';
import { useTheme, type ThemePref } from '../../shell/theme';
import { Button } from '../../ui/button';
import { cx } from '../../ui/cx';
import { useLang, type Locale } from '../../ui/lang';
import { InlineNote, Page, ScreenHeader } from '../../ui/page';
import { NameField } from '../me/name-field';
import { isQuiet, setEffects, setQuietEverything, TOASTS_OFF_PERSISTS } from './prefs';
import './settings.css';

function Group({ title, children, id, hint }: { title: ReactNode; children: ReactNode; id: string; hint?: ReactNode }) {
  return (
    <section className="h-set__group" aria-labelledby={id}>
      <h2 className="h-set__h2" id={id}>
        {title}
      </h2>
      {hint ? <p className="h-set__hint">{hint}</p> : null}
      {children}
    </section>
  );
}

/** A radio group drawn as cards (native radios underneath, so arrows and screen readers just work). */
function Choice<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: ReactNode; sub?: ReactNode; icon?: ReactNode; lang?: string }>;
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className={cx('h-choice', options.length > 2 && 'h-choice--many')}>
      <legend className="h-sr">{legend}</legend>
      {options.map((o) => (
        <label key={o.id} className={cx('h-choice__opt', value === o.id && 'h-choice__opt--on')}>
          <input type="radio" className="h-choice__radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
          {o.icon ? (
            <span className="h-choice__icon" aria-hidden="true">
              {o.icon}
            </span>
          ) : null}
          <span className="h-choice__text">
            <span className="h-choice__label" lang={o.lang}>
              {o.label}
            </span>
            {o.sub ? <span className="h-choice__sub">{o.sub}</span> : null}
          </span>
          <span className="h-choice__tick" aria-hidden="true">
            {value === o.id ? <Check size={18} strokeWidth={3} /> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** An on/off switch (role="switch"), 44px tall, with its state in words beside it. */
function Switch({ label, sub, checked, onChange, icon }: { label: ReactNode; sub?: ReactNode; checked: boolean; onChange: (next: boolean) => void; icon?: ReactNode }) {
  const { t } = useLang();
  const id = useId();
  return (
    <div className="h-switchrow">
      <span className="h-switchrow__text">
        <span className="h-switchrow__label" id={id}>
          {icon ? (
            <span className="h-switchrow__icon" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          {label}
        </span>
        {sub ? <span className="h-switchrow__sub">{sub}</span> : null}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} className="h-switch" onClick={() => onChange(!checked)}>
        <span className="h-switch__track" aria-hidden="true">
          <span className="h-switch__knob" />
        </span>
        <span className="h-switch__word" aria-hidden="true">
          {checked ? t('On', 'चालू') : t('Off', 'बंद')}
        </span>
      </button>
    </div>
  );
}

export default function SettingsScreen(_: ScreenProps) {
  const { t, locale, setLocale } = useLang();
  const theme = useTheme();
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
  const { toastsOff } = useBudgetSnapshot();
  const player = useAppPlayer();
  const juice = useJuice();
  const [exported, setExported] = useState<'idle' | 'busy' | 'done'>('idle');
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState<'ok' | 'failed' | null>(null);
  const volumeId = useId();
  useScreenTitle(t('Settings', 'सेटिंग्स'));

  const quiet = isQuiet(prefs, toastsOff);
  const volume = Math.round(prefs.volume * 100);

  return (
    <Page screen="settings" width="read" className="h-set">
      <ScreenHeader
        kicker={`F.No. S/${t('DEVICE', 'फ़ोन')}`}
        titleHi="सेटिंग्स"
        title="Settings"
        lead={t('Everything applies at once and stays on this device.', 'सब तुरंत लागू होता है और इसी फ़ोन पर रहता है।')}
      />

      <Group id="h-set-lang" title={t('Language', 'भाषा')} hint={t('Questions and receipts stay in English for now.', 'सवाल और रसीदें अभी अंग्रेज़ी में ही हैं।')}>
        <Choice<Locale>
          legend={t('Language', 'भाषा')}
          value={locale}
          onChange={(v) => setLocale(v)}
          options={[
            { id: 'en', label: 'English', lang: 'en' },
            { id: 'hi', label: 'हिन्दी', lang: 'hi' },
          ]}
        />
      </Group>

      <Group id="h-set-theme" title={t('Theme', 'थीम')} hint={t('Rotate picks a different edition each day, when you next open the game. It stays put during your visit.', 'बदलता संस्करण रोज़ खेल दोबारा खोलने पर बदलता है। खेलते समय वही रहता है।')}>
        <Choice<ThemePref>
          legend={t('Theme', 'थीम')}
          value={theme.pref}
          onChange={(v) => theme.setTheme(v)}
          options={[
            { id: 'light', label: t('Day edition', 'दिन का संस्करण'), sub: t('Light', 'हल्की'), icon: <Sun size={20} strokeWidth={2.4} /> },
            { id: 'dark', label: t('Night edition', 'रात का संस्करण'), sub: t('Dark', 'गहरी'), icon: <Moon size={20} strokeWidth={2.4} /> },
            { id: 'classic', label: t('Classic edition', 'पुराना संस्करण'), sub: t('The original dark palette', 'पहले वाली गहरी थीम'), icon: <Newspaper size={20} strokeWidth={2.4} /> },
            { id: 'rotate', label: t('Rotate editions', 'बदलता संस्करण'), sub: t('Day, Night, Classic · daily', 'दिन, रात, पुराना · रोज़'), icon: <RefreshCw size={20} strokeWidth={2.4} /> },
            {
              id: 'system',
              label: t('Match phone', 'फ़ोन जैसी'),
              sub: t('Follows your device appearance', 'फ़ोन की थीम के अनुसार'),
              icon: <Smartphone size={20} strokeWidth={2.4} />,
            },
          ]}
        />
      </Group>

      <Group id="h-set-sound" title={t('Sound and touch', 'आवाज़ और कंपन')} hint={t('Silent until your first tap, always.', 'पहले टैप तक हमेशा चुप।')}>
        <div className="h-set__card">
          <Switch icon={<Volume2 size={18} strokeWidth={2.4} />} label={t('Sound', 'आवाज़')} checked={prefs.sound} onChange={(v) => setPref('sound', v)} />
          <div className={cx('h-volume', !prefs.sound && 'h-volume--off')}>
            <label htmlFor={volumeId} className="h-volume__label">
              {t('Volume', 'आवाज़ का स्तर')} <span className="h-mono">{volume}%</span>
            </label>
            <input
              id={volumeId}
              className="h-volume__range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume}
              disabled={!prefs.sound}
              aria-valuetext={`${volume}%`}
              onChange={(e) => setPref('volume', Number(e.target.value) / 100)}
              onPointerUp={() => juice.sound('tap')}
              onKeyUp={() => juice.sound('tap')}
            />
          </div>
          <Switch label={t('Haptics', 'कंपन')} sub={t('Short buzzes on phones that have them.', 'जिन फ़ोनों में कंपन है।')} checked={prefs.haptics} onChange={(v) => setPref('haptics', v)} />
        </div>
      </Group>

      <Group id="h-set-effects" title={t('Effects', 'इफ़ेक्ट्स')}>
        <Choice<MotionPref>
          legend={t('Effects', 'इफ़ेक्ट्स')}
          value={prefs.motion}
          onChange={(v) => setEffects(v)}
          options={[
            { id: 'full', label: t('Full', 'पूरे'), sub: t('Stamps, paper chits and the 3D set pieces where your phone can run them.', 'ठप्पे, काग़ज़ के टुकड़े और 3D, जहाँ फ़ोन चला सके।') },
            { id: 'reduced', label: t('Reduced', 'कम'), sub: t('No movement across the screen; fades only.', 'स्क्रीन पर कोई हलचल नहीं; सिर्फ़ फ़ेड।') },
            { id: 'off', label: t('Off', 'बंद'), sub: t('No 3D, no confetti, no particles.', 'न 3D, न कंफ़ेटी।') },
          ]}
        />
      </Group>

      <Group id="h-set-quiet" title={t('Notifications', 'सूचनाएँ')}>
        <div className="h-set__card">
          <Switch
            icon={<BellOff size={18} strokeWidth={2.4} />}
            label={t('Quiet everything', 'सब चुप')}
            sub={t('Sound, haptics and effects off, and no pop-up notes — updates wait quietly in Profile › Activity.', 'आवाज़, कंपन, इफ़ेक्ट्स बंद और कोई पॉप-अप नहीं — अपडेट प्रोफ़ाइल › गतिविधि में।')}
            checked={quiet}
            onChange={(v) => setQuietEverything(v)}
          />
          <Switch
            label={t('Pop-up notes (toasts)', 'पॉप-अप नोट')}
            sub={t('At most one per screen, ever. Off sends them to Activity.', 'हर स्क्रीन पर ज़्यादा से ज़्यादा एक। बंद करने पर गतिविधि में जाते हैं।')}
            checked={!toastsOff}
            onChange={(v) => budget.setToastsOff(!v)}
          />
        </div>
        {toastsOff && !TOASTS_OFF_PERSISTS ? (
          <InlineNote>
            {t(
              'Pop-up notes come back on when you reopen the app: this switch can’t be saved on this device yet. Sound, haptics and effects stay as you set them.',
              'ऐप दोबारा खोलने पर पॉप-अप नोट फिर चालू हो जाते हैं: यह सेटिंग अभी सेव नहीं होती। आवाज़, कंपन और इफ़ेक्ट्स वैसे ही रहते हैं।',
            )}
          </InlineNote>
        ) : null}
        <p className="h-set__static">
          <BellOff size={16} strokeWidth={2.4} aria-hidden="true" /> {t('We never send notifications.', 'हम कभी नोटिफ़िकेशन नहीं भेजते।')}{' '}
          {t('No push, no e-mail, no badges, no “come back” messages.', 'न पुश, न ई-मेल, न बैज, न “वापस आओ” संदेश।')}
        </p>
      </Group>

      <Group id="h-set-name" title={t('Name', 'नाम')}>
        <NameField />
        <p className="h-set__hint">{t('Shown to a friend in a duel room and printed on certificates. Leave it empty to stay Anonymous Janta.', 'दोस्त के साथ मुक़ाबले में और प्रमाण पत्र पर। ख़ाली छोड़ें तो Anonymous Janta।')}</p>
      </Group>

      <Group
        id="h-set-data"
        title={t('Data', 'डेटा')}
        hint={t('Solo progress stays on this device. Online beta stores your nickname, matches and circle memberships on the game server.', 'अकेले खेलने की प्रगति इसी फ़ोन पर रहती है। ऑनलाइन बीटा में आपका उपनाम, मैच और मंडली की सदस्यता गेम सर्वर पर सेव होते हैं।')}
      >
        {player.storageError ? <InlineNote tone="wait">{player.storageError}</InlineNote> : null}
        {!player.persistent ? (
          <InlineNote tone="wait">{t('Browser storage is off here, so progress lasts for this visit. Export it before you leave.', 'यहाँ ब्राउज़र स्टोरेज बंद है; प्रगति सिर्फ़ इस बार की है।')}</InlineNote>
        ) : null}
        <div className="h-set__row">
          <Button
            variant="paper"
            icon={<Download size={20} strokeWidth={2.4} />}
            busy={exported === 'busy'}
            onClick={async () => {
              setExported('busy');
              await player.exportAll();
              setExported('done');
            }}
          >
            <span aria-live="polite">{exported === 'done' ? t('Exported ✓', 'एक्सपोर्ट हो गया ✓') : t('Export my data (JSON)', 'मेरा डेटा एक्सपोर्ट करो (JSON)')}</span>
          </Button>
        </div>
        {!confirm ? (
          <div className="h-set__row">
            <Button variant="ghost" icon={<Trash2 size={18} strokeWidth={2.4} />} trailing={null} onClick={() => setConfirm(true)}>
              {t('Delete my progress', 'मेरी प्रगति मिटाओ')}
            </Button>
            {deleted === 'ok' ? (
              <span className="h-set__done" role="status">
                {t('Deleted. A fresh file.', 'मिटा दिया। नई फ़ाइल।')}
              </span>
            ) : deleted === 'failed' ? (
              <span className="h-set__done" role="alert">
                {player.storageError ||
                  t(
                    'Could not delete: nothing was cleared. Export your data and try again.',
                    'मिटा नहीं पाए: कुछ भी नहीं मिटा। डेटा एक्सपोर्ट करके फिर कोशिश करें।',
                  )}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="h-set__confirm" role="group" aria-label={t('Delete my progress?', 'प्रगति मिटाएँ?')}>
            <p className="h-set__confirmq">
              {t(
                'Delete every receipt, level, streak and label on this device? This cannot be undone. Your name and settings stay.',
                'इस फ़ोन की हर रसीद, लेवल, सिलसिला और लेबल मिटाएँ? वापस नहीं होगा। नाम और सेटिंग्स रहेंगी।',
              )}
            </p>
            <div className="h-set__row">
              <Button
                variant="paper"
                className="h-set__danger"
                icon={<Trash2 size={18} strokeWidth={2.4} />}
                onClick={async () => {
                  // The shared clear() resolves either way; a reset that landed starts a new profile epoch.
                  // Same epoch after it = the 'Reset could not be saved' path: say so, never "Deleted".
                  const before = player.epoch();
                  await player.clear();
                  setConfirm(false);
                  setDeleted(player.epoch() !== before ? 'ok' : 'failed');
                }}
              >
                {t('Delete', 'मिटाओ')}
              </Button>
              <Button variant="paper" onClick={() => setConfirm(false)}>
                {t('Keep', 'रहने दो')}
              </Button>
            </div>
          </div>
        )}
      </Group>

      <Group id="h-set-links" title={t('Trust', 'भरोसा')}>
        <ul className="h-set__links">
          <li>
            <a className="h-link h-link--tap" href={href.rules()}>
              <BookOpen size={18} strokeWidth={2.4} aria-hidden="true" /> {t('Rules & Sources', 'नियम और स्रोत')}
            </a>
          </li>
          <li>
            <a className="h-link h-link--tap" href={`${href.rules()}${queryString({ s: 'corrections' })}`}>
              <History size={18} strokeWidth={2.4} aria-hidden="true" /> {t('Corrections', 'सुधार')}
            </a>
          </li>
          <li>
            <a className="h-link h-link--tap" href={`${href.rules()}${queryString({ s: 'report' })}`}>
              <Flag size={18} strokeWidth={2.4} aria-hidden="true" /> {t('Report a problem', 'समस्या बताओ')}
            </a>
          </li>
        </ul>
      </Group>

      <div className="h-set__done-bar">
        <Button variant="primary" block onClick={() => goBack(href.me())}>
          {t('Done', 'हो गया')}
        </Button>
      </div>
    </Page>
  );
}
