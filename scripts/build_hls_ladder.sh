#!/usr/bin/env bash
set -euo pipefail

# Production VOD HLS ladder builder (CMAF/fMP4) for portfolio assets.
# Usage:
#   scripts/build_hls_ladder.sh assets/videos/vuze-apple.mp4 assets/hls/vuze-apple

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <input_mp4> <output_dir>"
  exit 1
fi

INPUT="$1"
OUTDIR="$2"

if [[ ! -f "$INPUT" ]]; then
  echo "Input not found: $INPUT"
  exit 1
fi

mkdir -p "$OUTDIR"
find "$OUTDIR" -type f -delete

# 2s keyframe cadence + independent segments for fast seek/switch.
COMMON_VIDEO_FLAGS=(
  -c:v libx264
  -profile:v high
  -pix_fmt yuv420p
  -sc_threshold 0
  -g 48
  -keyint_min 48
  -force_key_frames "expr:gte(t,n_forced*2)"
  -movflags +faststart
)

HAS_AUDIO="0"
if ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of csv=p=0 "$INPUT" | grep -q "audio"; then
  HAS_AUDIO="1"
fi

if [[ "$HAS_AUDIO" == "1" ]]; then
  VAR_STREAM_MAP="v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:360p"
  ffmpeg -y -hide_banner -loglevel warning \
    -i "$INPUT" \
    -filter_complex "[0:v]split=4[v0][v1][v2][v3]; \
                     [v0]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v0out]; \
                     [v1]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v1out]; \
                     [v2]scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v2out]; \
                     [v3]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v3out]; \
                     [0:a]asplit=4[a0][a1][a2][a3]" \
    -map "[v0out]" -map "[v1out]" -map "[v2out]" -map "[v3out]" \
    -map "[a0]" -map "[a1]" -map "[a2]" -map "[a3]" \
    "${COMMON_VIDEO_FLAGS[@]}" \
    -c:a aac -ac 2 -ar 48000 -b:a 128k \
    -b:v:0 6000k -maxrate:v:0 6600k -bufsize:v:0 12000k \
    -b:v:1 3200k -maxrate:v:1 3500k -bufsize:v:1 6400k \
    -b:v:2 1600k -maxrate:v:2 1750k -bufsize:v:2 3200k \
    -b:v:3 900k  -maxrate:v:3 990k  -bufsize:v:3 1800k \
    -f hls \
    -hls_time 2 \
    -hls_playlist_type vod \
    -hls_flags independent_segments \
    -hls_segment_type fmp4 \
    -hls_fmp4_init_filename "init_%v.mp4" \
    -hls_segment_filename "$OUTDIR/seg_%v_%06d.m4s" \
    -master_pl_name master.m3u8 \
    -var_stream_map "$VAR_STREAM_MAP" \
    "$OUTDIR/stream_%v.m3u8"
else
  VAR_STREAM_MAP="v:0,name:1080p v:1,name:720p v:2,name:480p v:3,name:360p"
  ffmpeg -y -hide_banner -loglevel warning \
    -i "$INPUT" \
    -filter_complex "[0:v]split=4[v0][v1][v2][v3]; \
                     [v0]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v0out]; \
                     [v1]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v1out]; \
                     [v2]scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v2out]; \
                     [v3]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v3out]" \
    -map "[v0out]" -map "[v1out]" -map "[v2out]" -map "[v3out]" \
    -an \
    "${COMMON_VIDEO_FLAGS[@]}" \
    -b:v:0 6000k -maxrate:v:0 6600k -bufsize:v:0 12000k \
    -b:v:1 3200k -maxrate:v:1 3500k -bufsize:v:1 6400k \
    -b:v:2 1600k -maxrate:v:2 1750k -bufsize:v:2 3200k \
    -b:v:3 900k  -maxrate:v:3 990k  -bufsize:v:3 1800k \
    -f hls \
    -hls_time 2 \
    -hls_playlist_type vod \
    -hls_flags independent_segments \
    -hls_segment_type fmp4 \
    -hls_fmp4_init_filename "init_%v.mp4" \
    -hls_segment_filename "$OUTDIR/seg_%v_%06d.m4s" \
    -master_pl_name master.m3u8 \
    -var_stream_map "$VAR_STREAM_MAP" \
    "$OUTDIR/stream_%v.m3u8"
fi

echo "Built HLS ladder in: $OUTDIR"
