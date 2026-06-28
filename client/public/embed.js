// client/public/embed.js
/**
 * ProofMark Parasitic Embed Loader
 * ────────────────────────────────────────────────────────────────────────
 * クリエイターの外部サイト (Notion / WordPress / STUDIO / Next.js / Astro 等)
 * へ静的 HTML として撒かれた <blockquote class="proofmark-embed"> を
 * 安全 / 高速 / SPA 適応で <iframe> に昇華させる、依存ゼロの Vanilla JS。
 *
 * 設計の核 (The Parasitic Protocol):
 *  1) IIFE で完全密閉 — ホストサイトのグローバルを 1 byte も汚さない
 *  2) data-proofmark-loaded="true" による冪等性ロック
 *  3) innerHTML 禁止 — createElement + setAttribute の Surgical Mutation のみ
 *  4) MutationObserver + DOMContentLoaded の Cockroach Initialization
 *     (SPA で後から DOM が生まれても必ず検知)
 *  5) IntersectionObserver (rootMargin: 200px) で遅延寄生
 *     ホストサイトの FCP / LCP を絶対に阻害しない
 *
 * バンドル方針:
 *  - 第三者依存ゼロ / 全ブラウザの ES2018+ で動作
 *  - 例外は握り潰す (ホストサイトをクラッシュさせない最終防衛線)
 */

(function () {
  'use strict';

  // ── 二重ロード防止: 同じ embed.js が複数貼られた場合のためのシングルトンガード
  if (window.__PROOFMARK_EMBED_LOADED__) return;
  window.__PROOFMARK_EMBED_LOADED__ = true;

  /* ════════════════════════════════════════════════════════════════
     Constants
     ════════════════════════════════════════════════════════════════ */

  /** 同一オリジン推奨。スクリプト自身の origin から自動解決し、
   *  異なるオリジンに貼られた場合のフォールバックとして固定値を持つ。 */
  var FALLBACK_ORIGIN = 'https://proofmark.jp';

  var SELECTOR = 'blockquote.proofmark-embed';
  var LOADED_ATTR = 'data-proofmark-loaded';
  var ID_ATTR = 'data-id';

  /** 視覚仕様 (Zero-CLS のために height を確実に確保)
   *  パッチ3: WordPress 等の凶悪なグローバル CSS 汚染を !important で完封 */
  var IFRAME_STYLE =
    'display: block !important;' +
    'width: 100% !important;' +
    'max-width: 400px !important;' +
    'height: 460px !important;' +
    'box-sizing: border-box !important;' +
    'border: none !important;' +
    'border-radius: 12px !important;' +
    'margin: 0 auto !important;' +
    'background: transparent !important;' +
    'color-scheme: light dark !important;' +
    'overflow: hidden !important;';

  /** ビューポートから 200px 以内に入った瞬間に src を流し込む */
  var ROOT_MARGIN = '200px';

  /* ════════════════════════════════════════════════════════════════
     Origin resolution (Vite / CDN 配信どちらでも安全に解決)
     ════════════════════════════════════════════════════════════════ */

  function resolveOrigin() {
    try {
      // 自身の <script> 要素の src からオリジンを推定
      var current = document.currentScript;
      if (current && current.src) {
        var u = new URL(current.src);
        if (u.origin) return u.origin;
      }
      // currentScript が取れない (古い環境 / async ロード後) 場合は src 属性で逆引き
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var s = scripts[i];
        var src = s.getAttribute('src') || '';
        if (src.indexOf('/embed.js') !== -1) {
          try { return new URL(src, location.href).origin; } catch (_e) {}
        }
      }
    } catch (_e) {}
    return FALLBACK_ORIGIN;
  }

  var ORIGIN = resolveOrigin();
  var EMBED_API = ORIGIN + '/api/embed?id=';

  /* ════════════════════════════════════════════════════════════════
     UUID-ish validation (sanitize before composing the URL)
     ────────────────────────────────────────────────────────────────
     XSS / Open Redirect 防衛のため、id は厳格に検査する。
     UUID v4 形式 もしくは public_verify_token (英数 + -_ 8〜64 文字) を許可。
     ════════════════════════════════════════════════════════════════ */

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

  function isValidId(id) {
    if (typeof id !== 'string') return false;
    if (UUID_RE.test(id)) return true;
    if (TOKEN_RE.test(id)) return true;
    return false;
  }

  /* ════════════════════════════════════════════════════════════════
     Iframe factory — Surgical DOM Mutation (no innerHTML)
     ════════════════════════════════════════════════════════════════ */

  function createIframe(id) {
    var iframe = document.createElement('iframe');

    // 重要な属性は setAttribute で明示的に設定 (XSS surface を完全排除)
    iframe.setAttribute('title', 'ProofMark Verified Artwork');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    iframe.setAttribute('importance', 'low');
    // パッチ2: allow-scripts を削除 — Iframe 内で JS は一切実行しないため最小権限に徹する
    iframe.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
    iframe.setAttribute('aria-label', 'ProofMark certificate badge');
    iframe.setAttribute('data-proofmark-id', id);

    // Zero-CLS: 描画前に確実に高さを確保
    iframe.setAttribute('style', IFRAME_STYLE);

    return iframe;
  }

  /* ════════════════════════════════════════════════════════════════
     Mount (DOM Mutation) — children は削除し、iframe だけを残す
     ════════════════════════════════════════════════════════════════ */

  function mount(node) {
    if (!node || node.nodeType !== 1) return;

    // 冪等性ロック: 二重処理を物理的に阻止
    if (node.getAttribute(LOADED_ATTR) === 'true') return;

    var rawId = node.getAttribute(ID_ATTR);
    if (!isValidId(rawId)) {
      // 不正 id の場合は黙ってロックして再試行されないようにする
      node.setAttribute(LOADED_ATTR, 'true');
      return;
    }

    // 既存子要素を安全に除去 (innerHTML は使わない)
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }

    // blockquote 自身の見た目をホストサイト側 CSS から守る最小限のリセット
    // (margin/padding をユーザーが overrides できるよう !important は使わない)
    var hostStyle = node.getAttribute('style') || '';
    if (hostStyle.indexOf('margin') === -1) {
      node.setAttribute(
        'style',
        hostStyle +
          (hostStyle && hostStyle.charAt(hostStyle.length - 1) !== ';' ? ';' : '') +
          'margin: 16px auto; padding: 0; border: 0; quotes: none;'
      );
    }

    var iframe = createIframe(rawId);
    node.appendChild(iframe);

    // ロード完了マーク (MutationObserver の再検知を抑止)
    node.setAttribute(LOADED_ATTR, 'true');

    // 遅延寄生: ビューポート接近で初めて src を流し込む
    observeForActivation(iframe, rawId);
  }

  /* ════════════════════════════════════════════════════════════════
     IntersectionObserver — 遅延寄生 (FCP / LCP 防衛)
     ════════════════════════════════════════════════════════════════ */

  var io = null;
  // iframe → id の対応表 (closure leak を避けるため WeakMap)
  var pendingMap = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function getIntersectionObserver() {
    if (io) return io;
    if (typeof IntersectionObserver === 'undefined') return null;

    io = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (!e.isIntersecting) continue;
          var target = e.target;
          var id = pendingMap ? pendingMap.get(target) : target.getAttribute('data-proofmark-id');
          if (id && !target.getAttribute('src')) {
            activate(target, id);
          }
          io.unobserve(target);
          if (pendingMap) pendingMap.delete(target);
        }
      },
      { rootMargin: ROOT_MARGIN, threshold: 0.01 }
    );
    return io;
  }

  function observeForActivation(iframe, id) {
    var observer = getIntersectionObserver();
    if (!observer) {
      // 古いブラウザでは即時アクティベート (機能性優先)
      activate(iframe, id);
      return;
    }
    if (pendingMap) pendingMap.set(iframe, id);
    else iframe.setAttribute('data-proofmark-id', id);
    observer.observe(iframe);
  }

  function activate(iframe, id) {
    try {
      // URL は厳格にエンコードして組み立てる (id は検証済みだが二重防衛)
      var url = EMBED_API + encodeURIComponent(id);
      iframe.setAttribute('src', url);
    } catch (_e) { /* 握り潰す: ホストサイトを巻き込まない */ }
  }

  /* ════════════════════════════════════════════════════════════════
     パッチ1: Ghost Protocol 完全削除
     api/embed.ts が完全な静的 HTML/CSS 化されたため、
     Iframe からの postMessage は永遠に飛んでこない。
     onMessage ブロックおよび window.addEventListener('message', ...) は物理削除済み。
     ════════════════════════════════════════════════════════════════ */

  /* ════════════════════════════════════════════════════════════════
     Initial sweep + MutationObserver — Cockroach Lifecycle
     ════════════════════════════════════════════════════════════════ */

  function scan(root) {
    try {
      var scope = root && root.querySelectorAll ? root : document;
      var nodes = scope.querySelectorAll(SELECTOR + ':not([' + LOADED_ATTR + '="true"])');
      for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
    } catch (_e) { /* 握り潰す */ }
  }

  function bootstrap() {
    // 1) 初期 DOM の sweep
    scan(document);

    // 2) MutationObserver で SPA / 後挿入に追従
    if (typeof MutationObserver === 'undefined') return;

    var mo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'attributes') {
          // class 属性が後から付与されたケース (proofmark-embed 化)
          var t = m.target;
          if (t && t.nodeType === 1 && t.matches && t.matches(SELECTOR)) {
            if (t.getAttribute(LOADED_ATTR) !== 'true') mount(t);
          }
          continue;
        }
        if (m.type !== 'childList') continue;
        var added = m.addedNodes;
        if (!added || !added.length) continue;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (!n || n.nodeType !== 1) continue;
          // 追加されたノード自身が対象か
          if (n.matches && n.matches(SELECTOR)) {
            mount(n);
          }
          // その子孫に対象がいるか (フラグメント挿入対応)
          if (n.querySelectorAll) {
            var inside = n.querySelectorAll(SELECTOR + ':not([' + LOADED_ATTR + '="true"])');
            for (var k = 0; k < inside.length; k++) mount(inside[k]);
          }
        }
      }
    });

    try {
      mo.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', ID_ATTR],
      });
    } catch (_e) { /* 握り潰す */ }
  }

  /* ════════════════════════════════════════════════════════════════
     Entry: DOMContentLoaded まで待つ / すでに interactive なら即時
     ════════════════════════════════════════════════════════════════ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    // すでに DOM が組み上がっている (async ロードの典型)
    bootstrap();
  }

  // ページ離脱時に IO を解放 (BFCache に優しい)
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', function () {
      try { if (io) io.disconnect(); } catch (_e) {}
    }, { once: true });
  }
})();
