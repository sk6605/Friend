'use client';

import { createContext, useContext } from 'react';

interface SidebarContextType {
  openSidebar: () => void;
}

export const SidebarContext = createContext<SidebarContextType>({
  openSidebar: () => {},
});

export function useSidebarContext() {
  return useContext(SidebarContext);
}
