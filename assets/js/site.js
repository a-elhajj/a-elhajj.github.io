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
})();
