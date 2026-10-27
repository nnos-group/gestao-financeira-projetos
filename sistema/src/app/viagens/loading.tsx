/**
 * Feedback visual imediato durante a navegação para /viagens (página renderizada no servidor).
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        background: "var(--background, #f9f9ff)",
        color: "var(--on-surface-variant, #44474e)",
        fontSize: "13px",
        fontWeight: 600,
      }}
    >
      <style>{`@keyframes nnos-spin{to{transform:rotate(360deg)}}`}</style>
      <div
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          border: "3px solid var(--border, #d8dce6)",
          borderTopColor: "var(--secondary, #006781)",
          animation: "nnos-spin 0.7s linear infinite",
        }}
      />
      <span>Carregando módulo…</span>
    </div>
  );
}
