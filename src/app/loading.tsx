// Shows while page.tsx is fetching BirdEye data
export default function Loading() {
  return (
    <div>
      {/* Ticker skeleton */}
      <div
        style={{
          borderBottom: "1px solid var(--cw-border)",
          backgroundColor: "rgba(255,255,255,0.02)",
          height: 36,
        }}
      />

      <div style={{ padding: "20px" }}>
        <div
          style={{
            width: 120,
            height: 11,
            borderRadius: 4,
            backgroundColor: "rgba(255,255,255,0.06)",
            marginBottom: 10,
          }}
        />

        {/* Tab skeletons */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {[80, 60, 55].map((w, i) => (
            <div
              key={i}
              style={{
                width: w,
                height: 28,
                borderRadius: 6,
                backgroundColor: "rgba(255,255,255,0.05)",
              }}
            />
          ))}
        </div>

        {/* Card skeletons */}
        <div className="token-grid" style={{ gap: 10 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "var(--cw-card)",
                border: "1px solid var(--cw-border)",
                borderRadius: 10,
                padding: 12,
                height: 148,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ width: "60%", height: 12, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 6 }} />
                  <div style={{ width: "40%", height: 10, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.04)" }} />
                </div>
              </div>
              <div style={{ width: "70%", height: 14, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 6 }} />
              <div style={{ width: "40%", height: 11, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.04)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
