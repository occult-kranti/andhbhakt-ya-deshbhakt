/**
 * editions/hisaab/app/app.tsx — the Andhbhakt ya Deshbhakt app: providers + the shell.
 *
 *   LocaleProvider (@/app/use-locale)      the chrome's language, persisted per device
 *   └ FxProvider (@/components/fx)         particles, sound (silent until the first tap), haptics
 *     └ FxBudgetBridge (shell/)            the fx layer's pop-ups go through app/budget.ts
 *       └ PlayerProvider (shell/)          ONE usePlayer() for the app (useAppPlayer / useRecordRoom)
 *         └ Shell (shell/)                 top bar, nav / rail, the routed screen, toast + ceremony hosts
 *
 * The theme is applied before the first render by main.tsx (shell/theme.ts). See app/README.md.
 */
import { LocaleProvider } from '@/app/use-locale';
import { FxProvider } from '@/components/fx';
import { FxBudgetBridge } from './shell/fx-bridge';
import { PlayerProvider } from './shell/player';
import { Shell } from './shell/shell';
// Our CSS after the shared modules' own (locale.css, fx.css), so the edition's cascade wins ties.
import '../theme/tokens.css';
import './fonts.css';
import './base.css';

export function App() {
  return (
    <LocaleProvider>
      <FxProvider>
        <FxBudgetBridge>
          <PlayerProvider>
            <Shell />
          </PlayerProvider>
        </FxBudgetBridge>
      </FxProvider>
    </LocaleProvider>
  );
}

export default App;
