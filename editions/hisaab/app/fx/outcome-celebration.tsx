import { HandHeart, Medal, Scale } from 'lucide-react';
import { useLang } from '../ui/lang';
import './outcome-celebration.css';

/** Inline acknowledgement, not a second overlay or a pressure prompt. Existing result owns sound. */
export function OutcomeCelebration({ outcome }: { outcome: 'win' | 'loss' | 'draw' }) {
  const { t } = useLang();
  const Icon = outcome === 'win' ? Medal : outcome === 'loss' ? HandHeart : Scale;
  return <p className={`h-outcome-cheer h-outcome-cheer--${outcome}`} role="status">
    <span className="h-outcome-cheer__mark" aria-hidden="true"><Icon size={24} strokeWidth={2} /></span>
    <span><strong>{outcome === 'win' ? t('Waah Waah! Jeet aapki.', 'वाह वाह! जीत आपकी।')
      : outcome === 'loss' ? t('Taali toh banti hai.', 'ताली तो बनती है।') : t('Dono ki file mazboot.', 'दोनों की फ़ाइल मज़बूत।')}</strong>
      <span className="h-outcome-cheer__note">{outcome === 'win' ? t('A good answer deserves a little applause.', 'अच्छे जवाब पर थोड़ी तालियाँ तो बनती हैं।')
        : outcome === 'loss' ? t('This duel went to them. The learning stays with you.', 'मुक़ाबला उनका। सीख आपकी।')
          : t('A draw. The receipts belong to both of you.', 'बराबरी। रसीदें दोनों की।')}</span></span>
  </p>;
}
