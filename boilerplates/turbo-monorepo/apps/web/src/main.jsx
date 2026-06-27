import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Badge } from "@pxxl/turbo-ui";
import "./styles.css";

function App() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => setStatus(data.status || "ok"))
      .catch(() => setStatus("api unavailable"));
  }, []);

  return (
    <main>
      <Badge>Turbo Monorepo</Badge>
      <h1>Ship web and API services on Pxxl</h1>
      <p>This starter is split into deployable services and shared workspace packages.</p>
      <div className="status">API status: {status}</div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
