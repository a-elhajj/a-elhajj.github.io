/* ============================================================================
   site.js — shared behavior: custom cursor, marquee, scroll reveals, hero lines.
   All motion is gated by prefers-reduced-motion and touch/coarse pointers.
   ============================================================================ */
(function () {
	var yr = document.getElementById("yr"); if (yr) yr.textContent = new Date().getFullYear();
	var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	var coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;

	/* ---- Hero line reveal (only if a hero is present) ---- */
	var hero = document.getElementById("hero");
	if (hero) requestAnimationFrame(function(){ hero.classList.add("in"); });

	/* ---- Scroll reveals ---- */
	var rvs = document.querySelectorAll(".rv");
	if (reduce || !("IntersectionObserver" in window)) {
		rvs.forEach(function(el){ el.classList.add("in"); });
	} else {
		var io = new IntersectionObserver(function(es){
			es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } });
		}, { threshold:.15, rootMargin:"0px 0px -8% 0px" });
		rvs.forEach(function(el){ io.observe(el); });
	}

	/* ---- Custom crosshair cursor + magnetic snap ----
	   FIX: stays hidden (no .live) until the first mousemove, so it never renders
	   as a stray "+" parked in the middle of the hero on page load. */
	var cur = document.querySelector(".cursor");
	if (cur && !coarse && !reduce) {
		var cx = innerWidth/2, cy = innerHeight/2, tx = cx, ty = cy, started = false;
		addEventListener("mousemove", function(e){
			tx = e.clientX; ty = e.clientY;
			if (!started) { started = true; cx = tx; cy = ty; cur.classList.add("live"); }
		}, {passive:true});
		(function loop(){
			cx += (tx - cx) * .18; cy += (ty - cy) * .18;
			cur.style.transform = "translate(" + cx + "px," + cy + "px)";
			requestAnimationFrame(loop);
		})();
		var hot = "a, button, .work, .split a";
		document.addEventListener("mouseover", function(e){ if (e.target.closest(hot)) cur.classList.add("snap"); });
		document.addEventListener("mouseout",  function(e){ if (e.target.closest(hot)) cur.classList.remove("snap"); });
	} else if (cur) {
		cur.style.display = "none";
	}

	/* ---- Seamless marquee via rAF ---- */
	if (!reduce) {
		document.querySelectorAll(".mrow").forEach(function(row){
			row.innerHTML += row.innerHTML;   /* duplicate for a seamless loop */
			var dir = parseFloat(row.getAttribute("data-dir")) || 1;
			var x = dir < 0 ? -row.scrollWidth/2 : 0;
			var speed = 0.4 * dir;
			(function tick(){
				x -= speed;
				var half = row.scrollWidth/2;
				if (x <= -half) x += half;
				if (x >= 0 && dir < 0) x -= half;
				row.style.transform = "translateX(" + x + "px)";
				requestAnimationFrame(tick);
			})();
		});
	}

	/* ---- Offline floating story capsule ---- */
	var offSection = document.getElementById("offline");
	var offFloat = document.getElementById("off-float");
	if (offSection && offFloat) {
		var offCards = offSection.querySelectorAll(".off-card[data-story]");
		var offHead = offFloat.querySelector(".off-float-head");
		var offTitle = offFloat.querySelector(".off-float-title");
		var offCopy = offFloat.querySelector(".off-float-copy");
		var activeCard = null;
		var ticking = false;
		var fx = 0, fy = 0, tx = 0, ty = 0;

		function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

		function anchorForCard(card) {
			var r = card.getBoundingClientRect();
			var panelW = offFloat.offsetWidth || 340;
			var panelH = offFloat.offsetHeight || 190;
			var rightX = r.right + 22;
			var leftX = r.left - panelW - 22;
			var hasRight = (innerWidth - r.right) > (panelW + 28);
			var x = hasRight ? rightX : leftX;
			var y = r.top + (r.height * 0.24);
			x = clamp(x, 14, innerWidth - panelW - 14);
			y = clamp(y, 14, innerHeight - panelH - 14);
			return { x: x, y: y };
		}

		function render() {
			if (!ticking) return;
			fx += (tx - fx) * 0.16;
			fy += (ty - fy) * 0.16;
			offFloat.style.transform = "translate3d(" + Math.round(fx) + "px," + Math.round(fy) + "px,0)";
			requestAnimationFrame(render);
		}

		function showStory(card, evt) {
			activeCard = card;
			offCards.forEach(function(c){ c.classList.toggle("is-story-active", c === card); });
			if (offHead) offHead.textContent = "Story";
			if (offTitle) offTitle.textContent = card.getAttribute("data-label") || "Offline";
			if (offCopy) offCopy.textContent = card.getAttribute("data-story") || "";
			offFloat.classList.add("is-live");
			offFloat.setAttribute("aria-hidden", "false");

			var a = anchorForCard(card);
			fx = a.x;
			fy = a.y;
			tx = a.x;
			ty = a.y;
			offFloat.style.transform = "translate3d(" + Math.round(fx) + "px," + Math.round(fy) + "px,0)";

			if (evt && evt.clientX && evt.clientY) {
				var panelW = offFloat.offsetWidth || 340;
				var panelH = offFloat.offsetHeight || 190;
				tx = clamp(evt.clientX + 28, 14, innerWidth - panelW - 14);
				ty = clamp(evt.clientY - panelH * 0.42, 14, innerHeight - panelH - 14);
			}

			if (!ticking) {
				ticking = true;
				requestAnimationFrame(render);
			}
		}

		function moveStory(evt) {
			if (!activeCard || !offFloat.classList.contains("is-live")) return;
			var panelW = offFloat.offsetWidth || 340;
			var panelH = offFloat.offsetHeight || 190;
			tx = clamp(evt.clientX + 24, 14, innerWidth - panelW - 14);
			ty = clamp(evt.clientY - panelH * 0.42, 14, innerHeight - panelH - 14);
		}

		function hideStory() {
			activeCard = null;
			offCards.forEach(function(c){ c.classList.remove("is-story-active"); });
			offFloat.classList.remove("is-live");
			offFloat.setAttribute("aria-hidden", "true");
			ticking = false;
		}

		if (!coarse) {
			offCards.forEach(function(card){
				card.addEventListener("mouseenter", function(e){ showStory(card, e); });
				card.addEventListener("mousemove", moveStory);
				card.addEventListener("mouseleave", hideStory);
			});

			addEventListener("scroll", function(){
				if (!activeCard || !offFloat.classList.contains("is-live")) return;
				var a = anchorForCard(activeCard);
				tx = a.x;
				ty = a.y;
			}, { passive:true });

			addEventListener("resize", function(){
				if (!activeCard || !offFloat.classList.contains("is-live")) return;
				var a = anchorForCard(activeCard);
				tx = a.x;
				ty = a.y;
			});
		}
	}
})();
