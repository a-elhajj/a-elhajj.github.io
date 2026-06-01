#!/usr/bin/env bash
set -euo pipefail

# Loudness normalization for portfolio MP4 assets (EBU R128 target).
# Usage:
#   bash scripts/normalize_portfolio_audio.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET_I="-16"
TARGET_LRA="11"
TARGET_TP="-1.5"

videos=(
  "assets/videos/vuze-apple.mp4"
  "assets/videos/vuze-blueberry.mp4"
  "assets/videos/superpop3.mp4"
  "assets/videos/Standard Chartered Bank x Tatler Asia - Live Version.mp4"
  "assets/videos/historical-reenactment.mp4"
  "assets/videos/mancity.mp4"
  "assets/videos/Marea Reel.mp4"
  "assets/videos/Rumble Reel.mp4"
  "assets/videos/exp-20230928.mp4"
  "assets/videos/exp-20231130.mp4"
  "assets/videos/exp-rife.mp4"
  "assets/videos/exp-infinite-zoom.mp4"
)

for src in "${videos[@]}"; do
  if [[ ! -f "$src" ]]; then
    echo "Skipping missing file: $src"
    continue
  fi

  tmp="${src%.mp4}.norm.tmp.mp4"
  echo "Normalizing: $src"
  ffmpeg -y -hide_banner -loglevel warning \
    -i "$src" \
    -map 0:v:0 -map 0:a:0? \
    -c:v copy \
    -c:a aac -b:a 192k \
    -af "loudnorm=I=${TARGET_I}:LRA=${TARGET_LRA}:TP=${TARGET_TP}" \
    -movflags +faststart \
    "$tmp"

  mv "$tmp" "$src"
done

echo "Audio normalization complete."
