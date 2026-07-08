import os

path = "/Users/kanrisha/projects/proofmark-lp/client/src/lib/zipStreamer.ts"
with open(path, "r") as f:
    content = f.read()

# Replace Phase 1
content = content.replace(
    "if ((err as DOMException).name === 'AbortError') {\n        // ダイアログのキャンセル。\n        return;\n      }",
    "if ((err as DOMException).name === 'AbortError') {\n        // ダイアログのキャンセル。\n        throw err;\n      }"
)

# Replace Phase 2
content = content.replace(
    "if ((err as DOMException).name === 'AbortError') {\n          try { await writable.abort?.(); } catch { /* noop */ }\n          return;\n        }",
    "if ((err as DOMException).name === 'AbortError') {\n          try { await writable.abort?.(); } catch { /* noop */ }\n          throw err;\n        }"
)

# Replace Route B
content = content.replace(
    "if ((err as DOMException).name === 'AbortError') {\n      try { await fileStream?.abort?.(); } catch { /* noop */ }\n      return;\n    }",
    "if ((err as DOMException).name === 'AbortError') {\n      try { await fileStream?.abort?.(); } catch { /* noop */ }\n      throw err;\n    }"
)

with open(path, "w") as f:
    f.write(content)

print("Patch applied to zipStreamer.ts")
