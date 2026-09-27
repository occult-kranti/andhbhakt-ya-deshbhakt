/**
 * screens/me/index.tsx — the Me tab (design bible §11.14):
 *   #/me              → Profile: the label ladder, stats, duel performance, Stamp Register, Activity
 *   #/me/certificate  → the Certificate of Labelling (one per rung held; ?band=n picks an earlier one)
 */
import type { ScreenProps } from '../../router';
import { CertificateView } from './certificate-view';
import { Profile } from './profile';

export default function MeScreen({ route }: ScreenProps) {
  return route.view === 'certificate' ? <CertificateView route={route} /> : <Profile />;
}
