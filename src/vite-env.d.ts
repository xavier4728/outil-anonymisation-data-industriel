/// <reference types="vite/client" />

declare module "pdfjs-dist/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}

declare module "utif2" {
  export function decode(buffer: ArrayBuffer): unknown[];
  export function decodeImage(buffer: ArrayBuffer, ifd: unknown): void;
  export function toRGBA8(ifd: unknown): Uint8Array;
}

declare module "*?b64" {
  const base64: string;
  export default base64;
}
