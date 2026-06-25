// The PDF templates render with built-in fonts (Helvetica), which only support
// WinAnsi-encodable characters. Content without a glyph — common in math /
// science material (√ θ π − ≤ ⁴ …) — makes @react-pdf compute a NaN glyph
// width, which surfaces downstream as "unsupported number: <garbage>" from
// pdfkit and aborts the whole download. We map the common symbols to readable
// ASCII and drop anything else outside the safe range so the PDF always renders.

const REPLACEMENTS = {
  "−": "-", "–": "-", "—": "-", "‐": "-", "‑": "-",
  "×": "x", "÷": "/", "·": "*", "•": "-",
  "√": "sqrt", "∛": "cbrt",
  "≤": "<=", "≥": ">=", "≠": "!=", "≈": "~", "≡": "==",
  "∞": "infinity", "∑": "sum", "∏": "product", "∫": "integral",
  "∂": "d", "∇": "grad", "∝": "proportional to",
  "°": " deg", "′": "'", "″": "\"", "∠": "angle ",
  "±": "+/-", "∓": "-/+",
  "→": "->", "←": "<-", "↔": "<->", "⇒": "=>", "⇐": "<=",
  "…": "...",
  "“": "\"", "”": "\"", "‘": "'", "’": "'", "‚": ",", "„": "\"",
  "²": "^2", "³": "^3", "¹": "^1",
  "⁰": "^0", "⁴": "^4", "⁵": "^5", "⁶": "^6", "⁷": "^7",
  "⁸": "^8", "⁹": "^9", "ⁿ": "^n",
  "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3",
  "π": "pi", "θ": "theta", "Δ": "delta", "δ": "delta",
  "α": "alpha", "β": "beta", "γ": "gamma", "λ": "lambda",
  "μ": "mu", "Σ": "Sigma", "Ω": "Omega", "ω": "omega",
  "φ": "phi", "Φ": "Phi", "ρ": "rho",
  " ": " ",
};

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const RE = new RegExp(Object.keys(REPLACEMENTS).map(escapeRe).join("|"), "g");

export function sanitizePdfText(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(RE, (m) => REPLACEMENTS[m])
    // Strip diacritics so accented Latin letters degrade to their ASCII base
    // (é→e, ñ→n) instead of vanishing.
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    // Then keep ONLY ASCII printable (+ tab/newline). The built-in PDF font's
    // metrics return a garbage advance width for some non-ASCII glyphs in the
    // browser, which surfaces as "unsupported number: -1.7e+21" and aborts the
    // whole download. Restricting to ASCII guarantees every glyph is
    // measurable. (Platform output is English; symbols/Greek are already
    // mapped to ASCII by the table above.)
    .replace(/[^\t\n\r\x20-\x7E]/g, "");
}

// Recursively clean every string in a data object/array passed to a template.
export function deepSanitizePdf(value) {
  if (typeof value === "string") return sanitizePdfText(value);
  if (Array.isArray(value)) return value.map(deepSanitizePdf);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = deepSanitizePdf(value[k]);
    return out;
  }
  return value;
}
