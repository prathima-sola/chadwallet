export default function Loading() {
  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header skeleton */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--cw-border)",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)" }} />
        <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)" }} />
        <div>
          <div style={{ width: 100, height: 14, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 6 }} />
          <div style={{ width: 60, height: 11, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.04)" }} />
        </div>
        <div style={{ width: 120, height: 22, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)", marginLeft: 16 }} />
      </div>

      {/* Chart + panel skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px" }}>
        <div
          style={{
            height: 432,
            borderRight: "1px solid var(--cw-border)",
            borderBottom: "1px solid var(--cw-border)",
            backgroundColor: "rgba(255,255,255,0.01)",
          }}
        />
        <div
          style={{
            height: 432,
            borderBottom: "1px solid var(--cw-border)",
            backgroundColor: "rgba(255,255,255,0.01)",
          }}
        />
      </div>
    </div>
  );
}
