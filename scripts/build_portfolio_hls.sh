#!/usr/bin/env bash
set -euo pipefail

# Batch-build HLS ladders for all portfolio videos used in ai-portfolio.html.
# Run from repo root:
#   bash scripts/build_portfolio_hls.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_ONE="$ROOT/scripts/build_hls_ladder.sh"

if [[ ! -x "$BUILD_ONE" ]]; then
  chmod +x "$BUILD_ONE"
fi

declare -a PAIRS=(
  "assets/videos/vuze-apple.mp4|assets/hls/vuze-apple"
  "assets/videos/vuze-blueberry.mp4|assets/hls/vuze-blueberry"
  "assets/videos/superpop3.mp4|assets/hls/superpop3"
  "assets/videos/Standard Chartered Bank x Tatler Asia - Live Version.mp4|assets/hls/standard-chartered-tatler"
  "assets/videos/historical-reenactment.mp4|assets/hls/historical-reenactment"
  "assets/videos/mancity.mp4|assets/hls/mancity"
  "assets/videos/Marea Reel.mp4|assets/hls/marea-reel"
  "assets/videos/Rumble Reel.mp4|assets/hls/rumble-reel"
  "assets/videos/exp-20230928.mp4|assets/hls/exp-20230928"
  "assets/videos/exp-20231130.mp4|assets/hls/exp-20231130"
  "assets/videos/exp-rife.mp4|assets/hls/exp-rife"
  "assets/videos/exp-infinite-zoom.mp4|assets/hls/exp-infinite-zoom"
)

cd "$ROOT"
for pair in "${PAIRS[@]}"; do
  IFS="|" read -r input out <<< "$pair"
  echo "Building: $input -> $out"
  "$BUILD_ONE" "$input" "$out"
done

echo "All HLS ladders built."
