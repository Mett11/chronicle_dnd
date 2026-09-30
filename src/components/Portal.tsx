import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

let activePortalsCount = 0;

export const Portal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    activePortalsCount++;
    if (activePortalsCount === 1 && typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      setMounted(false);
      activePortalsCount = Math.max(0, activePortalsCount - 1);
      if (activePortalsCount === 0 && typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(children, document.body);
};
