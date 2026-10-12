import { describe, expect, it } from 'vitest';
import { inspectImage, MAX_PHOTO_BYTES } from './photos';

function png(width: number, height: number, animated = false) {
  const bytes = new Uint8Array(animated ? 45 : 33);
  bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16,width); view.setUint32(20,height);
  bytes[24] = 8; bytes[25] = 6;
  if (animated) bytes.set([0,0,0,0,97,99,84,76],33);
  return bytes;
}
describe('local photograph validation', () => {
  it('reads actual image dimensions and ignores a filename or declared MIME', () => {
    expect(inspectImage(png(640,480))).toEqual({mime:'image/png',width:640,height:480});
    expect(() => inspectImage(new TextEncoder().encode('<svg onload="x"/>'))).toThrow();
  });
  it('rejects pixel bombs before asking the browser to decode', () => {
    expect(() => inspectImage(png(100000,100000))).toThrow();
    expect(() => inspectImage(png(0,480))).toThrow();
    expect(() => inspectImage(new Uint8Array(MAX_PHOTO_BYTES + 1))).toThrow();
  });
  it('rejects animated PNG and incomplete headers', () => {
    expect(() => inspectImage(png(640,480,true))).toThrow();
    expect(() => inspectImage(png(640,480).slice(0,20))).toThrow();
  });
});
