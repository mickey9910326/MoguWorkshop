// Illustrative screenshots of mogugi drawn as SVG. Every colour is a CSS
// variable, so they follow the site theme. Names and numbers are made up.

const NUM_FONT = 'font-family="Chakra Petch, sans-serif"';

function win(w, h, title, body) {
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${title} 示意圖">`
    + `<rect width="${w}" height="${h}" fill="var(--bg-2)"/>`
    + `<rect width="${w}" height="26" fill="var(--surface-2)"/>`
    + `<circle cx="14" cy="13" r="4" fill="var(--cap)"/><text x="26" y="17" font-size="11" fill="var(--muted)" ${NUM_FONT}>MOGUGI</text>`
    + `${body}</svg>`;
}

function tabs(list, on, y) {
  let x = 12;
  let out = '';
  list.forEach((t, i) => {
    const w = t.length * 12 + 18;
    out += `<rect x="${x}" y="${y}" width="${w}" height="20" rx="6" fill="${i === on ? 'var(--accent)' : 'var(--surface)'}"/>`
      + `<text x="${x + 9}" y="${y + 14}" font-size="11" fill="${i === on ? 'var(--accent-ink)' : 'var(--muted)'}">${t}</text>`;
    x += w + 6;
  });
  return out;
}

function bars(x, y, w, rows) {
  const max = rows[0][1];
  return rows.map((r, i) => {
    const yy = y + i * 22;
    const bw = (w - 90) * r[1] / max;
    const fill = i === 0 ? 'var(--accent)' : `rgba(var(--accent-rgb), ${(0.75 - i * 0.12).toFixed(2)})`;
    return `<text x="${x}" y="${yy + 12}" font-size="11" fill="var(--ink)">${r[0]}</text>`
      + `<rect x="${x + 58}" y="${yy + 2}" width="${w - 90}" height="12" rx="4" fill="var(--surface)"/>`
      + `<rect x="${x + 58}" y="${yy + 2}" width="${bw}" height="12" rx="4" fill="${fill}"/>`
      + `<text x="${x + w - 4}" y="${yy + 12}" font-size="10" text-anchor="end" fill="var(--muted)" ${NUM_FONT}>${r[2]}</text>`;
  }).join('');
}

function line(x, y, w, h, pts, color, fill) {
  const step = w / (pts.length - 1);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(x + i * step).toFixed(1)} ${(y + h - v * h).toFixed(1)}`).join('');
  const area = fill ? `<path d="${d} L${x + w} ${y + h} L${x} ${y + h}Z" fill="rgba(var(--accent-rgb), .15)"/>` : '';
  return `${area}<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
}

function grid(x, y, w, h, n) {
  let out = '';
  for (let i = 0; i <= n; i++) {
    const yy = y + h * i / n;
    out += `<line x1="${x}" x2="${x + w}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-width="1" opacity=".6"/>`;
  }
  return out;
}

const dps = [0.2, 0.45, 0.62, 0.58, 0.7, 0.82, 0.76, 0.9, 0.86, 0.94, 0.8, 0.88, 0.97, 0.92, 0.85, 0.9];
const dps2 = [0.1, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.58, 0.62, 0.66, 0.6, 0.64, 0.7, 0.68, 0.62, 0.66];
const party = [['魔古', 100, '41.2M'], ['小麻古', 82, '33.8M'], ['抹古', 64, '26.4M'], ['Irusan', 47, '19.3M']];

export const SHOTS = {
  battle() {
    const cc = [[30, 120, '崩壞的波動'], [180, 90, '倒吊人'], [300, 120, '戰場序曲']].map((c, i) =>
      `<rect x="${300 + c[0] * 0.9}" y="${236 + i * 16}" width="${c[1] * 0.9}" height="11" rx="3" fill="rgba(var(--gold-rgb), ${(0.85 - i * 0.2).toFixed(2)})"/>`
      + `<text x="292" y="${245 + i * 16}" font-size="10" text-anchor="end" fill="var(--muted)">${c[2]}</text>`).join('');
    return win(720, 300, '戰鬥分頁',
      tabs(['戰鬥', '角色', '裝備', '物品索引', '紀錄'], 0, 34)
      + '<text x="12" y="80" font-size="12" fill="var(--muted)">目標：格蘭米諾頓</text>'
      + `<text x="12" y="108" font-size="22" font-weight="700" fill="var(--accent)" ${NUM_FONT}>1,284,550</text>`
      + '<text x="140" y="108" font-size="11" fill="var(--muted)">活躍 DPS</text>'
      + bars(12, 124, 240, party)
      + '<rect x="270" y="66" width="440" height="160" rx="8" fill="var(--surface)"/>' + grid(284, 80, 412, 130, 4)
      + line(284, 80, 412, 130, dps, 'var(--accent)', true) + line(284, 80, 412, 130, dps2, 'var(--gold)', false)
      + '<text x="12" y="252" font-size="11" fill="var(--muted)">BOSS CC 時間軸</text>' + cc);
  },
  'battle-mini'() {
    return win(320, 160, '傷害統計', '<rect x="10" y="36" width="300" height="114" rx="6" fill="var(--surface)"/>'
      + grid(20, 46, 280, 94, 3)
      + line(20, 46, 280, 94, dps, 'var(--accent)', true) + line(20, 46, 280, 94, dps2, 'var(--gold)', false));
  },
  log() {
    const rows = [['格蘭米諾頓・地獄', '12:48', true], ['喀輪巴斯深淵', '09:31', true], ['布里萊赫練習模式', '06:02', false], ['格蘭米諾頓・困難', '08:15', true]];
    return win(320, 160, '戰鬥紀錄', rows.map((r, i) => {
      const y = 36 + i * 30;
      return `<rect x="10" y="${y}" width="300" height="24" rx="5" fill="var(--surface)"/>`
        + `<text x="20" y="${y + 16}" font-size="11" fill="var(--ink)">${r[0]}</text>`
        + `<text x="240" y="${y + 16}" font-size="11" fill="var(--muted)" ${NUM_FONT}>${r[1]}</text>`
        + `<circle cx="296" cy="${y + 12}" r="4" fill="${r[2] ? 'var(--accent)' : 'var(--muted)'}"/>`;
    }).join(''));
  },
  char() {
    const st = [['力量', '1,284'], ['敏捷', '1,032'], ['最大傷害', '2,410'], ['暴擊', '38%']];
    let out = '<rect x="10" y="36" width="96" height="114" rx="6" fill="var(--surface)"/><circle cx="58" cy="76" r="22" fill="rgba(var(--accent-rgb), .25)"/>'
      + '<circle cx="58" cy="70" r="9" fill="var(--accent)"/><path d="M42 96a16 12 0 0 1 32 0z" fill="var(--accent)"/>'
      + '<text x="58" y="128" font-size="11" text-anchor="middle" fill="var(--ink)">魔古</text>'
      + '<text x="58" y="142" font-size="9" text-anchor="middle" fill="var(--muted)">旋律人偶師</text>';
    st.forEach((r, i) => {
      const y = 40 + i * 27;
      out += `<text x="120" y="${y + 14}" font-size="11" fill="var(--muted)">${r[0]}</text>`
        + `<text x="306" y="${y + 14}" font-size="12" text-anchor="end" fill="var(--ink)" ${NUM_FONT}>${r[1]}</text>`
        + `<line x1="120" x2="306" y1="${y + 21}" y2="${y + 21}" stroke="var(--line)"/>`;
    });
    return win(320, 160, '角色與裝備', out);
  },
  items() {
    const colors = ['var(--accent)', 'var(--gold)', 'var(--cap)', 'var(--muted)'];
    let out = '';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        const x = 12 + c * 37;
        const y = 38 + r * 38;
        const k = (r * 8 + c) * 7 % 11;
        out += `<rect x="${x}" y="${y}" width="32" height="32" rx="5" fill="var(--surface)" stroke="var(--line)"/>`;
        if (k < 7) out += `<rect x="${x + 8}" y="${y + 8}" width="16" height="16" rx="${k % 2 ? 8 : 3}" fill="${colors[k % 4]}" opacity=".85"/>`;
      }
    }
    return win(320, 160, '物品索引', out);
  },
};

export function fillShots(root = document) {
  for (const el of root.querySelectorAll('[data-shot]')) {
    const draw = Object.hasOwn(SHOTS, el.dataset.shot) ? SHOTS[el.dataset.shot] : null;
    if (draw) el.innerHTML = draw();
  }
}
