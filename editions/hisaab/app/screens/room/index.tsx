/** Legacy bot-room links now lead to the human duel desk. No bot match is created. */
import { useEffect } from 'react';
import { href, navigate, type ScreenProps } from '../../router';
import { Button } from '../../ui/button';
import { Page } from '../../ui/page';
import { useLang } from '../../ui/lang';
export default function RoomScreen(_props: ScreenProps) {
  const { t } = useLang();
  useEffect(() => { navigate(href.online(), { replace: true }); }, []);
  return <Page width="read" screen="room-redirect"><Button href={href.online()}>{t('Find a human duel', 'किसी खिलाड़ी से मुक़ाबला')}</Button></Page>;
}
