/* =========================================================
 * DarkWebDark 2 共通エンジン
 * 前作 DarkWebDark の dwd.js を土台に拡張したもの
 * - セーブ（localStorage）／前作セーブの読み取り
 * - 効果音（WebAudio で全て合成。外部音源ファイルなし）
 * - 驚かし（ジャンプスケア）演出：顔・目・文字・黒猫・手・長い髪の女・はいよる
 * - グリッチ / 文字化け / 砂嵐 / 画面遷移
 * - 設定（点滅・揺れを弱める／音量）
 * - RTAタイマー
 * ========================================================= */
(function () {
  'use strict';

  // ---- バージョン情報（更新したら必ずここと README の更新履歴を更新する） ----
  var VERSION = '1.0.0';
  var UPDATED = '2026-11-02';

  var DWD = (window.DWD = { VERSION: VERSION, UPDATED: UPDATED });

  /* ---------------------------------------------------------
   * セーブデータ
   * ------------------------------------------------------- */
  var KEY = 'dwd2_save_v1';
  var PREV_KEY = 'dwd_save_v1'; // 前作のセーブ（同じサイトで遊んでいれば残っている）
  var memory = {}; // localStorage が使えない環境用の保険

  DWD.load = function () {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) || {} : memory;
    } catch (e) {
      return memory;
    }
  };
  DWD.save = function (s) {
    memory = s;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {}
  };
  DWD.get = function (k) {
    return DWD.load()[k];
  };
  DWD.set = function (k, v) {
    var s = DWD.load();
    s[k] = v;
    DWD.save(s);
  };
  DWD.inc = function (k) {
    var v = (DWD.get(k) || 0) + 1;
    DWD.set(k, v);
    return v;
  };
  // 進行状況を消す。周回の記録・RTA・名前・設定は残す（all=true なら全部消す）
  var KEEP = ['rtaUnlocked', 'rtaBest', 'rtaPending', 'name', 'pid', 'calm', 'vol', 'clears', 'endings'];
  DWD.reset = function (all) {
    var old = DWD.load();
    var next = {};
    if (!all) {
      KEEP.forEach(function (k) {
        if (old[k] !== undefined) next[k] = old[k];
      });
    }
    memory = next;
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
    DWD.save(next);
  };
  // 到達した層を記録
  DWD.reach = function (n) {
    DWD.set('layer', Math.max(DWD.get('layer') || 0, n));
  };

  // 前作のセーブ（読み取りのみ。書き換えない）
  DWD.prev = function () {
    try {
      var raw = localStorage.getItem(PREV_KEY);
      var p = raw ? JSON.parse(raw) : null;
      return p && typeof p === 'object' ? p : null;
    } catch (e) {
      return null;
    }
  };
  // 前作でつかった名前（なければ空文字）
  DWD.prevName = function () {
    var p = DWD.prev();
    if (!p || typeof p.name !== 'string') return '';
    return p.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
  };
  // 前作をクリアしているか
  DWD.prevCleared = function () {
    var p = DWD.prev();
    return !!(p && (p.cleared || p.escaped));
  };
  // 呼びかけに使う名前
  DWD.who = function () {
    return DWD.get('name') || DWD.prevName() || 'あなた';
  };

  /* ---------------------------------------------------------
   * 入力のゆらぎを吸収（ひらがな化・空白除去）
   * ------------------------------------------------------- */
  DWD.norm = function (s) {
    s = String(s || '');
    try {
      s = s.normalize('NFKC');
    } catch (e) {}
    return s
      .toLowerCase()
      .replace(/[\s　・、。,.!?！？「」『』"'`~ー－-]/g, '')
      .replace(/[ァ-ヶ]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0x60);
      });
  };
  // 文字列を安全にHTMLへ
  DWD.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------------------------------------------------------
   * 設定（点滅・揺れを弱める／音量）
   * ------------------------------------------------------- */
  DWD.calm = function () {
    return !!DWD.get('calm');
  };
  function applyCalm() {
    document.documentElement.classList.toggle('dwd-calm', DWD.calm());
  }
  DWD.setCalm = function (on) {
    DWD.set('calm', !!on);
    applyCalm();
  };
  applyCalm();

  /* ---------------------------------------------------------
   * RTAモード（1回クリアで解放）
   * rta = { start: ミリ秒, end: ミリ秒 | undefined }
   * ------------------------------------------------------- */
  DWD.fmt = function (ms) {
    ms = Math.max(0, Math.floor(ms));
    var m = Math.floor(ms / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    var cs = Math.floor((ms % 1000) / 10);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (cs < 10 ? '0' : '') + cs;
  };
  DWD.rtaRunning = function () {
    var r = DWD.get('rta');
    return !!(r && r.start && !r.end);
  };
  DWD.rtaStart = function () {
    DWD.reset();
    DWD.set('rta', { start: Date.now() });
  };
  // 計測終了。タイム（ミリ秒）を返す
  DWD.rtaStop = function () {
    var r = DWD.get('rta');
    if (!r || !r.start || r.end) return null;
    r.end = Date.now();
    DWD.set('rta', r);
    var ms = r.end - r.start;
    var best = DWD.get('rtaBest');
    if (!best || ms < best) DWD.set('rtaBest', ms);
    DWD.set('rtaPending', ms);
    return ms;
  };
  DWD.rtaAbort = function () {
    DWD.set('rta', null);
  };
  // RTA中は演出を少し早くする係数
  DWD.speed = function () {
    return DWD.rtaRunning() ? 0.45 : 1;
  };

  // 画面右上のタイマー表示
  function rtaHud() {
    if (!DWD.rtaRunning()) return;
    var hud = document.createElement('div');
    hud.className = 'dwd-rta';
    hud.innerHTML = '<span class="t-label">RTA</span><span class="t-time">00:00.00</span><button type="button" class="t-quit">中断</button>';
    document.body.appendChild(hud);
    var t = hud.querySelector('.t-time');
    var quit = hud.querySelector('.t-quit');
    var armed = false;
    quit.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!armed) {
        armed = true;
        quit.textContent = 'もう一度押すと中断';
        setTimeout(function () {
          armed = false;
          quit.textContent = '中断';
        }, 3000);
        return;
      }
      DWD.rtaAbort();
      location.href = DWD.root() + 'index.html';
    });
    (function loop() {
      var r = DWD.get('rta');
      if (!r || !r.start) {
        hud.remove();
        return;
      }
      t.textContent = DWD.fmt((r.end || Date.now()) - r.start);
      if (r.end) hud.classList.add('done');
      requestAnimationFrame(loop);
    })();
  }

  // サイトのいちばん上（index.html のある場所）への相対パス
  DWD.root = function () {
    var s = document.querySelector('script[src$="assets/dwd.js"]');
    return s ? s.getAttribute('src').replace(/assets\/dwd\.js$/, '') : '';
  };

  /* ---------------------------------------------------------
   * ちょっとした道具
   * ------------------------------------------------------- */
  DWD.wait = function (ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  };
  DWD.rand = function (a, b) {
    return a + Math.random() * (b - a);
  };
  DWD.pick = function (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  };
  DWD.$ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  DWD.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  // 見ている端末をそれっぽく判定（不気味演出用。外部送信は一切しない）
  DWD.device = function () {
    var ua = navigator.userAgent || '';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) return 'iPad';
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Androidのスマホ' : 'Androidのタブレット';
    if (/Windows/.test(ua)) return 'Windowsのパソコン';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Linux/.test(ua)) return 'パソコン';
    return 'その画面';
  };
  DWD.timeStr = function () {
    var d = new Date();
    return d.getHours() + '時' + ('0' + d.getMinutes()).slice(-2) + '分';
  };
  DWD.clock = function (d, sec) {
    d = d || new Date();
    var p = function (n) {
      return ('0' + n).slice(-2);
    };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + (sec ? ':' + p(d.getSeconds()) : '');
  };
  DWD.today = function () {
    var d = new Date();
    return d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2);
  };
  DWD.isTouch = function () {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  };

  /* ---------------------------------------------------------
   * 効果音（すべて WebAudio で合成）
   * ------------------------------------------------------- */
  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var VOLS = { 0: 0, 1: 0.35, 2: 0.6, 3: 0.85 };

  DWD.audio = function () {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
      master = ctx.createGain();
      master.gain.value = DWD.volume();
      // 音割れ防止のコンプレッサー
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.ratio.value = 6;
      master.connect(comp);
      comp.connect(ctx.destination);
      // ノイズ用バッファ（2秒）
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  DWD.master = function () {
    DWD.audio();
    return master;
  };
  DWD.volume = function () {
    var v = DWD.get('vol');
    if (v === undefined || v === null) v = 3;
    return VOLS[v] !== undefined ? VOLS[v] : 0.85;
  };
  DWD.setVolume = function (level) {
    DWD.set('vol', level);
    if (master) master.gain.value = DWD.volume();
  };
  // 最初の操作で音を有効化（スマホ対策）
  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(function (ev) {
    window.addEventListener(
      ev,
      function () {
        DWD.audio();
      },
      { passive: true }
    );
  });

  function now() {
    return ctx.currentTime;
  }
  function noiseSrc(loop) {
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = !!loop;
    return s;
  }
  function env(gainNode, t, a, peak, hold, rel) {
    var g = gainNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + a);
    g.setValueAtTime(peak, t + a + hold);
    g.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  function distCurve(amount) {
    var n = 2048,
      c = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / n - 1;
      c[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return c;
  }

  var SFX = (DWD.sfx = {});

  // 絶叫（ジャンプスケア用）
  SFX.scream = function (dur, pitch) {
    if (!DWD.audio()) return;
    dur = dur || 1.3;
    pitch = pitch || 1;
    var t = now();
    var out = ctx.createGain();
    var shaper = ctx.createWaveShaper();
    shaper.curve = distCurve(60);
    out.connect(shaper);
    shaper.connect(master);
    env(out, t, 0.01, 0.9, dur * 0.6, dur * 0.4);

    [520, 780, 1130, 1390].forEach(function (f, i) {
      f *= pitch;
      var o = ctx.createOscillator();
      o.type = i % 2 ? 'sawtooth' : 'square';
      o.frequency.setValueAtTime(f * 0.6, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(f * 0.7, t + dur);
      // 震え
      var lfo = ctx.createOscillator();
      var lg = ctx.createGain();
      lfo.frequency.value = 9 + i * 3;
      lg.gain.value = f * 0.08;
      lfo.connect(lg);
      lg.connect(o.frequency);
      var g = ctx.createGain();
      g.gain.value = 0.22;
      o.connect(g);
      g.connect(out);
      o.start(t);
      lfo.start(t);
      o.stop(t + dur + 0.1);
      lfo.stop(t + dur + 0.1);
    });
    // 息のノイズ
    var n = noiseSrc(true);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    var ng = ctx.createGain();
    ng.gain.value = 0.7;
    n.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    n.start(t);
    n.stop(t + dur + 0.1);
    SFX.boom(0.9);
  };

  // ドンッという低音
  SFX.boom = function (vol) {
    if (!DWD.audio()) return;
    var t = now();
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.8);
    var g = ctx.createGain();
    env(g, t, 0.005, vol || 0.9, 0.05, 0.9);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 1.2);
  };

  // 不協和音のスティンガー（ジャーン）
  SFX.stinger = function () {
    if (!DWD.audio()) return;
    var t = now();
    var g = ctx.createGain();
    env(g, t, 0.01, 0.35, 0.3, 1.6);
    g.connect(master);
    [233, 247, 349, 370, 494, 523].forEach(function (f) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = DWD.rand(-25, 25);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(5000, t);
      lp.frequency.exponentialRampToValueAtTime(400, t + 2);
      o.connect(lp);
      lp.connect(g);
      o.start(t);
      o.stop(t + 2.2);
    });
    SFX.boom(0.7);
  };

  // 砂嵐
  SFX.static = function (dur, vol) {
    if (!DWD.audio()) return;
    var t = now();
    dur = dur || 0.4;
    var n = noiseSrc(true);
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    var g = ctx.createGain();
    env(g, t, 0.005, vol || 0.35, dur, 0.05);
    n.connect(hp);
    hp.connect(g);
    g.connect(master);
    n.start(t);
    n.stop(t + dur + 0.1);
  };

  // ピッ / ブツッ（グリッチ音）
  SFX.blip = function () {
    if (!DWD.audio()) return;
    var t = now();
    var o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(DWD.rand(80, 1800), t);
    o.frequency.setValueAtTime(DWD.rand(80, 1800), t + 0.03);
    var g = ctx.createGain();
    env(g, t, 0.002, 0.12, 0.04, 0.02);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.1);
  };

  // コン、コン、コン（ノック）
  SFX.knock = function (times, gap, vol) {
    if (!DWD.audio()) return;
    times = times || 3;
    gap = gap || 0.32;
    vol = vol || 0.8;
    for (var i = 0; i < times; i++) {
      var t = now() + i * gap;
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
      var g = ctx.createGain();
      env(g, t, 0.002, vol, 0.01, 0.12);
      var n = noiseSrc(false);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      var ng = ctx.createGain();
      env(ng, t, 0.001, vol / 2, 0.005, 0.05);
      n.connect(lp);
      lp.connect(ng);
      ng.connect(master);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.2);
      n.start(t);
      n.stop(t + 0.1);
    }
  };

  // ドクン…（心音）
  SFX.heartbeat = function (count, interval) {
    if (!DWD.audio()) return;
    count = count || 1;
    interval = interval || 0.9;
    for (var i = 0; i < count; i++) {
      [0, 0.22].forEach(function (off, j) {
        var t = now() + i * interval + off;
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(70 - j * 15, t);
        o.frequency.exponentialRampToValueAtTime(35, t + 0.15);
        var g = ctx.createGain();
        env(g, t, 0.01, j ? 0.5 : 0.8, 0.02, 0.2);
        o.connect(g);
        g.connect(master);
        o.start(t);
        o.stop(t + 0.35);
      });
    }
  };

  // ささやき（フィルタしたノイズを揺らす）
  SFX.whisper = function (dur) {
    if (!DWD.audio()) return;
    dur = dur || 1.6;
    var t = now();
    var n = noiseSrc(true);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(1800, t);
    for (var i = 0; i < 10; i++) {
      bp.frequency.linearRampToValueAtTime(DWD.rand(900, 3800), t + (dur * (i + 1)) / 10);
    }
    var g = ctx.createGain();
    var am = ctx.createOscillator();
    var amg = ctx.createGain();
    am.frequency.value = 7;
    amg.gain.value = 0.25;
    am.connect(amg);
    amg.connect(g.gain);
    env(g, t, 0.3, 0.35, Math.max(0.1, dur - 0.6), 0.3);
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    n.connect(bp);
    bp.connect(g);
    if (pan) {
      pan.pan.setValueAtTime(-1, t);
      pan.pan.linearRampToValueAtTime(1, t + dur);
      g.connect(pan);
      pan.connect(master);
    } else g.connect(master);
    n.start(t);
    am.start(t);
    n.stop(t + dur + 0.1);
    am.stop(t + dur + 0.1);
  };

  // ガリガリ（ひっかき音）
  SFX.scratch = function (dur) {
    if (!DWD.audio()) return;
    dur = dur || 1;
    var t = now();
    var n = noiseSrc(true);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.value = 3000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (var i = 0; i < dur * 12; i++) {
      g.gain.setValueAtTime(DWD.rand(0.05, 0.5), t + i / 12);
      g.gain.setValueAtTime(0.0, t + i / 12 + 0.04);
    }
    n.connect(bp);
    bp.connect(g);
    g.connect(master);
    n.start(t);
    n.stop(t + dur);
  };

  // はぁ…（息づかい）
  SFX.breath = function () {
    if (!DWD.audio()) return;
    var t = now();
    var n = noiseSrc(true);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 1.2;
    var g = ctx.createGain();
    env(g, t, 0.5, 0.5, 0.2, 0.9);
    n.connect(bp);
    bp.connect(g);
    g.connect(master);
    n.start(t);
    n.stop(t + 1.8);
  };

  // かわいい通知音
  SFX.chime = function () {
    if (!DWD.audio()) return;
    [880, 1318].forEach(function (f, i) {
      var t = now() + i * 0.12;
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      var g = ctx.createGain();
      env(g, t, 0.01, 0.15, 0.05, 0.5);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.7);
    });
  };

  // ピコン（メッセージ受信）。low=true で1音低く沈んだ音
  SFX.ping = function (low) {
    if (!DWD.audio()) return;
    var fs = low ? [392, 370] : [1046, 1568];
    fs.forEach(function (f, i) {
      var t = now() + i * 0.09;
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      var g = ctx.createGain();
      env(g, t, 0.005, 0.18, 0.03, low ? 0.9 : 0.3);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 1.1);
    });
  };

  // ブーッ（スマホのバイブ）
  SFX.buzz = function (times) {
    if (!DWD.audio()) return;
    times = times || 2;
    for (var i = 0; i < times; i++) {
      var t = now() + i * 0.55;
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 58;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300;
      var g = ctx.createGain();
      env(g, t, 0.01, 0.3, 0.32, 0.04);
      o.connect(lp);
      lp.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.45);
    }
  };

  // ニャア（猫）。evil=true で低くゆがんだ鳴き声。pan: -1〜1
  SFX.meow = function (evil, pan) {
    if (!DWD.audio()) return;
    var t = now();
    var dur = evil ? 1.1 : 0.7;
    var o = ctx.createOscillator();
    o.type = 'sawtooth';
    var base = evil ? 240 : 520;
    o.frequency.setValueAtTime(base * 0.8, t);
    o.frequency.linearRampToValueAtTime(base * 1.35, t + dur * 0.35);
    o.frequency.linearRampToValueAtTime(base * (evil ? 0.5 : 0.85), t + dur);
    var f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 5;
    f1.frequency.setValueAtTime(700, t);
    f1.frequency.linearRampToValueAtTime(1500, t + dur * 0.4);
    f1.frequency.linearRampToValueAtTime(900, t + dur);
    var g = ctx.createGain();
    env(g, t, 0.06, evil ? 0.7 : 0.45, dur * 0.5, dur * 0.4);
    o.connect(f1);
    f1.connect(g);
    var out = g;
    if (evil) {
      var sh = ctx.createWaveShaper();
      sh.curve = distCurve(30);
      g.connect(sh);
      out = sh;
    }
    if (ctx.createStereoPanner && pan) {
      var p = ctx.createStereoPanner();
      p.pan.value = pan;
      out.connect(p);
      p.connect(master);
    } else out.connect(master);
    o.start(t);
    o.stop(t + dur + 0.1);
  };

  // ギィ…（扉のきしみ）
  SFX.creak = function (dur) {
    if (!DWD.audio()) return;
    dur = dur || 1.4;
    var t = now();
    var o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, t);
    for (var i = 0; i < 14; i++) o.frequency.linearRampToValueAtTime(DWD.rand(60, 160), t + (dur * (i + 1)) / 14);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 9;
    var g = ctx.createGain();
    env(g, t, 0.08, 0.5, dur * 0.7, dur * 0.25);
    o.connect(bp);
    bp.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.1);
  };

  // ゴォォ…（線路沿いを電車が通る）
  SFX.train = function (dur) {
    if (!DWD.audio()) return;
    dur = dur || 5;
    var t = now();
    var n = noiseSrc(true);
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(lp);
    lp.connect(g);
    g.connect(master);
    n.start(t);
    n.stop(t + dur + 0.1);
    // ガタンゴトン
    for (var i = 0; i < dur * 2.2; i++) {
      var tt = t + 0.6 + i * 0.42 + (i % 2) * 0.1;
      if (tt > t + dur - 0.4) break;
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(110, tt);
      o.frequency.exponentialRampToValueAtTime(50, tt + 0.08);
      var og = ctx.createGain();
      var peak = 0.35 * Math.sin((Math.PI * (tt - t)) / dur) + 0.02;
      env(og, tt, 0.003, peak, 0.01, 0.1);
      o.connect(og);
      og.connect(master);
      o.start(tt);
      o.stop(tt + 0.2);
    }
  };

  // カチカチ（キーボード／勝手に入力される音）
  SFX.type = function () {
    if (!DWD.audio()) return;
    var t = now();
    var n = noiseSrc(false);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = DWD.rand(2500, 4200);
    bp.Q.value = 4;
    var g = ctx.createGain();
    env(g, t, 0.001, 0.25, 0.005, 0.03);
    n.connect(bp);
    bp.connect(g);
    g.connect(master);
    n.start(t);
    n.stop(t + 0.06);
  };

  // チッ（時計の秒針）
  SFX.tick = function (hi) {
    if (!DWD.audio()) return;
    var t = now();
    var o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = hi ? 2400 : 1800;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    var g = ctx.createGain();
    env(g, t, 0.001, 0.1, 0.004, 0.02);
    o.connect(hp);
    hp.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.05);
  };

  // 低いうなり（ループ）。戻り値の stop() で止める
  DWD.drone = function (level) {
    if (!DWD.audio()) return { stop: function () {}, set: function () {} };
    var t = now();
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level || 0.18, t + 3);
    g.connect(master);
    var nodes = [];
    [41.2, 43.1, 82.4, 87.3].forEach(function (f, i) {
      var o = ctx.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'sine';
      o.frequency.value = f;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      var og = ctx.createGain();
      og.gain.value = i < 2 ? 0.5 : 0.25;
      o.connect(lp);
      lp.connect(og);
      og.connect(g);
      o.start(t);
      nodes.push(o);
    });
    var n = noiseSrc(true);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 300;
    bp.Q.value = 0.5;
    var ng = ctx.createGain();
    ng.gain.value = 0.25;
    var lfo = ctx.createOscillator();
    var lg = ctx.createGain();
    lfo.frequency.value = 0.13;
    lg.gain.value = 0.2;
    lfo.connect(lg);
    lg.connect(ng.gain);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(g);
    n.start(t);
    lfo.start(t);
    nodes.push(n, lfo);
    var stopped = false;
    return {
      set: function (v) {
        if (stopped) return;
        g.gain.linearRampToValueAtTime(Math.max(0.0001, v), now() + 0.5);
      },
      stop: function () {
        if (stopped) return;
        stopped = true;
        var tt = now();
        g.gain.cancelScheduledValues(tt);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), tt);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 1);
        nodes.forEach(function (o) {
          try {
            o.stop(tt + 1.1);
          } catch (e) {}
        });
      }
    };
  };

  // 静かな部屋の環境音（冷蔵庫のうなり＋かすかな時計）。ひびログ用
  DWD.roomTone = function (level) {
    if (!DWD.audio()) return { stop: function () {} };
    var t = now();
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level || 0.08, t + 2);
    g.connect(master);
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 50;
    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 100.6;
    var og = ctx.createGain();
    og.gain.value = 0.4;
    o.connect(g);
    o2.connect(og);
    og.connect(g);
    o.start(t);
    o2.start(t);
    var n = noiseSrc(true);
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    var ng = ctx.createGain();
    ng.gain.value = 0.3;
    n.connect(lp);
    lp.connect(ng);
    ng.connect(g);
    n.start(t);
    return {
      stop: function () {
        var tt = now();
        g.gain.cancelScheduledValues(tt);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), tt);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.8);
        [o, o2, n].forEach(function (x) {
          try {
            x.stop(tt + 0.9);
          } catch (e) {}
        });
      }
    };
  };

  DWD.vibrate = function (pattern) {
    if (DWD.calm()) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  };

  /* ---------------------------------------------------------
   * 共通CSS（驚かし演出・設定ボタン）を注入
   * ------------------------------------------------------- */
  var css =
    '.dwd-scare{position:fixed;inset:0;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:none;touch-action:none}' +
    '.dwd-scare canvas{width:100vw;height:100vh;display:block;animation:dwdZoom .09s ease-out forwards, dwdShake .07s linear infinite .09s}' +
    '.dwd-scare.text{flex-direction:column;background:#0a0000}' +
    '.dwd-scare.text b{font:900 min(26vw,30vh)/1 "Hiragino Mincho ProN","Yu Mincho",serif;color:#f10;text-shadow:0 0 30px #f00,6px 0 #0ff,-6px 0 #f0f;animation:dwdZoom .08s ease-out forwards, dwdShake .06s linear infinite;text-align:center;padding:0 4vw;word-break:keep-all;overflow-wrap:anywhere}' +
    '.dwd-scare.text b.long{font-size:min(14vw,18vh)}' +
    '.dwd-scare.crawl canvas{animation:none}' +
    '.dwd-scare .flash{position:absolute;inset:0;background:#fff;animation:dwdFlash .25s steps(2) forwards;pointer-events:none}' +
    '@keyframes dwdZoom{from{transform:scale(.35);filter:contrast(3) brightness(2)}to{transform:scale(1.12);filter:contrast(1.3)}}' +
    '@keyframes dwdShake{0%{translate:0 0}25%{translate:-14px 9px}50%{translate:12px -11px}75%{translate:-8px -6px}100%{translate:9px 12px}}' +
    '@keyframes dwdFlash{0%{opacity:1}50%{opacity:0}75%{opacity:.8}100%{opacity:0}}' +
    '.dwd-sub{position:fixed;inset:0;z-index:99998;pointer-events:none}' +
    '.dwd-sub canvas{width:100%;height:100%;display:block}' +
    '.dwd-glitch{animation:dwdGlitch .25s steps(3) infinite}' +
    '@keyframes dwdGlitch{0%{transform:translate(0);filter:none}33%{transform:translate(-4px,2px) skewX(8deg);filter:hue-rotate(90deg) saturate(4)}66%{transform:translate(5px,-3px) skewX(-6deg);filter:invert(1)}100%{transform:translate(0)}}' +
    '.dwd-shake{animation:dwdShake .08s linear infinite}' +
    '.dwd-tv{position:fixed;inset:0;z-index:99990;background:#000;display:flex;align-items:center;justify-content:center}' +
    '.dwd-tv canvas{width:100%;height:100%;image-rendering:pixelated;display:block}' +
    '.dwd-gate{position:fixed;inset:0;z-index:99995;background:#000;color:#bbb;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:24px;font-family:"Courier New",monospace;overflow-y:auto}' +
    '.dwd-gate .g-title{font-size:clamp(14px,4vw,18px);letter-spacing:.3em;color:#888;line-height:1.8}' +
    '.dwd-gate button.g-go{background:none;border:1px solid #a00;color:#e22;padding:16px 38px;font:inherit;font-size:18px;letter-spacing:.4em;cursor:pointer;min-width:200px;animation:dwdPulse 2s ease-in-out infinite}' +
    '.dwd-gate .g-warn{font-size:12px;color:#666;line-height:1.9;max-width:420px}' +
    '.dwd-gate .g-opt{display:flex;flex-direction:column;gap:10px;align-items:center;font-size:13px;color:#888}' +
    '.dwd-gate label{display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 10px}' +
    '.dwd-gate input[type=checkbox]{width:20px;height:20px;accent-color:#a00}' +
    '@keyframes dwdPulse{0%,100%{box-shadow:0 0 0 #f000}50%{box-shadow:0 0 24px #f004}}' +
    '.dwd-ver{font:11px/1.6 "Courier New",monospace;opacity:.55;text-align:center;padding:14px 8px 56px}' +
    '.dwd-rta{position:fixed;z-index:99980;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.82);color:#ffd36a;border:1px solid #7a5a10;border-radius:6px;padding:4px 6px 4px 10px;font:600 15px/1.4 "Courier New",monospace;font-variant-numeric:tabular-nums;letter-spacing:.04em}' +
    '.dwd-rta .t-label{font-size:10px;color:#c9a040;letter-spacing:.2em}' +
    '.dwd-rta .t-quit{font:inherit;font-size:11px;background:none;border:1px solid #5a4410;color:#c9a040;border-radius:4px;padding:2px 6px;cursor:pointer}' +
    '.dwd-rta.done{color:#7dff9a;border-color:#2a7a3a}' +
    '.dwd-cfg{position:fixed;z-index:99970;left:calc(8px + env(safe-area-inset-left,0px));bottom:calc(8px + env(safe-area-inset-bottom,0px));width:36px;height:36px;border-radius:50%;border:1px solid #444;background:rgba(10,10,10,.75);color:#999;font:16px/1 sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}' +
    '.dwd-cfgp{position:fixed;z-index:99971;left:calc(8px + env(safe-area-inset-left,0px));bottom:calc(52px + env(safe-area-inset-bottom,0px));width:min(280px,calc(100vw - 16px));background:#0c0c0c;border:1px solid #333;border-radius:8px;padding:12px 14px;color:#bbb;font:13px/1.7 "Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;box-shadow:0 8px 30px #000}' +
    '.dwd-cfgp b{display:block;font-size:12px;color:#777;letter-spacing:.2em;margin-bottom:6px}' +
    '.dwd-cfgp label{display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer}' +
    '.dwd-cfgp input[type=checkbox]{width:20px;height:20px;accent-color:#a00}' +
    '.dwd-cfgp .vol{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}' +
    '.dwd-cfgp .vol button{flex:1;min-width:48px;font:inherit;background:#151515;border:1px solid #333;color:#aaa;border-radius:4px;padding:6px 0;cursor:pointer}' +
    '.dwd-cfgp .vol button.on{border-color:#a00;color:#f55}' +
    /* 点滅・揺れを弱める設定 */
    '.dwd-calm .dwd-scare canvas,.dwd-calm .dwd-scare.text b{animation:dwdZoom .2s ease-out forwards !important}' +
    '.dwd-calm .dwd-scare .flash{display:none}' +
    '.dwd-calm .dwd-glitch,.dwd-calm .dwd-shake{animation:none !important}' +
    '.dwd-calm .logo,.dwd-calm .blink,.dwd-calm .flicker{animation:none !important}' +
    '.dwd-calm .dwd-gate button.g-go{animation:none}';
  var st = document.createElement('style');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* ---------------------------------------------------------
   * 絵（キャンバスで手描き風に生成）
   * ------------------------------------------------------- */
  function sizeCanvas(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth,
      h = window.innerHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    return { w: cv.width, h: cv.height };
  }
  function scanlines(c, w, h, a) {
    c.fillStyle = 'rgba(0,0,0,' + (a || 0.25) + ')';
    for (var yy = 0; yy < h; yy += 4) c.fillRect(0, yy, w, 2);
  }
  function chroma(c, w) {
    try {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.25;
      c.drawImage(c.canvas, w * 0.012, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    } catch (e) {}
  }

  // こわい顔
  function drawFace(c, w, h, opt) {
    opt = opt || {};
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    var cx = w / 2,
      cy = h / 2 + h * 0.03;
    var r = Math.min(w * 0.62, h * 0.48);
    var bg = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, Math.max(w, h) * 0.7);
    bg.addColorStop(0, '#300');
    bg.addColorStop(1, '#000');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);

    c.save();
    c.translate(cx, cy);
    c.rotate(DWD.rand(-0.08, 0.08));
    var fg = c.createRadialGradient(0, -r * 0.1, r * 0.1, 0, 0, r * 1.05);
    fg.addColorStop(0, '#e9e4d8');
    fg.addColorStop(0.55, '#a8a293');
    fg.addColorStop(0.85, '#3d3a33');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = fg;
    c.beginPath();
    c.ellipse(0, 0, r * 0.74, r * 1.02, 0, 0, Math.PI * 2);
    c.fill();

    for (var i = 0; i < 700; i++) {
      c.fillStyle = 'rgba(0,0,0,' + DWD.rand(0.03, 0.18) + ')';
      var a = Math.random() * Math.PI * 2,
        rr = Math.random() * r * 0.8;
      c.fillRect(Math.cos(a) * rr * 0.9, Math.sin(a) * rr, DWD.rand(1, r * 0.03), DWD.rand(1, r * 0.03));
    }
    c.strokeStyle = 'rgba(30,0,0,.55)';
    for (i = 0; i < 9; i++) {
      c.lineWidth = DWD.rand(1, r * 0.008);
      c.beginPath();
      var x = DWD.rand(-r * 0.5, r * 0.5),
        y = DWD.rand(-r * 0.8, r * 0.2);
      c.moveTo(x, y);
      for (var k = 0; k < 6; k++) {
        x += DWD.rand(-r * 0.08, r * 0.08);
        y += DWD.rand(0, r * 0.1);
        c.lineTo(x, y);
      }
      c.stroke();
    }

    [-1, 1].forEach(function (s) {
      var ex = s * r * 0.29,
        ey = -r * 0.17;
      var eg = c.createRadialGradient(ex, ey, 0, ex, ey, r * 0.27);
      eg.addColorStop(0, '#000');
      eg.addColorStop(0.6, '#000');
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = eg;
      c.beginPath();
      c.ellipse(ex, ey, r * 0.2, r * 0.25, s * 0.25, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#000';
      for (var t = 0; t < 3; t++) {
        var tx = ex + DWD.rand(-r * 0.1, r * 0.1);
        var tl = DWD.rand(r * 0.25, r * 0.8);
        var tw = DWD.rand(r * 0.012, r * 0.035);
        c.fillRect(tx, ey + r * 0.1, tw, tl);
        c.beginPath();
        c.arc(tx + tw / 2, ey + r * 0.1 + tl, tw * 0.9, 0, Math.PI * 2);
        c.fill();
      }
      if (!opt.noPupil) {
        c.fillStyle = '#fff';
        c.shadowColor = '#f00';
        c.shadowBlur = r * 0.06;
        c.beginPath();
        c.arc(ex + s * r * 0.02, ey + r * 0.02, r * 0.018, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
      }
    });

    var my = r * 0.47;
    var mg = c.createRadialGradient(0, my, 0, 0, my, r * 0.4);
    mg.addColorStop(0, '#000');
    mg.addColorStop(0.7, '#100');
    mg.addColorStop(1, 'rgba(40,0,0,0)');
    c.fillStyle = mg;
    c.beginPath();
    c.ellipse(0, my, r * 0.22, r * 0.36, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#000';
    c.beginPath();
    c.ellipse(0, my, r * 0.16, r * 0.3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#d8d0b8';
    for (i = 0; i < 16; i++) {
      var ang = (i / 16) * Math.PI * 2;
      var px = Math.cos(ang) * r * 0.16,
        py = my + Math.sin(ang) * r * 0.3;
      c.beginPath();
      c.moveTo(px - r * 0.015, py);
      c.lineTo(px + r * 0.015, py);
      c.lineTo(px * 0.75, my + (py - my) * 0.75);
      c.closePath();
      c.fill();
    }
    c.restore();
    scanlines(c, w, h);
    chroma(c, w);
  }

  // 巨大な目
  function drawEye(c, w, h) {
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    var cx = w / 2,
      cy = h / 2,
      r = Math.min(w * 0.48, h * 0.42);
    c.save();
    c.translate(cx, cy);
    c.beginPath();
    c.moveTo(-r * 1.4, 0);
    c.quadraticCurveTo(0, -r * 1.25, r * 1.4, 0);
    c.quadraticCurveTo(0, r * 1.25, -r * 1.4, 0);
    c.closePath();
    var sg = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.4);
    sg.addColorStop(0, '#f2eee0');
    sg.addColorStop(0.7, '#c9b9a0');
    sg.addColorStop(1, '#5a1a10');
    c.fillStyle = sg;
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = 'rgba(170,0,0,.75)';
    for (var i = 0; i < 40; i++) {
      c.lineWidth = DWD.rand(0.5, r * 0.012);
      var a = Math.random() * Math.PI * 2;
      var x = Math.cos(a) * r * 1.4,
        y = Math.sin(a) * r * 0.9;
      c.beginPath();
      c.moveTo(x, y);
      for (var k = 0; k < 7; k++) {
        x += (-x / 7) * DWD.rand(0.5, 1.2) + DWD.rand(-r * 0.05, r * 0.05);
        y += (-y / 7) * DWD.rand(0.5, 1.2) + DWD.rand(-r * 0.05, r * 0.05);
        c.lineTo(x, y);
      }
      c.stroke();
    }
    var ig = c.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.55);
    ig.addColorStop(0, '#000');
    ig.addColorStop(0.3, '#2a0000');
    ig.addColorStop(0.75, '#7a0a0a');
    ig.addColorStop(1, '#100');
    c.fillStyle = ig;
    c.beginPath();
    c.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.4)';
    for (i = 0; i < 60; i++) {
      var aa = (i / 60) * Math.PI * 2;
      c.beginPath();
      c.moveTo(Math.cos(aa) * r * 0.2, Math.sin(aa) * r * 0.2);
      c.lineTo(Math.cos(aa) * r * 0.55, Math.sin(aa) * r * 0.55);
      c.stroke();
    }
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.8)';
    c.beginPath();
    c.arc(-r * 0.12, -r * 0.12, r * 0.05, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.restore();
    scanlines(c, w, h, 0.22);
  }

  // 黒猫（首輪のない「かえってきたもの」）
  function drawCat(c, w, h) {
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    var cx = w / 2,
      cy = h * 0.56,
      r = Math.min(w * 0.55, h * 0.45);
    var bg = c.createRadialGradient(cx, cy, r * 0.3, cx, cy, Math.max(w, h));
    bg.addColorStop(0, '#1a1408');
    bg.addColorStop(1, '#000');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#050403';
    // 頭
    c.beginPath();
    c.ellipse(cx, cy, r * 1.05, r * 0.85, 0, 0, Math.PI * 2);
    c.fill();
    // 耳（ちぎれかけ）
    [-1, 1].forEach(function (s) {
      c.beginPath();
      c.moveTo(cx + s * r * 0.95, cy - r * 0.25);
      c.lineTo(cx + s * r * 0.85, cy - r * 1.25);
      c.lineTo(cx + s * r * 0.75, cy - r * 1.05);
      c.lineTo(cx + s * r * 0.62, cy - r * 1.2);
      c.lineTo(cx + s * r * 0.3, cy - r * 0.65);
      c.fill();
    });
    // 目
    [-1, 1].forEach(function (s) {
      var ex = cx + s * r * 0.42,
        ey = cy - r * 0.12;
      c.shadowColor = '#ffcc00';
      c.shadowBlur = r * 0.12;
      var eg = c.createRadialGradient(ex, ey, 0, ex, ey, r * 0.26);
      eg.addColorStop(0, '#fff6a0');
      eg.addColorStop(0.6, '#d8b000');
      eg.addColorStop(1, '#5a3a00');
      c.fillStyle = eg;
      c.beginPath();
      c.ellipse(ex, ey, r * 0.26, r * 0.2, s * 0.35, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
      // 赤い縦長の瞳
      c.fillStyle = '#300';
      c.beginPath();
      c.ellipse(ex, ey, r * 0.035, r * 0.19, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#c00';
      c.beginPath();
      c.ellipse(ex, ey, r * 0.012, r * 0.14, 0, 0, Math.PI * 2);
      c.fill();
    });
    // 口（人の歯）
    var my = cy + r * 0.42;
    c.fillStyle = '#200';
    c.beginPath();
    c.ellipse(cx, my, r * 0.45, r * 0.2, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e4dcc4';
    for (var i = 0; i < 12; i++) {
      var tx = cx - r * 0.38 + i * r * 0.069;
      c.fillRect(tx, my - r * 0.16, r * 0.055, r * 0.1);
      c.fillRect(tx, my + r * 0.07, r * 0.055, r * 0.09);
    }
    // 首（首輪がない）
    c.strokeStyle = 'rgba(120,0,0,.6)';
    c.lineWidth = r * 0.02;
    c.beginPath();
    c.moveTo(cx - r * 0.6, cy + r * 0.82);
    c.quadraticCurveTo(cx, cy + r * 0.95, cx + r * 0.6, cy + r * 0.82);
    c.stroke();
    scanlines(c, w, h);
    chroma(c, w);
  }

  // 無数の手（画面の外からのびてくる）
  function drawHands(c, w, h) {
    c.fillStyle = '#100';
    c.fillRect(0, 0, w, h);
    var g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.6);
    g.addColorStop(0, '#000');
    g.addColorStop(1, '#3a0000');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    var s = Math.min(w, h);
    for (var i = 0; i < 46; i++) {
      // 端からのびる腕
      var side = i % 4;
      var x, y, ang;
      if (side === 0) {
        x = DWD.rand(0, w);
        y = -s * 0.05;
        ang = Math.PI / 2;
      } else if (side === 1) {
        x = DWD.rand(0, w);
        y = h + s * 0.05;
        ang = -Math.PI / 2;
      } else if (side === 2) {
        x = -s * 0.05;
        y = DWD.rand(0, h);
        ang = 0;
      } else {
        x = w + s * 0.05;
        y = DWD.rand(0, h);
        ang = Math.PI;
      }
      ang += DWD.rand(-0.5, 0.5);
      var len = DWD.rand(s * 0.15, s * 0.45);
      var hs = DWD.rand(s * 0.05, s * 0.09);
      c.save();
      c.translate(x, y);
      c.rotate(ang);
      c.fillStyle = 'rgba(' + Math.round(DWD.rand(170, 225)) + ',' + Math.round(DWD.rand(160, 210)) + ',' + Math.round(DWD.rand(150, 195)) + ',.92)';
      c.fillRect(0, -hs * 0.28, len, hs * 0.56);
      // てのひら
      c.beginPath();
      c.ellipse(len + hs * 0.4, 0, hs * 0.55, hs * 0.5, 0, 0, Math.PI * 2);
      c.fill();
      // 指（長い）
      for (var k = -2; k <= 1; k++) {
        c.save();
        c.translate(len + hs * 0.8, k * hs * 0.22 + hs * 0.08);
        c.rotate(k * 0.12);
        c.fillRect(0, -hs * 0.07, hs * DWD.rand(0.8, 1.3), hs * 0.14);
        c.restore();
      }
      c.save();
      c.translate(len + hs * 0.3, -hs * 0.45);
      c.rotate(-0.9);
      c.fillRect(0, -hs * 0.07, hs * 0.6, hs * 0.14);
      c.restore();
      // 汚れ
      c.fillStyle = 'rgba(40,0,0,.5)';
      c.fillRect(len * 0.3, -hs * 0.2, len * 0.2, hs * 0.1);
      c.restore();
    }
    c.fillStyle = '#d00';
    c.font = '900 ' + Math.round(s * 0.16) + 'px serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('あけて', w / 2, h / 2);
    scanlines(c, w, h, 0.2);
  }

  // 長い髪の女（髪のすきまから片目）。scale: 0〜1（遠く〜目の前）
  function drawGirl(c, w, h, scale, opt) {
    opt = opt || {};
    scale = scale === undefined ? 1 : scale;
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    if (opt.corridor) {
      // 奥へのびる廊下
      for (var i = 0; i < 9; i++) {
        var k = i / 9;
        c.strokeStyle = 'rgba(120,110,95,' + (0.35 - k * 0.3) + ')';
        c.lineWidth = 2;
        c.strokeRect(w * (0.5 - 0.5 * (1 - k)), h * (0.5 - 0.5 * (1 - k)), w * (1 - k), h * (1 - k));
      }
    }
    var cx = w / 2,
      cy = h * (0.5 + 0.02 * (1 - scale)),
      r = Math.min(w, h) * (0.06 + 0.62 * scale);
    c.save();
    c.translate(cx, cy);
    // 顔（白く細長い）
    var fg = c.createLinearGradient(0, -r, 0, r);
    fg.addColorStop(0, '#d9d4c6');
    fg.addColorStop(1, '#8e887a');
    c.fillStyle = fg;
    c.beginPath();
    c.ellipse(0, 0, r * 0.55, r * 0.85, 0, 0, Math.PI * 2);
    c.fill();
    // 片目
    c.fillStyle = '#f4f2ea';
    c.beginPath();
    c.ellipse(r * 0.08, -r * 0.12, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(r * 0.12, -r * 0.12, r * 0.035, 0, Math.PI * 2);
    c.fill();
    // 口（少しひらいている）
    c.fillStyle = '#1a0000';
    c.beginPath();
    c.ellipse(r * 0.05, r * 0.45, r * 0.08, r * 0.14, 0, 0, Math.PI * 2);
    c.fill();
    // 長い黒髪（顔の大部分を隠す）
    c.strokeStyle = '#030303';
    c.lineCap = 'round';
    for (var j = 0; j < 220; j++) {
      var sx = DWD.rand(-r * 0.75, r * 0.75);
      if (sx > r * 0.0 && sx < r * 0.24 && Math.random() < 0.85) continue; // 目のあたりにすきま
      c.lineWidth = DWD.rand(r * 0.01, r * 0.05);
      c.beginPath();
      c.moveTo(sx * 0.6, -r * 1.05);
      c.bezierCurveTo(sx * 1.1, -r * 0.4, sx * 0.9 + DWD.rand(-r * 0.1, r * 0.1), r * 0.6, sx * 1.2 + DWD.rand(-r * 0.2, r * 0.2), r * DWD.rand(1.6, 3.2));
      c.stroke();
    }
    c.restore();
    scanlines(c, w, h, 0.25);
    if (scale > 0.8) chroma(c, w);
  }
  DWD.drawFace = drawFace;
  DWD.drawEye = drawEye;
  DWD.drawCat = drawCat;
  DWD.drawHands = drawHands;
  DWD.drawGirl = drawGirl;

  /* ---------------------------------------------------------
   * 驚かし本体
   * type: 'face' | 'eye' | 'text' | 'cat' | 'hands' | 'girl' | 'crawl'
   * ------------------------------------------------------- */
  var scaring = false;
  DWD.isScaring = function () {
    return scaring;
  };
  DWD.scare = function (opt) {
    opt = opt || {};
    if (scaring) return Promise.resolve();
    scaring = true;
    DWD.inc('scares');
    var type = opt.type || 'face';
    var dur = opt.dur || 1100;
    var el = document.createElement('div');
    el.className = 'dwd-scare' + (type === 'text' ? ' text' : '') + (type === 'crawl' ? ' crawl' : '');
    var fl = document.createElement('div');
    fl.className = 'flash';
    if (type === 'text') {
      var b = document.createElement('b');
      b.textContent = opt.text || 'みつけた';
      if (b.textContent.length > 4) b.className = 'long';
      el.appendChild(b);
    } else {
      var cv = document.createElement('canvas');
      el.appendChild(cv);
      var sz = sizeCanvas(cv);
      var c = cv.getContext('2d');
      if (type === 'eye') drawEye(c, sz.w, sz.h);
      else if (type === 'cat') drawCat(c, sz.w, sz.h);
      else if (type === 'hands') drawHands(c, sz.w, sz.h);
      else if (type === 'girl') drawGirl(c, sz.w, sz.h, 1);
      else if (type === 'crawl') drawGirl(c, sz.w, sz.h, 0.08, { corridor: true });
      else drawFace(c, sz.w, sz.h, opt);
    }
    document.body.appendChild(el);

    // はいよる：だるまさんがころんだ のように3段階で近づいてくる
    if (type === 'crawl') {
      dur = opt.dur || 2300;
      DWD.sfx.knock(1, 0.3, 0.5);
      return DWD.wait(650)
        .then(function () {
          drawGirl(c, sz.w, sz.h, 0.3, { corridor: true });
          DWD.sfx.knock(1, 0.3, 0.7);
          return DWD.wait(500);
        })
        .then(function () {
          drawGirl(c, sz.w, sz.h, 0.6, { corridor: true });
          DWD.sfx.knock(1, 0.3, 0.9);
          return DWD.wait(380);
        })
        .then(function () {
          drawGirl(c, sz.w, sz.h, 1.15);
          cv.style.animation = 'dwdZoom .09s ease-out forwards, dwdShake .07s linear infinite .09s';
          el.appendChild(fl);
          if (opt.sound !== false) {
            SFX.scream(1.1, 1.15);
            SFX.stinger();
          }
          DWD.vibrate([300, 60, 400]);
          return DWD.wait(dur - 1530);
        })
        .then(function () {
          el.remove();
          scaring = false;
        });
    }

    el.appendChild(fl);
    if (opt.sound !== false) {
      if (type === 'cat') {
        SFX.meow(true);
        SFX.scream(dur / 1000 + 0.1, 0.7);
      } else if (type === 'hands') {
        SFX.scratch(dur / 1000);
        SFX.scream(dur / 1000 + 0.1, 0.85);
        SFX.knock(6, 0.08);
      } else {
        SFX.scream(dur / 1000 + 0.2, type === 'girl' ? 1.2 : 1);
        if (type !== 'face') SFX.stinger();
      }
    }
    DWD.vibrate([300, 60, 400]);
    return DWD.wait(dur).then(function () {
      el.remove();
      scaring = false;
    });
  };

  // 一瞬だけ顔が映る（サブリミナル）
  DWD.flash = function (ms, kind) {
    if (scaring) return;
    var el = document.createElement('div');
    el.className = 'dwd-sub';
    var cv = document.createElement('canvas');
    el.appendChild(cv);
    var sz = sizeCanvas(cv);
    var c = cv.getContext('2d');
    if (kind === 'girl') drawGirl(c, sz.w, sz.h, 0.85);
    else drawFace(c, sz.w, sz.h, { noPupil: Math.random() < 0.5 });
    el.style.opacity = DWD.calm() ? DWD.rand(0.12, 0.25) : DWD.rand(0.35, 0.8);
    document.body.appendChild(el);
    SFX.static(0.12, 0.3);
    setTimeout(function () {
      el.remove();
    }, DWD.calm() ? Math.min(ms || 90, 70) : ms || 90);
  };

  /* ---------------------------------------------------------
   * 砂嵐で画面遷移
   * ------------------------------------------------------- */
  DWD.tv = function (ms) {
    var el = document.createElement('div');
    el.className = 'dwd-tv';
    var cv = document.createElement('canvas');
    cv.width = 160;
    cv.height = 100;
    el.appendChild(cv);
    document.body.appendChild(el);
    var c = cv.getContext('2d');
    var img = c.createImageData(160, 100);
    var alive = true;
    var calm = DWD.calm();
    (function loop() {
      if (!alive) return;
      for (var i = 0; i < img.data.length; i += 4) {
        var v = calm ? 40 + Math.random() * 40 : Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      requestAnimationFrame(loop);
    })();
    SFX.static((ms || 900) / 1000, 0.4);
    return {
      el: el,
      stop: function () {
        alive = false;
        el.remove();
      }
    };
  };
  DWD.go = function (url, ms) {
    ms = ms || 900;
    DWD.tv(ms + 400);
    setTimeout(function () {
      location.href = url;
    }, ms);
  };

  /* ---------------------------------------------------------
   * 文字化け・タイプライター
   * ------------------------------------------------------- */
  var JUNK = '▓▒░█■□呪死目見誰縺繧ｦｨ譁ｼ蟄縺ｮ・ゑ';
  DWD.corrupt = function (str, p) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      out += str[i] !== ' ' && str[i] !== '\n' && Math.random() < p ? JUNK[Math.floor(Math.random() * JUNK.length)] : str[i];
    }
    return out;
  };
  // 要素の文字を一時的に化けさせる
  DWD.glitchText = function (el, ms, p) {
    if (!el) return;
    var orig = el.getAttribute('data-orig') || el.textContent;
    el.setAttribute('data-orig', orig);
    var end = Date.now() + (ms || 500);
    (function loop() {
      if (Date.now() > end) {
        el.textContent = orig;
        return;
      }
      el.textContent = DWD.corrupt(orig, p || 0.4);
      setTimeout(loop, 50);
    })();
  };
  DWD.type = function (el, text, speed, sound) {
    return new Promise(function (res) {
      var i = 0;
      el.textContent = '';
      var sp = (speed || 70) * DWD.speed();
      (function step() {
        if (i >= text.length) return res();
        el.textContent += text[i++];
        if (sound && i % 2 === 0) SFX.blip();
        setTimeout(step, sp);
      })();
    });
  };

  /* ---------------------------------------------------------
   * 開始ゲート（音を鳴らすには一度タップが必要なため）
   * opt.settings = true で「点滅・揺れを弱める」チェックを出す
   * ------------------------------------------------------- */
  DWD.gate = function (opt) {
    opt = opt || {};
    return new Promise(function (res) {
      var el = document.createElement('div');
      el.className = 'dwd-gate';
      el.setAttribute('role', 'dialog');
      el.innerHTML = '<div class="g-title"></div><button type="button" class="g-go"></button><div class="g-warn"></div>';
      el.querySelector('.g-title').textContent = opt.title || '接続を続けますか';
      el.querySelector('.g-go').textContent = opt.button || 'つづける';
      el.querySelector('.g-warn').innerHTML = opt.warn || '';
      if (opt.settings) {
        var o = document.createElement('div');
        o.className = 'g-opt';
        o.innerHTML = '<label><input type="checkbox" id="gCalm"> 点滅・揺れを弱める</label>';
        el.appendChild(o);
        var cb = o.querySelector('input');
        cb.checked = DWD.calm();
        cb.addEventListener('change', function () {
          DWD.setCalm(cb.checked);
        });
      }
      document.body.appendChild(el);
      el.querySelector('.g-go').addEventListener('click', function () {
        DWD.audio();
        SFX.static(0.25, 0.3);
        el.remove();
        res();
      });
    });
  };

  /* ---------------------------------------------------------
   * 設定ボタン（左下の歯車）
   * ------------------------------------------------------- */
  function cfgButton() {
    if (document.body.hasAttribute('data-no-cfg')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'dwd-cfg';
    b.setAttribute('aria-label', '設定');
    b.textContent = '⚙';
    document.body.appendChild(b);
    var panel = null;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel) {
        panel.remove();
        panel = null;
        return;
      }
      panel = document.createElement('div');
      panel.className = 'dwd-cfgp';
      panel.innerHTML =
        '<b>設定</b><label><input type="checkbox"> 点滅・揺れを弱める</label>' +
        '<div style="margin-top:6px">音量</div><div class="vol"><button type="button" data-v="0">消音</button><button type="button" data-v="1">小</button><button type="button" data-v="2">中</button><button type="button" data-v="3">大</button></div>';
      var cb = panel.querySelector('input');
      cb.checked = DWD.calm();
      cb.addEventListener('change', function () {
        DWD.setCalm(cb.checked);
      });
      var cur = DWD.get('vol');
      if (cur === undefined || cur === null) cur = 3;
      DWD.$$('.vol button', panel).forEach(function (vb) {
        if (+vb.dataset.v === cur) vb.classList.add('on');
        vb.addEventListener('click', function () {
          DWD.setVolume(+vb.dataset.v);
          DWD.$$('.vol button', panel).forEach(function (x) {
            x.classList.toggle('on', x === vb);
          });
          SFX.blip();
        });
      });
      panel.addEventListener('click', function (ev) {
        ev.stopPropagation();
      });
      document.body.appendChild(panel);
    });
    document.addEventListener('click', function () {
      if (panel) {
        panel.remove();
        panel = null;
      }
    });
  }

  /* ---------------------------------------------------------
   * 環境演出：ランダムに起きる怪現象
   * ------------------------------------------------------- */
  DWD.haunt = function (opt) {
    opt = opt || {};
    var min = opt.min || 9000,
      max = opt.max || 22000;
    var bigDone = false;
    var stopped = false;
    function tick() {
      if (stopped) return;
      setTimeout(function () {
        if (stopped) return;
        if (scaring || (opt.paused && opt.paused())) return tick();
        var r = Math.random();
        if (!bigDone && opt.big !== false && r < (opt.bigChance || 0.18)) {
          bigDone = true;
          DWD.scare({ type: DWD.pick(opt.types || ['face', 'eye', 'girl', 'text']), text: DWD.pick(['みてる', 'うしろ', 'みつけた', 'まだいる']) });
        } else if (r < 0.45) {
          DWD.flash(DWD.rand(60, 120), Math.random() < 0.3 ? 'girl' : null);
        } else if (r < 0.72 && opt.silent) {
          DWD.flash(DWD.rand(60, 120));
        } else if (r < 0.6) {
          SFX.whisper();
        } else if (r < 0.72) {
          SFX.knock(3);
        } else if (r < 0.85) {
          document.body.classList.add('dwd-glitch');
          SFX.blip();
          setTimeout(function () {
            document.body.classList.remove('dwd-glitch');
          }, 220);
        } else {
          var els = DWD.$$(opt.textSel || 'p,h1,h2,li');
          if (els.length) DWD.glitchText(DWD.pick(els), 600, 0.5);
          SFX.blip();
        }
        tick();
      }, DWD.rand(min, max));
    }
    tick();
    return {
      stop: function () {
        stopped = true;
      }
    };
  };

  // 背景の砂嵐（薄く）
  DWD.noiseBg = function (opacity) {
    var cv = document.createElement('canvas');
    cv.width = 120;
    cv.height = 80;
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;opacity:' +
      (opacity || 0.06) +
      ';image-rendering:pixelated;mix-blend-mode:screen';
    document.body.appendChild(cv);
    var c = cv.getContext('2d');
    var img = c.createImageData(120, 80);
    setInterval(function () {
      if (document.hidden) return;
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    }, 70);
    return cv;
  };

  // タブを離れるとタイトルが変わる（メタ演出）
  DWD.tabHaunt = function (titles) {
    var orig = document.title;
    var n = 0;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        document.title = titles[Math.min(n, titles.length - 1)];
        n++;
      } else {
        setTimeout(function () {
          document.title = orig;
        }, 1400);
      }
    });
  };

  // フッターにバージョンと更新日を表示
  DWD.footer = function (el, label) {
    if (!el) return;
    el.classList.add('dwd-ver');
    el.textContent = (label || 'DarkWebDark 2') + ' v' + VERSION + ' / 更新 ' + UPDATED;
  };

  document.addEventListener('DOMContentLoaded', function () {
    DWD.$$('[data-dwd-ver]').forEach(function (el) {
      DWD.footer(el, el.getAttribute('data-dwd-ver') || undefined);
    });
    rtaHud();
    cfgButton();
  });
})();
