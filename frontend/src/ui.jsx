import { createContext, useCallback, useContext, useState } from 'react';

const UICtx = createContext(null);

export function UIProvider({ children }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  return (
    <UICtx.Provider value={{ searchOpen, openSearch, closeSearch }}>
      {children}
    </UICtx.Provider>
  );
}

export function useUI() {
  const v = useContext(UICtx);
  if (!v) throw new Error('useUI requires UIProvider');
  return v;
}
