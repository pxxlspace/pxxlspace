import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main>
      <section>
        <p>Pxxl React Boilerplate</p>
        <h1>Build, deploy, and scale your React app on Pxxl.</h1>
        <a href="https://pxxl.app/dashboard/deploy">Deploy on Pxxl</a>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
