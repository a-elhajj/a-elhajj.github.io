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
        mainVideo.volume   = 0;
        playerWrap.appendChild(mainVideo);

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

        /* Auto-play whenever enough data is buffered */
        mainVideo.addEventListener("canplay", function () {
            if (idx === activePanelIdx) {
                mainVideo.play().catch(function () {});
            }
        });

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

        /* ---- Thumbnail grid ---- */
        var thumbGrid = document.createElement("div");
        thumbGrid.className = "ap-thumb-grid";

        var activeProjectIdx = 0;
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
            activeProjectIdx = pIdx;
            var proj = section.projects[pIdx];

            if (proj.youtube) {
                mainVideo.pause();
                mainVideo.removeAttribute("src");
                mainVideo.style.display = "none";
                mainImage.style.display = "none";
                mainYouTube.style.display = "block";

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

                /* Poster shows instantly while video loads */
                mainVideo.poster = proj.poster || "";
                currentSrc = proj.video;
                mainVideo.src = proj.video;
                mainVideo.play().catch(function (err) {
                    needsUserGesture = true;
                });
                currentYoutube = "";

            } else if (proj.image) {
                mainVideo.pause();
                mainVideo.removeAttribute("src");
                mainVideo.style.display = "none";
                mainYouTube.src = "";
                mainYouTube.style.display = "none";
                mainImage.src = proj.image;
                mainImage.alt = proj.title || "";
                mainImage.style.display = "";
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

            /* Hover → switch main player to this project */
            card.addEventListener("mouseenter", function () {
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
                e.target.closest(".ap-close-btn")) return;

            /* Don't switch panels when clicking video/YouTube player */
            if (e.target.closest("video") || e.target.closest("iframe")) {
                if (needsUserGesture) {
                    needsUserGesture = false;
                    mainVideo.play().catch(function () {});
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
                    selectProject(activeProjectIdx);
                } else {
                    mainVideo.pause();
                    mainVideo.removeAttribute("src");
                    mainYouTube.src = "";
                    currentSrc = "";
                    currentYoutube = "";
                }
            }
        });

        panelEls.push(panel);
        viewport.appendChild(panel);
    });

    /* ------------------------------------------------------------------
       4. INITIALISE — activate Main Work (panel 0)
       ------------------------------------------------------------------ */
    activatePanel(0);

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
