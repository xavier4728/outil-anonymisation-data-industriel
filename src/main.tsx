import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { Fournisseur } from "./etat";

createRoot(document.getElementById("racine")!).render(
  <StrictMode>
    <Fournisseur>
      <App />
    </Fournisseur>
  </StrictMode>,
);
