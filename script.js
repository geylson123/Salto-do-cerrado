(function () {
  "use strict";

  var W = 640, H = 360, T = 30, ROWS = 12, MAX_LIVES = 3;
  var FONT = "'Fredoka', 'Trebuchet MS', system-ui, sans-serif";
  var C = {
    skyTop: "#7fc4c0", skyBot: "#f6e3b4", sun: "#fff1c4",
    hillFar: "#b9cf9c", hillNear: "#9ab97f",
    grass: "#7fa83c", grassDark: "#668f2e", earth: "#b8652f", earthDark: "#9b5226", earthLight: "#c97a41",
    coin: "#f2b82e", coinDark: "#b3821a",
    shell: "#8a6a46", body: "#d3ab74", bodyDark: "#b88e58",
    bug: "#6e2f26", bugLight: "#8d3f32",
    spike: "#e8e2d0", flag: "#e4572e"
  };

  /* ---------- fases ---------- */
  var LEVELS = [
    {
      name: "Campo aberto", w: 80,
      segs: [[0, 18, 9], [21, 34, 9], [37, 52, 9], [55, 80, 9]],
      plats: [[8, 6, 3], [24, 6, 3], [27, 4, 2], [40, 6, 4], [46, 5, 2], [62, 6, 3], [66, 4, 3]],
      coins: [[4, 8, 3], [8, 5, 3], [18, 6, 1], [19, 5, 1], [20, 6, 1], [25, 5, 3], [27, 3, 2], [35, 6, 1], [36, 5, 1], [41, 5, 4], [46, 4, 2], [53, 6, 1], [54, 5, 1], [63, 5, 3], [66, 3, 3], [72, 8, 4]],
      enemies: [[12, 9, 5], [28, 9, 4], [44, 9, 5], [60, 9, 6], [70, 9, 5]],
      spikes: [[31, 8], [48, 8], [64, 8]],
      flag: [76, 9]
    },
    {
      name: "Serra dos Buracos", w: 110,
      segs: [[0, 12, 9], [15, 24, 9], [27, 36, 9], [40, 46, 9], [50, 62, 9], [66, 76, 10], [80, 110, 9]],
      plats: [[4, 6, 3], [18, 6, 3], [21, 4, 3], [30, 6, 3], [33, 4, 2], [37, 9, 2], [42, 6, 3], [47, 9, 2], [52, 6, 2], [56, 4, 3], [63, 9, 2], [69, 7, 3], [77, 10, 2], [84, 6, 3], [88, 4, 3], [93, 6, 3]],
      coins: [[3, 8, 3], [4, 5, 3], [13, 6, 1], [14, 5, 1], [18, 5, 3], [21, 3, 3], [25, 6, 1], [26, 5, 1], [30, 5, 3], [33, 3, 2], [37, 7, 2], [42, 5, 3], [47, 7, 2], [52, 5, 2], [56, 3, 3], [63, 7, 2], [69, 6, 3], [77, 8, 2], [84, 5, 3], [88, 3, 3], [93, 5, 3], [100, 8, 4]],
      enemies: [[9, 9, 3], [19, 9, 3], [31, 9, 3], [43, 9, 2], [54, 9, 4], [70, 10, 3], [86, 9, 5], [96, 9, 5], [104, 9, 3]],
      spikes: [[20, 8], [34, 8], [58, 8], [72, 9], [90, 8], [98, 8], [101, 8]],
      flag: [106, 9]
    }
  ];

  var cv = document.getElementById("game");
  var ctx = cv.getContext("2d");
  var overlay = document.getElementById("overlay");
  var ovTitle = document.getElementById("ovTitle");
  var ovText = document.getElementById("ovText");
  var ovBtn = document.getElementById("ovBtn");
  var elScore = document.getElementById("sScore");
  var elCoins = document.getElementById("sCoins");
  var elLevel = document.getElementById("sLevel");
  var elBest = document.getElementById("sBest");
  var elLives = document.getElementById("sLives");
  var btnL = document.getElementById("btnL");
  var btnR = document.getElementById("btnR");
  var btnJ = document.getElementById("btnJ");
  var btnPause = document.getElementById("btnPause");
  var btnSound = document.getElementById("btnSound");

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scale = 1;

  var state = "ready"; // ready | running | paused | clear | over
  var li = 0, level = null, grid = [], cols = 0;
  var coins = [], enemies = [], spikes = [], particles = [], flag = { x: 0, y: 0 };
  var player = null, camX = 0, elapsed = 0, shake = 0, invuln = 0;
  var score = 0, lives = MAX_LIVES, coinsGot = 0, coinsTotal = 0, kills = 0;
  var left = false, right = false, padLeft = false, padRight = false, jumpHeld = false, jumpBuf = 0;
  var best = 0, newBest = false, soundOn = true, audio = null, lastT = 0;
  var safe = { x: 40, y: 200 }, respawnT = 0;

  try { best = parseInt(localStorage.getItem("salto-cerrado-best") || "0", 10) || 0; } catch (e) { best = 0; }

  function fit() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    scale = cv.width / W;
  }
  window.addEventListener("resize", fit);

  /* ---------- som ---------- */
  function ensureAudio() {
    if (audio || !soundOn) return;
    try { var AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); } catch (e) { audio = null; }
  }
  function beep(freq, dur, type, vol, slide) {
    if (!soundOn || !audio) return;
    try {
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = type || "square";
      o.frequency.value = freq;
      if (slide) o.frequency.linearRampToValueAtTime(slide, audio.currentTime + dur);
      g.gain.value = vol || 0.04;
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
    } catch (e) { /* sem som */ }
  }

  /* ---------- placar ---------- */
  function renderLives() {
    var html = "";
    for (var i = 0; i < MAX_LIVES; i++) html += '<span class="pip' + (i < lives ? "" : " off") + '"></span>';
    elLives.innerHTML = html;
    elLives.setAttribute("aria-label", lives + " vidas");
  }
  function renderHud() {
    elScore.textContent = String(score);
    elCoins.textContent = coinsGot + "/" + coinsTotal;
    elLevel.textContent = String(li + 1);
    elBest.textContent = String(Math.max(best, score));
  }

  /* ---------- fase ---------- */
  function loadLevel(n) {
    li = n; level = LEVELS[n]; cols = level.w;
    grid = [];
    var r, c, i, s;
    for (r = 0; r < ROWS; r++) { grid.push([]); for (c = 0; c < cols; c++) grid[r].push(0); }
    for (i = 0; i < level.segs.length; i++) {
      s = level.segs[i];
      for (c = s[0]; c < s[1]; c++) for (r = s[2]; r < ROWS; r++) grid[r][c] = 1;
    }
    for (i = 0; i < level.plats.length; i++) {
      s = level.plats[i];
      for (c = 0; c < s[2]; c++) grid[s[1]][s[0] + c] = 1;
    }
    coins = [];
    for (i = 0; i < level.coins.length; i++) {
      s = level.coins[i];
      for (c = 0; c < s[2]; c++) coins.push({ x: (s[0] + c) * T + T / 2, y: s[1] * T + T / 2, got: false, ph: Math.random() * 6 });
    }
    coinsTotal = coins.length; coinsGot = 0;
    enemies = [];
    for (i = 0; i < level.enemies.length; i++) {
      s = level.enemies[i];
      enemies.push({
        x: s[0] * T, y: s[1] * T - 22, w: 26, h: 22, vx: (i % 2 ? 1 : -1) * 46,
        min: (s[0] - s[2]) * T, max: (s[0] + s[2]) * T, alive: true, dead: 0, ph: Math.random() * 6
      });
    }
    spikes = [];
    for (i = 0; i < level.spikes.length; i++) spikes.push({ x: level.spikes[i][0] * T, y: level.spikes[i][1] * T });
    flag = { x: level.flag[0] * T, y: level.flag[1] * T };
    player = { x: 40, y: 9 * T - 28, w: 20, h: 28, vx: 0, vy: 0, ground: false, coyote: 0, face: 1, step: 0 };
    safe = { x: player.x, y: player.y };
    camX = 0; particles = []; invuln = 0; jumpBuf = 0; respawnT = 0;
    renderHud();
  }

  /* ---------- estados ---------- */
  function showOverlay(title, text, btn) {
    ovTitle.textContent = title;
    ovText.innerHTML = text;
    ovBtn.textContent = btn;
    overlay.hidden = false;
    ovBtn.focus({ preventScroll: true });
  }
  function startRun() {
    ensureAudio();
    if (audio && audio.state === "suspended") { try { audio.resume(); } catch (e) {} }
    score = 0; lives = MAX_LIVES; kills = 0; newBest = false;
    loadLevel(0);
    renderLives(); renderHud();
    state = "running";
    overlay.hidden = true;
    btnPause.textContent = "Pausar";
    beep(520, 0.1, "square", 0.04); beep(780, 0.16, "square", 0.04);
  }
  function nextLevel() {
    loadLevel(li + 1);
    state = "running";
    overlay.hidden = true;
  }
  function saveBest() {
    if (score > best) {
      best = score; newBest = true;
      try { localStorage.setItem("salto-cerrado-best", String(best)); } catch (e) {}
    }
  }
  function levelClear() {
    score += 200 + lives * 100;
    beep(660, 0.12, "square", 0.05); beep(880, 0.12, "square", 0.05); beep(1320, 0.25, "square", 0.05);
    renderHud();
    if (li + 1 < LEVELS.length) {
      state = "clear";
      showOverlay("Fase cumprida", "Você juntou <strong>" + coinsGot + "</strong> de " + coinsTotal + " moedas. Próxima: <strong>" + LEVELS[li + 1].name + "</strong>.", "Próxima fase");
    } else {
      state = "over";
      saveBest();
      var t = "Você atravessou o Cerrado com <strong>" + score + "</strong> pontos.";
      if (newBest) t += " Novo recorde!";
      showOverlay("Cerrado concluído", t, "Jogar de novo");
      renderHud();
    }
  }
  function gameOver() {
    state = "over";
    saveBest();
    beep(200, 0.5, "sawtooth", 0.06, 60);
    var t = "Acabaram as vidas na fase <strong>" + (li + 1) + "</strong>, com <strong>" + score + "</strong> pontos.";
    if (newBest) t += " Novo recorde!";
    showOverlay("Fim de jogo", t, "Tentar de novo");
    renderHud();
  }
  function pauseToggle() {
    if (state === "running") {
      state = "paused"; btnPause.textContent = "Continuar";
      showOverlay("Pausa", "Respire fundo. A fase espera por você.", "Continuar");
    } else if (state === "paused") {
      state = "running"; btnPause.textContent = "Pausar"; overlay.hidden = true;
    }
  }
  ovBtn.addEventListener("click", function () {
    if (state === "paused") pauseToggle();
    else if (state === "clear") nextLevel();
    else startRun();
  });
  btnPause.addEventListener("click", function () { if (state === "running" || state === "paused") pauseToggle(); });
  btnSound.addEventListener("click", function () {
    soundOn = !soundOn;
    btnSound.textContent = soundOn ? "Som: ligado" : "Som: desligado";
    if (soundOn) { ensureAudio(); beep(500, 0.08, "square", 0.04); }
  });
  document.addEventListener("visibilitychange", function () { if (document.hidden && state === "running") pauseToggle(); });

  /* ---------- controles ---------- */
  function pressJump() { jumpHeld = true; jumpBuf = 0.12; }
  function setKey(e, down) {
    var k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") { left = down; e.preventDefault(); }
    else if (k === "ArrowRight" || k === "d" || k === "D") { right = down; e.preventDefault(); }
    else if (k === " " || k === "ArrowUp" || k === "w" || k === "W") {
      if (!overlay.hidden && document.activeElement === ovBtn) return;
      e.preventDefault();
      if (down) { if (!e.repeat) pressJump(); } else jumpHeld = false;
    } else if (down && (k === "p" || k === "P" || k === "Escape")) {
      if (e.repeat) return;
      if (state === "running" || state === "paused") pauseToggle();
    }
  }
  window.addEventListener("keydown", function (e) { setKey(e, true); });
  window.addEventListener("keyup", function (e) { setKey(e, false); });

  function holdButton(btn, onDown, onUp) {
    function on(e) { e.preventDefault(); onDown(); btn.classList.add("on"); try { btn.setPointerCapture(e.pointerId); } catch (x) {} }
    function off() { onUp(); btn.classList.remove("on"); }
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointercancel", off);
    btn.addEventListener("lostpointercapture", off);
  }
  holdButton(btnL, function () { padLeft = true; }, function () { padLeft = false; });
  holdButton(btnR, function () { padRight = true; }, function () { padRight = false; });
  holdButton(btnJ, pressJump, function () { jumpHeld = false; });

  /* ---------- física ---------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function solid(tx, ty) {
    if (tx < 0 || tx >= cols) return true;
    if (ty < 0 || ty >= ROWS) return false;
    return grid[ty][tx] === 1;
  }
  function hits(x, y, w, h) {
    var x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.01) / T);
    var y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.01) / T);
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (solid(tx, ty)) return true;
    return false;
  }
  function moveX(e, dt) {
    e.x += e.vx * dt;
    if (hits(e.x, e.y, e.w, e.h)) {
      if (e.vx > 0) e.x = Math.floor((e.x + e.w - 0.01) / T) * T - e.w;
      else e.x = (Math.floor(e.x / T) + 1) * T;
      e.vx = 0;
    }
  }
  function moveY(e, dt) {
    e.ground = false;
    e.y += e.vy * dt;
    if (hits(e.x, e.y, e.w, e.h)) {
      if (e.vy > 0) { e.y = Math.floor((e.y + e.h - 0.01) / T) * T - e.h; e.ground = true; }
      else e.y = (Math.floor(e.y / T) + 1) * T;
      e.vy = 0;
    }
  }

  function burst(x, y, color, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = 30 + Math.random() * (spd || 120);
      particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.3 + Math.random() * 0.4, t: 0, color: color, s: 2 + Math.random() * 2 });
    }
  }

  function hurt(fall) {
    if (!fall && invuln > 0) return;
    lives -= 1;
    shake = reduceMotion ? 0 : 0.3;
    burst(player.x + 10, player.y + 14, "#e4572e", 14, 140);
    beep(150, 0.3, "sawtooth", 0.06, 60);
    renderLives();
    if (lives <= 0) { gameOver(); return; }
    invuln = 1.6;
    if (fall) {
      player.x = safe.x; player.y = safe.y; player.vx = 0; player.vy = 0;
    } else {
      player.vy = -320; player.vx = -player.face * 160;
    }
  }

  function update(dt) {
    elapsed += dt;
    if (shake > 0) shake = Math.max(0, shake - dt);
    var i, p;
    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
      if (p.t > p.life) particles.splice(i, 1);
    }
    if (state !== "running") return;
    if (invuln > 0) invuln = Math.max(0, invuln - dt);
    if (jumpBuf > 0) jumpBuf -= dt;

    /* jogador */
    var dir = (right || padRight ? 1 : 0) - (left || padLeft ? 1 : 0);
    var accel = player.ground ? 1400 : 900;
    if (dir) {
      player.vx += dir * accel * dt;
      player.face = dir;
    } else {
      var fr = (player.ground ? 1300 : 400) * dt;
      if (Math.abs(player.vx) <= fr) player.vx = 0; else player.vx -= Math.sign(player.vx) * fr;
    }
    player.vx = clamp(player.vx, -175, 175);

    player.coyote = player.ground ? 0.1 : Math.max(0, player.coyote - dt);
    if (jumpBuf > 0 && player.coyote > 0) {
      player.vy = -540; player.coyote = 0; jumpBuf = 0; player.ground = false;
      beep(420, 0.12, "square", 0.03, 700);
    }
    var g = 1500;
    if (player.vy < 0 && !jumpHeld) g = 3200;
    player.vy = Math.min(700, player.vy + g * dt);

    moveX(player, dt);
    moveY(player, dt);
    if (player.ground) {
      player.step += Math.abs(player.vx) * dt * 0.09;
      var fx0 = Math.floor((player.x + 1) / T), fx1 = Math.floor((player.x + player.w - 2) / T);
      var fy = Math.floor((player.y + player.h + 1) / T);
      if (solid(fx0, fy) && solid(fx1, fy)) { safe.x = player.x; safe.y = player.y; }
    }
    if (player.y > H + 60) { hurt(true); if (state !== "running") return; }

    camX += (clamp(player.x + player.w / 2 - W / 2 + player.face * 40, 0, cols * T - W) - camX) * Math.min(1, dt * 6);

    /* moedas */
    for (i = 0; i < coins.length; i++) {
      var c = coins[i];
      if (!c.got && Math.abs(c.x - (player.x + 10)) < 18 && Math.abs(c.y - (player.y + 14)) < 22) {
        c.got = true; coinsGot += 1; score += 10;
        burst(c.x, c.y, C.coin, 6, 90);
        beep(900, 0.06, "square", 0.035); beep(1300, 0.09, "square", 0.035);
      }
    }

    /* inimigos */
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) { e.dead -= dt; continue; }
      var nx = e.x + e.vx * dt, dirE = e.vx > 0 ? 1 : -1;
      var frontX = dirE > 0 ? nx + e.w : nx;
      var blocked = solid(Math.floor(frontX / T), Math.floor((e.y + e.h / 2) / T));
      var noGround = !solid(Math.floor(frontX / T), Math.floor((e.y + e.h + 2) / T));
      if (blocked || noGround || nx < e.min || nx > e.max) e.vx = -e.vx; else e.x = nx;

      if (player.x + player.w > e.x + 2 && player.x < e.x + e.w - 2 && player.y + player.h > e.y && player.y < e.y + e.h) {
        if (player.vy > 60 && player.y + player.h - e.y < 16) {
          e.alive = false; e.dead = 0.4; kills += 1; score += 50;
          player.vy = jumpHeld ? -470 : -330;
          burst(e.x + 13, e.y + 10, C.bugLight, 12, 120);
          beep(300, 0.12, "square", 0.05, 120);
        } else {
          hurt(false);
          if (state !== "running") return;
        }
      }
    }

    /* espinhos */
    for (i = 0; i < spikes.length; i++) {
      var s = spikes[i];
      if (invuln <= 0 && player.x + player.w > s.x + 5 && player.x < s.x + T - 5 && player.y + player.h > s.y + 14 && player.y < s.y + T) {
        hurt(false);
        if (state !== "running") return;
      }
    }

    /* bandeira */
    if (player.x + player.w > flag.x + 6 && player.x < flag.x + 22 && player.y + player.h > flag.y - 90 && player.y < flag.y) levelClear();
  }

  /* ---------- desenho ---------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.skyTop); g.addColorStop(1, C.skyBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.sun;
    ctx.beginPath(); ctx.arc(520, 70, 34, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (var i = 0; i < 6; i++) {
      var cx = ((i * 210 - camX * 0.15) % (W + 200) + (W + 200)) % (W + 200) - 100;
      var cy = 40 + (i * 37) % 70;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 34, 11, 0, 0, 7); ctx.ellipse(cx + 20, cy - 7, 22, 10, 0, 0, 7); ctx.ellipse(cx - 18, cy - 4, 20, 9, 0, 0, 7);
      ctx.fill();
    }
    function hills(par, base, amp, freq, color) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (var x = 0; x <= W; x += 8) {
        var wx = x + camX * par;
        ctx.lineTo(x, base - Math.sin(wx * freq) * amp - Math.sin(wx * freq * 2.3 + 1) * amp * 0.4);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    hills(0.3, 250, 30, 0.006, C.hillFar);
    hills(0.55, 285, 22, 0.011, C.hillNear);
  }

  function drawTiles() {
    var c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(cols - 1, Math.floor((camX + W) / T));
    for (var r = 0; r < ROWS; r++) {
      for (var c = c0; c <= c1; c++) {
        if (grid[r][c] !== 1) continue;
        var x = c * T, y = r * T;
        var top = !(r > 0 && grid[r - 1][c] === 1);
        ctx.fillStyle = C.earth; ctx.fillRect(x, y, T, T);
        var h = (c * 73 + r * 131) % 7;
        ctx.fillStyle = C.earthDark; ctx.fillRect(x + 4 + h * 2, y + 10 + (h % 3) * 5, 5, 3);
        ctx.fillStyle = C.earthLight; ctx.fillRect(x + 18 - h, y + 5 + (h % 4) * 5, 4, 3);
        if (top) {
          ctx.fillStyle = C.grass; ctx.fillRect(x, y, T, 8);
          ctx.fillStyle = C.grassDark; ctx.fillRect(x, y + 7, T, 2);
          ctx.fillStyle = C.grass;
          for (var k = 0; k < 4; k++) ctx.fillRect(x + 3 + k * 8, y + 8, 3, 4 + ((c + k) % 3));
        }
      }
    }
  }

  function drawSpike(s) {
    ctx.fillStyle = C.spike;
    for (var i = 0; i < 3; i++) {
      var bx = s.x + i * 10;
      ctx.beginPath(); ctx.moveTo(bx, s.y + T); ctx.lineTo(bx + 5, s.y + 12); ctx.lineTo(bx + 10, s.y + T); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
    for (var j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(s.x + j * 10 + 5, s.y + 12); ctx.lineTo(s.x + j * 10 + 10, s.y + T); ctx.stroke(); }
  }

  function drawCoin(c) {
    var sw = Math.abs(Math.cos(elapsed * 3.5 + c.ph));
    var bob = Math.sin(elapsed * 3 + c.ph) * 2;
    ctx.fillStyle = C.coin;
    ctx.beginPath(); ctx.ellipse(c.x, c.y + bob, 8 * (0.3 + 0.7 * sw), 9, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = C.coinDark; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawEnemy(e) {
    var sq = e.alive ? 1 : Math.max(0.1, e.dead / 0.4);
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h);
    ctx.scale(1, sq);
    var wob = Math.sin(elapsed * 14 + e.ph) * 1.5;
    ctx.strokeStyle = "#2b2a24"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-11, 0 + wob); ctx.moveTo(0, -3); ctx.lineTo(0, 0 - wob); ctx.moveTo(8, -3); ctx.lineTo(11, 0 + wob); ctx.stroke();
    ctx.fillStyle = C.bug;
    ctx.beginPath(); ctx.ellipse(0, -11, 13, 11, 0, Math.PI, 0); ctx.lineTo(13, -3); ctx.lineTo(-13, -3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.bugLight;
    ctx.beginPath(); ctx.ellipse(-3, -14, 7, 5, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -3); ctx.stroke();
    var d = e.vx >= 0 ? 1 : -1;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(d * 8, -10, 3, 0, 7); ctx.fill();
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(d * 9, -10, 1.5, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawFlag() {
    var x = flag.x + 12, y = flag.y;
    ctx.fillStyle = "#6b4a2b"; ctx.fillRect(x, y - 90, 4, 90);
    ctx.fillStyle = C.coin; ctx.beginPath(); ctx.arc(x + 2, y - 92, 5, 0, 7); ctx.fill();
    var wave = Math.sin(elapsed * 4) * 3;
    ctx.fillStyle = C.flag;
    ctx.beginPath(); ctx.moveTo(x + 4, y - 86); ctx.lineTo(x + 34, y - 74 + wave); ctx.lineTo(x + 4, y - 60); ctx.closePath(); ctx.fill();
  }

  function drawPlayer() {
    var p = player;
    if (invuln > 0 && Math.floor(invuln * 12) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h);
    ctx.scale(p.face, 1);
    var air = !p.ground;
    var leg = air ? 3 : Math.sin(p.step * 3) * 3;
    ctx.fillStyle = C.bodyDark;
    rr(-8 + leg, -7, 6, 7, 2); ctx.fill();
    rr(3 - leg, -7, 6, 7, 2); ctx.fill();
    ctx.fillStyle = C.shell;
    ctx.beginPath(); ctx.ellipse(-3, -15, 12, 12, 0, Math.PI * 0.9, Math.PI * 2.1); ctx.lineTo(9, -6); ctx.lineTo(-14, -6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 1.5;
    for (var i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-3 + i * 6, -26); ctx.lineTo(-3 + i * 7, -7); ctx.stroke(); }
    ctx.fillStyle = C.body;
    ctx.beginPath(); ctx.ellipse(8, -13, 8, 7, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(12, -17); ctx.lineTo(19, -12); ctx.lineTo(12, -9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(9, -16, 3, 0, 7); ctx.fill();
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(10, -16, 1.6, 0, 7); ctx.fill();
    ctx.fillStyle = C.body; ctx.beginPath(); ctx.ellipse(4, -24, 2.5, 4, -0.3, 0, 7); ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (!level) { drawSky(); return; }
    var sx = 0, sy = 0;
    if (shake > 0) { var m = 6 * (shake / 0.3); sx = (Math.random() - 0.5) * m; sy = (Math.random() - 0.5) * m; }
    ctx.save();
    ctx.translate(sx, sy);
    drawSky();
    ctx.save();
    ctx.translate(-Math.round(camX), 0);
    drawFlag();
    drawTiles();
    var i;
    for (i = 0; i < spikes.length; i++) drawSpike(spikes[i]);
    for (i = 0; i < coins.length; i++) if (!coins[i].got) drawCoin(coins[i]);
    for (i = 0; i < enemies.length; i++) if (enemies[i].alive || enemies[i].dead > 0) drawEnemy(enemies[i]);
    if (state !== "over" || lives > 0) drawPlayer();
    for (i = 0; i < particles.length; i++) {
      var pt = particles[i];
      ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.s / 2, pt.y - pt.s / 2, pt.s, pt.s);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.restore();
    if (state === "running" && elapsed < 3 && li === 0 && score === 0) {
      ctx.fillStyle = "rgba(34,40,30,0.7)"; rr(W / 2 - 150, 16, 300, 30, 6); ctx.fill();
      ctx.fillStyle = "#fff7e0"; ctx.font = "500 15px " + FONT; ctx.textAlign = "center";
      ctx.fillText("Pule nos besouros e chegue à bandeira", W / 2, 37);
    }
  }

  function frame(t) {
    var dt = Math.min(0.033, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (state !== "paused") update(dt);
    draw();
    renderHud();
    requestAnimationFrame(frame);
  }

  /* demonstração ao fundo antes de começar */
  loadLevel(0);
  elapsed = 0;
  fit();
  renderLives();
  renderHud();
  requestAnimationFrame(function (t) { lastT = t; requestAnimationFrame(frame); });
})();
