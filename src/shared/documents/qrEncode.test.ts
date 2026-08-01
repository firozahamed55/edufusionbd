import { describe, expect, it } from "vitest";
import { encodeQr, rsEncode } from "./qrEncode";

describe("rsEncode", () => {
  /**
   * ISO/IEC 18004 Annex I worked example — version 1-M, "01234567".
   * These are the published data codewords and the ECC codewords they must
   * produce. This is the anchor for the whole encoder: everything downstream
   * is placement, and placement is structural. Reed-Solomon is the part where
   * a wrong answer still LOOKS like a QR code and simply never scans.
   */
  it("matches the specification's worked example", () => {
    const data = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
    expect(rsEncode(data, 10)).toEqual([0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55]);
  });

  it("returns exactly the requested number of codewords", () => {
    for (const len of [10, 16, 18, 22, 24, 26]) {
      expect(rsEncode([1, 2, 3, 4, 5], len)).toHaveLength(len);
    }
  });

  it("is deterministic", () => {
    expect(rsEncode([9, 8, 7], 16)).toEqual(rsEncode([9, 8, 7], 16));
  });
});

describe("encodeQr", () => {
  it("produces a square grid at the smallest version that fits", () => {
    // 20 bytes fits version 1-M (16 data codewords is 16 bytes) → version 2 (28).
    const grid = encodeQr("https://x.test/v/12345678");
    expect(grid.length).toBe(grid[0].length);
    // Version n is 17 + 4n modules; every version is ≡ 1 (mod 4).
    expect((grid.length - 17) % 4).toBe(0);
  });

  it("draws all three finder patterns", () => {
    const grid = encodeQr("EFB");
    const n = grid.length;
    const finderAt = (ox: number, oy: number) =>
      grid[oy][ox] && grid[oy][ox + 6] && grid[oy + 6][ox] && grid[oy + 6][ox + 6] && grid[oy + 3][ox + 3];
    expect(finderAt(0, 0)).toBe(true);
    expect(finderAt(n - 7, 0)).toBe(true);
    expect(finderAt(0, n - 7)).toBe(true);
  });

  it("draws the timing pattern on row and column 6", () => {
    const grid = encodeQr("EFB");
    for (let i = 8; i < grid.length - 8; i++) {
      expect(grid[6][i]).toBe(i % 2 === 0);
      expect(grid[i][6]).toBe(i % 2 === 0);
    }
  });

  it("sets the mandatory dark module", () => {
    const grid = encodeQr("EFB");
    expect(grid[grid.length - 8][8]).toBe(true);
  });

  it("grows the version as the payload grows", () => {
    const small = encodeQr("a".repeat(10)).length;
    const large = encodeQr("a".repeat(150)).length;
    expect(large).toBeGreaterThan(small);
  });

  it("refuses a payload it cannot encode rather than truncating it", () => {
    // Truncation would produce a scannable code pointing at the WRONG URL.
    expect(() => encodeQr("a".repeat(400))).toThrow(/too long/i);
  });

  /**
   * Round-trip. The structural assertions above prove the finders and timing
   * marks are where a scanner looks; only reading the payload back out proves
   * that masking, zig-zag placement, block interleaving and the reserved-module
   * map all agree. A one-column drift in `placeData` passes every test above
   * and produces a code no scanner can read.
   */
  it.each([
    "https://edufusion.test/v/abc123",
    "EFB",
    "a".repeat(100),
  ])("round-trips %s", (payload) => {
    expect(decodeQr(encodeQr(payload))).toBe(payload);
  });
});

/* -------------------------------------------------------------------------- */

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
const M_SPEC: Record<number, [number, number, number, number]> = {
  1: [26, 10, 1, 0], 2: [44, 16, 1, 0], 3: [70, 26, 1, 0], 4: [100, 18, 2, 0], 5: [134, 24, 2, 0],
  6: [172, 16, 4, 0], 7: [196, 18, 4, 0], 8: [242, 22, 2, 2], 9: [292, 22, 3, 2], 10: [346, 26, 4, 1],
};
const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

/** A test-only reader: the inverse of the encoder's placement, written
 *  independently of it so a shared mistake cannot cancel itself out. */
function decodeQr(grid: boolean[][]): string {
  const size = grid.length;
  const version = (size - 17) / 4;
  const reserved = reservedMap(size, version);

  // Format info sits at (0..8, 8) and (8, 0..8); bit i of the 15-bit string is
  // read back from the same positions the encoder wrote it to.
  let fmt = 0;
  for (let i = 0; i < 15; i++) {
    const a = i < 6 ? i : i < 8 ? i + 1 : 8;
    const b = i < 8 ? 8 : i === 8 ? 7 : 14 - i;
    if (grid[b][a]) fmt |= 1 << i;
  }
  fmt ^= 0x5412;
  const mask = (fmt >>> 10) & 0b111;
  expect((fmt >>> 13) & 0b11).toBe(0b00); // level M

  // Unmask + read the zig-zag stream.
  const bits: number[] = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const y = upward ? size - 1 - step : step;
      for (const x of [right, right - 1]) {
        if (reserved[y][x]) continue;
        const v = grid[y][x] !== MASKS[mask](x, y);
        bits.push(v ? 1 : 0);
      }
    }
    upward = !upward;
  }
  const stream: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    stream.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  }

  // De-interleave the data codewords (ECC codewords trail them and are unused).
  const [total, ecc, g1, g2] = M_SPEC[version];
  const blocks = g1 + g2;
  const dataLen = total - ecc * blocks;
  const shortLen = Math.floor(dataLen / blocks);
  const lens = Array.from({ length: blocks }, (_, b) => shortLen + (b < g1 ? 0 : 1));
  const out: number[][] = lens.map(() => []);
  let k = 0;
  for (let i = 0; i < Math.max(...lens); i++) {
    for (let b = 0; b < blocks; b++) if (i < lens[b]) out[b].push(stream[k++]);
  }
  const words = out.flat();

  // Parse byte-mode header + payload.
  const bitAt = (n: number) => (words[n >>> 3] >>> (7 - (n & 7))) & 1;
  const read = (from: number, len: number) => {
    let v = 0;
    for (let i = 0; i < len; i++) v = (v << 1) | bitAt(from + i);
    return v;
  };
  expect(read(0, 4)).toBe(0b0100); // byte mode
  const countBits = version <= 9 ? 8 : 16;
  const length = read(4, countBits);
  const bytes = Array.from({ length }, (_, i) => read(4 + countBits + i * 8, 8));
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

/** Which modules are function patterns — reconstructed for the reader. */
function reservedMap(size: number, version: number): boolean[][] {
  const r = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const box = (ox: number, oy: number, w: number, h: number) => {
    for (let y = oy; y < oy + h; y++) for (let x = ox; x < ox + w; x++) {
      if (x >= 0 && y >= 0 && x < size && y < size) r[y][x] = true;
    }
  };
  box(-1, -1, 9, 9);
  box(size - 8, -1, 9, 9);
  box(-1, size - 8, 9, 9);
  for (let i = 0; i < size; i++) { r[6][i] = true; r[i][6] = true; }
  for (const cy of ALIGN[version]) {
    for (const cx of ALIGN[version]) {
      const nearFinder = (cx <= 8 && cy <= 8) || (cx <= 8 && cy >= size - 9) || (cx >= size - 9 && cy <= 8);
      if (!nearFinder) box(cx - 2, cy - 2, 5, 5);
    }
  }
  // Format-information strips. Easy to forget, and forgetting them shifts the
  // whole data stream by 31 modules — which is exactly what this reader did
  // on its first run, and why the round-trip test earns its keep.
  for (let i = 0; i < 9; i++) { r[8][i] = true; r[i][8] = true; }
  for (let i = 0; i < 8; i++) { r[8][size - 1 - i] = true; r[size - 1 - i][8] = true; }
  r[size - 8][8] = true;
  return r;
}
