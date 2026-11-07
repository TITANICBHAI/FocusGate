import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

/** Decodes an 8-bit RGBA PNG just far enough to read pixels. */
function decode(path: string): { width: number; height: number; px(x: number, y: number): number[] } {
  const buf = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let depth = 0;
  const data: Buffer[] = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8]!;
      colorType = body[9]!;
    } else if (type === "IDAT") data.push(body);
    offset += 12 + length;
  }
  expect(colorType, `${path} must be RGBA`).toBe(6);
  expect(depth).toBe(8);
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[y * (stride + 1) + 1 + i]!;
      const left = i >= 4 ? out[y * stride + i - 4]! : 0;
      const up = y > 0 ? out[(y - 1) * stride + i]! : 0;
      const upLeft = y > 0 && i >= 4 ? out[(y - 1) * stride + i - 4]! : 0;
      let value = x;
      if (filter === 1) value = x + left;
      else if (filter === 2) value = x + up;
      else if (filter === 3) value = x + Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = x + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      }
      out[y * stride + i] = value & 255;
    }
  }
  return {
    width,
    height,
    px: (x, y) => [...out.subarray(y * stride + x * 4, y * stride + x * 4 + 4)],
  };
}

const FILES = [
  ["public/icons/icon-16.png", 16],
  ["public/icons/icon-32.png", 32],
  ["public/icons/icon-48.png", 48],
  ["public/icons/icon-128.png", 128],
  ["public/icon.png", 128],
  ["store-assets/icon-128.png", 128],
] as const;

describe("app icons", () => {
  for (const [path, size] of FILES) {
    it(`${path} is ${size}px with transparent corners`, () => {
      const image = decode(path);
      expect(image.width).toBe(size);
      expect(image.height).toBe(size);
      for (const [x, y] of [
        [0, 0],
        [size - 1, 0],
        [0, size - 1],
        [size - 1, size - 1],
      ] as const) {
        expect(image.px(x, y)[3], `corner ${x},${y}`).toBe(0);
      }
      // The mark itself is still there.
      expect(image.px(size >> 1, size >> 1)[3]).toBe(255);
    });
  }
});
