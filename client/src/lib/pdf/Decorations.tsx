/**
 * Decorations.tsx (v2)
 * -----------------------------------------------------------------------------
 * 装飾を担う「純ベクター」SVG コンポーネント群 — 本番安全版。
 *
 * v1 からの致命的変更:
 *  - <textPath> を完全削除 (@react-pdf/renderer 非対応)
 *  - GeometricBackdrop を完全削除 (2,600 個の <Circle> による
 *    PDF 肥大化・モバイルフリーズ要因の根絶)
 *  - LinearGradient を全廃 (PDFKit の既知バグ回避)
 *    → グラデ罫線は「2 セグメントの矩形 + 中間矩形」で擬似表現
 *  - ProofMarkLogo を新設 (シンボル + ワードマークのロックアップ)
 *
 * 提供パーツ:
 *  - ProofMarkLogo  : 公式ロゴ (シンボル + 「PROOFMARK」 ワードマーク)
 *  - CornerOrnament : 4 隅のエレガントなボーダー装飾
 *  - SealedStamp    : トラストバッジ (円弧テキストなし、幾何学のみ)
 *  - DividerRule    : Purple→Teal の擬似グラデ罫線 (単色矩形 3 連)
 * -----------------------------------------------------------------------------
 */

import React from 'react';
import { Svg, Path, Circle, G, Line, Rect, Polygon, Polyline } from '@react-pdf/renderer';
import { View } from '@react-pdf/renderer';
import { PDF_COLORS } from './tokens';

/* ================================================================ *
 * ProofMarkLogo
 *
 * 「ProofMark 公式ベクターロゴ」コンポーネント。
 * シンボル ("P" + チェックの合字) + ワードマーク "PROOFMARK" のロックアップ。
 *
 * 制約 (本番安全):
 *  - 単色 HEX のみ。LinearGradient 不使用。
 *  - パスと円のみの純粋ベクター。
 *  - render width に応じてシンボル/ワードマーク/タグラインを自動スケール。
 *
 * 将来、確定版の公式 SVG (paths) が支給された場合、本コンポーネント内の
 * <Svg> の中身だけを差し替えれば全ドキュメントに即反映される。
 * ================================================================ */
interface ProofMarkLogoProps { height?: number; }
export const ProofMarkLogo: React.FC<ProofMarkLogoProps> = ({ height = 22 }) => {
  const width = height * 4.89;
  return (
    <View style={{ width, height }}>
      <Svg viewBox="0 0 470 96" width="100%" height="100%">
        <Polygon points="50,12 82,30 82,70 50,88 18,70 18,30" fill="#6C3EF4" fillOpacity={0.04} />
        <Polygon points="50,12 82,30 82,70 50,88 18,70 18,30" fill="none" stroke="#6C3EF4" strokeWidth={0.6} opacity={0.15} />
        <Path d="M 50,4 L 10,27 L 10,73 L 50,96 L 90,73 L 90,27 L 88,26 L 84,28 L 78,20 Z" fill="none" stroke="#5830CC" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <Path d="M 78,20 L 84,28 L 88,26" fill="none" stroke="#00B896" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
        <Polyline points="20,52 36,69 80,24" fill="none" stroke="#00D4AA" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="112" y="12" width="1" height="72" rx={0.5} fill="#1C1A38" opacity={0.3} />
        <G fill="#1A233A">
          <Path d="M139.476 56.73V50.08H158.438Q159.578 50.08 160.357 49.719Q161.136 49.358 161.136 48.18Q161.136 46.964 160.357 46.622Q159.578 46.28 158.438 46.28H140.084V63.0H130.584V38.68H156.956Q159.806 38.68 162.295 39.079Q164.784 39.478 166.646 40.504Q168.508 41.53 169.572 43.392Q170.636 45.254 170.636 48.18Q170.636 51.106 169.572 52.816Q168.508 54.526 166.646 55.362Q164.784 56.198 162.295 56.464Q159.806 56.73 156.956 56.73Z M174.436 44.38H183.556V63.0H174.436ZM193.36 51.41Q190.89 51.41 188.838 51.866Q186.786 52.322 185.342 52.949Q183.898 53.576 183.176 54.184L183.1 52.36Q183.214 51.562 183.708 50.479Q184.202 49.396 185.038 48.237Q185.874 47.078 187.09 46.071Q188.306 45.064 189.883 44.437Q191.46 43.81 193.36 43.81Z M213.5 63.57Q207.458 63.57 203.449 62.582Q199.44 61.594 197.445 59.428Q195.45 57.262 195.45 53.728Q195.45 50.194 197.445 48.009Q199.44 45.824 203.449 44.817Q207.458 43.81 213.5 43.81Q219.504 43.81 223.475 44.817Q227.446 45.824 229.422 48.009Q231.398 50.194 231.398 53.728Q231.398 57.262 229.422 59.428Q227.446 61.594 223.475 62.582Q219.504 63.57 213.5 63.57ZM213.5 58.06Q216.312 58.06 218.212 57.585Q220.112 57.11 221.1 56.141Q222.088 55.172 222.088 53.728Q222.088 52.284 221.119 51.296Q220.15 50.308 218.25 49.814Q216.35 49.32 213.5 49.32Q210.688 49.32 208.731 49.814Q206.774 50.308 205.767 51.277Q204.76 52.246 204.76 53.728Q204.76 55.172 205.748 56.141Q206.736 57.11 208.693 57.585Q210.65 58.06 213.5 58.06Z M252.108 63.57Q246.066 63.57 242.057 62.582Q238.048 61.594 236.053 59.428Q234.058 57.262 234.058 53.728Q234.058 50.194 236.053 48.009Q238.048 45.824 242.057 44.817Q246.066 43.81 252.108 43.81Q258.112 43.81 262.083 44.817Q266.054 45.824 268.03 48.009Q270.006 50.194 270.006 53.728Q270.006 57.262 268.03 59.428Q266.054 61.594 262.083 62.582Q258.112 63.57 252.108 63.57ZM252.108 58.06Q254.92 58.06 256.82 57.585Q258.72 57.11 259.708 56.141Q260.696 55.172 260.696 53.728Q260.696 52.284 259.727 51.296Q258.758 50.308 256.858 49.814Q254.958 49.32 252.108 49.32Q249.296 49.32 247.339 49.814Q245.382 50.308 244.375 51.277Q243.368 52.246 243.368 53.728Q243.368 55.172 244.356 56.141Q245.344 57.11 247.301 57.585Q249.258 58.06 252.108 58.06Z M272.096 45.52H296.188V51.22H272.096ZM287.41 36.78H296.188V42.86H291.21Q289.69 42.822 288.873 43.012Q288.056 43.202 287.733 43.772Q287.41 44.342 287.41 45.52V63.0H278.29V43.62Q278.29 41.34 279.145 39.82Q280.0 38.3 281.995 37.54Q283.99 36.78 287.41 36.78Z" />
          <Path fill="#00D4AA" d="M331.508 59.96H325.508L347.348 37.4H357.348V63.0H347.348V45.56L350.348 46.8L334.548 63.0H322.548L306.708 46.84L309.748 45.6V63.0H299.748V37.4H309.748Z M375.968 63.56Q371.648 63.56 368.288 62.34Q364.928 61.12 362.988 58.8Q361.048 56.48 361.048 53.2Q361.048 49.76 362.988 47.44Q364.928 45.12 368.288 43.96Q371.648 42.8 375.968 42.8Q380.768 42.8 384.268 44.1Q387.768 45.4 389.668 47.74Q391.568 50.08 391.568 53.2Q391.568 55.52 390.488 57.42Q389.408 59.32 387.368 60.7Q385.328 62.08 382.448 62.82Q379.568 63.56 375.968 63.56ZM379.568 57.48Q382.608 57.48 385.148 57.1Q387.688 56.72 389.228 55.8Q390.768 54.88 390.768 53.2Q390.768 51.48 389.228 50.56Q387.688 49.64 385.148 49.28Q382.608 48.92 379.568 48.92Q375.488 48.92 373.248 49.98Q371.008 51.04 371.008 53.2Q371.008 54.6 372.008 55.56Q373.008 56.52 374.928 57.0Q376.848 57.48 379.568 57.48ZM390.768 43.4H400.368V63.0H391.328Q391.328 63.0 391.188 62.08Q391.048 61.16 390.908 59.44Q390.768 57.72 390.768 55.4Z M403.468 43.4H413.068V63.0H403.468ZM423.388 50.8Q420.788 50.8 418.628 51.28Q416.468 51.76 414.948 52.42Q413.428 53.08 412.668 53.72L412.588 51.8Q412.708 50.96 413.228 49.82Q413.748 48.68 414.628 47.46Q415.508 46.24 416.788 45.18Q418.068 44.12 419.728 43.46Q421.388 42.8 423.388 42.8Z M425.888 35.4H435.488V63.0H425.888ZM459.808 43.4 443.968 54.4 444.168 49.2 461.168 63.0H449.008L435.648 51.84L447.088 43.4Z" />
        </G>
      </Svg>
    </View>
  );
};

/* ================================================================ *
 * CornerOrnament
 *
 * 4 隅に配置する L 字 + 内側ヘアラインの二重ボーダー。
 * 証券・賞状の「枠」を彷彿させるエレガンス。
 * ================================================================ */
interface CornerOrnamentProps {
  width: number;
  height: number;
  margin?: number;
  armLength?: number;
  color?: string;
}
export const CornerOrnament: React.FC<CornerOrnamentProps> = ({
  width,
  height,
  margin = 28,
  armLength = 44,
  color = PDF_COLORS.purple,
}) => {
  const innerInset = 6;
  const x0 = margin;
  const y0 = margin;
  const x1 = width - margin;
  const y1 = height - margin;

  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0 }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* 内側のヘアライン枠 */}
      <Rect
        x={x0 + innerInset}
        y={y0 + innerInset}
        width={x1 - x0 - innerInset * 2}
        height={y1 - y0 - innerInset * 2}
        stroke={color}
        strokeOpacity={0.12}
        strokeWidth={0.4}
        fill="none"
      />

      {/* 4 隅の L 字 */}
      <G stroke={color} strokeWidth={1.1} strokeLinecap="round">
        {/* TL */}
        <Line x1={x0} y1={y0} x2={x0 + armLength} y2={y0} />
        <Line x1={x0} y1={y0} x2={x0} y2={y0 + armLength} />
        {/* TR */}
        <Line x1={x1} y1={y0} x2={x1 - armLength} y2={y0} />
        <Line x1={x1} y1={y0} x2={x1} y2={y0 + armLength} />
        {/* BL */}
        <Line x1={x0} y1={y1} x2={x0 + armLength} y2={y1} />
        <Line x1={x0} y1={y1} x2={x0} y2={y1 - armLength} />
        {/* BR */}
        <Line x1={x1} y1={y1} x2={x1 - armLength} y2={y1} />
        <Line x1={x1} y1={y1} x2={x1} y2={y1 - armLength} />
      </G>

      {/* 隅の小ドット (装飾アクセント) */}
      <G fill={color}>
        <Circle cx={x0} cy={y0} r={1.6} />
        <Circle cx={x1} cy={y0} r={1.6} />
        <Circle cx={x0} cy={y1} r={1.6} />
        <Circle cx={x1} cy={y1} r={1.6} />
      </G>
    </Svg>
  );
};

/* ================================================================ *
 * SealedStamp
 *
 * トラストバッジ — 円弧テキスト一切なし、幾何学パーツのみで完結。
 *
 * 構成:
 *  - 外周二重円 (主環 + 内環)
 *  - 12 個のラジアル・スポーク (時計の時針マークのような短い線)
 *  - 中央の大きなチェックマーク (ProofMark シグネチャ)
 *  - 中央チェックの下に「★」を 1 つ (装飾)
 *  - 上下にバー (時計の 12 時 / 6 時 マーク強調)
 *
 * variant: 'teal' (デフォルト) / 'gold'
 * 単色のみ。グラデ無し。
 * ================================================================ */
interface SealedStampProps {
  size?: number;
  variant?: 'teal' | 'gold';
  rotation?: number;
}
export const SealedStamp: React.FC<SealedStampProps> = ({
  size = 96,
  variant = 'teal',
  rotation = 0,
}) => {
  const base = variant === 'teal' ? PDF_COLORS.sealTeal : PDF_COLORS.sealGold;
  const deep = variant === 'teal' ? PDF_COLORS.tealDeep : PDF_COLORS.goldDeep;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.48;
  const rInner = size * 0.4;
  const rCore = size * 0.3;

  // 12 個のスポーク (時計の時針マーク)
  const spokes: React.ReactNode[] = [];
  const spokeCount = 12;
  for (let i = 0; i < spokeCount; i++) {
    const a = (i / spokeCount) * Math.PI * 2 - Math.PI / 2;
    const r1 = rOuter - 2.4;
    const r2 = rOuter - 5.4;
    const x1 = cx + Math.cos(a) * r1;
    const y1 = cy + Math.sin(a) * r1;
    const x2 = cx + Math.cos(a) * r2;
    const y2 = cy + Math.sin(a) * r2;
    spokes.push(
      <Line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={PDF_COLORS.paper}
        strokeOpacity={0.7}
        strokeWidth={1.0}
        strokeLinecap="round"
      />,
    );
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* 外側ベースリング (deep 色) */}
      <Circle cx={cx} cy={cy} r={rOuter + 1.6} fill={deep} />

      {/* メインのワックス本体 (base 色, 単色) */}
      <Circle cx={cx} cy={cy} r={rOuter} fill={base} />

      {/* 内側ベゼル */}
      <Circle
        cx={cx}
        cy={cy}
        r={rInner}
        stroke={PDF_COLORS.paper}
        strokeOpacity={0.6}
        strokeWidth={0.9}
        fill="none"
      />
      <Circle
        cx={cx}
        cy={cy}
        r={rCore}
        stroke={PDF_COLORS.paper}
        strokeOpacity={0.32}
        strokeWidth={0.6}
        fill="none"
      />

      {/* 12 スポーク */}
      <G>{spokes}</G>

      {/* 中央のチェックマーク (ProofMark シグネチャ) */}
      <Path
        d={`M ${cx - size * 0.135} ${cy + size * 0.005}
            L ${cx - size * 0.04} ${cy + size * 0.085}
            L ${cx + size * 0.155} ${cy - size * 0.105}`}
        stroke={PDF_COLORS.paper}
        strokeWidth={size * 0.055}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* 中央チェックの下のスター (4 ポイント、装飾) */}
      <Path
        d={`M ${cx} ${cy + size * 0.21}
            L ${cx + size * 0.025} ${cy + size * 0.275}
            L ${cx + size * 0.09} ${cy + size * 0.3}
            L ${cx + size * 0.025} ${cy + size * 0.325}
            L ${cx} ${cy + size * 0.39}
            L ${cx - size * 0.025} ${cy + size * 0.325}
            L ${cx - size * 0.09} ${cy + size * 0.3}
            L ${cx - size * 0.025} ${cy + size * 0.275}
            Z`}
        fill={PDF_COLORS.paper}
        fillOpacity={0.85}
      />
    </Svg>
  );
};

/* ================================================================ *
 * DividerRule
 *
 * 擬似グラデ罫線。
 * PDFKit の LinearGradient はバグでクラッシュすることがあるため、
 * 単色矩形 3 連 (Purple / 中間 / Teal) で「グラデ風」を再現する。
 * ================================================================ */
interface DividerRuleProps {
  width: number;
  height?: number;
}
export const DividerRule: React.FC<DividerRuleProps> = ({
  width,
  height = 2,
}) => {
  const seg = width / 5;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={0} y={0} width={seg * 2} height={height} fill={PDF_COLORS.purple} />
      <Rect
        x={seg * 2}
        y={0}
        width={seg}
        height={height}
        fill={PDF_COLORS.purpleSoft}
      />
      <Rect
        x={seg * 3}
        y={0}
        width={seg * 2}
        height={height}
        fill={PDF_COLORS.teal}
      />
    </Svg>
  );
};
