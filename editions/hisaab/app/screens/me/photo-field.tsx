import { useRef, useState, useSyncExternalStore } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { useLang } from '../../ui/lang';
import { normalizePortrait, readPortrait, savePortrait, subscribePortrait } from './portrait-store.mjs';

export const usePortrait = () => useSyncExternalStore(subscribePortrait, readPortrait, () => null) as string | null;

export function PhotoField() {
  const portrait = usePortrait(); const { t } = useLang();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const choose = async (file?: File) => {
    if (!file) return;
    setBusy(true); setMessage('');
    try {
      const image = await normalizePortrait(file);
      const saved = savePortrait(image);
      setMessage(saved.persisted ? t('Photo ready. Kept on this device.', 'तस्वीर तैयार। इसी डिवाइस पर।') : t('Photo ready for this visit. Storage is unavailable.', 'इस बार के लिए तस्वीर तैयार। सेव नहीं हो सकी।'));
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  return <section className="h-photo" aria-label={t('Certificate photo', 'प्रमाण पत्र की तस्वीर')}>
    <div className="h-photo__intro">{portrait && <img className="h-photo__preview" src={portrait} alt={t('Your chosen certificate photo', 'आपकी चुनी हुई तस्वीर')} />}<div><strong>{t('Put your face on the receipt.', 'रसीद पर अपना चेहरा।')}</strong><p>{t('Optional · JPG, PNG or WebP · up to 5 MB. A square centre crop, stored only here.', 'वैकल्पिक · JPG, PNG या WebP · 5 MB तक। बीच से चौकोर तस्वीर, सिर्फ़ यहीं सेव।')}</p></div></div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="h-sr" aria-label={t('Choose profile photo', 'प्रोफ़ाइल तस्वीर चुनें')} onChange={event => void choose(event.target.files?.[0])} disabled={busy} />
    <div className="h-photo__actions"><Button variant="paper" icon={<Camera size={18} />} busy={busy} onClick={() => input.current?.click()}>{portrait ? t('Change photo', 'तस्वीर बदलें') : t('Add photo', 'तस्वीर जोड़ें')}</Button>{portrait && <Button variant="ghost" icon={<Trash2 size={18} />} disabled={busy} onClick={() => { const result = savePortrait(null); setMessage(result.persisted ? t('Photo removed.', 'तस्वीर हटा दी।') : t('Photo removed for this visit. Browser storage could not be cleared.', 'इस बार तस्वीर हटा दी। ब्राउज़र स्टोरेज साफ़ नहीं हो सका।')); }}>{t('Remove', 'हटाएँ')}</Button>}</div>
    <p className="h-photo__status" role="status">{message || t('Your photo appears only in certificates you choose to share.', 'तस्वीर सिर्फ़ आपके चुने हुए शेयर में जाती है।')}</p>
  </section>;
}
