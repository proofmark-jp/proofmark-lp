import { useEffect, useRef, useState } from 'react';

export function useWakeLock(active: boolean) {
  const wakeLockRef = useRef<any | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      setIsSupported(false);
      return;
    }

    if (!active) {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
        setIsLocked(false);
      }
      return;
    }

    let cancelled = false;

    const requestLock = async () => {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (cancelled) {
          lock.release();
          return;
        }
        wakeLockRef.current = lock;
        setIsLocked(true);
      } catch (err: any) {
        // 低電力モード等で拒否された場合
        setIsLocked(false);
        console.warn(`[WakeLock] Failed: ${err.message}`);
      }
    };

    requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active && !wakeLockRef.current) {
        requestLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
        setIsLocked(false);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [active]);

  return { isLocked, isSupported };
}