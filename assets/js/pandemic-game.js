/**
 * Pandemic Manager: AI Edition - Keypad Movement, Clean Graphics
 * Arrow keys move character, Enter at building to enter. No reference images.
 */

(function (global) {
  "use strict";

  var D = global.PandemicGameData;
  if (!D) return;

  var INIT_COMMUNITY_LEVEL = 0.05;
  var COMMUNITY_GROWTH = 0.04;
  var MOVE_STEP = 3;
  var CHAR_INIT_X = 50;
  var CHAR_INIT_Y = 55;

  var game = {
    day: 1,
    daysSurvived: 0,
    location: "overworld",
    communityLevel: INIT_COMMUNITY_LEVEL,
    infected: false,
    decisionStep: 0,
    chosenLocation: null,
    chosenOptions: {},
    currentPrompt: null,
    charX: CHAR_INIT_X,
    charY: CHAR_INIT_Y
  };

  var ZONES = [
    { id: "home", x: 10, y: 50, w: 18, h: 30 },
    { id: "work", x: 45, y: 15, w: 20, h: 40 },
    { id: "school", x: 75, y: 18, w: 18, h: 35 },
    { id: "social", x: 72, y: 52, w: 22, h: 32 },
    { id: "hospital", x: 10, y: 15, w: 18, h: 25 }
  ];

  var ASSETS = {
    male: null,
    female: null
  };

  function cleanImage(src, tolerance, callback) {
    if (typeof tolerance === 'function') {
      callback = tolerance;
      tolerance = 60; // default
    }
    var img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = src;
    img.onload = function() {
      // Use full image dimensions
      var sourceW = img.width;
      var sourceH = img.height;
      var destW = img.width;
      var destH = img.height;
      var sourceX = 0;

      var canvas = document.createElement("canvas");
      canvas.width = destW;
      canvas.height = destH;
      var ctx = canvas.getContext("2d");
      
      ctx.drawImage(img, sourceX, 0, sourceW, sourceH, 0, 0, destW, destH);
      
      var idata = ctx.getImageData(0,0,canvas.width,canvas.height);
      var d = idata.data;
      // Target Green: 91, 163, 70 (#5ba346)
      var minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      var hasPixels = false;

      for(var i=0; i<d.length; i+=4) {
        var r=d[i], g=d[i+1], b=d[i+2];
        
        // 1. Green Key (Euclidean Distance)
        var dist = Math.sqrt(Math.pow(r-91, 2) + Math.pow(g-163, 2) + Math.pow(b-70, 2));
        if (dist < tolerance) {
          d[i+3] = 0;
        }
        
        // Track bounding box of non-transparent pixels
        if (d[i+3] > 0) {
          hasPixels = true;
          var x = (i / 4) % canvas.width;
          var y = Math.floor((i / 4) / canvas.width);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      
      if (hasPixels) {
        // Crop to bounding box
        var cropW = maxX - minX + 1;
        var cropH = maxY - minY + 1;
        var cropCanvas = document.createElement("canvas");
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        var cropCtx = cropCanvas.getContext("2d");
        
        // Put the cleaned data back to original canvas first
        ctx.putImageData(idata, 0, 0);
        
        // Draw cropped region to new canvas
        cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
        callback(cropCanvas.toDataURL());
      } else {
        // Return transparent 1x1 if empty
        ctx.putImageData(idata, 0, 0);
        callback(canvas.toDataURL());
      }
    };
  }

  function preloadAssets() {
    var ts = new Date().getTime();
    cleanImage("/assets/images/game-assets/sprite_male.png?v=" + ts, 60, function(url) { ASSETS.male = url; });
    cleanImage("/assets/images/game-assets/sprite_female.png?v=" + ts, 60, function(url) { ASSETS.female = url; });
    
    // Clean static elements
    setTimeout(function() {
      var els = document.querySelectorAll(".game-building, .game-tree");
      els.forEach(function(el) {
        var style = window.getComputedStyle(el);
        var bg = style.backgroundImage;
        if(bg && bg.indexOf("url") !== -1) {
          var match = bg.match(/url\(["']?([^"']*)["']?\)/);
          if (match && match[1]) {
            var src = match[1];
            // Custom tolerance per building type to balance edge cleaning vs preservation
            var tol = 60; // default
            if (el.classList.contains("game-tree")) tol = 55;
            else if (el.classList.contains("school") || el.classList.contains("social")) tol = 110; // Stronger for dark buildings
            else if (el.classList.contains("home") || el.classList.contains("hospital")) tol = 50; // Weaker for light/greenish buildings
            else tol = 80;
            
            cleanImage(src, tol, function(url) { el.style.backgroundImage = "url(" + url + ")"; });
          }
        }
      });
    }, 500); // Wait for CSS to apply
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function show(el, visible) {
    if (!el) return;
    el.classList.toggle("game-hidden", !visible);
  }

  function setScene(locId) {
    var viewport = getEl("game-viewport");
    if (!viewport) return;
    viewport.className = "game-viewport game-scene " + (locId || "overworld");
    var locView = getEl("game-location-view");
    if (locView) locView.className = "game-location-view game-hidden scene-" + (locId || "overworld");
    game.location = locId || "overworld";
  }

  function showOverworld() {
    show(getEl("game-title-screen"), false);
    show(getEl("game-main"), true);
    show(getEl("game-topbar"), true);
    show(getEl("game-overworld"), true);
    show(getEl("game-location-view"), false);
    setScene("overworld");
    updateCharacter();
    updateTopbar();
    updateZoneActive();
  }

  function showLocationView(locId) {
    show(getEl("game-overworld"), false);
    setScene(locId);
    
    var locView = getEl("game-location-view");
    if (locView) {
      // Force display and specific scene class
      locView.className = "game-location-view scene-" + locId;
    }

    game.chosenLocation = locId;
    game.decisionStep = 0;
    game.chosenOptions = {};
    showLocationDecision(locId);
  }

  function showLocationDecision(locId) {
    var def = D.getLocationDef(locId);
    if (!def || !def.decisions) return;

    var step = game.decisionStep;
    var decision = def.decisions[step];
    if (!decision) {
      endLocationVisit();
      return;
    }

    game.currentPrompt = decision;
    var container = getEl("game-decision-container");
    if (!container) return;

    var html = '<div class="game-decision-box">' +
      '<h3>' + decision.prompt + '</h3>' +
      '<div class="game-decision-buttons">';
    decision.options.forEach(function (opt) {
      html += '<button type="button" class="game-decision-btn" data-option="' + opt.id + '" data-mod="' + opt.riskMod + '">' + opt.label + '</button>';
    });
    html += '</div></div>';
    container.innerHTML = html;

    container.querySelectorAll(".game-decision-btn").forEach(function (btn) {
      btn.onclick = function () {
        var optId = btn.dataset.option;
        var riskMod = parseFloat(btn.dataset.mod);
        game.chosenOptions[decision.id] = { option: optId, riskMod: riskMod };

        if (decision.id === "stay_home" && optId === "no") {
          showOverworld();
          return;
        }
        if (riskMod === 0) {
          endLocationVisit();
          return;
        }
        if (decision.id === "go_social" && optId === "yes") {
          game.decisionStep++;
          showLocationDecision(locId);
          return;
        }
        if (decision.id === "confirm_social" && optId === "yes") {
          game.decisionStep++;
          showLocationDecision(locId);
          return;
        }
        if (decision.id === "go_school" && optId === "yes") {
          game.decisionStep++;
          showLocationDecision(locId);
          return;
        }
        if (decision.id === "work_from_home" && optId === "no") {
          game.decisionStep++;
          showLocationDecision(locId);
          return;
        }
        if (decision.id === "work_from_home" && optId === "yes") {
          endLocationVisit();
          return;
        }
        if (decision.id === "mask_sd" || decision.id === "stay_home") {
          endLocationVisit();
          return;
        }
        endLocationVisit();
      };
    });
  }

  function resolveInfection() {
    var def = D.getLocationDef(game.chosenLocation);
    if (!def) return;

    var totalRiskMod = 1;
    for (var k in game.chosenOptions) {
      totalRiskMod *= game.chosenOptions[k].riskMod;
    }
    if (totalRiskMod === 0) {
      safeDay();
      return;
    }

    var infected = D.rollInfection(def, totalRiskMod, game.communityLevel, game.agent, game.chosenOptions);
    if (infected) {
      game.infected = true;
      showGameOver();
    } else {
      safeDay();
    }
  }

  function safeDay() {
    game.communityLevel = Math.min(1, game.communityLevel + COMMUNITY_GROWTH);
    game.day++;
    game.daysSurvived = game.day;
    
    if (game.day > 100) {
      showVictory();
      return;
    }

    showToast("Day " + game.day + " – You stayed safe.", 2000);
    maybeShowResearchTip();
    showOverworld();
  }

  function showVictory() {
    var locView = getEl("game-location-view");
    if (locView) locView.className = "game-location-view scene-overworld"; // Use generic bg
    
    var agentInfo = game.agent ? (" (" + game.agent.ageLabel + ")") : "";
    
    var html = '<div class="game-end-screen victory" id="victory-screen">' +
      '<h2>VICTORY!</h2>' +
      '<p><strong>100 DAYS SURVIVED!</strong></p>' +
      '<p>You flattened the curve, saved the economy (sort of), and mastered the art of awkward elbow bumps.</p>' +
      '<p>The virus has officially filed a complaint against you.</p>' +
      '<p class="score">Final Score: 100 Days' + agentInfo + '</p>' +
      '<button type="button" class="restart-btn" id="restart-btn-win">Play Again</button>' +
      '</div>';
      
    var container = getEl("game-end-container");
    if (container) container.innerHTML = html;
    
    show(getEl("game-overworld"), false);
    show(getEl("game-location-view"), false);
    show(getEl("game-end-container"), true);

    setTimeout(function () {
      var btn = getEl("restart-btn-win");
      if (btn) btn.onclick = startGame;
    }, 50);
  }

  function maybeShowResearchTip() {
    if (game.day > 1 && game.day % 5 === 0) {
      setTimeout(function () {
        showToast(D.getRandomTip(), 4500);
      }, 2200);
    }
  }

  function showToast(msg, duration) {
    var t = getEl("game-toast");
    if (!t) return;
    t.textContent = msg;
    show(t, true);
    setTimeout(function () {
      show(t, false);
    }, duration || 2000);
  }

  function endLocationVisit() {
    resolveInfection();
  }

  function showGameOver() {
    var locView = getEl("game-location-view");
    if (locView) locView.className = "game-location-view scene-home";
    var survived = game.day;
    var agentInfo = game.agent ? (" (" + game.agent.ageLabel + ", " + game.agent.comorbidityLabel + ")") : "";
    var html = '<div class="game-end-screen failure" id="failure-screen">' +
      '<h2>INFECTED</h2>' +
      '<p>You brought the infection home. Household transmission is active.</p>' +
      '<p class="score">You survived ' + survived + ' days' + agentInfo + '</p>' +
      '<p><em>Research: 45.4% of infections occur at home when people spend more time indoors. Mask and social distance at high-risk locations.</em></p>' +
      '<button type="button" class="restart-btn" id="restart-btn">Try Again</button>' +
      '</div>';
    var container = getEl("game-end-container");
    if (container) container.innerHTML = html;
    show(getEl("game-overworld"), false);
    show(getEl("game-location-view"), false);
    show(getEl("game-end-container"), true);

    setTimeout(function () {
      var btn = getEl("restart-btn");
      if (btn) btn.onclick = startGame;
    }, 50);
  }

  function updateCharacter(isMoving) {
    var ch = getEl("game-character");
    if (!ch) return;
    ch.style.left = game.charX + "%";
    ch.style.top = game.charY + "%";
    
    // Apply gender class
    ch.classList.remove("male", "female");
    var gender = (game.agent && game.agent.gender) ? game.agent.gender : "male";
    ch.classList.add(gender);
    
    var body = ch.querySelector(".sprite-body");
    if (body && ASSETS[gender]) {
      body.style.backgroundImage = "url(" + ASSETS[gender] + ")";
    }

    // Walking animation
    if (isMoving) {
      ch.classList.add("walking");
    } else {
      ch.classList.remove("walking");
    }
  }

  function handleKeydown(e) {
    if (game.location !== "overworld") return;
    var handled = false;
    var moved = false;
    if (e.key === "ArrowUp") {
      game.charY = Math.max(5, game.charY - MOVE_STEP);
      handled = true; moved = true;
    } else if (e.key === "ArrowDown") {
      game.charY = Math.min(95, game.charY + MOVE_STEP);
      handled = true; moved = true;
    } else if (e.key === "ArrowLeft") {
      game.charX = Math.max(2, game.charX - MOVE_STEP);
      handled = true; moved = true;
    } else if (e.key === "ArrowRight") {
      game.charX = Math.min(98, game.charX + MOVE_STEP);
      handled = true; moved = true;
    } else if (e.key === "Enter" || e.key === " ") {
      tryEnterLocation();
      handled = true;
    }
    
    if (handled) {
      e.preventDefault();
      updateCharacter(moved);
      updateZoneActive();
      
      // Stop walking animation after a delay
      if (moved) {
        clearTimeout(game.walkTimeout);
        game.walkTimeout = setTimeout(function() {
          updateCharacter(false);
        }, 200);
      }
    }
  }

  function getCurrentZone() {
    // Simple distance check or bounding box
    // Character is at game.charX, game.charY (percent)
    // Zones have x, y, w, h (percent)
    // Check if character is "inside" or close to the door of the zone
    // Let's assume the "door" is near the bottom center of the zone
    
    for (var i = 0; i < ZONES.length; i++) {
      var z = ZONES[i];
      // Check if char is within the zone box roughly
      if (game.charX >= z.x && game.charX <= z.x + z.w &&
          game.charY >= z.y && game.charY <= z.y + z.h) {
        return z;
      }
      // Also check a bit of buffer
      if (game.charX >= z.x - 2 && game.charX <= z.x + z.w + 2 &&
          game.charY >= z.y - 2 && game.charY <= z.y + z.h + 2) {
        return z;
      }
    }
    return null;
  }

  function updateZoneActive() {
    var activeZone = getCurrentZone();
    document.querySelectorAll(".game-zone").forEach(function(el) {
      el.classList.remove("active");
      if (activeZone && el.dataset.location === activeZone.id) {
        el.classList.add("active");
      }
    });
    
    var hint = getEl("game-move-hint");
    if (hint) {
      if (activeZone) {
        hint.textContent = "Press ENTER to enter " + activeZone.id.toUpperCase();
        hint.classList.add("highlight");
      } else {
        hint.textContent = "Arrow keys to move • Enter to visit";
        hint.classList.remove("highlight");
      }
    }
  }

  function tryEnterLocation() {
    var zone = getCurrentZone();
    if (zone) {
      showLocationView(zone.id);
    }
  }

  function updateTopbar() {
    var dayEl = getEl("game-day");
    if (dayEl) dayEl.textContent = "Day " + game.day;

    var survivalEl = getEl("game-survival");
    if (survivalEl) survivalEl.textContent = "Days survived: " + game.day;

    var agentEl = getEl("game-agent-info");
    if (agentEl) {
      agentEl.textContent = game.agent ? (game.agent.gender === "female" ? "♀ " : "♂ ") + game.agent.ageLabel + ", " + game.agent.comorbidityLabel : "";
    }
  }

  function startGame() {
    game = {
      day: 1,
      daysSurvived: 1,
      location: "overworld",
      communityLevel: INIT_COMMUNITY_LEVEL,
      infected: false,
      decisionStep: 0,
      chosenLocation: null,
      chosenOptions: {},
      currentPrompt: null,
      agent: D.generateAgentState(),
      charX: CHAR_INIT_X,
      charY: CHAR_INIT_Y
    };

    var container = getEl("game-end-container");
    if (container) container.innerHTML = "";

    showOverworld();
  }

  function init() {
    var startBtn = getEl("game-start-btn");
    if (startBtn) startBtn.onclick = startGame;

    var backBtn = getEl("game-back-btn");
    if (backBtn) {
      backBtn.onclick = function () {
        show(getEl("game-location-view"), false);
        show(getEl("game-overworld"), true);
        setScene("overworld");
      };
    }

    document.querySelectorAll(".game-zone").forEach(function (el) {
      el.onclick = function () {
        if (game.location !== "overworld") return;
        var locId = el.dataset.location;
        if (locId) showLocationView(locId);
      };
    });

    document.addEventListener("keydown", handleKeydown);
    
    preloadAssets();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : this);
