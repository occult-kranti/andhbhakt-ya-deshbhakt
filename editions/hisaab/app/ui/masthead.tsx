import { useLang } from './lang';
import { BrandName } from './brand';
import './masthead.css';

/** An original newspaper-inspired nameplate. The date is the local edition date, not a news claim. */
export function Masthead({ day }: { day: string }) {
  const { t, isHi } = useLang();
  const [year, month, date] = day.split('-').map(Number);
  const printedDate = new Intl.DateTimeFormat(isHi ? 'hi-IN' : 'en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(year, month - 1, date));
  return (
    <header className="h-masthead">
      <div className="h-masthead__edition">
        <span>{t('THE DAILY ACCOUNT', 'रोज़ का हिसाब')}</span>
        <time dateTime={day}>{printedDate}</time>
        <span>{t('PLAY. QUESTION. VERIFY.', 'खेलो। पूछो। जाँचो।')}</span>
      </div>
      <div className="h-masthead__name" role="img" aria-label="Andhbhakt ya Deshbhakt">
        <span className="h-masthead__side" lang="hi" aria-hidden="true">जनता का पैसा।<br />जनता का सवाल।</span>
        <BrandName className="h-masthead__title" />
        <span className="h-masthead__seal" lang="hi" aria-hidden="true">अंधभक्त या देशभक्त<br /><small>हर जवाब की रसीद</small></span>
      </div>
      <p className="h-masthead__strap">{t('A quiz on public money, power & the paper trail.', 'जनता के पैसे, सत्ता और दस्तावेज़ों पर एक क्विज़।')}</p>
    </header>
  );
}
