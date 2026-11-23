import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<Mark size={512} />, size);
}

// "Grow" leaf mark, same artwork as the iPhone app icon (mobile/assets/icon.png).
export function Mark({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, display: "flex", background: "linear-gradient(180deg, #10603f, #083b27)" }}>
      <svg width={size} height={size} viewBox="0 0 1024 1024">
        <path d="M512 196 C 772 316 792 652 512 828 C 232 652 252 316 512 196 Z" fill="#ffffff" />
        <g fill="none" stroke="#0b4d34" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round">
          <line x1="512" y1="760" x2="512" y2="330" />
          <polyline points="428,414 512,330 596,414" />
          <line x1="512" y1="610" x2="620" y2="520" strokeWidth="34" />
          <line x1="512" y1="610" x2="404" y2="520" strokeWidth="34" />
        </g>
      </svg>
    </div>
  );
}
