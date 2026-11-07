/**
 * Анимации страниц состояния (коды HTTP, «нет подключения»): canvas 2D, без зависимостей.
 * При каждой загрузке выбирается случайная анимация, не совпадающая с предыдущей (запоминается в sessionStorage).
 * «Уменьшение движения» в системе – рисуется один кадр.
 */

export interface AnimColors {
  bg: string;
  fg: string;
  muted: string;
  line: string;
  accent: string;
  accent2: string;
  /** Цвет «сбоя»: ошибка для 4xx/5xx и офлайна, второй акцент для остальных. */
  alert: string;
  warn: string;
  ok: string;
}

export interface AnimEnv {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  colors: AnimColors;
  /** Текст в анимации: код состояния («404») или «000» для офлайна. */
  label: string;
  rand: () => number;
  pointer: { x: number; y: number; active: boolean };
}

type Frame = (t: number, dt: number) => void;

export interface StatusAnimation {
  id: string;
  name: string;
  setup(env: AnimEnv): Frame;
}

// ─── утилиты ─────────────────────────────────────────────

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** «#RRGGBB» + прозрачность → rgba(). */
export function alpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${clamp(a, 0, 1).toFixed(3)})`;
}

/** Гладкий псевдошум из синусов: дёшево и без таблиц. */
const wobble = (x: number, seed: number) => Math.sin(x * 1.7 + seed) * 0.5 + Math.sin(x * 3.1 + seed * 2.3) * 0.3 + Math.sin(x * 5.3 + seed * 0.7) * 0.2;

const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function clear(e: AnimEnv) {
  e.ctx.clearRect(0, 0, e.w, e.h);
}

// ─── 1. Обрыв линии ─────────────────────────────────────

const powerline: StatusAnimation = {
  id: 'powerline',
  name: 'Обрыв линии',
  setup(e) {
    const { ctx, colors } = e;
    const ground = e.h * 0.86;
    const xs = [0.12, 0.5, 0.88].map((k) => e.w * k);
    const top = e.h * 0.2;
    const arms = [0, 0.1, 0.2].map((k) => top + (ground - top) * k);
    const broken = 1 + Math.floor(e.rand() * 2);
    type Spark = { x: number; y: number; vx: number; vy: number; life: number };
    const sparks: Spark[] = [];
    let flash = 0;

    const pylon = (x: number) => {
      ctx.strokeStyle = colors.fg;
      ctx.lineWidth = 1.4;
      const half = Math.min(e.w * 0.04, 26);
      ctx.beginPath();
      ctx.moveTo(x - half, ground);
      ctx.lineTo(x - 3, top);
      ctx.lineTo(x + 3, top);
      ctx.lineTo(x + half, ground);
      const rungs = 6;
      for (let i = 0; i < rungs; i++) {
        const k1 = i / rungs;
        const k2 = (i + 1) / rungs;
        const y1 = lerp(ground, top, k1);
        const y2 = lerp(ground, top, k2);
        const w1 = lerp(half, 3, k1);
        const w2 = lerp(half, 3, k2);
        ctx.moveTo(x - w1, y1);
        ctx.lineTo(x + w2, y2);
        ctx.moveTo(x + w1, y1);
        ctx.lineTo(x - w2, y2);
      }
      for (const y of arms) {
        const a = Math.min(e.w * 0.05, 34);
        ctx.moveTo(x - a, y);
        ctx.lineTo(x + a, y);
      }
      ctx.stroke();
    };

    return (t, dt) => {
      clear(e);
      ctx.strokeStyle = alpha(colors.muted, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, ground + 0.5);
      ctx.lineTo(e.w, ground + 0.5);
      ctx.stroke();
      for (const x of xs) pylon(x);
      const armW = Math.min(e.w * 0.05, 34);
      arms.forEach((y, wi) => {
        for (let span = 0; span < xs.length - 1; span++) {
          const x1 = xs[span]! + armW;
          const x2 = xs[span + 1]! - armW;
          const sag = (e.h * 0.09 + wi * 4) * (1 + 0.05 * Math.sin(t * 0.8 + span + wi));
          if (span === 1 && wi === broken) {
            // Обрыв: два свисающих конца качаются, на одном – искры
            const len = (x2 - x1) * 0.38;
            const swing = Math.sin(t * 1.6) * 0.35;
            const swing2 = Math.sin(t * 1.3 + 1) * 0.3;
            const endL = { x: x1 + Math.sin(swing) * len * 0.6 + len * 0.25, y: y + Math.cos(swing) * len };
            const endR = { x: x2 - Math.sin(swing2) * len * 0.6 - len * 0.25, y: y + Math.cos(swing2) * len * 0.9 };
            ctx.strokeStyle = colors.alert;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.quadraticCurveTo(x1 + len * 0.45, y + len * 0.1, endL.x, endL.y);
            ctx.moveTo(x2, y);
            ctx.quadraticCurveTo(x2 - len * 0.45, y + len * 0.1, endR.x, endR.y);
            ctx.stroke();
            if (e.rand() < 0.5) for (let i = 0; i < 3; i++) sparks.push({ x: endL.x, y: endL.y, vx: (e.rand() - 0.5) * 160, vy: -e.rand() * 140, life: 0.5 + e.rand() * 0.6 });
            if (e.rand() < 0.012) flash = 1;
            if (flash > 0) {
              ctx.fillStyle = alpha(colors.warn, flash * 0.35);
              ctx.beginPath();
              ctx.arc(endL.x, endL.y, 30 + (1 - flash) * 40, 0, TAU);
              ctx.fill();
              flash = Math.max(0, flash - dt * 3);
            }
          } else {
            ctx.strokeStyle = alpha(colors.accent, 0.85);
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.quadraticCurveTo((x1 + x2) / 2, y + sag * 2, x2, y);
            ctx.stroke();
            // Ток по целым проводам
            const k = (t * 0.35 + span * 0.3 + wi * 0.2) % 1;
            const px = lerp(x1, x2, k);
            const py = y + sag * 2 * 2 * k * (1 - k);
            ctx.fillStyle = colors.accent;
            ctx.beginPath();
            ctx.arc(px, py, 2.2, 0, TAU);
            ctx.fill();
          }
        }
      });
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]!;
        p.vy += 420 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0 || p.y > ground) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = alpha(i % 3 ? colors.warn : colors.alert, clamp(p.life * 1.6, 0, 1));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      }
    };
  },
};

// ─── 2. Осциллограф ─────────────────────────────────────

const scope: StatusAnimation = {
  id: 'scope',
  name: 'Осциллограф трёх фаз',
  setup(e) {
    const { ctx, colors } = e;
    const phases = [colors.accent, colors.accent2, colors.fg];
    let glitch = { phase: -1, until: 0, next: 2 + e.rand() * 2 };
    return (t) => {
      clear(e);
      const step = Math.max(28, Math.round(e.w / 16));
      ctx.strokeStyle = alpha(colors.muted, 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = (e.w % step) / 2; x < e.w; x += step) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, e.h);
      }
      for (let y = (e.h % step) / 2; y < e.h; y += step) {
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(e.w, Math.round(y) + 0.5);
      }
      ctx.stroke();
      ctx.strokeStyle = alpha(colors.muted, 0.45);
      ctx.beginPath();
      ctx.moveTo(0, e.h / 2 + 0.5);
      ctx.lineTo(e.w, e.h / 2 + 0.5);
      ctx.stroke();
      if (t > glitch.next) glitch = { phase: Math.floor(e.rand() * 3), until: t + 1.2, next: t + 3 + e.rand() * 3 };
      const amp = e.h * 0.28;
      const period = e.w / 2.2;
      phases.forEach((c, k) => {
        const broken = glitch.phase === k && t < glitch.until;
        ctx.strokeStyle = broken ? colors.alert : alpha(c, 0.9);
        ctx.lineWidth = broken ? 1.8 : 1.6;
        ctx.beginPath();
        for (let x = 0; x <= e.w; x += 3) {
          const base = Math.sin((x / period) * TAU - t * 2.4 + (k * TAU) / 3);
          const decay = broken ? clamp((glitch.until - t) / 1.2, 0, 1) : 1;
          const noise = broken ? (e.rand() - 0.5) * 0.35 : 0;
          const y = e.h / 2 - (base * decay + noise) * amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
    };
  },
};

// ─── 3. Энергосеть ──────────────────────────────────────

const network: StatusAnimation = {
  id: 'network',
  name: 'Энергосеть с отказом узла',
  setup(e) {
    const { ctx, colors } = e;
    const cols = Math.max(4, Math.round(e.w / 110));
    const rows = Math.max(3, Math.round(e.h / 95));
    const nodes: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) nodes.push({ x: ((c + 0.5) / cols) * e.w + (e.rand() - 0.5) * (e.w / cols) * 0.5, y: ((r + 0.5) / rows) * e.h + (e.rand() - 0.5) * (e.h / rows) * 0.5 });
    const edges: [number, number][] = [];
    nodes.forEach((n, i) => {
      const near = nodes
        .map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      for (const { j } of near) if (!edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) edges.push([i, j]);
    });
    type Pulse = { edge: number; k: number; dir: 1 | -1; speed: number };
    const pulses: Pulse[] = [];
    let failed = Math.floor(e.rand() * nodes.length);
    let nextFail = 4;
    return (t, dt) => {
      clear(e);
      if (t > nextFail) {
        failed = Math.floor(e.rand() * nodes.length);
        nextFail = t + 4 + e.rand() * 2;
      }
      while (pulses.length < edges.length * 0.6) pulses.push({ edge: Math.floor(e.rand() * edges.length), k: 0, dir: e.rand() < 0.5 ? 1 : -1, speed: 0.3 + e.rand() * 0.5 });
      edges.forEach(([a, b]) => {
        const A = nodes[a]!;
        const B = nodes[b]!;
        const dead = a === failed || b === failed;
        ctx.strokeStyle = dead ? alpha(colors.alert, 0.5) : alpha(colors.muted, 0.35);
        ctx.setLineDash(dead ? [4, 5] : []);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]!;
        const [a, b] = edges[p.edge]!;
        if (a === failed || b === failed) {
          pulses.splice(i, 1);
          continue;
        }
        p.k += p.speed * dt;
        if (p.k >= 1) {
          pulses.splice(i, 1);
          continue;
        }
        const A = nodes[p.dir === 1 ? a : b]!;
        const B = nodes[p.dir === 1 ? b : a]!;
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(lerp(A.x, B.x, p.k), lerp(A.y, B.y, p.k), 2.4, 0, TAU);
        ctx.fill();
      }
      nodes.forEach((n, i) => {
        const dead = i === failed;
        const blink = dead ? 0.5 + 0.5 * Math.sin(t * 9) : 1;
        ctx.fillStyle = dead ? alpha(colors.alert, blink) : colors.bg;
        ctx.strokeStyle = dead ? colors.alert : colors.fg;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(n.x, n.y, dead ? 6 : 4.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (dead) {
          ctx.strokeStyle = alpha(colors.alert, 0.4 * (1 - ((t * 1.5) % 1)));
          ctx.beginPath();
          ctx.arc(n.x, n.y, 6 + ((t * 1.5) % 1) * 22, 0, TAU);
          ctx.stroke();
        }
      });
    };
  },
};

// ─── 4. Ячейки батареи ──────────────────────────────────

const battery: StatusAnimation = {
  id: 'battery',
  name: 'Ячейки накопителя',
  setup(e) {
    const { ctx, colors } = e;
    const n = e.w < 420 ? 5 : 7;
    const cw = Math.min(56, (e.w * 0.8) / n - 12);
    const ch = Math.min(e.h * 0.6, cw * 2.3);
    const gap = Math.min(18, cw * 0.35);
    const x0 = (e.w - n * cw - (n - 1) * gap) / 2;
    const y0 = (e.h - ch) / 2 + 6;
    const cells = Array.from({ length: n }, () => ({ speed: 0.25 + e.rand() * 0.5, phase: e.rand() * TAU, bubbles: [] as { x: number; y: number; r: number }[] }));
    return (t, dt) => {
      clear(e);
      cells.forEach((c, i) => {
        const x = x0 + i * (cw + gap);
        const level = 0.5 + 0.47 * Math.sin(t * c.speed + c.phase);
        const charging = Math.cos(t * c.speed + c.phase) > 0;
        const color = level < 0.22 ? colors.alert : level < 0.5 ? colors.warn : colors.ok;
        ctx.strokeStyle = colors.fg;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x + 0.5, y0 + 0.5, cw, ch);
        ctx.fillStyle = colors.fg;
        ctx.fillRect(x + cw * 0.3, y0 - 6, cw * 0.4, 5);
        const fh = (ch - 6) * level;
        ctx.fillStyle = alpha(color, 0.8);
        ctx.fillRect(x + 3.5, y0 + ch - 2.5 - fh, cw - 6, fh);
        if (charging && e.rand() < dt * 6) c.bubbles.push({ x: x + 6 + e.rand() * (cw - 12), y: y0 + ch - 4, r: 1 + e.rand() * 2 });
        for (let b = c.bubbles.length - 1; b >= 0; b--) {
          const bb = c.bubbles[b]!;
          bb.y -= dt * 30;
          if (bb.y < y0 + ch - 2.5 - fh + bb.r) {
            c.bubbles.splice(b, 1);
            continue;
          }
          ctx.strokeStyle = alpha(colors.bg, 0.8);
          ctx.beginPath();
          ctx.arc(bb.x, bb.y, bb.r, 0, TAU);
          ctx.stroke();
        }
        // Стрелка: заряд вверх, разряд вниз
        ctx.strokeStyle = charging ? colors.accent : colors.muted;
        ctx.lineWidth = 1.4;
        const ax = x + cw / 2;
        const ay = y0 + ch + 18;
        ctx.beginPath();
        ctx.moveTo(ax, ay + (charging ? 6 : -6));
        ctx.lineTo(ax, ay + (charging ? -6 : 6));
        ctx.moveTo(ax - 4, ay + (charging ? -2 : 2));
        ctx.lineTo(ax, ay + (charging ? -6 : 6));
        ctx.lineTo(ax + 4, ay + (charging ? -2 : 2));
        ctx.stroke();
        ctx.fillStyle = colors.muted;
        ctx.font = `500 ${Math.max(9, Math.min(12, cw * 0.22))}px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(level * 100)}%`, ax, y0 - 12);
      });
    };
  },
};

// ─── 5. Ветряки ─────────────────────────────────────────

const turbines: StatusAnimation = {
  id: 'turbines',
  name: 'Ветряки и порывы ветра',
  setup(e) {
    const { ctx, colors } = e;
    const ground = e.h * 0.9;
    const items = [0.2, 0.47, 0.78].map((k, i) => ({ x: e.w * k, hgt: e.h * (0.42 + i * 0.1 - (i === 2 ? 0.17 : 0)), speed: 0.8 + e.rand() * 1.4, angle: e.rand() * TAU, stall: e.rand() < 0.5 }));
    const streaks = Array.from({ length: 14 }, () => ({ x: e.rand() * e.w, y: e.rand() * ground * 0.8, len: 20 + e.rand() * 60, v: 60 + e.rand() * 120 }));
    return (t, dt) => {
      clear(e);
      ctx.strokeStyle = alpha(colors.muted, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, ground + 0.5);
      ctx.lineTo(e.w, ground + 0.5);
      ctx.stroke();
      for (const s of streaks) {
        s.x += s.v * dt;
        if (s.x - s.len > e.w) {
          s.x = -e.rand() * 80;
          s.y = e.rand() * ground * 0.8;
        }
        ctx.strokeStyle = alpha(colors.accent2, 0.3);
        ctx.beginPath();
        ctx.moveTo(s.x - s.len, s.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      for (const it of items) {
        // У одного ветряка ротор то и дело «встаёт» – как при отказе
        const gust = it.stall ? Math.max(0, Math.sin(t * 0.5)) : 0.6 + 0.4 * Math.sin(t * 0.7 + it.x);
        it.angle += it.speed * gust * dt * 2;
        const hubY = ground - it.hgt;
        ctx.strokeStyle = colors.fg;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(it.x - 4, ground);
        ctx.lineTo(it.x - 1.5, hubY);
        ctx.lineTo(it.x + 1.5, hubY);
        ctx.lineTo(it.x + 4, ground);
        ctx.stroke();
        const blade = it.hgt * 0.42;
        ctx.strokeStyle = it.stall && gust < 0.05 ? colors.alert : colors.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let b = 0; b < 3; b++) {
          const a = it.angle + (b * TAU) / 3;
          ctx.moveTo(it.x, hubY);
          ctx.lineTo(it.x + Math.cos(a) * blade, hubY + Math.sin(a) * blade);
        }
        ctx.stroke();
        ctx.fillStyle = colors.bg;
        ctx.strokeStyle = colors.fg;
        ctx.beginPath();
        ctx.arc(it.x, hubY, 3.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    };
  },
};

// ─── 6. Солнечное поле ──────────────────────────────────

const solar: StatusAnimation = {
  id: 'solar',
  name: 'Солнечное поле под облаками',
  setup(e) {
    const { ctx, colors } = e;
    const rows = 3;
    const perRow = e.w < 420 ? 4 : 7;
    const clouds = Array.from({ length: 3 }, (_, i) => ({ x: e.rand() * e.w, y: e.h * (0.12 + i * 0.08), s: 0.7 + e.rand() * 0.6, v: 12 + e.rand() * 18 }));
    return (t, dt) => {
      clear(e);
      const day = (t * 0.06) % 1;
      const sx = lerp(e.w * 0.1, e.w * 0.9, day);
      const sy = e.h * 0.55 - Math.sin(day * Math.PI) * e.h * 0.42;
      const height = Math.sin(day * Math.PI);
      ctx.strokeStyle = alpha(colors.warn, 0.5);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let r = 0; r < 12; r++) {
        const a = (r / 12) * TAU + t * 0.2;
        ctx.moveTo(sx + Math.cos(a) * 16, sy + Math.sin(a) * 16);
        ctx.lineTo(sx + Math.cos(a) * 24, sy + Math.sin(a) * 24);
      }
      ctx.stroke();
      ctx.fillStyle = alpha(colors.warn, 0.85);
      ctx.beginPath();
      ctx.arc(sx, sy, 11, 0, TAU);
      ctx.fill();
      for (const c of clouds) {
        c.x += c.v * dt;
        if (c.x - 80 * c.s > e.w) c.x = -80 * c.s;
        ctx.fillStyle = alpha(colors.muted, 0.28);
        ctx.beginPath();
        for (const [dx, dy, r] of [[-26, 4, 16], [0, -4, 22], [26, 4, 16], [10, 8, 14]] as const) ctx.arc(c.x + dx * c.s, c.y + dy * c.s, r * c.s, 0, TAU);
        ctx.fill();
      }
      const fieldTop = e.h * 0.62;
      for (let r = 0; r < rows; r++) {
        const y = fieldTop + r * (e.h * 0.11);
        const scale = 0.8 + r * 0.12;
        const pw = ((e.w * 0.86) / perRow) * scale * 0.86;
        const ph = e.h * 0.06 * scale;
        const rowW = perRow * pw * 1.08;
        for (let i = 0; i < perRow; i++) {
          const x = (e.w - rowW) / 2 + i * pw * 1.08;
          const shade = clouds.some((c) => Math.abs(c.x - (x + pw / 2)) < 50 * c.s) ? 0.35 : 1;
          const output = clamp(height * shade, 0, 1);
          ctx.fillStyle = alpha(colors.accent2, 0.15 + output * 0.55);
          ctx.strokeStyle = colors.fg;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + pw * 0.12, y);
          ctx.lineTo(x + pw, y);
          ctx.lineTo(x + pw * 0.88, y + ph);
          ctx.lineTo(x, y + ph);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = alpha(colors.bg, 0.5);
          ctx.beginPath();
          ctx.moveTo(x + pw * 0.53, y);
          ctx.lineTo(x + pw * 0.44, y + ph);
          ctx.stroke();
        }
      }
    };
  },
};

// ─── 7. Счётчик-одометр ─────────────────────────────────

const meter: StatusAnimation = {
  id: 'meter',
  name: 'Барабаны счётчика',
  setup(e) {
    const { ctx, colors } = e;
    const digits = `${e.label}`.split('').map((d) => (/\d/.test(d) ? Number(d) : 0));
    const wheels = [...digits, 0];
    const n = wheels.length;
    const dw = Math.min(64, (e.w * 0.7) / n);
    const dh = dw * 1.5;
    const x0 = (e.w - n * dw - (n - 1) * 6) / 2;
    const y0 = (e.h - dh) / 2;
    const cycle = 5.5;
    return (t) => {
      clear(e);
      ctx.font = `600 ${dw * 0.78}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      wheels.forEach((target, i) => {
        const x = x0 + i * (dw + 6);
        const decimal = i === n - 1;
        // Барабан крутится, замедляется и встаёт на цифру кода; последний (десятые) крутится всегда
        const local = (t - i * 0.25) % cycle;
        const spin = clamp(local / 2.2, 0, 1);
        const eased = 1 - Math.pow(1 - spin, 3);
        const pos = decimal ? t * 1.6 : target + (1 - eased) * (12 + i * 4);
        ctx.fillStyle = decimal ? alpha(colors.alert, 0.12) : alpha(colors.fg, 0.04);
        ctx.fillRect(x, y0, dw, dh);
        ctx.strokeStyle = decimal ? colors.alert : colors.fg;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x + 0.5, y0 + 0.5, dw, dh);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 1, y0 + 1, dw - 2, dh - 2);
        ctx.clip();
        const base = Math.floor(pos);
        const frac = pos - base;
        for (let k = -1; k <= 1; k++) {
          const d = (((base + k) % 10) + 10) % 10;
          const y = y0 + dh / 2 + (k - frac) * dh * 0.9;
          ctx.fillStyle = decimal ? colors.alert : colors.fg;
          ctx.fillText(String(d), x + dw / 2, y + dh * 0.04);
        }
        ctx.restore();
      });
      ctx.fillStyle = colors.muted;
      ctx.font = `500 ${Math.max(11, dw * 0.22)}px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.fillText('kWh', x0 + n * (dw + 6) + 4, y0 + dh - 8);
      ctx.strokeStyle = alpha(colors.muted, 0.4);
      ctx.strokeRect(x0 - 10.5, y0 - 10.5, n * (dw + 6) + 15, dh + 21);
    };
  },
};

// ─── 8. Частицы кода ────────────────────────────────────

function textPoints(label: string, w: number, h: number, gap: number): { x: number; y: number }[] {
  if (typeof document === 'undefined') return [];
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(w));
  c.height = Math.max(1, Math.floor(h));
  const g = c.getContext('2d');
  if (!g) return [];
  const size = Math.min(h * 0.62, (w * 0.82) / Math.max(1, label.length) / 0.62);
  g.font = `700 ${size}px ${MONO}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#000';
  g.fillText(label, w / 2, h / 2);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y < c.height; y += gap) for (let x = 0; x < c.width; x += gap) if (data[(y * c.width + x) * 4 + 3]! > 128) pts.push({ x, y });
  return pts;
}

const particles: StatusAnimation = {
  id: 'particles',
  name: 'Частицы собирают код',
  setup(e) {
    const { ctx, colors } = e;
    const gap = e.w < 420 ? 5 : 6;
    const targets = textPoints(e.label, e.w, e.h, gap);
    const ps = targets.map((p) => ({ tx: p.x, ty: p.y, x: e.rand() * e.w, y: e.rand() * e.h, vx: 0, vy: 0, c: e.rand() < 0.2 ? colors.accent2 : colors.accent }));
    let scatterAt = 6;
    return (t, dt) => {
      clear(e);
      const scatter = t > scatterAt && t < scatterAt + 0.25;
      if (t > scatterAt + 0.25) scatterAt = t + 6 + e.rand() * 2;
      for (const p of ps) {
        if (scatter) {
          const a = e.rand() * TAU;
          p.vx += Math.cos(a) * 600 * dt * 4;
          p.vy += Math.sin(a) * 600 * dt * 4;
        }
        const ax = (p.tx + wobble(t + p.tx * 0.02, p.ty) * 2 - p.x) * 6;
        const ay = (p.ty + wobble(t + p.ty * 0.02, p.tx) * 2 - p.y) * 6;
        p.vx = (p.vx + ax * dt) * 0.9;
        p.vy = (p.vy + ay * dt) * 0.9;
        if (e.pointer.active) {
          const dx = p.x - e.pointer.x;
          const dy = p.y - e.pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 3600) {
            const f = (1 - d2 / 3600) * 900 * dt;
            const d = Math.sqrt(d2) || 1;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }
        p.x += p.vx * dt * 10;
        p.y += p.vy * dt * 10;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
      }
    };
  },
};

// ─── 9. Поиск сигнала ───────────────────────────────────

const radar: StatusAnimation = {
  id: 'radar',
  name: 'Поиск сигнала',
  setup(e) {
    const { ctx, colors } = e;
    const cx = e.w / 2;
    const cy = e.h / 2;
    const R = Math.min(e.w, e.h) * 0.42;
    const blips = Array.from({ length: 9 }, () => ({ a: e.rand() * TAU, r: (0.2 + e.rand() * 0.75) * R, glow: 0, lost: e.rand() < 0.3 }));
    let prev = 0;
    return (t, dt) => {
      clear(e);
      ctx.strokeStyle = alpha(colors.muted, 0.3);
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (R * i) / 4, 0, TAU);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.stroke();
      const a = (t * 1.3) % TAU;
      for (let i = 0; i < 40; i++) {
        const aa = a - (i / 40) * 0.9;
        ctx.strokeStyle = alpha(colors.accent, 0.5 * (1 - i / 40));
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(aa) * R, cy + Math.sin(aa) * R);
        ctx.stroke();
      }
      for (const b of blips) {
        const passed = ((a - b.a + TAU) % TAU) < ((a - prev + TAU) % TAU) + 0.001;
        if (passed) b.glow = 1;
        b.glow = Math.max(0, b.glow - dt * 0.5);
        if (b.glow <= 0) continue;
        const color = b.lost ? colors.alert : colors.accent;
        ctx.fillStyle = alpha(color, b.glow);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(b.a) * b.r, cy + Math.sin(b.a) * b.r, 3.5, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = alpha(color, b.glow * 0.5);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(b.a) * b.r, cy + Math.sin(b.a) * b.r, 3.5 + (1 - b.glow) * 14, 0, TAU);
        ctx.stroke();
      }
      prev = a;
      ctx.fillStyle = colors.fg;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, TAU);
      ctx.fill();
    };
  },
};

// ─── 10. Электрическая дуга ─────────────────────────────

const arc: StatusAnimation = {
  id: 'arc',
  name: 'Электрическая дуга',
  setup(e) {
    const { ctx, colors } = e;
    const y = e.h / 2;
    const left = e.w * 0.18;
    const right = e.w * 0.82;
    let path: { x: number; y: number }[] = [];
    let branches: { x: number; y: number }[][] = [];
    let regen = 0;
    let breakUntil = 0;
    let nextBreak = 3 + e.rand() * 2;
    // Срединное смещение с медленным затуханием – излом на всех масштабах, как у настоящей дуги
    const bolt = (x1: number, y1: number, x2: number, y2: number, disp: number, out: { x: number; y: number }[]) => {
      if (Math.hypot(x2 - x1, y2 - y1) < 7) {
        out.push({ x: x2, y: y2 });
        return;
      }
      const mx = (x1 + x2) / 2 + (e.rand() - 0.5) * disp * 0.4;
      const my = (y1 + y2) / 2 + (e.rand() - 0.5) * disp;
      bolt(x1, y1, mx, my, disp * 0.6, out);
      bolt(mx, my, x2, y2, disp * 0.6, out);
    };
    return (t) => {
      clear(e);
      if (t > nextBreak) {
        breakUntil = t + 0.6 + e.rand() * 0.5;
        nextBreak = t + 3 + e.rand() * 3;
      }
      const elH = e.h * 0.32;
      ctx.fillStyle = colors.fg;
      ctx.fillRect(left - 14, y - elH / 2, 10, elH);
      ctx.fillRect(right + 4, y - elH / 2, 10, elH);
      if (t > regen) {
        path = [{ x: left, y }];
        bolt(left, y, right, y, e.h * 0.6, path);
        branches = [];
        for (let i = 0; i < 2 + Math.floor(e.rand() * 3); i++) {
          const from = path[Math.floor(path.length * (0.15 + e.rand() * 0.7))]!;
          const a = (e.rand() < 0.5 ? -1 : 1) * (0.4 + e.rand() * 0.9);
          const len = e.h * (0.08 + e.rand() * 0.14);
          const b = [from];
          bolt(from.x, from.y, from.x + Math.cos(a) * len * 0.6, from.y + Math.sin(a) * len, len * 0.5, b);
          branches.push(b);
        }
        regen = t + 0.05 + e.rand() * 0.05;
      }
      const broken = t < breakUntil;
      if (!broken) {
        for (const [wdt, a] of [[9, 0.12], [4, 0.3], [1.6, 1]] as const) {
          ctx.strokeStyle = alpha(colors.accent, a);
          ctx.lineWidth = wdt;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
        }
        ctx.strokeStyle = alpha(colors.accent, 0.55);
        ctx.lineWidth = 1;
        for (const b of branches) {
          ctx.beginPath();
          b.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
        }
      } else {
        for (const x of [left, right]) {
          ctx.strokeStyle = colors.alert;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const a = e.rand() * TAU;
            const l = 6 + e.rand() * 14;
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
          }
          ctx.stroke();
        }
      }
    };
  },
};

// ─── 11. Потерянные пакеты ──────────────────────────────

const packets: StatusAnimation = {
  id: 'packets',
  name: 'Потерянные пакеты',
  setup(e) {
    const { ctx, colors } = e;
    const lanes = Math.max(3, Math.min(6, Math.round(e.h / 55)));
    const x1 = e.w * 0.1;
    const x2 = e.w * 0.9;
    type P = { lane: number; x: number; v: number; lostAt: number; fall: number };
    const ps: P[] = [];
    return (_t, dt) => {
      clear(e);
      const laneY = (i: number) => e.h * 0.15 + (i * e.h * 0.7) / (lanes - 1);
      if (e.rand() < dt * 3) ps.push({ lane: Math.floor(e.rand() * lanes), x: x1, v: 70 + e.rand() * 90, lostAt: e.rand() < 0.35 ? lerp(x1, x2, 0.3 + e.rand() * 0.5) : Infinity, fall: 0 });
      for (let i = 0; i < lanes; i++) {
        const y = laneY(i);
        ctx.strokeStyle = alpha(colors.muted, 0.3);
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const x of [x1, x2]) {
        ctx.strokeStyle = colors.fg;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x - 7, laneY(0) - 14, 14, laneY(lanes - 1) - laneY(0) + 28);
      }
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]!;
        let y = laneY(p.lane);
        if (p.x >= p.lostAt) {
          p.fall += dt;
          y += p.fall * p.fall * 260;
          ctx.globalAlpha = clamp(1 - p.fall * 1.4, 0, 1);
          ctx.strokeStyle = colors.alert;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(p.x - 5, y - 5);
          ctx.lineTo(p.x + 5, y + 5);
          ctx.moveTo(p.x + 5, y - 5);
          ctx.lineTo(p.x - 5, y + 5);
          ctx.stroke();
          ctx.globalAlpha = 1;
          if (p.fall > 0.8) ps.splice(i, 1);
          continue;
        }
        p.x += p.v * dt;
        if (p.x > x2) {
          ps.splice(i, 1);
          continue;
        }
        ctx.fillStyle = colors.accent;
        ctx.fillRect(p.x - 9, y - 4, 18, 8);
        ctx.fillStyle = alpha(colors.accent, 0.25);
        ctx.fillRect(p.x - 30, y - 1, 20, 2);
      }
    };
  },
};

// ─── 12. Интерференция ──────────────────────────────────

const waves: StatusAnimation = {
  id: 'waves',
  name: 'Интерференция волн',
  setup(e) {
    const { ctx, colors } = e;
    const step = e.w < 420 ? 12 : 15;
    const k = TAU / 56;
    return (t) => {
      clear(e);
      const s1 = { x: e.w * (0.35 + 0.08 * Math.sin(t * 0.3)), y: e.h * 0.5 };
      const s2 = { x: e.w * (0.65 + 0.08 * Math.cos(t * 0.27)), y: e.h * (0.5 + 0.1 * Math.sin(t * 0.4)) };
      for (let y = step / 2; y < e.h; y += step) {
        for (let x = step / 2; x < e.w; x += step) {
          const d1 = Math.hypot(x - s1.x, y - s1.y);
          const d2 = Math.hypot(x - s2.x, y - s2.y);
          const v = (Math.sin(k * d1 - t * 3) + Math.sin(k * d2 - t * 3)) / 2;
          const r = Math.abs(v) * step * 0.36;
          if (r < 0.4) continue;
          ctx.fillStyle = v > 0 ? alpha(colors.accent, 0.25 + Math.abs(v) * 0.6) : alpha(colors.accent2, 0.15 + Math.abs(v) * 0.4);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.fill();
        }
      }
      for (const s of [s1, s2]) {
        ctx.fillStyle = colors.fg;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, TAU);
        ctx.fill();
      }
    };
  },
};

// ─── 13. Пульс сети ─────────────────────────────────────

const pulse: StatusAnimation = {
  id: 'pulse',
  name: 'Пульс сети',
  setup(e) {
    const { ctx, colors } = e;
    const n = Math.ceil(e.w / 2);
    const ys = new Float32Array(n).fill(0);
    const flat = new Uint8Array(n);
    let head = 0;
    let beatPhase = 0;
    let flatBeat = false;
    const shape = (p: number) => {
      // P – QRS – T
      if (p < 0.1) return Math.sin((p / 0.1) * Math.PI) * 0.12;
      if (p < 0.16) return 0;
      if (p < 0.19) return -((p - 0.16) / 0.03) * 0.2;
      if (p < 0.22) return lerp(-0.2, 1, (p - 0.19) / 0.03);
      if (p < 0.26) return lerp(1, -0.35, (p - 0.22) / 0.04);
      if (p < 0.3) return lerp(-0.35, 0, (p - 0.26) / 0.04);
      if (p < 0.42) return 0;
      if (p < 0.6) return Math.sin(((p - 0.42) / 0.18) * Math.PI) * 0.25;
      return 0;
    };
    return (_t, dt) => {
      clear(e);
      const speed = Math.max(1, Math.round(dt * 160));
      for (let s = 0; s < speed; s++) {
        beatPhase += 1 / 110;
        if (beatPhase >= 1) {
          beatPhase = 0;
          flatBeat = e.rand() < 0.25;
        }
        ys[head] = flatBeat ? (e.rand() - 0.5) * 0.02 : shape(beatPhase);
        flat[head] = flatBeat ? 1 : 0;
        head = (head + 1) % n;
      }
      const mid = e.h * 0.58;
      const amp = e.h * 0.32;
      ctx.lineWidth = 1.8;
      for (let i = 1; i < n; i++) {
        const idx = (head + i) % n;
        const prevIdx = (head + i - 1) % n;
        const age = i / n;
        ctx.strokeStyle = alpha(flat[idx] ? colors.alert : colors.accent, age * age);
        ctx.beginPath();
        ctx.moveTo((i - 1) * 2, mid - ys[prevIdx]! * amp);
        ctx.lineTo(i * 2, mid - ys[idx]! * amp);
        ctx.stroke();
      }
      ctx.fillStyle = flatBeat ? colors.alert : colors.accent;
      ctx.beginPath();
      ctx.arc((n - 1) * 2, mid - ys[(head + n - 1) % n]! * amp, 3.5, 0, TAU);
      ctx.fill();
    };
  },
};

export const STATUS_ANIMATIONS: readonly StatusAnimation[] = [powerline, scope, network, battery, turbines, solar, meter, particles, radar, arc, packets, waves, pulse];

const LAST_KEY = 'el.status.anim';

/** Случайная анимация, отличная от показанной в прошлый раз (у каждой загрузки страницы – новая). */
export function pickAnimation(force?: string | null): StatusAnimation {
  const forced = force ? STATUS_ANIMATIONS.find((a) => a.id === force) : undefined;
  if (forced) return forced;
  let last: string | null = null;
  try {
    last = sessionStorage.getItem(LAST_KEY);
  } catch {
    /* хранилище недоступно – просто случайная */
  }
  const pool = STATUS_ANIMATIONS.filter((a) => a.id !== last);
  const choice = pool[Math.floor(Math.random() * pool.length)] ?? STATUS_ANIMATIONS[0]!;
  try {
    sessionStorage.setItem(LAST_KEY, choice.id);
  } catch {
    /* не запомнили – повтор возможен, это не ошибка */
  }
  return choice;
}

export interface RunningAnimation {
  id: string;
  name: string;
  stop(): void;
}

/** Запустить анимацию на canvas: размер по контейнеру, плотность пикселей, пауза в скрытой вкладке. */
export function startStatusAnimation(canvas: HTMLCanvasElement, opts: { label: string; colors: AnimColors; animation?: StatusAnimation; reducedMotion?: boolean }): RunningAnimation {
  const anim = opts.animation ?? pickAnimation();
  const ctx = canvas.getContext('2d');
  if (!ctx) return { id: anim.id, name: anim.name, stop: () => {} };
  const pointer = { x: 0, y: 0, active: false };
  const reduced = opts.reducedMotion ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let frame: Frame | null = null;
  let raf = 0;
  let last = 0;
  let t = 0;
  let stopped = false;

  const setup = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    frame = anim.setup({ ctx, w, h, colors: opts.colors, label: opts.label, rand: Math.random, pointer });
    if (reduced) {
      // Один осмысленный кадр: частицы успевают собраться, барабаны – встать
      for (let i = 0; i < 150; i++) frame((t += 1 / 60), 1 / 60);
    }
  };

  const loop = (now: number) => {
    if (stopped) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    t += dt;
    frame?.(t, dt);
    raf = requestAnimationFrame(loop);
  };

  setup();
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => setup()) : null;
  ro?.observe(canvas);
  const move = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ev.clientX - r.left;
    pointer.y = ev.clientY - r.top;
    pointer.active = true;
  };
  const leave = () => (pointer.active = false);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerleave', leave);
  if (!reduced) raf = requestAnimationFrame(loop);

  return {
    id: anim.id,
    name: anim.name,
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
    },
  };
}
