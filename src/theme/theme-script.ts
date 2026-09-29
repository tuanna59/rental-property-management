import { THEME_STORAGE_KEY } from "./theme";

export const themeBootstrapScript = `
try {
  var key = ${JSON.stringify(THEME_STORAGE_KEY)};
  var preference = localStorage.getItem(key);
  if (preference !== "light" && preference !== "dark" && preference !== "system") preference = "system";
  var resolved = preference === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
} catch {
  document.documentElement.dataset.themePreference = "system";
  document.documentElement.dataset.theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
`;
