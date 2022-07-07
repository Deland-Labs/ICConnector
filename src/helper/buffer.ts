export const bufferToHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');

export function hexToBuffer(hex: string) {
  const view = new Uint8Array(hex.length / 2);

  for (let i = 0; i < hex.length; i += 2)
    view[i / 2] = parseInt(hex.slice(i, i + 2), 16);

  return view;
}
