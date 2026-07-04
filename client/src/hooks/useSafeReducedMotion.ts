'use client';

import { useState, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

export function useSafeReducedMotion(): boolean {
  const [isSafe, setIsSafe] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setIsSafe(true);
  }, []);

  if (!isSafe) {
    return false;
  }

  return shouldReduceMotion ?? false;
}
