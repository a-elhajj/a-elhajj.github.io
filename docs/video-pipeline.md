# Production Video Pipeline (HLS ABR)

This site now supports adaptive HLS playback with `hls.js` and MP4 fallback.

## Why this pipeline

- Adaptive bitrate (ABR) reduces stalls on weak connections.
- 2-second keyframe/segment cadence improves seek reliability.
- CMAF/fMP4 segments reduce startup and switching overhead.
- MP4 fallback keeps compatibility if HLS assets are missing.

## Build all portfolio HLS assets

From repo root:

```bash
bash scripts/build_portfolio_hls.sh
```

Build one file:

```bash
bash scripts/build_hls_ladder.sh assets/videos/vuze-apple.mp4 assets/hls/vuze-apple
```

## Deployment headers (recommended)

For `*.m3u8`:

- `Content-Type: application/vnd.apple.mpegurl`
- `Cache-Control: public, max-age=60, s-maxage=60`

For `*.m4s` and `init_*.mp4` segments:

- `Content-Type: video/iso.segment` (or correct binary stream type supported by host)
- `Cache-Control: public, max-age=31536000, immutable`

For posters/images:

- `Cache-Control: public, max-age=31536000, immutable`

## Runtime behavior

- Player prefers `project.hls` if present.
- Falls back to native HLS on Safari/iOS.
- Falls back to MP4 if HLS fails.
- Auto-recovers from transient `waiting/stalled` states.

