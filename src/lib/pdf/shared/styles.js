import { StyleSheet } from "@react-pdf/renderer";

export const COLORS = {
  ink: "#1A1A1A",
  ink2: "#475569",
  ink3: "#6B7280",
  brand: "#2563EB",
  brandDeep: "#1D4ED8",
  brandSoft: "#EEF2FF",
  line: "#E2E8F0",
  white: "#FFFFFF",
  green: "#16A34A",
  amber: "#D97706",
};

export const SIZES = {
  cover: 48,
  h1: 28,
  h2: 20,
  h3: 16,
  body: 11,
  question: 12,
  small: 10,
  footer: 9,
};

export const PAGE = {
  size: "LETTER",
  margins: { top: 54, right: 54, bottom: 54, left: 54 },
};

// The templates render entirely with the PDF built-in fonts (Helvetica /
// Helvetica-Bold), so no remote font registration is needed. A previous
// version registered an "Inter" font from a gstatic URL that now 404s — never
// referenced, but a needless runtime fetch/footgun, so it's removed.
export function ensureFonts() {}

export const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE.margins.top,
    paddingBottom: PAGE.margins.bottom + 22,
    paddingLeft: PAGE.margins.left,
    paddingRight: PAGE.margins.right,
    fontFamily: "Helvetica",
    color: COLORS.ink,
    fontSize: SIZES.body,
    lineHeight: 1.45,
  },
  coverPage: {
    paddingTop: 120,
    paddingBottom: PAGE.margins.bottom + 22,
    paddingLeft: PAGE.margins.left,
    paddingRight: PAGE.margins.right,
    fontFamily: "Helvetica",
    color: COLORS.ink,
  },
  coverEyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.brand,
    fontFamily: "Helvetica-Bold",
    marginBottom: 16,
    textTransform: "uppercase",
  },
  coverTitle: {
    fontSize: SIZES.cover,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.05,
    marginBottom: 16,
    color: COLORS.ink,
  },
  coverSubtitle: {
    fontSize: 16,
    color: COLORS.ink2,
    lineHeight: 1.4,
    marginBottom: 36,
  },
  coverMeta: {
    fontSize: SIZES.small,
    color: COLORS.ink3,
    marginTop: 4,
  },
  h1: {
    fontSize: SIZES.h1,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginBottom: 12,
  },
  h2: {
    fontSize: SIZES.h2,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginBottom: 10,
    marginTop: 6,
  },
  h3: {
    fontSize: SIZES.h3,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginBottom: 6,
  },
  sectionEyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: COLORS.brand,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  body: {
    fontSize: SIZES.body,
    color: COLORS.ink,
    lineHeight: 1.5,
  },
  muted: {
    fontSize: SIZES.small,
    color: COLORS.ink3,
  },
  question: {
    fontSize: SIZES.question,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginBottom: 8,
    lineHeight: 1.35,
  },
  choiceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
    gap: 8,
  },
  choiceBubble: {
    width: 11,
    height: 11,
    // Half the box = a perfect circle. A radius far larger than the element
    // (was 999) makes @react-pdf's browser path math emit a garbage number,
    // which aborts the whole render with "unsupported number".
    borderRadius: 5.5,
    borderWidth: 1,
    borderColor: COLORS.ink3,
    marginTop: 2,
  },
  choiceText: {
    fontSize: SIZES.body,
    color: COLORS.ink,
    flex: 1,
  },
  tintBox: {
    backgroundColor: COLORS.brandSoft,
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
  },
  ruledLine: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.line,
    height: 22,
    marginBottom: 0,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.line,
    marginVertical: 12,
  },
  qNumber: {
    fontFamily: "Helvetica-Bold",
    color: COLORS.brand,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.line,
  },
  badge: {
    fontSize: 9,
    color: COLORS.brand,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
