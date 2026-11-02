/* 入口ページ群の共通処理：写真（キャンバス描画）・アバター・拡大表示・トースト */
(function () {
  'use strict';
  var H = (window.HIBI = {});

  /* ---------------- 共通の小道具 ---------------- */
  H.toast = function (html, ms) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function () {
      t.remove();
    }, ms || 3200);
    return t;
  };

  // 写真を描く（800x600）
  H.photo = function (canvas, kind, opt) {
    var w = (canvas.width = 800),
      h = (canvas.height = 600);
    var c = canvas.getContext('2d');
    var f = PHOTOS[kind];
    if (f) f(c, w, h, opt || {});
    grain(c, w, h, 0.06);
    var v = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.45)');
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  };
  function grain(c, w, h, a) {
    for (var i = 0; i < 2600; i++) {
      c.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',' + Math.random() * a + ')';
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }
  function stamp(c, w, h, t) {
    c.fillStyle = '#e8a030';
    c.font = 'bold 26px monospace';
    c.textAlign = 'right';
    c.fillText(t, w - 18, h - 18);
    c.textAlign = 'left';
  }
  // 人影（遠く）
  function shadowMan(c, x, y, s, col) {
    c.fillStyle = col || '#000';
    c.beginPath();
    c.arc(x, y, s * 0.18, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(x - s * 0.2, y + s * 0.2);
    c.lineTo(x + s * 0.2, y + s * 0.2);
    c.lineTo(x + s * 0.26, y + s * 1.25);
    c.lineTo(x - s * 0.26, y + s * 1.25);
    c.fill();
    // 長い髪
    c.fillRect(x - s * 0.2, y - s * 0.05, s * 0.4, s * 0.55);
  }
  function paleFace(c, x, y, s, a) {
    c.fillStyle = 'rgba(225,220,205,' + (a || 0.8) + ')';
    c.beginPath();
    c.ellipse(x, y, s * 0.7, s, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#000';
    c.beginPath();
    c.ellipse(x - s * 0.28, y - s * 0.15, s * 0.15, s * 0.22, 0, 0, Math.PI * 2);
    c.ellipse(x + s * 0.28, y - s * 0.15, s * 0.15, s * 0.22, 0, 0, Math.PI * 2);
    c.ellipse(x, y + s * 0.5, s * 0.12, s * 0.26, 0, 0, Math.PI * 2);
    c.fill();
  }
  function cat(c, x, y, s, collar, eyeCol) {
    c.fillStyle = '#0d0b0a';
    c.beginPath();
    c.ellipse(x, y + s * 0.55, s * 0.9, s * 0.6, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(x, y, s * 0.48, 0, Math.PI * 2);
    c.fill();
    [-1, 1].forEach(function (d) {
      c.beginPath();
      c.moveTo(x + d * s * 0.44, y - s * 0.1);
      c.lineTo(x + d * s * 0.36, y - s * 0.66);
      c.lineTo(x + d * s * 0.08, y - s * 0.4);
      c.fill();
    });
    if (eyeCol) {
      [-1, 1].forEach(function (d) {
        c.fillStyle = eyeCol;
        c.beginPath();
        c.ellipse(x + d * s * 0.2, y - s * 0.02, s * 0.09, s * 0.11, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#000';
        c.fillRect(x + d * s * 0.2 - s * 0.015, y - s * 0.1, s * 0.03, s * 0.17);
      });
    }
    if (collar) {
      c.fillStyle = '#b01010';
      c.fillRect(x - s * 0.36, y + s * 0.36, s * 0.72, s * 0.08);
    }
  }
  // 女の子（上半身）。eyes: 'normal' | 'black'
  function girl(c, x, y, s, hair, eyes, top) {
    c.fillStyle = top || '#d8c7b0';
    c.beginPath();
    c.ellipse(x, y + s * 1.25, s * 0.95, s * 0.6, 0, Math.PI, 0);
    c.fill();
    c.fillRect(x - s * 0.95, y + s * 1.25, s * 1.9, s * 0.6);
    c.fillStyle = hair;
    c.beginPath();
    c.ellipse(x, y + s * 0.05, s * 0.62, s * 0.7, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(x - s * 0.62, y, s * 1.24, s * 0.7);
    c.fillStyle = '#f2dcc8';
    c.beginPath();
    c.ellipse(x, y + s * 0.12, s * 0.46, s * 0.55, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hair;
    c.beginPath();
    c.ellipse(x, y - s * 0.32, s * 0.5, s * 0.2, 0, 0, Math.PI * 2);
    c.fill();
    if (eyes === 'black') {
      c.fillStyle = '#000';
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.ellipse(x + d * s * 0.18, y + s * 0.08, s * 0.11, s * 0.14, 0, 0, Math.PI * 2);
        c.fill();
        c.fillRect(x + d * s * 0.18 - s * 0.02, y + s * 0.15, s * 0.035, s * 0.45);
      });
      c.fillStyle = '#300';
      c.beginPath();
      c.ellipse(x, y + s * 0.42, s * 0.1, s * 0.13, 0, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillStyle = '#3a2a22';
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.arc(x + d * s * 0.18, y + s * 0.1, s * 0.05, 0, Math.PI * 2);
        c.fill();
      });
      c.strokeStyle = '#a0584a';
      c.lineWidth = s * 0.03;
      c.beginPath();
      c.arc(x, y + s * 0.3, s * 0.13, 0.2, Math.PI - 0.2);
      c.stroke();
      c.fillStyle = 'rgba(240,140,140,.35)';
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.arc(x + d * s * 0.3, y + s * 0.28, s * 0.08, 0, Math.PI * 2);
        c.fill();
      });
    }
  }

  // アパート外観（夜）
  function apartment(c, w, h, opt) {
    c.fillStyle = '#0a0c14';
    c.fillRect(0, 0, w, h);
    // 建物
    c.fillStyle = '#2b2d33';
    c.fillRect(w * 0.12, h * 0.2, w * 0.76, h * 0.56);
    c.fillStyle = '#1f2026';
    c.fillRect(w * 0.1, h * 0.17, w * 0.8, h * 0.05);
    c.fillRect(w * 0.12, h * 0.47, w * 0.76, h * 0.03);
    // 2階の窓 201〜204
    for (var i = 0; i < 4; i++) {
      var x = w * (0.16 + i * 0.18);
      c.fillStyle = '#0d0e12';
      c.fillRect(x, h * 0.26, w * 0.12, h * 0.15);
      if (i === 0) {
        c.fillStyle = 'rgba(255,220,150,.55)';
        c.fillRect(x, h * 0.26, w * 0.12, h * 0.15);
      }
      if (i === 2 && opt.face) paleFace(c, x + w * 0.06, h * 0.33, w * 0.016, 0.75);
    }
    // 1階
    for (i = 0; i < 4; i++) {
      c.fillStyle = '#121318';
      c.fillRect(w * (0.16 + i * 0.18), h * 0.56, w * 0.12, h * 0.15);
    }
    // 看板
    c.fillStyle = '#d8d2bc';
    c.fillRect(w * 0.42, h * 0.505, w * 0.16, h * 0.04);
    c.fillStyle = '#1a3a1a';
    c.font = 'bold 20px serif';
    c.textAlign = 'center';
    c.fillText('みどり荘', w * 0.5, h * 0.537);
    c.textAlign = 'left';
    // 線路
    c.fillStyle = '#16161a';
    c.fillRect(0, h * 0.82, w, h * 0.18);
    c.strokeStyle = '#4a4a50';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(0, h * 0.86);
    c.lineTo(w, h * 0.86);
    c.moveTo(0, h * 0.93);
    c.lineTo(w, h * 0.93);
    c.stroke();
    for (i = 0; i < 20; i++) {
      c.fillStyle = '#2a2420';
      c.fillRect(i * 44, h * 0.85, 12, h * 0.1);
    }
    // 街灯
    var g = c.createRadialGradient(w * 0.93, h * 0.3, 2, w * 0.93, h * 0.3, w * 0.25);
    g.addColorStop(0, 'rgba(230,240,255,.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }

  var PHOTOS = {
    apart: function (c, w, h, opt) {
      apartment(c, w, h, { face: opt.face !== false });
      stamp(c, w, h, '11/04 01:52');
    },
    apart2: function (c, w, h) {
      apartment(c, w, h, { face: false });
      stamp(c, w, h, '11/04 01:12');
    },
    station: function (c, w, h) {
      c.fillStyle = '#05060a';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#2a2a2e';
      c.fillRect(0, h * 0.62, w, h * 0.38);
      c.fillStyle = '#cfc040';
      c.fillRect(0, h * 0.62, w, 6);
      // 屋根と蛍光灯
      c.fillStyle = '#141418';
      c.fillRect(0, 0, w, h * 0.14);
      for (var i = 0; i < 5; i++) {
        c.fillStyle = i === 3 ? 'rgba(255,255,255,.25)' : '#eef4ff';
        c.fillRect(60 + i * 160, h * 0.15, 90, 6);
        var g = c.createRadialGradient(105 + i * 160, h * 0.16, 2, 105 + i * 160, h * 0.4, 220);
        g.addColorStop(0, i === 3 ? 'rgba(200,220,255,.05)' : 'rgba(200,220,255,.18)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      }
      // 駅名標
      c.fillStyle = '#f0f0f0';
      c.fillRect(w * 0.32, h * 0.3, w * 0.36, h * 0.12);
      c.fillStyle = '#222';
      c.font = 'bold 34px sans-serif';
      c.textAlign = 'center';
      c.fillText('■■ 駅', w * 0.5, h * 0.385);
      c.textAlign = 'left';
      // 遠くのベンチの人影
      shadowMan(c, w * 0.86, h * 0.48, 60, 'rgba(0,0,0,.85)');
      stamp(c, w, h, '11/04 00:58');
    },
    mailbox: function (c, w, h) {
      c.fillStyle = '#3a3630';
      c.fillRect(0, 0, w, h);
      var names = ['田村', '白石', '', ''];
      for (var i = 0; i < 4; i++) {
        var x = w * 0.08 + i * w * 0.215,
          y = h * 0.25;
        c.fillStyle = '#7a7468';
        c.fillRect(x, y, w * 0.19, h * 0.42);
        c.fillStyle = '#1e1c18';
        c.fillRect(x + w * 0.02, y + h * 0.06, w * 0.15, h * 0.03);
        c.fillStyle = '#e8e2d0';
        c.fillRect(x + w * 0.02, y + h * 0.18, w * 0.15, h * 0.08);
        c.fillStyle = '#222';
        c.font = 'bold 28px sans-serif';
        c.textAlign = 'center';
        c.fillText(String(201 + i), x + w * 0.095, y + h * 0.15);
        c.font = '26px serif';
        c.fillText(names[i], x + w * 0.095, y + h * 0.24);
        if (i === 2) {
          // 203：管理シール
          c.fillStyle = '#c9b028';
          c.fillRect(x + w * 0.015, y + h * 0.17, w * 0.16, h * 0.1);
          c.fillStyle = '#300';
          c.font = 'bold 21px sans-serif';
          c.fillText('管理　間宮', x + w * 0.095, y + h * 0.235);
        }
        if (i === 3) {
          c.fillStyle = '#777';
          c.font = '20px sans-serif';
          c.fillText('空室', x + w * 0.095, y + h * 0.235);
        }
      }
      c.textAlign = 'left';
      // 202 の下からはみ出たテープ
      c.fillStyle = 'rgba(230,220,180,.8)';
      c.fillRect(w * 0.32, h * 0.67, w * 0.06, h * 0.03);
      stamp(c, w, h, '11/04 01:20');
    },
    corridor: function (c, w, h, opt) {
      c.fillStyle = '#0b0b0d';
      c.fillRect(0, 0, w, h);
      // 外廊下（遠近）
      c.fillStyle = '#26262a';
      c.beginPath();
      c.moveTo(0, h);
      c.lineTo(w * 0.42, h * 0.55);
      c.lineTo(w * 0.52, h * 0.55);
      c.lineTo(w * 0.62, h);
      c.fill();
      // 壁とドア
      c.fillStyle = '#34343a';
      c.beginPath();
      c.moveTo(w * 0.62, h);
      c.lineTo(w * 0.52, h * 0.55);
      c.lineTo(w * 0.52, h * 0.22);
      c.lineTo(w, -h * 0.2);
      c.lineTo(w, h);
      c.fill();
      var doors = [
        [0.9, 1.0, '201'],
        [0.74, 0.62, '202'],
        [0.64, 0.42, '203'],
        [0.575, 0.3, '204']
      ];
      doors.forEach(function (d) {
        var x = w * d[0],
          s = d[1];
        c.fillStyle = '#4a3a2c';
        c.fillRect(x - 70 * s, h * 0.58 - 160 * s * 0.9, 90 * s, 240 * s);
        c.fillStyle = '#ddd';
        c.font = 'bold ' + Math.round(22 * s) + 'px sans-serif';
        c.fillText(d[2], x - 55 * s, h * 0.58 - 120 * s * 0.9);
      });
      // 手すり
      c.strokeStyle = '#55555c';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(0, h * 0.62);
      c.lineTo(w * 0.42, h * 0.45);
      c.stroke();
      // 奥の蛍光灯
      var g = c.createRadialGradient(w * 0.5, h * 0.3, 2, w * 0.5, h * 0.3, w * 0.35);
      g.addColorStop(0, 'rgba(220,240,230,.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      // 開くたびに増える人影
      var n = opt.figures || 0;
      var spots = [
        [0.5, 0.42, 22],
        [0.47, 0.47, 30],
        [0.4, 0.5, 46],
        [0.3, 0.55, 70],
        [0.15, 0.6, 110]
      ];
      for (var i = 0; i < Math.min(n, spots.length); i++) shadowMan(c, w * spots[i][0], h * spots[i][1], spots[i][2], 'rgba(0,0,0,.92)');
      stamp(c, w, h, '11/04 01:31');
    },
    door202: function (c, w, h) {
      c.fillStyle = '#5a5246';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#6e604e';
      c.fillRect(w * 0.18, 0, w * 0.64, h);
      c.fillStyle = '#c8c0b0';
      c.beginPath();
      c.arc(w * 0.74, h * 0.56, 18, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ddd';
      c.fillRect(w * 0.42, h * 0.06, w * 0.16, h * 0.08);
      c.fillStyle = '#222';
      c.font = 'bold 30px sans-serif';
      c.textAlign = 'center';
      c.fillText('202', w * 0.5, h * 0.12);
      c.save();
      c.translate(w * 0.45, h * 0.44);
      c.rotate(-0.06);
      c.fillStyle = '#f7ef9a';
      c.fillRect(-120, -100, 240, 220);
      c.fillStyle = '#5a1010';
      c.font = 'bold 30px serif';
      c.fillText('ノックしたら', 0, -20);
      c.fillText('こたえて', 0, 30);
      c.font = '20px serif';
      c.fillText('２０３', 70, 100);
      c.restore();
      c.textAlign = 'left';
      stamp(c, w, h, '11/04 01:38');
    },
    door203: function (c, w, h) {
      c.fillStyle = '#4d463c';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#5e5243';
      c.fillRect(w * 0.18, 0, w * 0.6, h);
      // 少し開いたすきま
      c.fillStyle = '#000';
      c.fillRect(w * 0.78, 0, w * 0.035, h);
      // すきまの目
      c.fillStyle = '#e8e4d8';
      c.beginPath();
      c.ellipse(w * 0.797, h * 0.42, 9, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(w * 0.797, h * 0.42, 3.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ddd';
      c.fillRect(w * 0.4, h * 0.06, w * 0.16, h * 0.08);
      c.fillStyle = '#222';
      c.font = 'bold 30px sans-serif';
      c.textAlign = 'center';
      c.fillText('203', w * 0.48, h * 0.12);
      c.fillStyle = '#c9b028';
      c.fillRect(w * 0.36, h * 0.2, w * 0.24, h * 0.07);
      c.fillStyle = '#300';
      c.font = 'bold 22px sans-serif';
      c.fillText('管理　間宮', w * 0.48, h * 0.25);
      c.textAlign = 'left';
      stamp(c, w, h, '11/04 01:40');
    },
    room202: function (c, w, h) {
      c.fillStyle = '#030304';
      c.fillRect(0, 0, w, h);
      // 懐中電灯の丸い光
      var g = c.createRadialGradient(w * 0.55, h * 0.5, 10, w * 0.55, h * 0.5, w * 0.42);
      g.addColorStop(0, 'rgba(200,190,170,.55)');
      g.addColorStop(0.7, 'rgba(90,80,70,.25)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      // 壁のひっかき傷
      c.strokeStyle = 'rgba(40,10,5,.7)';
      c.lineWidth = 3;
      for (var i = 0; i < 26; i++) {
        var x = w * 0.35 + Math.random() * w * 0.4,
          y = h * 0.15 + Math.random() * h * 0.3;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.random() * 10 - 5, y + 60 + Math.random() * 80);
        c.stroke();
      }
      // 壁を向いて座る黒猫（首輪なし）
      cat(c, w * 0.55, h * 0.7, 70, false, null);
      stamp(c, w, h, '11/04 01:58');
    },
    black: function (c, w, h) {
      c.fillStyle = '#040404';
      c.fillRect(0, 0, w, h);
      paleFace(c, w * 0.5, h * 0.45, 42, 0.06);
      stamp(c, w, h, '11/04 02:13');
    },
    pumpkin: function (c, w, h) {
      c.fillStyle = '#2b1d14';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#e07a20';
      c.beginPath();
      c.ellipse(w * 0.5, h * 0.58, w * 0.25, h * 0.25, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3a5a20';
      c.fillRect(w * 0.48, h * 0.28, w * 0.04, h * 0.08);
      c.fillStyle = '#ffd860';
      c.beginPath();
      c.moveTo(w * 0.4, h * 0.5);
      c.lineTo(w * 0.45, h * 0.58);
      c.lineTo(w * 0.35, h * 0.58);
      c.moveTo(w * 0.6, h * 0.5);
      c.lineTo(w * 0.65, h * 0.58);
      c.lineTo(w * 0.55, h * 0.58);
      c.fill();
      c.fillRect(w * 0.4, h * 0.67, w * 0.2, h * 0.04);
    },
    latte: function (c, w, h) {
      c.fillStyle = '#9a7a5e';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(w * 0.5, h * 0.5, h * 0.34, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#8b5a33';
      c.beginPath();
      c.arc(w * 0.5, h * 0.5, h * 0.28, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f2e6d2';
      var x = w * 0.5,
        y = h * 0.52,
        s = h * 0.15;
      c.beginPath();
      c.moveTo(x, y + s * 0.9);
      c.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
      c.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
      c.fill();
    },
    // END1 用：こもれびの二人
    cafe2: function (c, w, h, opt) {
      c.fillStyle = '#d9b98f';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#c69d6c';
      for (var i = 0; i < 8; i++) c.fillRect(0, i * 80, w, 4);
      // 窓の光
      var g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(255,250,220,.6)');
      g.addColorStop(1, 'rgba(255,250,220,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h * 0.7);
      var ev = opt.black ? 'black' : 'normal';
      girl(c, w * 0.33, h * 0.36, 95, '#2a1a12', ev, '#e8e0ef');
      girl(c, w * 0.67, h * 0.36, 95, '#6b4a33', ev, '#f2cfa8');
      // テーブルとナポリタン
      c.fillStyle = '#7a4e2a';
      c.fillRect(0, h * 0.74, w, h * 0.26);
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(w * 0.5, h * 0.84, w * 0.16, h * 0.06, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#d4552a';
      c.beginPath();
      c.ellipse(w * 0.5, h * 0.83, w * 0.11, h * 0.035, 0, 0, Math.PI * 2);
      c.fill();
      if (opt.black) {
        // 窓に黒猫（首輪なし）
        cat(c, w * 0.9, h * 0.2, 36, false, '#ffcc00');
      }
      stamp(c, w, h, '11/05 12:13');
    },
    // 1998年の写真（はるか）
    haruka: function (c, w, h, opt) {
      c.fillStyle = '#b8a07a';
      c.fillRect(0, 0, w, h);
      var g = c.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
      g.addColorStop(0, 'rgba(255,240,210,.5)');
      g.addColorStop(1, 'rgba(60,40,20,.6)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      girl(c, w * 0.5, h * 0.36, 120, '#1a120c', opt.black ? 'black' : 'normal', '#8a9a8a');
      if (opt.scratch) {
        c.strokeStyle = 'rgba(30,10,5,.85)';
        c.lineWidth = 5;
        for (var i = 0; i < 18; i++) {
          c.beginPath();
          c.moveTo(w * 0.4 + Math.random() * w * 0.2, h * 0.22);
          c.lineTo(w * 0.4 + Math.random() * w * 0.2, h * 0.5);
          c.stroke();
        }
      }
      c.fillStyle = 'rgba(240,230,200,.15)';
      c.fillRect(0, 0, w, h);
      if (!opt.nostamp) {
        c.fillStyle = '#e8a030';
        c.font = 'bold 26px monospace';
        c.fillText("'98 10 01", w - 170, h - 18);
      }
    }
  };
  H.PHOTOS = PHOTOS;

  /* ---------------- アバター（小さなキャンバス） ---------------- */
  // who: 'mai' | 'yuki' | '203' ; state: 'normal' | 'closed' | 'black'
  H.avatar = function (canvas, who, state) {
    var s = (canvas.width = canvas.height = 120);
    var c = canvas.getContext('2d');
    if (who === '203') {
      c.fillStyle = '#111';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#e0dccf';
      c.font = 'bold 34px monospace';
      c.textAlign = 'center';
      c.fillText('203', s / 2, s / 2 + 12);
      return;
    }
    if (who === 'master') {
      c.fillStyle = '#6b5440';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#f2e6d0';
      c.font = 'bold 40px serif';
      c.textAlign = 'center';
      c.fillText('珈', s / 2, s / 2 + 14);
      return;
    }
    c.fillStyle = who === 'yuki' ? '#ffe1c4' : '#d9d3e6';
    c.fillRect(0, 0, s, s);
    var hair = who === 'yuki' ? '#6b4a33' : '#2a1a12';
    c.fillStyle = hair;
    c.beginPath();
    c.ellipse(s / 2, s * 0.5, s * 0.36, s * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(s * 0.14, s * 0.5, s * 0.72, who === 'mai' ? s * 0.3 : s * 0.42);
    c.fillStyle = '#f6e2cf';
    c.beginPath();
    c.ellipse(s / 2, s * 0.58, s * 0.27, s * 0.3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hair;
    c.fillRect(s * 0.22, s * 0.26, s * 0.56, s * 0.14);
    if (state === 'black') {
      c.fillStyle = '#000';
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.ellipse(s / 2 + d * s * 0.1, s * 0.57, s * 0.06, s * 0.08, 0, 0, Math.PI * 2);
        c.fill();
        c.fillRect(s / 2 + d * s * 0.1 - 1.5, s * 0.6, 3, s * 0.25);
      });
    } else if (state === 'closed') {
      c.strokeStyle = '#3a2a22';
      c.lineWidth = 2;
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.moveTo(s / 2 + d * s * 0.1 - 6, s * 0.58);
        c.lineTo(s / 2 + d * s * 0.1 + 6, s * 0.58);
        c.stroke();
      });
    } else {
      c.fillStyle = '#3a2a22';
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.arc(s / 2 + d * s * 0.1, s * 0.58, 3.5, 0, Math.PI * 2);
        c.fill();
      });
    }
    // 口（まいは笑っていない）
    c.strokeStyle = '#a0584a';
    c.lineWidth = 2;
    c.beginPath();
    if (who === 'mai') {
      c.moveTo(s * 0.46, s * 0.71);
      c.lineTo(s * 0.54, s * 0.71);
    } else c.arc(s / 2, s * 0.68, 7, 0.3, Math.PI - 0.3);
    c.stroke();
  };
  // まばたき（ときどき目が黒くなる）
  H.blinker = function (canvas, who) {
    H.avatar(canvas, who, 'normal');
    function loop() {
      setTimeout(function () {
        var black = Math.random() < 0.18;
        H.avatar(canvas, who, black ? 'black' : 'closed');
        setTimeout(function () {
          H.avatar(canvas, who, 'normal');
          loop();
        }, black ? 260 : 140);
      }, DWD.rand(2500, 7000));
    }
    loop();
  };

  /* ---------------- 写真の拡大表示 ---------------- */
  // onOpen(canvas) で毎回描き直せる
  H.viewer = function (draw, cap, onShown) {
    var v = document.createElement('div');
    v.className = 'viewer';
    v.innerHTML = '<button type="button" class="x" aria-label="閉じる">×</button><canvas></canvas><div class="cap"></div>';
    var cv = v.querySelector('canvas');
    draw(cv);
    v.querySelector('.cap').textContent = cap || '';
    document.body.appendChild(v);
    DWD.sfx.blip();
    function close() {
      v.remove();
      document.removeEventListener('keydown', key);
    }
    function key(e) {
      if (e.key === 'Escape') close();
    }
    v.querySelector('.x').addEventListener('click', close);
    v.addEventListener('click', function (e) {
      if (e.target === v) close();
    });
    document.addEventListener('keydown', key);
    if (onShown) onShown(v, cv);
    return { el: v, close: close };
  };

  /* ---------------- 入口ページのナビ ---------------- */
  // 見たページを記録
  H.visit = function (page) {
    var seen = DWD.get('seen') || {};
    seen[page] = (seen[page] || 0) + 1;
    DWD.set('seen', seen);
    return seen[page];
  };
  H.seen = function (page) {
    return (DWD.get('seen') || {})[page] || 0;
  };
  // ナビのリンクを、見つけたページだけ使えるようにする
  H.nav = function () {
    var unlocked = DWD.get('unlock') || {};
    DWD.$$('.topbar nav a[data-need]').forEach(function (a) {
      if (!unlocked[a.getAttribute('data-need')]) a.classList.add('locked');
    });
  };
  H.unlock = function (k) {
    var u = DWD.get('unlock') || {};
    u[k] = true;
    DWD.set('unlock', u);
  };
  H.unlocked = function (k) {
    return !!(DWD.get('unlock') || {})[k];
  };

  // タブを離れたときのタイトル
  H.tabHaunt = function () {
    DWD.tabHaunt(['まい？', 'どこいくの', 'もどってきて', 'みてるよ', 'こん　こん　こん']);
  };

  document.addEventListener('DOMContentLoaded', function () {
    DWD.$$('canvas[data-photo]').forEach(function (cv) {
      H.photo(cv, cv.getAttribute('data-photo'));
    });
  });
})();
