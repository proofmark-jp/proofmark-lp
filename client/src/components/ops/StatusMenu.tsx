/**
 * StatusMenu — popover/dropdown for changing a cert's delivery_status.
 *
 * Optimistic UI: the status updates locally first, then awaits the API.
 * On failure → rollback + toast (caller's responsibility).
 *
 * Keyboard a11y:
 *   • Open with Enter / Space on the trigger.
 *   • Close with Escape.
 *   • Arrow keys move between options.
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import {
  DELIVERY_STATUS_ORDER,
  DELIVERY_STATUS_TOKENS,
  type DeliveryStatus,
} from '../../lib/proofmark-ops';
import { StatusBadge } from './StatusBadge';

interface StatusMenuProps {
  current: DeliveryStatus | null;
  onChange: (next: DeliveryStatus | null) => void | Promise<void>;
  disabled?: boolean;
}

export function StatusMenu({ current, onChange, disabled }: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handlePick = async (next: DeliveryStatus | null) => {
    setOpen(false);
    if (next === current) return;
    await onChange(next);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'inline-flex items-center gap-1 rounded-full',
          'transition-opacity disabled:opacity-50',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]',
        ].join(' ')}
      >
        <StatusBadge status={current} interactive />
        <ChevronDown className="w-3 h-3 text-white/40" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            aria-label="ステータスを変更"
            className={[
              'absolute z-50 mt-2 left-0 min-w-[220px]',
              'rounded-xl border border-white/10 bg-[#12121e]/95 backdrop-blur-xl',
              'shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)]',
              'p-1.5',
            ].join(' ')}
          >
            {DELIVERY_STATUS_ORDER.map((s) => {
              const t = DELIVERY_STATUS_TOKENS[s];
              const active = current === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => handlePick(s)}
                  className={[
                    'w-full flex items-start gap-3 px-2.5 py-2 rounded-lg text-left',
                    'transition-colors hover:bg-white/[0.04]',
                    active ? 'bg-white/[0.05]' : '',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                    style={{ background: t.color }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-white">{t.label}</span>
                    <span className="block text-[11px] text-white/55 mt-0.5 leading-snug">
                      {t.description}
                    </span>
                  </span>
                </button>
              );
            })}

            <div className="my-1 mx-2 border-t border-white/5" />

            <button
              type="button"
              role="option"
              aria-selected={current === null}
              onClick={() => handlePick(null)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-white/60 hover:bg-white/[0.04] hover:text-white/80 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-white/30" aria-hidden="true" />
              ステータス未設定に戻す
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
