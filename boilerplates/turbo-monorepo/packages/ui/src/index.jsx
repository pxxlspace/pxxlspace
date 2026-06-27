export function Badge({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        border: "1px solid #953d92",
        borderRadius: 8,
        padding: "8px 10px",
        color: "#f4d7f3",
        background: "rgba(149, 61, 146, 0.16)",
        fontSize: 13,
      }}
    >
      {children}
    </span>
  );
}
