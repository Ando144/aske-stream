export interface FirstStepsInput {
  hidden: boolean;
  completed: boolean;
  libraryLoaded: boolean;
  radioLoaded: boolean;
  steps: boolean[];
}

/** Decides what the checklist shows; waits for data so it never flashes before loading. */
export function firstStepsView(input: FirstStepsInput): 'none' | 'wait' | 'complete' | 'show' {
  if (input.hidden || input.completed) return 'none';
  if (!input.libraryLoaded || !input.radioLoaded) return 'wait';
  if (input.steps.every(Boolean)) return 'complete';
  return 'show';
}
