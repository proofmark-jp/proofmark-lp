import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Cpu,
  FileText,
  Folder,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface ZipEntry {
  id: string;
  icon: React.ReactNode;
  iconColor: string;
  name: string;
  title: string;
  description: string;
}

const ENTRIES: ReadonlyArray<ZipEntry> = [
  {
    id: 'cert',
    icon: <FileText className="h-4 w-4" />,
    iconColor: '#00D4AA',
    name: 'Certificate_of_Authenticity.pdf',
    title: 'クライアントに渡す証明書',
    description: '印刷・法務提出対応。SHA-256とタイムスタンプを記載した正式書面。',
  },
  {
    id: 'cover',
    icon: <FileText className="h-4 w-4" />,
    iconColor: '#BC78FF',
    name: 'Cover_Letter.pdf',
    title: 'クライアント向け説明レター',
    description: 'そのまま納品メールに添付できる、検証手順入りの紹介状。',
  },
  {
    id: 'tsr',
    icon: <ShieldCheck className="h-4 w-4" />,
    iconColor: '#F0BB38',
    name: 'TIMESTAMP.tsr',
    title: 'RFC3161 生トークン',
    description: 'ProofMarkなしでも独立検証できる、IETF標準のバイナリトークン。',
  },
  {
    id: 'sh',
    icon: <Terminal className="h-4 w-4" />,
    iconColor: '#A8A0D8',
    name: 'verify.sh',
    title: 'ターミナル1コマンドで改ざん検証',
    description: 'macOS / Linux / WSL でopenssl使用。コピペで動くワンライナー。',
  },
  {
    id: 'py',
    icon: <Cpu className="h-4 w-4" />,
    iconColor: '#A8A0D8',
    name: 'verify.py',
    title: 'Python3 検証スクリプト',
    description: 'クロスプラットフォーム対応。クライアントが社内で再検証可能。',
  },
  {
    id: 'howto',
    icon: <FileText className="h-4 w-4" />,
    iconColor: '#A8A0D8',
    name: 'HOW_TO_VERIFY.txt',
    title: '4つの検証方法の説明書',
    description: 'ブラウザ・shell・python・OpenSSL の各方法を網羅。クライアントにも渡せます。',
  },
];

export default function ZipContentsShowcase(): JSX.Element {
  const reduce = useReducedMotion() ?? false;
  const [activeId, setActiveId] = useState<string>(ENTRIES[0].id);
  const active = ENTRIES.find((e) => e.id === activeId) ?? ENTRIES[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
      {/* tree */}
      <div
        className="rounded-[24px] border p-5 sm:p-6"
        style={{
          background: '#0D0B24',
          borderColor: '#1C1A38',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-white">
          <Folder className="h-4 w-4" style={{ color: '#BC78FF' }} />
          ProofMark_Evidence_Pack_A3F7.zip
        </div>

        <ul className="ml-2 border-l pl-3" style={{ borderColor: '#1C1A38' }}>
          {ENTRIES.map((e) => {
            const isActive = e.id === activeId;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(e.id)}
                  onMouseEnter={() => setActiveId(e.id)}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                  style={{
                    background: isActive ? 'rgba(108,62,244,0.10)' : 'transparent',
                    transition: 'background 200ms',
                  }}
                >
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      color: e.iconColor,
                    }}
                  >
                    {e.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate font-mono text-[12.5px]"
                      style={{
                        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.78)',
                      }}
                    >
                      {e.name}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100"
                    style={{
                      color: e.iconColor,
                      opacity: isActive ? 1 : undefined,
                      transition: 'opacity 200ms',
                    }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* description card */}
      <div
        className="relative overflow-hidden rounded-[24px] border p-6 sm:p-7"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005))',
          borderColor: '#1C1A38',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -8 }}
            transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: active.iconColor,
                }}
              >
                {active.icon}
              </span>
              <span
                className="font-mono text-[12px]"
                style={{ color: 'rgba(255,255,255,0.62)' }}
              >
                {active.name}
              </span>
            </div>
            <h3
              className="text-[20px] font-extrabold text-white sm:text-[22px]"
              style={{ letterSpacing: '-0.015em' }}
            >
              {active.title}
            </h3>
            <p
              className="mt-3 text-[14px] leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.72)' }}
            >
              {active.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
