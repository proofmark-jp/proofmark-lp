// client/src/components/proof/TimelineWorkspace.tsx
import { useState, type Dispatch, type SetStateAction, type RefObject, type ChangeEvent } from 'react';
import { AnimatePresence, Reorder, motion } from 'framer-motion';
import {
  CloudLightning,
  CheckCircle2,
  ImagePlus,
  Lock,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import type { WorkspaceStep } from '../../hooks/useMediaPipeline';
import KineticEvolutionScrub from './KineticEvolutionScrub';

/* ── Constants ── */
const FLICK_VELOCITY_THRESHOLD = 400;

/* ═══════════════════════════════════════════════════════════════
   ChainConnector (内部サブコンポーネント)
   ═══════════════════════════════════════════════════════════════ */

function ChainConnector({ verified }: { verified: boolean }) {
  return (
    <div className="flex items-center justify-center w-8 shrink-0">
      <div className="flex flex-col items-center gap-0.5">
        <div
          className={`w-0.5 h-2.5 transition-colors duration-700 ${
            verified
              ? 'bg-gradient-to-b from-transparent to-[#00D4AA]'
              : 'bg-gradient-to-b from-transparent to-white/10'
          }`}
        />
        <div
          className={`
            w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-700
            ${
              verified
                ? 'border-[#00D4AA]/60 bg-[#00D4AA]/15 shadow-[0_0_10px_rgba(0,212,170,0.3)]'
                : 'border-white/10 bg-white/5'
            }
          `}
        >
          {verified ? (
            <Lock className="w-2.5 h-2.5 text-[#00D4AA]" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-[#6C3EF4] animate-pulse" />
          )}
        </div>
        <div
          className={`w-0.5 h-2.5 transition-colors duration-700 ${
            verified
              ? 'bg-gradient-to-b from-[#00D4AA] to-transparent'
              : 'bg-gradient-to-b from-white/10 to-transparent'
          }`}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TimelineCard (内部サブコンポーネント)
   ═══════════════════════════════════════════════════════════════ */

// lucide-react の CheckCircle2 を CloudAll として再利用（既存の慣習を踏襲）
const CloudAll = CheckCircle2;

interface TimelineCardProps {
  step: WorkspaceStep;
  index: number;
  totalSteps: number;
  isSilentAnchor: boolean;
  isHead: boolean;
  sealed: boolean;
  onUpdate: (id: string, patch: Partial<WorkspaceStep>) => void;
  onRemove: (id: string) => void;
  onReplace: (file: File) => void;
}

function TimelineCard({
  step,
  index,
  totalSteps,
  isSilentAnchor,
  isHead,
  onUpdate,
  onRemove,
  onReplace,
}: TimelineCardProps) {
  // UIローカル state: インライン編集フラグはビジネスロジックではなく純粋なUI状態
  const [editingTitle, setEditingTitle] = useState(false);

  const handleDragEnd = (_: unknown, info: { velocity: { y: number } }) => {
    if (step.isRoot) return;
    if (Math.abs(info.velocity.y) > FLICK_VELOCITY_THRESHOLD) {
      onRemove(step.id);
    }
  };

  const isOrigin = index === 0;
  const badgeIcon = isOrigin ? '🎨' : isSilentAnchor ? '' : isHead ? '🏁' : '📝';
  const badgeLabel = isOrigin ? '起点' : isSilentAnchor ? '' : isHead ? 'HEAD (完成品)' : '途中工程';
  const badgeColor = isOrigin ? '#F59E0B' : isSilentAnchor || isHead ? '#00D4AA' : '#818CF8';
  const badgeBg = isHead
    ? 'rgba(0,212,170,0.12)'
    : isOrigin
      ? 'rgba(245,158,11,0.12)'
      : 'rgba(129,140,248,0.12)';

  const confidencePulse = step.sameTimestamp;

  return (
    <Reorder.Item
      value={step}
      id={step.id}
      dragListener={(!isSilentAnchor && !editingTitle) as boolean}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.04, zIndex: 50, boxShadow: '0 20px 60px rgba(0,212,170,0.2)' }}
      layout
      layoutId={step.id}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, y: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className={`
        relative w-[150px] sm:w-[190px] md:w-[210px] rounded-2xl border backdrop-blur-md touch-pan-y
        transition-[border-color,box-shadow] duration-300 shrink-0 group/card cursor-grab active:cursor-grabbing
        bg-white/5
        ${
          isSilentAnchor || isHead
            ? 'border-[#00D4AA]/30 shadow-[0_0_30px_rgba(0,212,170,0.12)]'
            : step.hashState === 'hashing'
              ? 'border-[#6C3EF4]/50 shadow-[0_0_25px_rgba(108,62,244,0.15)]'
              : step.hashState === 'verified'
                ? 'border-[#00D4AA]/20 hover:border-[#00D4AA]/40'
                : 'border-white/10 hover:border-white/20'
        }
        ${confidencePulse && !isSilentAnchor && !isHead ? 'animate-confidence-pulse' : ''}
      `}
    >
      {confidencePulse && !isSilentAnchor && !isHead && (
        <motion.div
          className="absolute -inset-px rounded-2xl pointer-events-none"
          animate={{ borderColor: ['#F59E0B', '#00D4AA', '#F59E0B'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ border: '1px solid' }}
        />
      )}

      <div className="relative aspect-[4/3] bg-[#0D0B24] overflow-hidden rounded-t-2xl group/thumb">
        {step.previewUrl ? (
          <img
            src={step.previewUrl}
            alt={step.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <label className="cursor-pointer flex flex-col items-center gap-2 text-[#A8A0D8]/40 hover:text-[#00D4AA] transition-colors">
              <ImagePlus className="w-8 h-8" />
              <span className="text-[10px] font-medium">画像を選択</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onReplace(f);
                }}
              />
            </label>
          </div>
        )}

        {step.hashState === 'hashing' && (
          <div className="absolute inset-0 bg-[#07061A]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <div className="relative w-12 h-12">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(108,62,244,0.15)" strokeWidth="3" />
                <circle
                  cx="24" cy="24" r="20" fill="none" stroke="#6C3EF4" strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - (step.hashProgress ?? 0))}`}
                  strokeLinecap="round"
                  className="transition-all duration-200"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-mono font-bold text-[#6C3EF4]">
                  {Math.round((step.hashProgress ?? 0) * 100)}%
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#6C3EF4] uppercase">Hashing…</span>
          </div>
        )}

        {step.hashState === 'verified' && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#6C3EF4] via-[#00D4AA] to-[#6C3EF4] opacity-70" />
        )}

        <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1 z-10 min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-6 h-6 rounded-lg bg-[#07061A]/80 backdrop-blur-sm flex items-center justify-center border border-white/10 shrink-0">
              <span className="text-[10px] font-black text-white">{index + 1}</span>
            </div>
            {step.isRoot && (
              <div className="px-1.5 py-0.5 rounded-lg bg-[#00D4AA]/20 backdrop-blur-sm border border-[#00D4AA]/30 flex items-center gap-1 shrink-0">
                <Shield className="w-2.5 h-2.5 text-[#00D4AA]" />
                <span className="text-[8px] font-black text-[#00D4AA] uppercase tracking-wider hidden sm:inline">Root</span>
              </div>
            )}
          </div>
          {!isSilentAnchor && (
            <AnimatePresence mode="wait">
              <motion.div
                key={badgeLabel}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="px-2 py-0.5 rounded-lg text-[10px] font-bold backdrop-blur-sm shrink-0"
                style={{ color: badgeColor, backgroundColor: badgeBg, border: `1px solid ${badgeColor}30` }}
              >
                {badgeIcon} {badgeLabel}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {(isSilentAnchor || isHead) && (
          <div className="absolute bottom-2 right-2 z-20">
            <motion.div
              animate={{ boxShadow: ['0 0 10px rgba(0,212,170,0.4)', '0 0 24px rgba(0,212,170,0.8)', '0 0 10px rgba(0,212,170,0.4)'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-8 h-8 rounded-xl bg-[#00D4AA]/20 border border-[#00D4AA]/40 flex items-center justify-center"
              title={isHead ? 'HEAD: オリジナル画質を保持' : '原本アンカー'}
            >
              <Lock className="w-4 h-4 text-[#00D4AA]" />
            </motion.div>
          </div>
        )}

        {!step.isRoot && totalSteps > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(step.id); }}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-[#07061A]/80 backdrop-blur-sm border border-white/10 flex items-center justify-center text-[#A8A0D8]/50 hover:text-[#FF4D4D] hover:border-[#FF4D4D]/30 transition-colors opacity-0 group-hover/thumb:opacity-100"
            style={isHead ? { right: 'auto', left: 8 } : undefined}
            title="削除（編集後は自動で新リヴィジョン）"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {step.previewUrl && !step.isRoot && !isHead && (
          <label className="absolute bottom-2 left-2 w-7 h-7 rounded-lg bg-[#07061A]/80 backdrop-blur-sm border border-white/10 flex items-center justify-center text-[#A8A0D8]/50 hover:text-[#00D4AA] hover:border-[#00D4AA]/30 transition-colors opacity-0 group-hover/thumb:opacity-100 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReplace(f);
              }}
            />
          </label>
        )}
      </div>

      {!isSilentAnchor && (
        <div className="px-3 py-2.5">
          {editingTitle ? (
            <input
              autoFocus
              className="w-full bg-transparent border-b border-[#00D4AA]/60 text-xs font-bold text-white pb-0.5 focus:outline-none"
              value={step.title}
              onChange={(e) => onUpdate(step.id, { title: e.target.value })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(false); }}
            />
          ) : (
            <div className="flex items-center justify-between mb-1 min-w-0 flex-1">
              <p
                className="text-xs font-bold text-white truncate cursor-text hover:text-[#00D4AA] transition-colors min-w-0 flex-1"
                onClick={() => setEditingTitle(true)}
              >
                {step.title}
              </p>
              {!step.isRoot && step.uploadState === 'uploading' && (
                <CloudLightning className="w-3 h-3 text-[#00D4AA] animate-pulse ml-2 shrink-0" />
              )}
              {!step.isRoot && step.uploadState === 'uploaded' && (
                <CloudAll className="w-3 h-3 text-[#00D4AA] ml-2 shrink-0" />
              )}
              {!step.isRoot && step.uploadState === 'error' && (
                <button
                  onClick={() => onUpdate(step.id, { uploadState: 'idle' })}
                  title="アップロード再試行"
                  className="ml-2 shrink-0"
                >
                  <RefreshCw className="w-3 h-3 text-[#FF4D4D]" />
                </button>
              )}
            </div>
          )}

          {/* Note editing — UI local state のみ。本文は onUpdate で外部へ伝搬。 */}
          <NoteEditor step={step} onUpdate={onUpdate} />

          {step.hashState === 'verified' && step.sha256 && (
            <div className="mt-1.5 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-[#00D4AA]" />
              <span className="text-[8px] font-mono text-[#00D4AA]/60 tracking-wider">
                {step.sha256.slice(0, 8)}…{step.sha256.slice(-6)}
              </span>
            </div>
          )}

          {!step.isRoot && (
            isHead ? (
              <p className="mt-1.5 text-[8px] text-[#00D4AA]/60 font-bold tracking-wide">★ オリジナル画質保持</p>
            ) : (
              <p className="mt-1.5 text-[8px] text-white/20 font-medium">↕ フリックで削除</p>
            )
          )}
        </div>
      )}
    </Reorder.Item>
  );
}

/* Note編集のローカルUI状態をサブコンポーネントに分離（TimelineCardの肥大化を防ぐ） */
function NoteEditor({
  step,
  onUpdate,
}: {
  step: WorkspaceStep;
  onUpdate: (id: string, patch: Partial<WorkspaceStep>) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <textarea
        autoFocus
        className="w-full mt-1 bg-transparent border-b border-[#00D4AA]/60 text-[10px] text-[#A8A0D8] pb-0.5 focus:outline-none resize-none min-h-[32px]"
        value={step.note ?? ''}
        onChange={(e) => onUpdate(step.id, { note: e.target.value })}
        onBlur={() => setEditing(false)}
        placeholder="メモを追加..."
      />
    );
  }
  return (
    <p
      className="mt-0.5 text-[10px] text-[#A8A0D8]/40 truncate cursor-text hover:text-[#A8A0D8]/70 transition-colors"
      onClick={() => setEditing(true)}
    >
      {step.note || 'メモを追加...'}
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROPS — TimelineWorkspace
   ═══════════════════════════════════════════════════════════════ */

export interface TimelineWorkspaceProps {
  steps: WorkspaceStep[];
  isHydrating: boolean;
  magicMode: boolean;
  sealed: boolean;
  revisionLabel: string;
  globalDragOver: boolean;
  /** Reorder.Group の onReorder コールバック */
  onReorder: Dispatch<SetStateAction<WorkspaceStep[]>>;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<WorkspaceStep>) => void;
  onReplace: (stepId: string, file: File) => void;
  /** 空キャンバスクリック時のファイル選択 */
  onOpenFileDialog: () => void;
  /** ファイル input の ref（親で fileInputRef を管理し、hidden input を置く） */
  fileInputRef: RefObject<HTMLInputElement>;
  onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function TimelineWorkspace({
  steps,
  isHydrating,
  magicMode,
  sealed,
  revisionLabel,
  globalDragOver,
  onReorder,
  onRemove,
  onUpdate,
  onReplace,
  onOpenFileDialog,
  fileInputRef,
  onFileInputChange,
}: TimelineWorkspaceProps) {
  const readyCount = steps.filter(
    (s) => s.isRoot || (s.file && s.title.trim()),
  ).length;

  return (
    <>
      {/* Loading State */}
      {isHydrating && (
        <div className="flex flex-col items-center justify-center py-20 md:py-28 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-md animate-pulse">
          <svg className="w-8 h-8 text-[#00D4AA] animate-spin mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <div className="text-sm font-bold text-white tracking-widest uppercase">
            {magicMode ? 'Loading Timeline...' : 'Restoring Timeline...'}
          </div>
          <div className="text-xs text-[#A8A0D8]/60 mt-2">
            {magicMode ? '工程ファイルをタイムラインに展開しています' : '過去の証明データを安全に復元しています'}
          </div>
        </div>
      )}

      {/* Empty Canvas */}
      {steps.length === 0 && !isHydrating && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={onOpenFileDialog}
          className={`
            relative group cursor-pointer rounded-3xl border-2 border-dashed py-20 md:py-28
            transition-all duration-300 overflow-hidden
            ${
              globalDragOver
                ? 'border-[#00D4AA] bg-[#00D4AA]/10 shadow-[0_0_60px_rgba(0,212,170,0.2)]'
                : 'border-white/10 bg-white/5 hover:border-[#00D4AA]/40 hover:bg-[#00D4AA]/5'
            }
          `}
        >
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'radial-gradient(circle, #00D4AA 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
          <div className="relative flex flex-col items-center gap-4 text-center px-4">
            <div
              className={`
                w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
                ${globalDragOver ? 'bg-[#00D4AA] shadow-[0_0_40px_rgba(0,212,170,0.6)] scale-110' : 'bg-[#00D4AA]/10 group-hover:bg-[#00D4AA]/20'}
              `}
            >
              {globalDragOver ? (
                <Upload className="w-8 h-8 text-white animate-bounce" />
              ) : (
                <ImagePlus className="w-8 h-8 text-[#00D4AA]" />
              )}
            </div>
            <div>
              <div className="text-white font-bold text-lg">制作工程をドロップしてタイムラインを開始</div>
              <p className="mt-1 text-sm text-[#A8A0D8]/60 max-w-md mx-auto">
                複数枚でも OK — lastModified の古い順に自動整列されます。
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Living Timeline */}
      {steps.length > 0 && !isHydrating && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-5">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#A8A0D8]/60">
              Evidence Chain — {readyCount} step{readyCount !== 1 ? 's' : ''}
              {sealed && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00D4AA]/15 border border-[#00D4AA]/30 text-[#00D4AA] text-[9px] font-black tracking-widest">
                  <Lock className="w-2.5 h-2.5" /> SEALED · {revisionLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    s.hashState === 'verified'
                      ? 'bg-[#00D4AA] shadow-[0_0_6px_rgba(0,212,170,0.5)]'
                      : s.hashState === 'hashing'
                        ? 'bg-[#6C3EF4] animate-pulse'
                        : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="overflow-x-auto pb-6 -mx-2 px-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            <Reorder.Group
              axis="x"
              values={steps}
              onReorder={onReorder}
              className="flex items-stretch w-max gap-0 pr-8"
              as="div"
            >
              {steps.map((step, index) => {
                const isSilentAnchor =
                  step.isRoot && index === steps.length - 1 && steps.length > 1;
                const isHead =
                  !step.isRoot && index === steps.length - 1 && steps.length > 1;
                const isLast = index === steps.length - 1;

                return (
                  <div key={step.id} className="flex items-stretch shrink-0">
                    <TimelineCard
                      step={step}
                      index={index}
                      totalSteps={steps.length}
                      isSilentAnchor={!!isSilentAnchor}
                      isHead={isHead}
                      sealed={false}
                      onUpdate={onUpdate}
                      onRemove={onRemove}
                      onReplace={(file) => onReplace(step.id, file)}
                    />

                    {!isLast && (
                      <div className="flex items-center shrink-0 px-1">
                        <ChainConnector
                          verified={
                            step.hashState === 'verified' &&
                            steps[index + 1]?.hashState === 'verified'
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Step button */}
              <motion.button
                type="button"
                onClick={onOpenFileDialog}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-[150px] sm:w-[190px] md:w-[210px] rounded-2xl border-2 border-dashed border-white/10 hover:border-[#00D4AA]/30 bg-white/5 hover:bg-[#00D4AA]/5 backdrop-blur-md flex flex-col items-center justify-center gap-2 py-14 transition-all group/add shrink-0 ml-2"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00D4AA]/10 group-hover/add:bg-[#00D4AA]/20 flex items-center justify-center transition-colors">
                  <ImagePlus className="w-5 h-5 text-[#00D4AA]" />
                </div>
                <span className="text-xs font-bold text-[#A8A0D8]/50 group-hover/add:text-[#A8A0D8]">工程を追加</span>
                {sealed && (
                  <span className="text-[8px] text-[#BC78FF]/80 font-mono tracking-wider">+ NEW REVISION</span>
                )}
              </motion.button>
            </Reorder.Group>
          </div>

          {steps.some((s) => s.thumbUrl || s.previewUrl) && (
            <KineticEvolutionScrub steps={steps} onScrubEnd={() => {}} />
          )}
        </div>
      )}

      {/* Drag Overlay */}
      {globalDragOver && steps.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div className="absolute inset-0 bg-[#00D4AA]/5 backdrop-blur-[1px]" />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={true}
        className="hidden"
        onChange={onFileInputChange}
      />
    </>
  );
}
