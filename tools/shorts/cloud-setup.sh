#!/usr/bin/env bash
# Prepare a fresh machine (the daily agent's cloud sandbox) to film and render (docs/specs/studio.md).
#   bash tools/shorts/cloud-setup.sh && source ~/.owc-env
# Every step reports and carries on; the summary at the end says what's missing. Settings the
# tools need (the browser to use, the proxy) go in ~/.owc-env: source it in every shell.
set -uo pipefail
cd "$(dirname "$0")/../.."
: > "$HOME/.owc-env"
say() { printf '%-10s %s\n' "$1" "$2"; }
command -v pnpm >/dev/null || npm install -g pnpm@9 >/dev/null 2>&1
if pnpm install --frozen-lockfile >/tmp/owc-install.log 2>&1; then say deps ok; else say deps "FAILED (see /tmp/owc-install.log)"; fi

# A browser to film with: Playwright's own if it can be downloaded, else one already on the machine.
if pnpm exec playwright install chromium >/tmp/owc-browser.log 2>&1 && node -e "import('playwright').then(async (p) => { const b = await p.chromium.launch(); await b.close(); })" 2>/dev/null; then
  say browser "ok (Playwright's)"
else
  found=""
  for c in /opt/pw-browsers/chromium "$(command -v chromium 2>/dev/null)" "$(command -v chromium-browser 2>/dev/null)" "$(command -v google-chrome 2>/dev/null)"; do
    [ -n "$c" ] && [ -x "$c" ] && OWC_CHROMIUM="$c" node -e "import('playwright').then(async (p) => { const b = await p.chromium.launch({ executablePath: process.env.OWC_CHROMIUM }); await b.close(); })" 2>/dev/null && { found="$c"; break; }
  done
  if [ -n "$found" ]; then echo "export OWC_CHROMIUM=$found" >> "$HOME/.owc-env"; say browser "ok ($found)"; else say browser "FAILED: no browser could be launched (see /tmp/owc-browser.log)"; fi
fi

# ffmpeg and ffprobe: the system's, or static builds from npm.
if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
  (sudo -n apt-get update -qq && sudo -n apt-get install -y -qq ffmpeg) >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq ffmpeg) >/dev/null 2>&1 || {
    mkdir -p "$HOME/.local/ffbin" "$HOME/.local/bin" && (cd "$HOME/.local/ffbin" && npm init -y >/dev/null 2>&1 && npm install --silent ffmpeg-static ffprobe-static >/dev/null 2>&1 \
      && ln -sf "$PWD/node_modules/ffmpeg-static/ffmpeg" "$HOME/.local/bin/ffmpeg" && ln -sf "$(node -p "require('ffprobe-static').path")" "$HOME/.local/bin/ffprobe")
  }
fi
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.owc-env"
export PATH="$HOME/.local/bin:$PATH"
if command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null; then say ffmpeg "ok ($(ffmpeg -version | head -1 | cut -d' ' -f3))"; else say ffmpeg FAILED; fi

# Behind a proxy (the cloud sandbox), Node's fetch only uses it when told to.
if [ -n "${HTTPS_PROXY:-}${https_proxy:-}" ]; then echo 'export NODE_USE_ENV_PROXY=1' >> "$HOME/.owc-env"; export NODE_USE_ENV_PROXY=1; fi

# The game's client, for staged scenes on a local server.
if pnpm --filter @owc/client build >/tmp/owc-build.log 2>&1; then say client ok; else say client "FAILED (see /tmp/owc-build.log)"; fi

# The game itself: filming the live world, the voice and posting all go through it.
code=$(curl -s -o /dev/null -m 20 -w '%{http_code}' https://openworldchess.com/api/showcase || true)
if [ "$code" = "200" ]; then say network ok; else say network "FAILED: openworldchess.com answered $code (the environment's network access must allow openworldchess.com)"; fi
say node "$(node -v)"
echo "now: source ~/.owc-env"
