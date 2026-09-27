/** In-match preferences and a deliberate exit. Opening this dialog never pauses a live clock. */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { LogOut, Settings2, Volume2, X } from 'lucide-react';
import { getPrefs, setPref, subscribePrefs } from '@/lib/fx/prefs';
import { useTheme, type ThemePref } from '../../shell/theme';
import { Button, IconButton } from '../../ui/button';
import { BrandName } from '../../ui/brand';
import { useLang } from '../../ui/lang';
import './match-settings.css';

export function MatchSettingsButton({ onClick }: { onClick: () => void }) {
  const { t } = useLang();
  return (
    <button type="button" className="h-matchsettings-trigger" onClick={onClick} aria-haspopup="dialog">
      <Settings2 aria-hidden="true" size={20} strokeWidth={2.3} />
      <span>{t('Settings', 'सेटिंग्स')}</span>
    </button>
  );
}

export function MatchSettings({
  onClose, onQuit, running, settled = false, resultReady = false, pass = false,
}: {
  onClose: () => void;
  onQuit: () => void;
  running: boolean;
  settled?: boolean;
  resultReady?: boolean;
  pass?: boolean;
}) {
  const { t } = useLang();
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
  const theme = useTheme();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const safe = useRef<HTMLButtonElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const before = document.activeElement as HTMLElement | null;
    d.showModal();
    safe.current?.focus();
    return () => {
      d.close();
      if (before?.isConnected) before.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('.h-matchsettings-trigger')?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => { safe.current?.focus(); }, [confirm]);
  // A timeout or the peer's last answer can finish the round while this dialog is open.
  // Keep preferences available, but discard a confirmation based on the earlier playing state.
  useEffect(() => { if (resultReady) setConfirm(false); }, [resultReady]);

  const title = confirm ? t('Quit this game?', 'यह खेल छोड़ें?') : t('Game settings', 'खेल की सेटिंग्स');
  const quit = () => { setLeaving(true); onQuit(); };
  return (
    <dialog ref={dialog} className="h-matchsettings" aria-labelledby={`${id}-title`} aria-describedby={`${id}-note`}
      onCancel={(e) => { e.preventDefault(); if (!leaving) confirm ? setConfirm(false) : onClose(); }}>
      <div className="h-matchsettings__head">
        <div>
          <p className="h-matchsettings__brand"><BrandName /></p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <IconButton label={t('Close settings', 'सेटिंग्स बंद करें')} icon={<X size={20} />} disabled={leaving} onClick={onClose} />
      </div>
      <p className="h-sr" aria-live="polite">{resultReady ? t('The round has finished. Close settings to read the result.', 'राउंड ख़त्म हुआ। नतीजा पढ़ने के लिए सेटिंग्स बंद करें।') : ''}</p>
      {confirm ? <>
        <p id={`${id}-note`} className="h-matchsettings__note">
          {pass
            ? t('This game will end. Pass & Play scores are not saved to a profile.', 'यह खेल ख़त्म होगा। पास एंड प्ले के स्कोर प्रोफ़ाइल में सेव नहीं होते।')
            : t('The unfinished match will stop with no win or loss. XP from rounds already completed stays saved.', 'अधूरा मैच बिना जीत या हार के रुकेगा। पूरे हो चुके राउंड का XP सेव रहेगा।')}
        </p>
        <div className="h-matchsettings__actions">
          <Button ref={safe} variant="primary" trailing={null} disabled={leaving} onClick={() => setConfirm(false)}>{t('Keep playing', 'खेलते रहें')}</Button>
          <Button icon={<LogOut size={18} />} disabled={leaving} busy={leaving} onClick={quit}>{leaving ? t('Leaving…', 'बाहर जा रहे हैं…') : t('Yes, quit game', 'हाँ, खेल छोड़ें')}</Button>
        </div>
      </> : <>
        <p id={`${id}-note`} className="h-matchsettings__note">
          {resultReady
            ? t('The round has finished. Close settings to read the result.', 'राउंड ख़त्म हुआ। नतीजा पढ़ने के लिए सेटिंग्स बंद करें।')
            : running
            ? pass ? t('The stopwatch keeps running while settings are open.', 'सेटिंग्स खुली होने पर स्टॉपवॉच चलती रहेगी।') : t('The round keeps running while settings are open.', 'सेटिंग्स खुली होने पर राउंड चलता रहेगा।')
            : t('Changes apply immediately and stay on this device.', 'बदलाव तुरंत लागू होंगे और इसी फ़ोन पर रहेंगे।')}
        </p>
        <Button ref={safe} variant="primary" trailing={null} block onClick={onClose}>{t('Back to game', 'खेल पर वापस')}</Button>
        <div className="h-matchsettings__row">
          <span id={`${id}-sound`}><Volume2 size={19} aria-hidden="true" />{t('Sound', 'आवाज़')}</span>
          <button type="button" role="switch" aria-checked={prefs.sound} aria-labelledby={`${id}-sound`} onClick={() => setPref('sound', !prefs.sound)}>
            {prefs.sound ? t('On', 'चालू') : t('Off', 'बंद')}
          </button>
        </div>
        <label className="h-matchsettings__row" htmlFor={`${id}-theme`}>
          <span>{t('Theme', 'थीम')}</span>
          <select id={`${id}-theme`} value={theme.pref} onChange={(e) => theme.setTheme(e.target.value as ThemePref)}>
            <option value="light">{t('Day edition', 'दिन का संस्करण')}</option>
            <option value="dark">{t('Night edition', 'रात का संस्करण')}</option>
            <option value="system">{t('Match device', 'फ़ोन जैसा')}</option>
          </select>
        </label>
        <div className="h-matchsettings__exit">
          <Button variant="ghost" icon={<LogOut size={18} />} disabled={leaving} onClick={settled ? quit : () => setConfirm(true)}>
            {settled ? t('Leave results', 'नतीजे से बाहर जाएँ') : t('Quit game', 'खेल छोड़ें')}
          </Button>
        </div>
      </>}
    </dialog>
  );
}

/** Existing friend-lobby confirmation retains the shared native modal behavior. */
export function ConfirmLeave({ onStay, onLeave, body }: { onStay: () => void; onLeave: () => void; body?: ReactNode }) {
  const { t } = useLang();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const before = document.activeElement as HTMLElement | null;
    d.showModal();
    stay.current?.focus();
    return () => { d.close(); if (before?.isConnected) before.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className="h-leave" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} onCancel={(e) => { e.preventDefault(); onStay(); }}>
    <h2 className="h-leave__title" id={`${id}-title`}>{t('Leave the room?', 'रूम छोड़ें?')}</h2>
    <p className="h-leave__body" id={`${id}-body`}>{body ?? t('The match stops here with no result. Nothing is recorded as a loss.', 'मैच यहीं रुकेगा, कोई नतीजा नहीं। हार दर्ज नहीं होगी।')}</p>
    <div className="h-leave__actions"><Button variant="paper" onClick={onLeave}>{t('Leave', 'छोड़ें')}</Button><Button ref={stay} variant="primary" trailing={null} onClick={onStay}>{t('Stay', 'रुकें')}</Button></div>
  </dialog>;
}
