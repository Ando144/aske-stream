import { create } from 'zustand';
import { loadValue, savePref } from '../lib/storage';

/** Which first-time explanations the user has already seen. */
interface TipsState {
  welcomeSeen: boolean;
  dismissed: string[];
  firstStepsHidden: boolean;
  helpVisited: boolean;
  finishWelcome: () => void;
  dismiss: (id: string) => void;
  hideFirstSteps: () => void;
  markHelpVisited: () => void;
  /** Settings → Help → "Show tips again". */
  resetAll: () => void;
}

const KEY = 'tips-v1';

interface Saved {
  welcomeSeen: boolean;
  dismissed: string[];
  firstStepsHidden: boolean;
  helpVisited: boolean;
}

const DEFAULTS: Saved = {
  welcomeSeen: false,
  dismissed: [],
  firstStepsHidden: false,
  helpVisited: false,
};

export const useTips = create<TipsState>((set, get) => {
  const save = (patch: Partial<Saved>) => {
    const { welcomeSeen, dismissed, firstStepsHidden, helpVisited } = { ...get(), ...patch };
    savePref(KEY, { welcomeSeen, dismissed, firstStepsHidden, helpVisited });
    set(patch);
  };
  // Installations from before the introduction existed have already set things up.
  const saved = loadValue<Saved | null>(KEY, null) ?? {
    ...DEFAULTS,
    welcomeSeen: loadValue<unknown>('setup', null) !== null,
  };
  return {
    ...DEFAULTS,
    ...saved,
    finishWelcome: () => save({ welcomeSeen: true }),
    dismiss: (id) => {
      if (!get().dismissed.includes(id)) save({ dismissed: [...get().dismissed, id] });
    },
    hideFirstSteps: () => save({ firstStepsHidden: true }),
    markHelpVisited: () => {
      if (!get().helpVisited) save({ helpVisited: true });
    },
    resetAll: () => {
      savePref('dl-intro-seen', false);
      save({ ...DEFAULTS, welcomeSeen: true });
    },
  };
});
