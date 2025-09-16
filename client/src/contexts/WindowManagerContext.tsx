import { createContext, useContext, useState, ReactNode } from 'react';

interface FloatingWindow {
  id: string;
  title: string;
  component: ReactNode;
  isOpen: boolean;
  zIndex: number;
  icon?: ReactNode;
}

interface WindowManagerContextType {
  windows: FloatingWindow[];
  openWindow: (id: string, title: string, component: ReactNode, icon?: ReactNode) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  getTopZIndex: () => number;
}

const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined);

const BASE_Z_INDEX = 1000;

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<FloatingWindow[]>([]);

  const getTopZIndex = () => {
    if (windows.length === 0) return BASE_Z_INDEX;
    return Math.max(...windows.map(w => w.zIndex)) + 1;
  };

  const openWindow = (id: string, title: string, component: ReactNode, icon?: ReactNode) => {
    setWindows(prev => {
      // Check if window already exists
      const existingIndex = prev.findIndex(w => w.id === id);
      
      if (existingIndex !== -1) {
        // Window exists, bring it to front and open it
        const newZIndex = getTopZIndex();
        return prev.map((w, index) => 
          index === existingIndex 
            ? { ...w, isOpen: true, zIndex: newZIndex }
            : w
        );
      } else {
        // Create new window
        const newWindow: FloatingWindow = {
          id,
          title,
          component,
          isOpen: true,
          zIndex: getTopZIndex(),
          icon
        };
        return [...prev, newWindow];
      }
    });
  };

  const closeWindow = (id: string) => {
    setWindows(prev => 
      prev.map(w => 
        w.id === id ? { ...w, isOpen: false } : w
      )
    );
  };

  const focusWindow = (id: string) => {
    setWindows(prev => {
      const targetWindow = prev.find(w => w.id === id);
      if (!targetWindow || !targetWindow.isOpen) return prev;

      const newZIndex = getTopZIndex();
      return prev.map(w => 
        w.id === id ? { ...w, zIndex: newZIndex } : w
      );
    });
  };

  return (
    <WindowManagerContext.Provider value={{
      windows,
      openWindow,
      closeWindow,
      focusWindow,
      getTopZIndex
    }}>
      {children}
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager() {
  const context = useContext(WindowManagerContext);
  if (context === undefined) {
    throw new Error('useWindowManager must be used within a WindowManagerProvider');
  }
  return context;
}