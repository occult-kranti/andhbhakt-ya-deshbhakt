import { useState } from 'react';
import { useLang } from '../../ui/lang';

const KEY = 'hd-landing-preference-v1';
export type LandingChoice = 'home' | 'daily';
export function readLandingPreference(): LandingChoice {
  try { return localStorage.getItem(KEY) === 'daily' ? 'daily' : 'home'; } catch { return 'home'; }
}
export function LandingPreference() {
  const { t } = useLang();
  const [choice, setChoice] = useState(readLandingPreference);
  const [note, setNote] = useState('');
  return <div className="h-home__landing">
    <label htmlFor="h-landing-choice">{t('When I come back', 'जब मैं लौटूँ')}</label>
    <select id="h-landing-choice" value={choice} onChange={e => {
      const next = e.target.value as LandingChoice; setChoice(next);
      try { localStorage.setItem(KEY, next); setNote(t('Saved on this browser.', 'इस ब्राउज़र में सहेजा गया।')); }
      catch { setNote(t('This browser could not save the choice.', 'यह ब्राउज़र पसंद सहेज नहीं पाया।')); }
    }}>
      <option value="home">{t('Home · choose a duel', 'होम · मुक़ाबला चुनूँ')}</option>
      <option value="daily">{t('Today’s file · duel desk', 'आज की फ़ाइल · मुक़ाबला डेस्क')}</option>
    </select>
    <p className="h-meta">{t('Today’s file is ready when you return. You choose when to play.', 'लौटने पर आज की फ़ाइल तैयार मिलेगी। खेल आपकी मर्ज़ी से शुरू होगा।')}</p>
    <span role="status" className="h-meta">{note}</span>
  </div>;
}
