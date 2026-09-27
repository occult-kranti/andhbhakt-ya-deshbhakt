import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { getPrefs, setPref, subscribePrefs } from '@/lib/fx/prefs';
import { useTheme, type ThemePref } from '../../shell/theme';
import { Button } from '../../ui/button';
import { useLang } from '../../ui/lang';

export function OnlineSettings({ running, onClose, onQuit }: { running: boolean; onClose: () => void; onQuit: () => void }) {
  const { t } = useLang(); const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getPrefs); const theme = useTheme(); const id = useId();
  const dialog = useRef<HTMLDialogElement>(null); const stay = useRef<HTMLButtonElement>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const d = dialog.current!; const previous = document.activeElement as HTMLElement | null;
    d.showModal(); stay.current?.focus();
    return () => { d.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="h-matchsettings" aria-labelledby={id} onCancel={e => { e.preventDefault(); confirm ? setConfirm(false) : onClose(); }}>
    <h2 id={id}>{confirm ? t('Leave this online table?', 'ऑनलाइन बैठक छोड़ें?') : t('Game settings', 'खेल की सेटिंग्स')}</h2>
    <p className="h-matchsettings__note">{confirm ? t('Leaving ends this match. An unfinished match does not count on ranked boards. XP from answers already recorded stays on your online profile.', 'बाहर जाने पर मुक़ाबला ख़त्म होगा। अधूरा मुक़ाबला रैंकिंग में नहीं जुड़ता। दर्ज जवाबों का XP ऑनलाइन प्रोफ़ाइल में रहता है।') : running ? t('The server clock continues while settings are open.', 'सेटिंग्स खुली हों तब भी सर्वर की घड़ी चलती है।') : t('Your display preferences stay on this device.', 'दिखावट की पसंद इस डिवाइस पर रहती है।')}</p>
    <Button ref={stay} variant="primary" block onClick={confirm ? () => setConfirm(false) : onClose}>{confirm ? t('Keep playing', 'खेलते रहें') : t('Back to game', 'खेल पर वापस')}</Button>
    {!confirm && <div className="h-matchsettings__row"><span id={`${id}-sound`}>{t('Sound', 'आवाज़')}</span><button type="button" role="switch" aria-checked={prefs.sound} aria-labelledby={`${id}-sound`} onClick={() => setPref('sound', !prefs.sound)}>{prefs.sound ? t('On', 'चालू') : t('Off', 'बंद')}</button></div>}
    {!confirm && <label className="h-matchsettings__row"><span>{t('Theme', 'थीम')}</span><select value={theme.pref} onChange={e => theme.setTheme(e.target.value as ThemePref)}><option value="light">{t('Day edition', 'दिन का संस्करण')}</option><option value="dark">{t('Night edition', 'रात का संस्करण')}</option><option value="classic">{t('Classic edition', 'क्लासिक संस्करण')}</option><option value="rotate">{t('Rotate editions', 'बदलते संस्करण')}</option><option value="system">{t('Match device', 'फ़ोन जैसा')}</option></select></label>}
    <div className="h-matchsettings__exit"><Button variant="ghost" onClick={confirm || !running ? onQuit : () => setConfirm(true)}>{confirm ? t('Yes, leave match', 'हाँ, मुक़ाबला छोड़ें') : t('Leave game', 'खेल छोड़ें')}</Button></div>
  </dialog>;
}
