import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function useEase(from: number, to: number, output: [number, number]) {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], output, {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}

const shell = {
  background: "#f8f4ec",
  ink: "#17120f",
  muted: "#7c7065",
  line: "#ddd2c3",
  card: "#fffaf2",
  blue: "#2563eb",
  purple: "#7c3aed",
  green: "#138a5b",
};

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div
    style={{
      background: shell.card,
      border: `2px solid ${shell.line}`,
      borderRadius: 28,
      boxShadow: "0 24px 80px rgba(38, 28, 18, 0.12)",
      ...style,
    }}
  >
    {children}
  </div>
);

const CodeLine = ({ color, label, value }: { color: string; label: string; value: string }) => (
  <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 28, lineHeight: 1.35 }}>
    <span style={{ width: 13, height: 13, borderRadius: 999, background: color }} />
    <span style={{ color: shell.muted }}>{label}</span>
    <strong style={{ color: shell.ink }}>{value}</strong>
  </div>
);

const FloatingPath = ({ text, top, left, delay, color }: { text: string; top: number; left: number; delay: number; color: string }) => {
  const y = useEase(delay, delay + 24, [28, 0]);
  const opacity = useEase(delay, delay + 18, [0, 1]);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        transform: `translateY(${y}px)`,
        opacity,
        padding: "15px 20px",
        borderRadius: 999,
        border: `2px solid ${color}`,
        color,
        background: "rgba(255,250,242,0.88)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 24,
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  );
};

export const PiNotesPreview = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleY = useEase(0, 28, [36, 0]);
  const titleOpacity = useEase(0, 20, [0, 1]);
  const cardScale = useEase(12, 42, [0.94, 1]);
  const bridge = useEase(58, 92, [0, 1]);
  const pulse = interpolate(Math.sin(frame / 8), [-1, 1], [0.35, 1]);

  return (
    <AbsoluteFill style={{ background: shell.background, color: shell.ink, fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 18% 20%, rgba(124,58,237,0.20), transparent 28%), radial-gradient(circle at 80% 18%, rgba(37,99,235,0.18), transparent 30%), radial-gradient(circle at 50% 92%, rgba(19,138,91,0.16), transparent 28%)" }} />

      <div style={{ position: "absolute", top: 70, left: 92, right: 92, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: titleOpacity, transform: `translateY(${titleY}px)` }}>
        <div>
          <div style={{ fontSize: 34, color: shell.muted, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase" }}>pi-notes</div>
          <h1 style={{ margin: "8px 0 0", fontSize: 82, lineHeight: 0.94, letterSpacing: -4 }}>Local Brain pages<br />with agent feedback.</h1>
        </div>
        <div style={{ fontSize: 112 }}>🧠</div>
      </div>

      <Sequence from={18}>
        <Card style={{ position: "absolute", left: 92, bottom: 88, width: 690, height: 430, padding: 34, transform: `scale(${cardScale})` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 }}>
            <strong style={{ fontSize: 34 }}>Tiny narrative shell</strong>
            <span style={{ fontSize: 22, color: shell.muted, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>.brain/projects/tweet-wall.svx</span>
          </div>
          <div style={{ display: "grid", gap: 19, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
            <CodeLine color={shell.purple} label="#" value="Tweet Wall" />
            <CodeLine color={shell.blue} label="data" value=".brain/data/tweets.json" />
            <CodeLine color={shell.green} label="render" value="<TweetWall />" />
          </div>
          <p style={{ position: "absolute", left: 34, right: 34, bottom: 28, color: shell.muted, fontSize: 27, lineHeight: 1.32, margin: 0 }}>Raw source stays out of MDSvX. Components paginate, lazy-load media, and render text safely.</p>
        </Card>
      </Sequence>

      <Sequence from={34}>
        <Card style={{ position: "absolute", right: 92, bottom: 88, width: 640, height: 430, padding: 0, overflow: "hidden" }}>
          <div style={{ height: 62, borderBottom: `2px solid ${shell.line}`, display: "flex", alignItems: "center", gap: 10, padding: "0 22px" }}>
            <span style={{ width: 15, height: 15, borderRadius: 999, background: "#ef4444" }} />
            <span style={{ width: 15, height: 15, borderRadius: 999, background: "#f59e0b" }} />
            <span style={{ width: 15, height: 15, borderRadius: 999, background: "#22c55e" }} />
            <span style={{ marginLeft: 18, fontSize: 20, color: shell.muted }}>localhost /notes</span>
          </div>
          <div style={{ padding: 28, display: "grid", gap: 18 }}>
            {["Select exact block", "Queue feedback", "Send Review Batch", "Pi edits source + receipt"].map((item, index) => {
              const opacity = interpolate(frame, [42 + index * 12, 54 + index * 12], [0, 1], clamp);
              const x = interpolate(frame, [42 + index * 12, 54 + index * 12], [26, 0], clamp);
              return (
                <div key={item} style={{ opacity, transform: `translateX(${x}px)`, display: "flex", alignItems: "center", gap: 15, padding: 18, borderRadius: 18, background: index === 2 ? "rgba(37,99,235,0.10)" : "rgba(23,18,15,0.04)", fontSize: 28, fontWeight: 800 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 999, background: index === 2 ? shell.blue : shell.line, color: index === 2 ? "white" : shell.ink, display: "grid", placeItems: "center", fontSize: 18 }}>{index + 1}</span>
                  {item}
                </div>
              );
            })}
          </div>
        </Card>
      </Sequence>

      <svg style={{ position: "absolute", left: 760, top: 502, width: 140, height: 80, overflow: "visible", opacity: bridge }} viewBox="0 0 140 80">
        <path d="M8 40 C 48 6, 92 74, 132 40" fill="none" stroke={shell.blue} strokeWidth="7" strokeLinecap="round" strokeDasharray="16 14" />
        <circle cx="132" cy="40" r={10 + pulse * 4} fill={shell.blue} opacity={0.9} />
      </svg>

      <FloatingPath text=".brain/data/**" top={310} left={770} delay={70} color={shell.blue} />
      <FloatingPath text=".brain/components/**" top={398} left={836} delay={80} color={shell.purple} />
      <FloatingPath text="Review Batch → Pi" top={224} left={1008} delay={90} color={shell.green} />

      <div style={{ position: "absolute", left: 92, bottom: 34, color: shell.muted, fontSize: 22 }}>Made with Remotion · examples/remotion-readme-preview</div>
    </AbsoluteFill>
  );
};
