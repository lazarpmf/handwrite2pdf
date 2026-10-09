const LICENSE_KEY = "inktex.licenseKey";
const LATEX_DRAFT = "inktex.latexDraft";

export function getStoredLicense(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LICENSE_KEY) || "";
}

export function setStoredLicense(key: string): void {
  localStorage.setItem(LICENSE_KEY, key.trim().toUpperCase());
}

export function clearStoredLicense(): void {
  localStorage.removeItem(LICENSE_KEY);
}

export function getStoredLatex(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LATEX_DRAFT) || "";
}

export function setStoredLatex(latex: string): void {
  localStorage.setItem(LATEX_DRAFT, latex);
}
