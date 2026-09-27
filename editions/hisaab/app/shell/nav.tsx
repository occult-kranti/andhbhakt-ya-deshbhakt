/**
 * shell/nav.tsx — `h-nav` (bible §5): the bottom bar on phones (64px + safe-area), a left rail of
 * 88px at ≥ 900px. Five items: Home, Files, Duel, Receipts, Me. Current = syahi text + a 3px bar.
 * Hidden in live rooms, pass-and-play and while a ceremony is open.
 */
import { CircleUser, FolderOpen, House, ReceiptText, Scale, Users } from 'lucide-react';
import type { NavTab } from '../router';
import { href } from '../router';
import { useLang } from '../ui/lang';

const ITEMS = [
  { id: 'home', en: 'Home', hi: 'होम', to: href.home(), Icon: House },
  { id: 'files', en: 'Files', hi: 'फ़ाइलें', to: href.files(), Icon: FolderOpen },
  { id: 'duel', en: 'Duel', hi: 'मुक़ाबला', to: href.duel(), Icon: Scale },
  { id: 'circles', en: 'Circles', hi: 'सर्कल', to: '#/circles', Icon: Users },
  { id: 'receipts', en: 'Receipts', hi: 'रसीदें', to: href.receipts(), Icon: ReceiptText },
  { id: 'me', en: 'Me', hi: 'मैं', to: href.me(), Icon: CircleUser },
] as const;

export function Nav({ tab }: { tab: NavTab }) {
  const { t, isHi } = useLang();
  return (
    <nav className="h-nav" aria-label={t('Main', 'मुख्य')}>
      <ul className="h-nav__list">
        {ITEMS.map(({ id, en, hi, to, Icon }) => (
          <li key={id} className="h-nav__li">
            <a className="h-nav__item" href={to} aria-current={tab === id ? 'page' : undefined} data-nav={id}>
              <Icon aria-hidden="true" size={24} strokeWidth={2.2} />
              <span className="h-nav__label" lang={isHi ? 'hi' : undefined}>
                {t(en, hi)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
