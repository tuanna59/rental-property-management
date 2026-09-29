import type { ReactNode } from "react";
import "./assets.css";

export function AssetsShell({ children }: { children: ReactNode }) {
  return <main className="assets-page">{children}</main>;
}
