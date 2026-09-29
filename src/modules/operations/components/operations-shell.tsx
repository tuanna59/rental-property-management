import type { ReactNode } from "react";

import "./operations.css";

export function OperationsShell({ children }: { children: ReactNode }) {
  return (
    <main className="operations-app">
      <div className="operations-workspace">
        <div className="operations-content">{children}</div>
      </div>
    </main>
  );
}
