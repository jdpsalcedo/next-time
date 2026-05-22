import { createContext, useContext, useEffect, useState } from 'react';
import { subscribeSlimeDefaults } from './firebaseStore.js';

const EMPTY = { hop_frames: null, sleep_frames: null, emerald_skin: null };
const SlimeDefaultsContext = createContext(EMPTY);

/**
 * Subscribes once to the global `cosmetics/defaults` doc and broadcasts the
 * admin-edited hop/sleep frames + emerald override to every SlimeSprite.
 */
export function SlimeDefaultsProvider({ children }) {
  const [defaults, setDefaults] = useState(EMPTY);
  useEffect(() => {
    return subscribeSlimeDefaults(setDefaults);
  }, []);
  return (
    <SlimeDefaultsContext.Provider value={defaults}>
      {children}
    </SlimeDefaultsContext.Provider>
  );
}

export function useSlimeDefaults() {
  return useContext(SlimeDefaultsContext);
}
