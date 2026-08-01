/**
 * Minimal QR Code encoder — byte mode, error-correction level M, versions 1–10.
 *
 * WHY HAND-ROLLED (SRA A-7 point 5). The only thing this product encodes is a
 * verification URL: one short ASCII string, always byte mode, always the same
 * ECC level, rendered as SVG so it prints at any size without a raster step.
 * `qrcode` on npm carries eight modes, four ECC levels, forty versions, Kanji
 * tables, a PNG renderer and a CLI to serve that one case.
 *
 * The part that must not be got wrong is Reed–Solomon, so it is tested against
 * the ISO/IEC 18004 worked example (Annex I: version 1-M, "01234567") whose
 * data and ECC codewords are published — see qr.test.ts. Everything else here
 * is structural and is asserted on shape.
 *
 * Version 10 at level M holds 213 bytes, which is ~4× the longest URL this
 * product mints. `encodeQr` throws rather than silently truncating past that:
 * a QR that scans to a truncated URL is worse than no QR at all.
 */

/* ------------------------------------------------------------ GF(256) */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // QR's primitive polynomial
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Generator polynomial for `degree` ECC codewords. */
function generator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let d = 0; d < degree; d++) {
    const next = new Uint8Array(poly.length + 1);
    for (let i = 0; i < poly.length; i++) {
      next[i] ^= mul(poly[i], 1);
      next[i + 1] ^= mul(poly[i], EXP[d]);
    }
    poly = next;
  }
  return poly;
}

/** Reed–Solomon remainder — the ECC codewords appended to a data block. */
export function rsEncode(data: readonly number[] | Uint8Array, eccLen: number): number[] {
  const gen = generator(eccLen);
  const rem = new Uint8Array(eccLen);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.copyWithin(0, 1);
    rem[eccLen - 1] = 0;
    for (let i = 0; i < eccLen; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return [...rem];
}

/* ------------------------------------------------- version capacity (level M) */

/**
 * Per version: [total codewords, ECC codewords per block, block count in
 * group 1, block count in group 2]. Level M only. Group 2 blocks hold one more
 * data codeword than group 1 — the interleaving rule from §8.6.
 */
const M_SPEC: Record<number, [total: number, eccPerBlock: number, g1: number, g2: number]> = {
  1: [26, 10, 1, 0],
  2: [44, 16, 1, 0],
  3: [70, 26, 1, 0],
  4: [100, 18, 2, 0],
  5: [134, 24, 2, 0],
  6: [172, 16, 4, 0],
  7: [196, 18, 4, 0],
  8: [242, 22, 2, 2],
  9: [292, 22, 3, 2],
  10: [346, 26, 4, 1],
};

/** Alignment-pattern centre coordinates per version (§ Annex E). */
const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const dataCapacity = (v: number) => {
  const [total, ecc, g1, g2] = M_SPEC[v];
  return total - ecc * (g1 + g2);
};

/* --------------------------------------------------------------- encoding */

class BitWriter {
  readonly bits: number[] = [];
  put(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
}

function charCountBits(version: number): number {
  // Byte mode: 8 bits for versions 1–9, 16 for 10–40.
  return version <= 9 ? 8 : 16;
}

/** UTF-8 bytes — a Bangla institution name in a URL is percent-encoded before
 *  it reaches here, but nothing stops a caller passing raw text. */
function toBytes(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

function buildCodewords(bytes: number[], version: number): number[] {
  const cap = dataCapacity(version);
  const bw = new BitWriter();
  bw.put(0b0100, 4); // byte mode
  bw.put(bytes.length, charCountBits(version));
  for (const b of bytes) bw.put(b, 8);

  // Terminator: up to four zero bits, then pad to a byte boundary.
  const capBits = cap * 8;
  const terminator = Math.min(4, capBits - bw.bits.length);
  bw.put(0, terminator);
  while (bw.bits.length % 8 !== 0) bw.bits.push(0);

  const words: number[] = [];
  for (let i = 0; i < bw.bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bw.bits[i + j];
    words.push(v);
  }
  // Pad bytes alternate 0xEC / 0x11 (§8.4.9).
  for (let i = 0; words.length < cap; i++) words.push(i % 2 === 0 ? 0xec : 0x11);
  return words;
}

/** Split into blocks, RS-encode each, then interleave data then ECC (§8.6). */
function interleave(dataWords: number[], version: number): number[] {
  const [, eccPerBlock, g1, g2] = M_SPEC[version];
  const blockCount = g1 + g2;
  const shortLen = Math.floor(dataWords.length / blockCount);

  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let at = 0;
  for (let b = 0; b < blockCount; b++) {
    const len = shortLen + (b < g1 ? 0 : 1);
    const block = dataWords.slice(at, at + len);
    at += len;
    dataBlocks.push(block);
    eccBlocks.push(rsEncode(block, eccPerBlock));
  }

  const out: number[] = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < eccPerBlock; i++) for (const b of eccBlocks) out.push(b[i]);
  return out;
}

/* ---------------------------------------------------------------- matrix */

type Grid = { size: number; modules: Uint8Array; reserved: Uint8Array };

const idx = (g: Grid, x: number, y: number) => y * g.size + x;

function place(g: Grid, x: number, y: number, dark: boolean, reserve = true) {
  g.modules[idx(g, x, y)] = dark ? 1 : 0;
  if (reserve) g.reserved[idx(g, x, y)] = 1;
}

function drawFinder(g: Grid, cx: number, cy: number) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= g.size || y >= g.size) continue;
      const inRing = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark =
        inRing && ((dx === 0 || dx === 6 || dy === 0 || dy === 6) || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      place(g, x, y, dark);
    }
  }
}

function drawFunctionPatterns(g: Grid, version: number) {
  drawFinder(g, 0, 0);
  drawFinder(g, g.size - 7, 0);
  drawFinder(g, 0, g.size - 7);

  // Timing patterns.
  for (let i = 8; i < g.size - 8; i++) {
    place(g, i, 6, i % 2 === 0);
    place(g, 6, i, i % 2 === 0);
  }

  // Alignment patterns, skipping the three that would sit on a finder.
  const centres = ALIGN[version];
  for (const cy of centres) {
    for (const cx of centres) {
      const nearFinder =
        (cx <= 8 && cy <= 8) || (cx <= 8 && cy >= g.size - 9) || (cx >= g.size - 9 && cy <= 8);
      if (nearFinder) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ring = Math.max(Math.abs(dx), Math.abs(dy));
          place(g, cx + dx, cy + dy, ring !== 1);
        }
      }
    }
  }

  // Dark module + reserved format-information areas.
  place(g, 8, g.size - 8, true);
  for (let i = 0; i < 9; i++) {
    if (i !== 6) { g.reserved[idx(g, i, 8)] = 1; g.reserved[idx(g, 8, i)] = 1; }
  }
  for (let i = 0; i < 8; i++) {
    g.reserved[idx(g, g.size - 1 - i, 8)] = 1;
    g.reserved[idx(g, 8, g.size - 1 - i)] = 1;
  }
}

/** Zig-zag placement of the interleaved codeword stream (§8.7.3). */
function placeData(g: Grid, words: number[]) {
  let bit = 0;
  const total = words.length * 8;
  let upward = true;
  for (let right = g.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing column is skipped entirely
    for (let step = 0; step < g.size; step++) {
      const y = upward ? g.size - 1 - step : step;
      for (const x of [right, right - 1]) {
        if (g.reserved[idx(g, x, y)]) continue;
        let dark = false;
        if (bit < total) dark = ((words[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
        g.modules[idx(g, x, y)] = dark ? 1 : 0;
        bit++;
      }
    }
    upward = !upward;
  }
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Format information: 5 data bits (ECC level + mask) + BCH(15,5), XOR 0x5412. */
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask; // 0b00 = level M
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function applyMaskAndFormat(g: Grid, mask: number) {
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (g.reserved[idx(g, x, y)]) continue;
      if (MASKS[mask](x, y)) g.modules[idx(g, x, y)] ^= 1;
    }
  }

  const bits = formatBits(mask);
  for (let i = 0; i < 15; i++) {
    const dark = ((bits >>> i) & 1) === 1 ? 1 : 0;
    // Copy 1 — around the top-left finder.
    const a = i < 6 ? i : i < 8 ? i + 1 : 8;
    const b = i < 8 ? 8 : i === 8 ? 7 : 14 - i;
    g.modules[idx(g, a, b)] = dark;
    // Copy 2 — split between the other two finders.
    if (i < 8) g.modules[idx(g, g.size - 1 - i, 8)] = dark;
    else g.modules[idx(g, 8, g.size - 15 + i)] = dark;
  }
}

/** Penalty score (§8.8.2) — only used to pick the least-bad mask. */
function penalty(g: Grid): number {
  const at = (x: number, y: number) => g.modules[idx(g, x, y)];
  let score = 0;

  // Rule 1: runs of five or more.
  for (let i = 0; i < g.size; i++) {
    for (const horizontal of [true, false]) {
      let run = 1;
      for (let j = 1; j < g.size; j++) {
        const cur = horizontal ? at(j, i) : at(i, j);
        const prev = horizontal ? at(j - 1, i) : at(i, j - 1);
        if (cur === prev) run++;
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
  }
  // Rule 2: 2×2 blocks of one colour.
  for (let y = 0; y < g.size - 1; y++) {
    for (let x = 0; x < g.size - 1; x++) {
      const v = at(x, y);
      if (v === at(x + 1, y) && v === at(x, y + 1) && v === at(x + 1, y + 1)) score += 3;
    }
  }
  // Rule 3: the finder-lookalike 1:1:3:1:1 pattern.
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matches = (get: (k: number) => number, start: number, pat: number[]) =>
    pat.every((p, k) => get(start + k) === p);
  for (let i = 0; i < g.size; i++) {
    for (let j = 0; j + 11 <= g.size; j++) {
      if (matches((k) => at(k, i), j, A) || matches((k) => at(k, i), j, B)) score += 40;
      if (matches((k) => at(i, k), j, A) || matches((k) => at(i, k), j, B)) score += 40;
    }
  }
  // Rule 4: deviation from a 50/50 dark ratio.
  const dark = g.modules.reduce<number>((a, b) => a + b, 0);
  const pct = (dark * 100) / (g.size * g.size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/**
 * Encode `text` as a QR matrix. Returns a square boolean grid, row-major,
 * without a quiet zone — `<Qr>` adds that, since it is a rendering concern.
 */
export function encodeQr(text: string): boolean[][] {
  const bytes = toBytes(text);
  const version = Number(
    Object.keys(M_SPEC).find((v) => {
      const n = Number(v);
      const headerBits = 4 + charCountBits(n);
      return dataCapacity(n) * 8 >= headerBits + bytes.length * 8;
    }) ?? 0,
  );
  if (!version) {
    throw new Error(`QR payload too long: ${bytes.length} bytes exceeds the level-M version-10 capacity`);
  }

  const size = 17 + version * 4;
  const words = interleave(buildCodewords(bytes, version), version);

  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g: Grid = { size, modules: new Uint8Array(size * size), reserved: new Uint8Array(size * size) };
    drawFunctionPatterns(g, version);
    placeData(g, words);
    applyMaskAndFormat(g, mask);
    const s = penalty(g);
    if (s < bestScore) { bestScore = s; best = g; }
  }

  const g = best as Grid;
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => g.modules[idx(g, x, y)] === 1),
  );
}
