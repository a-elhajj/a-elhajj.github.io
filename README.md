# a-elhajj.github.io

Personal portfolio site (Jekyll) with:
- Homepage (`index.html`)
- Research page (`research.html`)
- Interactive AI portfolio player (`ai-portfolio.html`) with HLS + MP4 fallback

## Run Demo Locally

1. Install Ruby gems:
```bash
bundle install
```

2. Start local server:
```bash
bundle exec jekyll serve --livereload --host 127.0.0.1 --port 4000
```

3. Open:
`http://127.0.0.1:4000`

If port `4000` is busy:
```bash
bundle exec jekyll serve --livereload --host 127.0.0.1 --port 4001
```

## Video Pipeline

Portfolio playback uses adaptive HLS in the player and falls back to MP4 when needed.

- Build all HLS ladders:
```bash
bash scripts/build_portfolio_hls.sh
```

- Normalize audio loudness across portfolio videos:
```bash
bash scripts/normalize_portfolio_audio.sh
```

- Full pipeline notes:
[docs/video-pipeline.md](/Users/alexanderel-hajj/a-elhajj.github.io/docs/video-pipeline.md)
