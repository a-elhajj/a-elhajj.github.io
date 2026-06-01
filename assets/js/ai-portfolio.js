(function () {
    "use strict";

    /* ------------------------------------------------------------------
       1. BOOTSTRAP
       ------------------------------------------------------------------ */
    var viewport = document.getElementById("ap-viewport");
    var dataEl   = document.getElementById("ap-portfolio-data");
    if (!viewport || !dataEl) return;

    var data;
    try { data = JSON.parse(dataEl.textContent || "{}"); }
    catch (e) { viewport.textContent = "Portfolio data failed to load."; return; }

    var sections = data.portfolio || [];
    if (!sections.length) return;

    var activePanelIdx = -1;   /* -1 so first activatePanel(0) always fires */
    var panelEls       = [];
    var controllers    = [];
    var needsUserGesture = false;  /* tracks if autoplay was blocked */

    /* ------------------------------------------------------------------
       2. PANEL ACTIVATION
       ------------------------------------------------------------------ */
    function activatePanel(idx) {
        if (idx === activePanelIdx) return;
        activePanelIdx = idx;
        panelEls.forEach(function (el, i) {
            el.classList.toggle("is-active", i === idx);
        });
        controllers.forEach(function (c) {
            c.onActivate(c.idx === idx);
        });
    }

    /* ------------------------------------------------------------------
       3. BUILD EACH PANEL
       ------------------------------------------------------------------ */
    sections.forEach(function (section, idx) {
        var panel = document.createElement("article");
        panel.className = "ap-panel";
        panel.dataset.index = String(idx);
        if (idx === 0) panel.classList.add("is-active");  /* Main Work largest from first paint */

        /* ---------- Spine title ---------- */
        var spineTitle = document.createElement("div");
        spineTitle.className = "ap-spine-title";
        spineTitle.innerHTML = "<span>" + section.title + "</span>";
        panel.appendChild(spineTitle);

        /* ---------- Spine preview (placeholders — NO heavy video elements) ---------- */
        var spinePreview = document.createElement("div");
        spinePreview.className = "ap-spine-preview";
        section.projects.slice(0, 10).forEach(function (proj, sIdx) {
            var thumb = document.createElement("button");
            thumb.className = "ap-spine-thumb";
            thumb.type = "button";
            thumb.dataset.projectIdx = String(sIdx);
            if (proj.image) {
                var img = document.createElement("img");
                img.src = proj.image;
                img.alt = proj.title || "";
                img.loading = "lazy";
                thumb.appendChild(img);
            } else if (proj.youtube) {
                var ytM = proj.youtube.match(/[?&]v=([^&]+)/) || proj.youtube.match(/youtu\.be\/([^?]+)/) || proj.youtube.match(/\/embed\/([^?]+)/);
                var ytId = ytM ? ytM[1] : "";
                if (ytId) {
                    var img = document.createElement("img");
                    img.src = "https://img.youtube.com/vi/" + ytId + "/mqdefault.jpg";
                    img.alt = proj.title || "";
                    img.loading = "eager";
                    thumb.appendChild(img);
                } else {
                    thumb.style.background = "var(--ap-card)";
                }
            } else if (proj.poster) {
                var img = document.createElement("img");
                img.src = proj.poster;
                img.alt = proj.title || "";
                img.loading = "eager";
                thumb.appendChild(img);
            } else {
                thumb.style.background = "var(--ap-card)";
                thumb.dataset.posterSrc = proj.video || "";
            }
            thumb.addEventListener("click", function (e) {
                e.stopPropagation();
                var pIdx = parseInt(thumb.dataset.projectIdx, 10);
                if (pIdx >= 0 && pIdx < section.projects.length) {
                    activeProjectIdx = pIdx;
                }
                activatePanel(idx);
            });
            spinePreview.appendChild(thumb);
        });
        panel.appendChild(spinePreview);

        /* ---------- Panel content ---------- */
        var content = document.createElement("div");
        content.className = "ap-panel-content";

        var header = document.createElement("h2");
        header.className = "ap-panel-header";
        header.textContent = section.title;
        content.appendChild(header);

        /* ---- Main player ---- */
        var playerWrap = document.createElement("div");
        playerWrap.className = "ap-player-wrap";

        var mainVideo = document.createElement("video");
        mainVideo.className = "ap-main-player";
        mainVideo.controls = true;
        mainVideo.setAttribute("controlslist", "nodownload");
        mainVideo.muted    = true;
        mainVideo.loop     = true;
        mainVideo.playsInline = true;
        mainVideo.setAttribute("playsinline", "");
        mainVideo.setAttribute("muted", "");
        mainVideo.preload  = "auto";
        mainVideo.volume   = 0.85;
        playerWrap.appendChild(mainVideo);
        var hlsPlayer = null;
        var selectedProjectVolume = 0.85;

        var mainImage = document.createElement("img");
        mainImage.className = "ap-main-player-img";
        playerWrap.appendChild(mainImage);

        var mainYouTube = document.createElement("iframe");
        mainYouTube.className = "ap-main-youtube";
        mainYouTube.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
        mainYouTube.setAttribute("allowfullscreen", "");
        mainYouTube.setAttribute("frameborder", "0");
        mainYouTube.title = "YouTube video";
        mainYouTube.style.display = "none";
        playerWrap.appendChild(mainYouTube);

        /* Player controls: quality selector only (volume stays native) */
        var hud = document.createElement("div");
        hud.className = "ap-player-hud";

        var settingsBtn = document.createElement("button");
        settingsBtn.className = "ap-hud-settings-btn";
        settingsBtn.type = "button";
        settingsBtn.textContent = "Quality";

        var settingsPanel = document.createElement("div");
        settingsPanel.className = "ap-hud-settings-panel";

        var qualityLabel = document.createElement("label");
        qualityLabel.className = "ap-hud-label";
        qualityLabel.textContent = "Video Quality";

        var qualitySelect = document.createElement("select");
        qualitySelect.className = "ap-hud-select";
        qualitySelect.setAttribute("aria-label", "Video quality");
        qualitySelect.innerHTML = "<option value='-1'>Auto</option>";
        qualitySelect.disabled = true;

        settingsPanel.appendChild(qualityLabel);
        settingsPanel.appendChild(qualitySelect);
        hud.appendChild(settingsBtn);
        hud.appendChild(settingsPanel);
        playerWrap.appendChild(hud);

        settingsBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            settingsPanel.classList.toggle("is-open");
        });
        playerWrap.addEventListener("click", function () {
            settingsPanel.classList.remove("is-open");
        });
        settingsPanel.addEventListener("click", function (e) {
            e.stopPropagation();
        });

        var metricState = {
            startupAt: 0,
            startupMs: null,
            rebufferCount: 0,
            seekStartAt: 0,
            seekLastMs: null
        };

        function logMetrics(eventLabel) {
            var startupText = (metricState.startupMs == null) ? "--" : String(metricState.startupMs);
            var seekText = (metricState.seekLastMs == null) ? "--" : String(metricState.seekLastMs);
            console.info("[player-metrics][" + section.id + "] " + eventLabel + " | startup_ms=" + startupText + " rebuffer_count=" + metricState.rebufferCount + " seek_ms=" + seekText);
        }

        function resetMetrics() {
            metricState.startupAt = performance.now();
            metricState.startupMs = null;
            metricState.rebufferCount = 0;
            metricState.seekStartAt = 0;
            metricState.seekLastMs = null;
            logMetrics("reset");
        }

        var playRequestId = 0;

        function safeAutoplay() {
            mainVideo.muted = true;
            mainVideo.setAttribute("muted", "");
            return mainVideo.play().catch(function () {
                /* Browser autoplay policies may block unmuted hover-initiated play. */
                mainVideo.muted = true;
                return mainVideo.play().catch(function () {
                    needsUserGesture = true;
                });
            });
        }

        function requestAutoplay() {
            var requestId = ++playRequestId;
            safeAutoplay();
            requestAnimationFrame(function () {
                if (requestId === playRequestId && idx === activePanelIdx && mainVideo.style.display !== "none") {
                    safeAutoplay();
                }
            });
        }

        function setQualityOptions(levels) {
            qualitySelect.innerHTML = "";
            var autoOpt = document.createElement("option");
            autoOpt.value = "-1";
            autoOpt.textContent = "Auto";
            qualitySelect.appendChild(autoOpt);

            if (!levels || !levels.length) {
                qualitySelect.disabled = true;
                return;
            }
            levels.forEach(function (lv, i) {
                var h = lv && lv.height ? lv.height + "p" : "L" + (i + 1);
                var br = lv && lv.bitrate ? Math.round(lv.bitrate / 1000) + "k" : "";
                var opt = document.createElement("option");
                opt.value = String(i);
                opt.textContent = br ? (h + " (" + br + ")") : h;
                qualitySelect.appendChild(opt);
            });
            qualitySelect.disabled = false;
            qualitySelect.value = "-1";
        }

        qualitySelect.addEventListener("change", function (e) {
            if (!hlsPlayer) return;
            var v = parseInt(qualitySelect.value, 10);
            if (Number.isNaN(v)) v = -1;
            if (v === -1) {
                hlsPlayer.currentLevel = -1;
                hlsPlayer.nextLevel = -1;
                hlsPlayer.loadLevel = -1;
            } else {
                hlsPlayer.currentLevel = v;
                hlsPlayer.nextLevel = v;
            }
        });

        /* Auto-play whenever enough data is buffered. canplay fires after every
           successful source swap (HLS.js or native), so this is the single
           reliable place to (re)start playback — never call play() synchronously
           right after loadSource(). */
        mainVideo.addEventListener("canplay", function () {
            if (idx === activePanelIdx && mainVideo.style.display !== "none") {
                requestAutoplay();
            }
        });
        mainVideo.addEventListener("loadeddata", function () {
            if (idx === activePanelIdx && mainVideo.style.display !== "none") {
                requestAutoplay();
            }
        });

        /* The HLS.js instance is created ONCE per panel and reused. Switching
           projects calls loadSource() — we never destroy/re-attach on hover,
           which was the cause of the race that stalled playback. */
        var hlsLoadedUrl = "";

        function ensureHlsPlayer() {
            if (hlsPlayer) return hlsPlayer;
            hlsPlayer = new window.Hls({
                lowLatencyMode: false,
                enableWorker: true,
                backBufferLength: 30,
                capLevelToPlayerSize: true,
                maxBufferLength: 20,
                maxMaxBufferLength: 40,
                maxBufferHole: 0.5,
                abrEwmaFastVoD: 3.0,
                abrEwmaSlowVoD: 9.0
            });
            hlsPlayer.on(window.Hls.Events.ERROR, function (_, data) {
                if (!data || !data.fatal) return;
                if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
                    hlsPlayer.startLoad();
                    return;
                }
                if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
                    hlsPlayer.recoverMediaError();
                    return;
                }
                /* Unrecoverable: tear down and fall back to progressive MP4. */
                destroyHlsPlayer();
                var fb = currentFallbackMp4;
                if (fb) {
                    mainVideo.src = fb;
                    mainVideo.load();
                    requestAutoplay();
                }
            });
            hlsPlayer.on(window.Hls.Events.MANIFEST_PARSED, function (_, data) {
                setQualityOptions((data && data.levels) || hlsPlayer.levels || []);
            });
            hlsPlayer.attachMedia(mainVideo);
            return hlsPlayer;
        }

        var currentFallbackMp4 = "";

        function destroyHlsPlayer() {
            if (hlsPlayer) {
                try { hlsPlayer.destroy(); } catch (e) {}
                hlsPlayer = null;
            }
            hlsLoadedUrl = "";
            setQualityOptions([]);
        }

        function resetVideoSource() {
            clearTimeout(stallRetryTimer);
            mainVideo.pause();
            mainVideo.removeAttribute("src");
            mainVideo.load();
            playRequestId += 1;
        }

        function attachAdaptiveSource(hlsUrl, fallbackMp4) {
            currentFallbackMp4 = fallbackMp4 || "";
            /* Hover playback should prioritize instant reliability. These MP4s are
               fast-start and range-served; HLS/MSE is kept only for projects that
               do not have a progressive fallback. */
            if (fallbackMp4) {
                destroyHlsPlayer();
                setQualityOptions([]);
                if (normaliseSrc(mainVideo.currentSrc || mainVideo.src) !== normaliseSrc(fallbackMp4)) {
                    mainVideo.src = fallbackMp4;
                    mainVideo.load();
                }
                return;
            }

            var hasHlsJs = !!(window.Hls && window.Hls.isSupported && window.Hls.isSupported());
            var useNativeHls = mainVideo.canPlayType("application/vnd.apple.mpegurl");

            if (hlsUrl && hasHlsJs) {
                ensureHlsPlayer();
                if (hlsLoadedUrl !== hlsUrl) {
                    hlsLoadedUrl = hlsUrl;
                    setQualityOptions([]);              /* reset until new manifest parses */
                    hlsPlayer.loadSource(hlsUrl);       /* swap source on the SAME instance */
                }
                return;
            }
            /* No HLS.js (e.g. Safari) — use native HLS or progressive MP4. */
            destroyHlsPlayer();
            if (hlsUrl && useNativeHls) {
                qualitySelect.innerHTML = "<option value='-1'>Auto (device)</option>";
                qualitySelect.disabled = true;
                if (mainVideo.src !== hlsUrl) { mainVideo.src = hlsUrl; mainVideo.load(); }
                return;
            }
            if (fallbackMp4) {
                setQualityOptions([]);
                if (normaliseSrc(mainVideo.src) !== normaliseSrc(fallbackMp4)) {
                    mainVideo.src = fallbackMp4;
                    mainVideo.load();
                }
            }
        }

        /* Recover from transient stalls during network/decode hiccups */
        var stallRetryTimer = null;
        function scheduleRetryPlay() {
            clearTimeout(stallRetryTimer);
            stallRetryTimer = setTimeout(function () {
                if (idx !== activePanelIdx || mainVideo.style.display === "none") return;
                requestAutoplay();
            }, 220);
        }
        mainVideo.addEventListener("waiting", scheduleRetryPlay);
        mainVideo.addEventListener("stalled", scheduleRetryPlay);
        mainVideo.addEventListener("waiting", function () {
            if (idx === activePanelIdx && mainVideo.style.display !== "none") {
                metricState.rebufferCount += 1;
                logMetrics("waiting");
            }
        });
        mainVideo.addEventListener("playing", function () {
            if (metricState.startupMs == null && metricState.startupAt > 0) {
                metricState.startupMs = Math.max(0, Math.round(performance.now() - metricState.startupAt));
                logMetrics("playing");
            }
        });
        mainVideo.addEventListener("seeking", function () {
            metricState.seekStartAt = performance.now();
        });
        mainVideo.addEventListener("seeked", function () {
            if (idx === activePanelIdx && mainVideo.style.display !== "none") {
                if (metricState.seekStartAt > 0) {
                    metricState.seekLastMs = Math.max(0, Math.round(performance.now() - metricState.seekStartAt));
                    logMetrics("seeked");
                }
                requestAutoplay();
            }
        });

        /* Playback watchdog for silent pause/stall edge cases */
        var lastTime = 0;
        var lastAdvanceAt = performance.now();
        mainVideo.addEventListener("timeupdate", function () {
            if (mainVideo.currentTime > lastTime + 0.001) {
                lastAdvanceAt = performance.now();
                lastTime = mainVideo.currentTime;
            }
        });
        setInterval(function () {
            if (idx !== activePanelIdx) return;
            if (mainVideo.style.display === "none") return;   /* image/youtube project active */
            if (mainVideo.ended) return;
            /* "Always play": if the active video is paused for any reason — including
               mid-buffer (readyState < 2) after a source swap — nudge it. Calling
               play() while buffering is harmless; it resumes once data arrives.
               This is the catch-all that fixes the "stops after switching" bug even
               if a canplay/loadeddata event was missed during a rapid hover swap. */
            if (mainVideo.paused) {
                requestAutoplay();
                logMetrics("watchdog-resume");
                return;
            }
            /* Detected playing-but-not-advancing (silent decode stall). */
            var stuckFor = performance.now() - lastAdvanceAt;
            if (mainVideo.readyState >= 2 && stuckFor > 1600) {
                mainVideo.currentTime = mainVideo.currentTime;  /* kick the decoder */
                requestAutoplay();
                logMetrics("watchdog-unstick");
            }
        }, 1000);

        /* Portrait detection: extend player down for portrait videos */
        mainVideo.addEventListener("loadedmetadata", function () {
            var h = mainVideo.videoHeight || 0;
            var w = mainVideo.videoWidth || 0;
            playerWrap.classList.toggle("is-portrait", h > w);
        });

        /* Lightbox (experiments only) */
        var lightbox = null;
        if (section.type === "grid") {
            lightbox = document.createElement("div");
            lightbox.className = "ap-lightbox";
            lightbox.innerHTML =
                "<div class='ap-lightbox-media'></div>" +
                "<div class='ap-lightbox-foot'>" +
                    "<p class='ap-lightbox-title'></p>" +
                    "<button class='ap-close-btn' type='button'>Close</button>" +
                "</div>";
            lightbox.querySelector(".ap-close-btn").addEventListener("click", function (e) {
                e.stopPropagation();
                lightbox.classList.remove("is-open");
            });
            playerWrap.appendChild(lightbox);
        }

        content.appendChild(playerWrap);

        /* ---- Context text box (between video and grid; updates per project) ---- */
        var contextBox = document.createElement("div");
        contextBox.className = "ap-context-box";

        function setContextText(text, links) {
            var txt = (text || section.description || "").trim();
            contextBox.innerHTML = txt ? ("<p>" + txt.replace(/\n/g, "</p><p>") + "</p>") : "";
            if (links && links.length) {
                var linkWrap = document.createElement("div");
                linkWrap.className = "ap-official-links";
                links.forEach(function (link) {
                    if (!link || !link.url) return;
                    var anchor = document.createElement("a");
                    anchor.className = "ap-official-link";
                    anchor.href = link.url;
                    anchor.target = "_blank";
                    anchor.rel = "noopener noreferrer";
                    anchor.textContent = link.label || "Watch official post";
                    linkWrap.appendChild(anchor);
                });
                if (linkWrap.children.length) {
                    contextBox.appendChild(linkWrap);
                }
            }
        }
        content.appendChild(contextBox);

        /* ---- Thumbnail grid ---- */
        var thumbGrid = document.createElement("div");
        thumbGrid.className = "ap-thumb-grid";

        var activeProjectIdx = -1;
        var thumbCards = [];
        var currentSrc = "";
        var currentYoutube = "";

        function normaliseSrc(src) {
            if (!src) return "";
            try {
                var a = document.createElement("a");
                a.href = src;
                return a.pathname || src;
            } catch (e) { return src; }
        }

        function selectProject(pIdx) {
            if (pIdx < 0 || pIdx >= section.projects.length) return;
            var proj = section.projects[pIdx];
            activeProjectIdx = pIdx;

            /* Always close the lightbox when selection changes */
            if (lightbox) {
                lightbox.classList.remove("is-open");
            }

            /* Update context box with project-specific description */
            setContextText(proj.description, proj.officialLinks);

            if (proj.youtube) {
                destroyHlsPlayer();
                resetVideoSource();
                mainVideo.style.display = "none";
                mainImage.style.display = "none";
                mainYouTube.style.display = "block";
                hud.style.display = "none";

                var embedUrl = proj.youtube;
                if (embedUrl.indexOf("/embed/") === -1 && embedUrl.indexOf("youtube.com/watch") !== -1) {
                    var m = embedUrl.match(/[?&]v=([^&]+)/);
                    embedUrl = m ? "https://www.youtube.com/embed/" + m[1] : embedUrl;
                } else if (embedUrl.indexOf("/embed/") === -1 && embedUrl.indexOf("youtu.be/") !== -1) {
                    var m = embedUrl.match(/youtu\.be\/([^?]+)/);
                    embedUrl = m ? "https://www.youtube.com/embed/" + m[1] : embedUrl;
                }
                if (embedUrl !== currentYoutube) {
                    currentYoutube = embedUrl;
                    mainYouTube.src = embedUrl + (embedUrl.indexOf("?") !== -1 ? "&" : "?") + "autoplay=1";
                }
                currentSrc = "";

            } else if (proj.video) {
                mainYouTube.src = "";
                mainYouTube.style.display = "none";
                mainImage.style.display = "none";
                mainVideo.style.display = "";
                hud.style.display = "";
                resetMetrics();

                /* Unified default level + optional per-project override */
                var projectVolume = (typeof proj.volume === "number") ? proj.volume : 0.85;
                selectedProjectVolume = Math.max(0, Math.min(1, projectVolume));
                mainVideo.volume = selectedProjectVolume;

                /* Poster shows instantly while video loads */
                mainVideo.poster = proj.poster || "";
                currentSrc = proj.hls || proj.video;
                /* attachAdaptiveSource is idempotent: it no-ops if the source is
                   unchanged, swaps source on the existing HLS instance otherwise.
                   Playback (re)starts from the canplay/loadeddata handlers — we do
                   NOT call play() synchronously here, which was the stall race. */
                attachAdaptiveSource(proj.hls || "", proj.video);
                requestAutoplay();
                currentYoutube = "";

            } else if (proj.image) {
                destroyHlsPlayer();
                resetVideoSource();
                mainVideo.style.display = "none";
                mainYouTube.src = "";
                mainYouTube.style.display = "none";
                mainImage.src = proj.image;
                mainImage.alt = proj.title || "";
                mainImage.style.display = "";
                hud.style.display = "none";
                currentSrc = "";
                currentYoutube = "";
            }

            thumbCards.forEach(function (btn, i) {
                btn.classList.toggle("is-active", i === pIdx);
            });
        }

        section.projects.forEach(function (proj, pIdx) {
            var card = document.createElement("button");
            card.className = "ap-thumb-card";
            card.type = "button";

            var mediaDiv = document.createElement("div");
            mediaDiv.className = "ap-thumb-media";

            if (proj.image) {
                var tImg = document.createElement("img");
                tImg.src = proj.image;
                tImg.alt = proj.title || "";
                tImg.loading = "eager";
                mediaDiv.appendChild(tImg);
            } else if (proj.youtube) {
                var ytM = proj.youtube.match(/[?&]v=([^&]+)/) || proj.youtube.match(/youtu\.be\/([^?]+)/) || proj.youtube.match(/\/embed\/([^?]+)/);
                var ytId = ytM ? ytM[1] : "";
                if (ytId) {
                    var tImg = document.createElement("img");
                    tImg.src = "https://img.youtube.com/vi/" + ytId + "/mqdefault.jpg";
                    tImg.alt = proj.title || "";
                    tImg.loading = "eager";
                    mediaDiv.appendChild(tImg);
                } else {
                    mediaDiv.style.background = "var(--ap-lift)";
                }
            } else if (proj.poster) {
                var tImg = document.createElement("img");
                tImg.src = proj.poster;
                tImg.alt = proj.title || "";
                tImg.loading = "eager";
                mediaDiv.appendChild(tImg);
            } else {
                mediaDiv.dataset.posterSrc = proj.video || "";
                mediaDiv.style.background = "var(--ap-lift)";
            }

            var info = document.createElement("div");
            info.className = "ap-thumb-info";
            info.innerHTML = "<strong>" + (proj.title || "") + "</strong>" +
                (proj.subtitle ? "<span>" + proj.subtitle + "</span>" : "");

            card.appendChild(mediaDiv);
            card.appendChild(info);
            thumbGrid.appendChild(card);
            thumbCards.push(card);

            /* Hover/focus → switch main player to this project */
            card.addEventListener("pointerenter", function () {
                selectProject(pIdx);
            });
            card.addEventListener("focus", function () {
                selectProject(pIdx);
            });

            /* Click → switch + lightbox for experiments */
            card.addEventListener("click", function (e) {
                e.stopPropagation();
                selectProject(pIdx);

                if (section.type === "grid" && lightbox && proj.image) {
                    var slot  = lightbox.querySelector(".ap-lightbox-media");
                    var title = lightbox.querySelector(".ap-lightbox-title");
                    slot.innerHTML = "";
                    var lbImg = document.createElement("img");
                    lbImg.src = proj.image;
                    lbImg.alt = proj.title || "";
                    slot.appendChild(lbImg);
                    title.textContent = proj.title || "";
                    lightbox.classList.add("is-open");
                }
            });
        });

        content.appendChild(thumbGrid);
        panel.appendChild(content);

        /* ---------- Panel click → activate ---------- */
        panel.addEventListener("click", function (e) {
            /* Don't hijack clicks on thumb cards, close buttons, or native
               video controls — let those handle themselves. */
            if (e.target.closest(".ap-thumb-card") ||
                e.target.closest(".ap-close-btn") ||
                e.target.closest(".ap-official-link")) return;

            /* Don't switch panels when clicking video/YouTube player */
            if (e.target.closest("video") || e.target.closest("iframe")) {
                if (needsUserGesture) {
                    needsUserGesture = false;
                    requestAutoplay();
                }
                return;
            }

            if (activePanelIdx !== idx) {
                activatePanel(idx);
            }
        });

        /* ---------- Controller ---------- */
        controllers.push({
            idx: idx,
            onActivate: function (isActive) {
                if (isActive) {
                    if (activeProjectIdx < 0) activeProjectIdx = 0;
                    selectProject(activeProjectIdx);
                } else {
                    destroyHlsPlayer();
                    resetVideoSource();
                    mainYouTube.src = "";
                    hud.style.display = "none";
                    currentSrc = "";
                    currentYoutube = "";
                }
            }
        });

        panelEls.push(panel);
        viewport.appendChild(panel);
    });

    /* ------------------------------------------------------------------
       4. INITIALISE — activate Main Work (panel 0).
          Wait for hls.js so the very first source attaches via HLS.js
          (otherwise the first project would fall back to native/MP4 and the
          quality menu would be stuck on "Auto"). If the CDN is slow/blocked,
          proceed after a short timeout — attachAdaptiveSource degrades to
          native HLS or progressive MP4 on its own.
       ------------------------------------------------------------------ */
    (function initWhenReady(waited) {
        var hlsReady = !!(window.Hls && window.Hls.isSupported);
        if (hlsReady || waited >= 2500) {
            activatePanel(0);
            return;
        }
        setTimeout(function () { initWhenReady(waited + 80); }, 80);
    })(0);

    /* ------------------------------------------------------------------
       5. GLOBAL CLICK FALLBACK — if browser blocked muted autoplay,
          the very first user click anywhere retries playback.
       ------------------------------------------------------------------ */
    document.addEventListener("click", function retryPlay() {
        if (needsUserGesture) {
            needsUserGesture = false;
            controllers.forEach(function (c) {
                if (c.idx === activePanelIdx) c.onActivate(true);
            });
        }
        document.removeEventListener("click", retryPlay);
    }, { once: true });

    /* ------------------------------------------------------------------
       6. POSTER FRAMES — capture first frame of each video in parallel
          so all thumbnails appear instantly.
       ------------------------------------------------------------------ */
    function loadPosterFrames() {
        var items = viewport.querySelectorAll("[data-poster-src]");
        items.forEach(function (el) {
            var src = el.dataset.posterSrc;
            if (!src) return;

            var v = document.createElement("video");
            v.muted = true;
            v.preload = "auto";
            v.playsInline = true;

            var done = false;
            function finish(url) {
                if (done) return;
                done = true;
                v.removeAttribute("src");
                v.load();
                if (url) {
                    var img = document.createElement("img");
                    img.src = url;
                    img.alt = "";
                    img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
                    el.innerHTML = "";
                    el.appendChild(img);
                    el.style.background = "";
                }
            }

            v.addEventListener("loadeddata", function () {
                try {
                    var c = document.createElement("canvas");
                    c.width  = v.videoWidth  || 320;
                    c.height = v.videoHeight || 180;
                    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
                    finish(c.toDataURL("image/jpeg", 0.55));
                } catch (e) { finish(""); }
            });
            v.addEventListener("error", function () { finish(""); });
            setTimeout(function () { finish(""); }, 4000);
            v.src = src;
        });
    }

    loadPosterFrames();
})();
