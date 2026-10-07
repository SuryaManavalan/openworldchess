#!/usr/bin/env bash
# Prepare a fresh machine (the daily agent's cloud sandbox) to film and render (docs/specs/studio.md).
#   bash tools/shorts/cloud-setup.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v pnpm >/dev/null || npm install -g pnpm@9
pnpm install --frozen-lockfile
# A browser to film with (and its system libraries, where we may install them).
pnpm exec playwright install --with-deps chromium 2>/dev/null || pnpm exec playwright install chromium
# ffmpeg and ffprobe: the system's, or static builds from npm.
if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
  (sudo -n apt-get update -qq && sudo -n apt-get install -y -qq ffmpeg) 2>/dev/null || (apt-get update -qq && apt-get install -y -qq ffmpeg) 2>/dev/null || {
    mkdir -p "$HOME/.local/ffbin" && cd "$HOME/.local/ffbin"
    npm init -y >/dev/null 2>&1; npm install --silent ffmpeg-static ffprobe-static
    mkdir -p "$HOME/.local/bin"
    ln -sf "$PWD/node_modules/ffmpeg-static/ffmpeg" "$HOME/.local/bin/ffmpeg"
    ln -sf "$(node -p "require('ffprobe-static').path")" "$HOME/.local/bin/ffprobe"
    echo "ffmpeg from npm: add $HOME/.local/bin to PATH"
    cd - >/dev/null
  }
fi
export PATH="$HOME/.local/bin:$PATH"
ffmpeg -version | head -1
ffprobe -version | head -1
# The game's client, for staged scenes on a local server.
pnpm --filter @owc/client build >/dev/null && echo "client built"
node -e "console.log('node', process.version)"
