import { flushSync } from 'react-dom';

const reduceMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function smoothUpdate(updater) {
  if (
    typeof document !== 'undefined' &&
    !reduceMotion &&
    typeof document.startViewTransition === 'function'
  ) {
    document.startViewTransition(() => flushSync(updater));
  } else {
    updater();
  }
}
