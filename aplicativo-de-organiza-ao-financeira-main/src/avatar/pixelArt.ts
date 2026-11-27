/* ==========================================================================
   Pixel art do personagem e dos companheiros (vindo da prévia RPG).
   Apenas apresentação: gera uma grade de cores que o componente Avatar desenha em SVG.
   ========================================================================== */
/* eslint-disable */
export const SKINS = ['#f6d3b3', '#e0ac7e', '#b9784f', '#7a4a2e'];
export const HAIR_COLORS = ['#2b1a12', '#7a4a21', '#d9a441', '#c2453a', '#e8e2f5', '#4b7bd8'];
const INK = '#1a0f2e';
export function mixHex(a: string, b: string, t: number): string {
  const pa = (a.match(/\w\w/g) ?? []).map(h => parseInt(h, 16)), pb = (b.match(/\w\w/g) ?? []).map(h => parseInt(h, 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const dk = (c: string, t = .25) => mixHex(c, '#120a24', t), lt = (c: string, t = .25) => mixHex(c, '#ffffff', t);
export type PixelBuf = { w: number; h: number; px: (string | null)[] }
function makeBuf(w: number, h: number): PixelBuf { return { w, h, px: new Array(w * h).fill(null) }; }
type Painter = { clip: number; P: (x: number, y: number, c: string | null) => void; R: (x: number, y: number, w: number, h: number, c: string | null) => void; H: (y: number, x1: number, x2: number, c: string | null) => void; G: (x: number, y: number, rows: readonly string[], map: Record<string, string>) => void }
function painter(buf: PixelBuf, ox: number, oy: number): Painter {
  const p = { clip: -99 } as Painter;
  p.P = (x, y, c) => { if (!c || y < p.clip) return; x += ox; y += oy; if (x >= 0 && y >= 0 && x < buf.w && y < buf.h) buf.px[y * buf.w + x] = c; };
  p.R = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.P(x + i, y + j, c); };
  p.H = (y, x1, x2, c) => p.R(x1, y, x2 - x1 + 1, 1, c);
  p.G = (x, y, rows, map) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && map[ch]) p.P(x + i, y + j, map[ch]); }));
  return p;
}
function outlineBuf(buf: PixelBuf, color = INK) {
  const { w, h, px } = buf, out = px.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[y * w + x]) continue;
    if ((x > 0 && px[y * w + x - 1]) || (x < w - 1 && px[y * w + x + 1]) || (y > 0 && px[(y - 1) * w + x]) || (y < h - 1 && px[(y + 1) * w + x])) out[y * w + x] = color;
  }
  buf.px = out;
}

/* --- Corpo e rosto --- */
type Tone = { b: string; d: string }
function drawBody(p: Painter, sk: Tone) {
  p.H(4, 8, 15, sk.b); p.H(5, 7, 16, sk.b); p.R(6, 6, 12, 7, sk.b); p.H(13, 7, 16, sk.b); p.H(14, 8, 15, sk.b);
  p.R(17, 7, 1, 5, sk.d); p.H(13, 14, 16, sk.d); p.H(14, 12, 15, sk.d);
  p.R(5, 9, 1, 2, sk.b); p.R(18, 9, 1, 2, sk.d);
  p.R(10, 15, 4, 1, sk.d);
  p.R(4, 22, 2, 2, sk.b); p.R(18, 22, 2, 2, sk.d);
}
function drawFace(p: Painter, sk: Tone) {
  const E = '#24163a', blush = mixHex(sk.b, '#ff5c78', .38), mouth = mixHex(sk.b, '#7a1f3a', .55);
  [8, 14].forEach(x => { p.P(x, 9, '#ffffff'); p.P(x + 1, 9, E); p.P(x, 10, E); p.P(x + 1, 10, E); });
  p.H(11, 7, 8, blush); p.H(11, 15, 16, blush);
  p.P(10, 11, mouth); p.P(13, 11, mouth); p.H(12, 11, 12, mouth);
}

/* --- Roupas: cada uma com silhueta própria --- */
export type OutfitColors = { t: string; u: string; p: string; b: string }
function baseOutfit(p: Painter, c: OutfitColors, opt: { noLegs?: boolean } = {}) {
  const T = c.t, Td = dk(T, .22), Tl = lt(T, .16);
  p.H(16, 8, 15, T); p.R(7, 17, 10, 6, T); p.R(7, 17, 1, 6, Tl); p.R(16, 16, 1, 7, Td); p.P(15, 16, Td);
  p.R(4, 17, 2, 5, T); p.R(4, 17, 1, 5, Tl); p.R(18, 17, 2, 5, Td);
  if (!opt.noLegs) {
    const P = c.p, Pd = dk(P, .25);
    p.R(7, 23, 10, 2, P); p.H(24, 7, 16, Pd);
    p.R(8, 25, 3, 3, P); p.R(13, 25, 3, 3, P); p.R(10, 25, 1, 3, Pd); p.R(15, 25, 1, 3, Pd);
    const B = c.b, Bd = dk(B, .3);
    p.R(7, 28, 4, 2, B); p.R(13, 28, 4, 2, B); p.H(29, 7, 10, Bd); p.H(29, 13, 16, Bd); p.P(8, 28, lt(B, .3)); p.P(14, 28, lt(B, .3));
  }
}
function belt(p: Painter, color: string, buckle: string) { p.H(22, 7, 16, color); p.H(22, 11, 12, buckle); }
const OUTFITS: Record<string, (c: OutfitColors) => (p: Painter) => void> = {
  'outfit-tunic': c => p => {
    baseOutfit(p, c);
    p.H(16, 10, 13, c.u); p.H(16, 11, 12, '#f0d9b8'); p.P(11, 17, c.u); p.P(12, 17, c.u);
    p.H(21, 4, 5, c.u); p.H(21, 18, 19, dk(c.u, .2));
    belt(p, '#5a3b22', '#ffc94a');
  },
  'outfit-ranger': c => p => {
    baseOutfit(p, c);
    const hood = '#2b7343', hoodD = '#1d5532', leather = '#7a4a21';
    p.H(15, 7, 9, hood); p.H(15, 14, 16, hoodD); p.H(16, 7, 16, hood); p.H(16, 14, 16, hoodD);
    [[8, 17], [9, 18], [10, 19], [11, 20], [12, 21], [13, 21]].forEach(([x, y]) => p.P(x, y, leather));
    p.P(9, 17, lt(leather, .2));
    belt(p, leather, '#cfc8e6');
    p.R(7, 26, 4, 4, c.b); p.R(13, 26, 4, 4, c.b); p.H(26, 7, 10, lt(c.b, .2)); p.H(26, 13, 16, lt(c.b, .2)); p.H(29, 7, 10, dk(c.b, .3)); p.H(29, 13, 16, dk(c.b, .3));
  },
  'outfit-mage': c => p => {
    baseOutfit(p, c, { noLegs: true });
    const T = c.t, Td = dk(T, .25), G = c.u;
    [[23, 7, 16], [24, 7, 16], [25, 6, 17], [26, 6, 17], [27, 5, 18], [28, 5, 18]].forEach(([y, a, b]) => { p.H(y, a, b, T); p.P(b, y, Td); p.P(b - 1, y, Td); });
    p.H(28, 5, 18, G); p.R(11, 16, 2, 13, G); p.P(11, 18, lt(G, .4));
    p.R(3, 20, 3, 2, T); p.R(18, 20, 3, 2, Td); p.H(21, 3, 5, G); p.H(21, 18, 20, dk(G, .2));
    p.R(7, 29, 4, 1, c.b); p.R(13, 29, 4, 1, c.b);
  },
  'outfit-goose': c => p => {
    baseOutfit(p, c, { noLegs: true });
    const W = c.t, S = c.u, O = c.p;
    p.R(9, 18, 6, 5, '#fff0c8'); p.R(9, 18, 6, 1, lt('#fff0c8', .3));
    p.R(3, 17, 3, 6, W); p.R(18, 17, 3, 6, S); p.R(3, 21, 3, 2, S); p.R(18, 21, 3, 2, dk(S, .2)); p.P(3, 17, null);
    p.R(7, 23, 10, 2, W); p.H(24, 7, 16, S);
    p.R(9, 25, 2, 3, O); p.R(13, 25, 2, 3, O); p.P(10, 25, dk(O, .2)); p.P(14, 25, dk(O, .2));
    p.R(7, 28, 4, 2, O); p.R(13, 28, 5, 2, O); p.H(29, 7, 10, dk(O, .25)); p.H(29, 13, 17, dk(O, .25)); p.P(7, 28, null);
    p.H(16, 10, 13, '#f39c34');
  },
  'outfit-knight': c => p => {
    baseOutfit(p, c);
    const T = c.t, Tl = lt(T, .45), Td = dk(T, .3), red = '#b8233f', gold = '#ffc94a';
    p.R(10, 17, 4, 8, red); p.R(13, 17, 1, 8, dk(red, .25)); p.R(11, 18, 2, 3, gold); p.H(19, 10, 13, gold);
    p.R(8, 17, 1, 3, Tl);
    belt(p, '#4a4560', gold); p.R(10, 22, 4, 1, red); p.H(22, 11, 12, gold);
    p.H(16, 4, 6, T); p.R(3, 17, 5, 2, T); p.H(16, 4, 5, Tl); p.H(17, 3, 4, Tl);
    p.H(16, 17, 19, Td); p.R(16, 17, 5, 2, Td); p.H(16, 17, 18, T);
    p.R(4, 22, 2, 2, T); p.R(18, 22, 2, 2, Td);
    p.P(9, 25, Tl); p.P(14, 25, Tl);
  },
  'outfit-stellar': c => p => {
    baseOutfit(p, c);
    const T = c.t, Tl = lt(T, .35), Td = dk(T, .3), G = c.u, S = '#bfe3ff';
    p.H(16, 4, 6, T); p.R(3, 17, 5, 2, T); p.H(16, 4, 5, G); p.H(17, 3, 4, Tl);
    p.H(16, 17, 19, Td); p.R(16, 17, 5, 2, Td); p.H(16, 18, 19, dk(G, .2));
    p.R(9, 17, 6, 5, Td); p.P(10, 18, G); p.P(13, 19, S); p.P(11, 20, G); p.P(12, 18, S); p.P(14, 21, G); p.P(9, 21, S);
    p.H(22, 7, 16, G); p.H(22, 11, 12, S);
    p.R(4, 22, 2, 2, Tl); p.R(18, 22, 2, 2, Td);
    p.P(9, 26, S); p.P(14, 25, G);
  },
  'outfit-royal': c => p => {
    baseOutfit(p, c);
    const T = c.t, Td = dk(T, .25), G = c.u, F = '#fff6e0', Fd = '#d9cfc0';
    p.R(11, 17, 2, 8, G); [18, 20].forEach(y => { p.P(9, y, G); p.P(14, y, G); });
    p.H(15, 7, 9, F); p.H(15, 14, 16, Fd); p.H(16, 7, 16, F); p.H(16, 14, 16, Fd); p.P(8, 16, INK); p.P(15, 16, INK);
    p.R(3, 17, 3, 1, G); p.R(18, 17, 3, 1, dk(G, .15)); p.P(3, 18, G); p.P(20, 18, dk(G, .15));
    p.H(21, 4, 5, G); p.H(21, 18, 19, dk(G, .15));
    p.R(6, 23, 3, 4, T); p.R(15, 23, 3, 4, Td); p.H(26, 6, 8, G); p.H(26, 15, 17, dk(G, .15));
  }
};

/* --- Cabelos --- */
type HairTone = { b: string; d: string; l: string }
const HAIR: Record<string, (p: Painter, h: HairTone) => void> = {
  'hair-short': (p, h) => {
    p.G(6, 3, ['..hhhhhhhh..', '.hllhhhhhhh.', 'hhlhhhhhhhhd', 'hhhhhhhhhhhd', 'hh.hhh.hh.hd', 'h..h......dd'], { h: h.b, l: h.l, d: h.d });
  },
  'hair-bun': (p, h) => {
    p.G(9, -1, ['.hhhh.', 'hlhhhd', 'hhhhhd', '.hddd.'], { h: h.b, l: h.l, d: h.d });
    p.H(3, 10, 13, '#ffc94a');
    p.G(6, 4, ['.hllhhhhhhh.', 'hhlhhhhhhhhd', 'hhhhhhhhhhhd', 'hh........dd', 'h..........d'], { h: h.b, l: h.l, d: h.d });
  },
  'hair-long': (p, h) => {
    p.G(6, 3, ['..hhhhhhhh..', '.hllhhhhhhh.', 'hhlhhhhhhhhd', 'hhhhhhhhhhhd', 'hhhh.hh.hhhd', 'hh........dd', 'h..........d', 'h..........d', 'h..........d', 'h..........d'], { h: h.b, l: h.l, d: h.d });
  },
  'hair-mohawk': (p, h) => {
    p.G(10, -2, ['.hh.', 'hlhd', 'hlhd', 'hlhd', 'hlhd', 'hhhd', 'hhhd', 'hhhd', '.hd.'], { h: h.b, l: h.l, d: h.d });
    const stub = mixHex(h.b, '#888888', .2);
    [[7, 5], [8, 6], [7, 7], [15, 5], [16, 6], [16, 7]].forEach(([x, y]) => p.P(x, y, stub));
  }
};
function longHairBack(p: Painter, h: HairTone) {
  for (let y = 5; y <= 18; y++) { p.H(y, 5, 7, y > 15 ? h.d : h.b); p.H(y, 16, 18, h.d); }
  p.P(5, 19, h.d); p.P(18, 19, h.d); p.R(8, 5, 8, 9, h.d);
}

/* --- Chapéus --- */
const HATS: Record<string, { hairFrom: number; draw: (p: Painter) => void }> = {
  'hat-cap': { hairFrom: 7, draw: p => {
    const r = '#d9384f', rd = '#9c2238', rl = '#ff7088';
    p.G(6, 2, ['..rrrrrrrr..', '.rlrrwwrrrd.', 'rlrrrwwrrrrd', 'rrrrrrrrrrrd'], { r, l: rl, d: rd, w: '#fff6e0' });
    p.H(6, 5, 18, rd); p.H(6, 13, 20, rd); p.H(6, 5, 7, r);
  } },
  'hat-wizard': { hairFrom: 7, draw: p => {
    const v = '#6a46f0', vd = '#4528b8', vl = '#9d82ff', y = '#ffc94a';
    p.G(7, -5, ['.........vv.', '.......vvvd.', '......vvvd..', '.....vlvvd..', '....vlvvvd..', '....vlvyvd..', '...vlvvvvvd.', '...vlvvvvvd.', '..vvvvvvvvd.', '..yyyyyyyyy.'], { v, d: vd, l: vl, y });
    p.H(5, 3, 20, v); p.H(5, 3, 5, vl); p.H(5, 17, 20, vd); p.H(6, 4, 19, vd);
  } },
  'hat-helmet': { hairFrom: 99, draw: p => {
    const s = '#cfc8e6', sd = '#8f88a8', sl = '#f4f0ff', r = '#d9384f';
    p.G(10, -3, ['.rr.', 'rrrr', '.rrd', '.rd.'], { r, d: '#9c2238' });
    p.G(5, 1, ['...ssssss...', '..slsssssd..', '.slssssssdd.', '.slssssssssd', 'sslssssssssdd', 'ss....ss...dd', 'ss....ss...dd', 'ss....ss...dd', 'ss..........dd', 'ss..........dd', '.s..........d.'].map(r => r.padEnd(14, '.')), { s, d: sd, l: sl });
    p.P(7, 4, sd); p.P(16, 4, sd);
  } },
  'hat-crown': { hairFrom: -99, draw: p => {
    const y = '#ffc94a', yd = '#d98a1c', yl = '#fff0a8';
    p.G(7, 0, ['l..l..l..l', 'yy.yy.yy.y', 'yyyyyyyyyd', 'yryybyyryd', 'dddddddddd'].map(r => r.padEnd(10, '.')), { y, d: yd, l: yl, r: '#ff4d6d', b: '#6fb8ff' });
  } }
};

/* --- Acessórios --- */
function capeBack(p: Painter) {
  const c = '#a3263e', cd = '#6e1a2f';
  p.H(16, 6, 17, c);
  for (let y = 17; y <= 29; y++) { const a = y < 20 ? 3 : 2, b = y < 20 ? 20 : 21; p.H(y, a, b, c); p.P(a, y, cd); p.P(b, y, cd); p.P(b - 1, y, cd); }
  p.P(2, 29, null); p.P(21, 29, null); p.P(5, 29, cd); p.P(18, 29, cd);
}
function wingsBack(p: Painter) {
  const c = '#9fe7ff', cd = '#4fa9d9', cl = '#e9fbff';
  const left: [number, number, number][] = [[13, 3, 5], [14, 2, 5], [15, 1, 5], [16, 0, 5], [17, 0, 5], [18, 0, 4], [19, 1, 4], [20, 0, 4], [21, 1, 4], [22, 2, 4], [23, 3, 4]];
  left.forEach(([y, a, b]) => { p.H(y, a, b, c); p.H(y, 23 - b, 23 - a, c); p.P(a, y, cd); p.P(23 - a, y, cd); });
  [[14, 3], [15, 2], [16, 2], [17, 1], [20, 1], [21, 2]].forEach(([y, x]) => { p.P(x, y, cl); p.P(23 - x, y, cl); });
  p.H(18, 1, 3, cd); p.H(18, 20, 22, cd);
}
function scarf(p: Painter) {
  const r = '#d9384f', rd = '#9c2238', w = '#fff6e0';
  p.H(15, 8, 15, r); p.H(16, 8, 15, rd); p.P(9, 15, w); p.P(12, 15, w); p.P(14, 15, w);
  p.R(14, 17, 2, 4, r); p.P(15, 17, rd); p.P(15, 19, rd); p.P(14, 18, w); p.P(14, 21, r); p.P(15, 21, rd);
}
function glasses(p: Painter) {
  const f = '#e8c35a';
  [7, 13].forEach(x => { p.P(x, 9, f); p.P(x, 10, f); p.P(x + 3, 9, f); p.P(x + 3, 10, f); p.H(8, x + 1, x + 2, f); p.H(11, x + 1, x + 2, f); });
  p.H(9, 11, 12, f);
}

export type AvatarLook = { skin: number; hairColor: number; hair: string; outfit: string; hat: string; accessory: string }
export function buildAvatar(cfg: AvatarLook, itemColors: (id: string) => OutfitColors): PixelBuf {
  const buf = makeBuf(26, 37), p = painter(buf, 1, 5);
  const skin = SKINS[cfg.skin] || SKINS[1], sk = { b: skin, d: dk(skin, .16) };
  const hc = HAIR_COLORS[cfg.hairColor] || HAIR_COLORS[0], hr = { b: hc, d: dk(hc, .3), l: lt(hc, .28) };
  const hat = HATS[cfg.hat];
  const make = OUTFITS[cfg.outfit] || OUTFITS['outfit-tunic'];
  if (cfg.accessory === 'acc-cape') capeBack(p);
  if (cfg.accessory === 'acc-wings') wingsBack(p);
  if (cfg.hair === 'hair-long') longHairBack(p, hr);
  drawBody(p, sk);
  make(itemColors(cfg.outfit))(p);
  drawFace(p, sk);
  p.clip = hat ? hat.hairFrom : -99;
  (HAIR[cfg.hair] || HAIR['hair-short'])(p, hr);
  p.clip = -99;
  if (cfg.accessory === 'acc-scarf') scarf(p);
  if (hat) hat.draw(p);
  if (cfg.accessory === 'acc-glasses') glasses(p);
  if (cfg.accessory === 'acc-cape') { p.P(8, 16, '#ffc94a'); p.P(15, 16, '#ffc94a'); }
  outlineBuf(buf);
  return buf;
}

/* --- Companheiros 16x16 --- */
export const PETS: Record<string, { map: Record<string, string>; rows: string[] }> = {
  slime: { map: { g: '#2fbf86', G: '#5ef0b0', W: '#d9fff0', e: '#163a2c', m: '#1d6b4c', d: '#239b6c', p: '#ff9aa8' }, rows: [
    '................', '................', '................', '.......gg.......', '......gWGg......', '.....gWWGGg.....', '....gGWGGGGg....', '...gGGGGGGGGg...',
    '..gGGWGGGGWGGg..', '..gGGeGGGGeGGg..', '.gGGGeGGGGeGGGg.', '.gGpGGGmmGGGpGg.', '.gGGGGGGGGGGGdg.', '.gddGGGGGGGGddg.', '..gddddddddddg..', '................'] },
  cat: { map: { G: '#9a8fb0', S: '#6f6488', L: '#c4bad6', P: '#ff9aa8', Y: '#ffc94a', E: '#1a0f2e', N: '#ff6f8a', W: '#f4f0ff', T: '#7d7296' }, rows: [
    '................', '................', '..G.......G.....', '..GG.....GG.....', '..GPG...GPG.....', '..GLGGSGGGG.....', '.GLGGSGSGGGS....', '.GLGGGGGGGGS....',
    '.GYEGGGGGYES....', '.GGGGGNGGGGS....', '..GGGWEWGGS.....', '...GGGGGGS...TT.', '..GGWWWWWGS..TS.', '..GSWWWWWSGGTS..', '..GGWWWWWGGTS...', '...GG...GG......'] },
  goose: { map: { W: '#fff6e0', D: '#d9cfc0', S: '#a89fb8', O: '#f39c34', o: '#c26a14', E: '#1a0f2e', R: '#d9384f', r: '#9c2238', K: '#2a1f3e', k: '#4a3f60' }, rows: [
    '........KK......', '........KK......', '.......kKKk.....', '.......WWWW.....', '......WWWWWW....', '......WWWEWWOO..', '......WWWWWOOOo.', '.......WWWD.oo..',
    '.......RrR......', '..W....WWWW.....', '..WWWWWWWWWD....', '..WWSSWWWWWD....', '...WWSSSSWWD....', '....DDWWWWD.....', '......O..O......', '.....OO.OO......'] },
  phoenix: { map: { R: '#ff6a3d', O: '#ffa53d', Y: '#ffd86b', W: '#fff3c4', E: '#1a0f2e', K: '#c96a10', D: '#b8323a' }, rows: [
    '......Y..Y......', '.......YY.......', '......OOOO......', '.....OOOOOO.....', '.....OEOOEO.....', '......OKKO......', 'D....ROOOOR....D', 'DR..RROYYORR..RD',
    'DRRRROYWWYORRRRD', '.DRRROYWWYORRRD.', '..DRROOYYOORRD..', '...DROOOOOORD...', '.....ROOOOR.....', '....RO.YY.OR....', '...RO..YY..OR...', '..R...Y..Y...R..'] },
  dragon: { map: { V: '#8f6bff', L: '#b9a4ff', D: '#5b3be0', A: '#4528b8', a: '#6a4ad8', Y: '#ffc94a', y: '#d98a1c', H: '#fff0c8', W: '#ffffff', E: '#1a0f2e', N: '#3a1f8a', C: '#fff0c8', R: '#ff7a4a' }, rows: [
    '................', '...H.......H....', '...HH.....HH....', '....VVVVVVV.....', '...VLLVVVVVD....', '...VWEVVVWEV....', '...VVVVVVVVD....', '....VVNVNVD.....',
    'A....VVVVV....A.', 'AA..VVYYYVD..aA.', 'AaAVVVYyYVVDaaA.', '.AaVVVYYYVVDaA..', '..AVVVYyYVVDA...', '....VVYYYVD.VVR.', '....VVVVVVVVVD..', '....CC...CC.....'] }
};
export function buildPet(name: string): PixelBuf | null {
  const def = PETS[name]; if (!def) return null;
  const buf = makeBuf(18, 18), p = painter(buf, 1, 1);
  p.G(0, 0, def.rows, def.map);
  outlineBuf(buf);
  return buf;
}
