import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TransformerAssembly } from "./components/TransformerAssembly";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TransformerAssembly />
  </StrictMode>,
);
