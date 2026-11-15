import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<Mark size={512} />, size);
}

export function Mark({ size }: { size: number }) {
  const bar = size * 0.09;
  return (
    <div style={{ width: size, height: size, background: "#0f4a30", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: size * 0.03 }}>
        <div style={{ width: bar, height: size * 0.42, background: "#c9a66b", borderRadius: size * 0.03 }} />
        <div style={{ width: bar, height: size * 0.3, background: "#c9a66b", borderRadius: size * 0.03 }} />
        <div style={{ width: size * 0.22, height: bar * 0.8, background: "#f2ead7", borderRadius: size * 0.02 }} />
        <div style={{ width: bar, height: size * 0.3, background: "#c9a66b", borderRadius: size * 0.03 }} />
        <div style={{ width: bar, height: size * 0.42, background: "#c9a66b", borderRadius: size * 0.03 }} />
      </div>
    </div>
  );
}
