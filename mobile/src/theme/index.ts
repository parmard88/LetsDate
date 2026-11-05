// Design system — ported from Next.js frontend (globals.css)
// Colors match the web frontend exactly

export const COLORS = {
  background: "#fffaf7",
  foreground: "#292321",
  muted: "#766d69",
  primary: "#c95767",
  primaryDark: "#a83d50",
  roseLight: "#f8e6e5",
  cream: "#fff2e9",
  line: "#eee3de",
  white: "#ffffff",
  errorBg: "#fff1f1",
  errorText: "#9d3030",
  errorBorder: "#e9b8b8",
  successBg: "#f0faf3",
  successText: "#276b43",
  successBorder: "#cce8d6",
  photoPlaceholderBg: "#faf3ef",
  border: "#e8e8e8",
  chatBubbleMine: "#d6336c",
  chatBubbleMineText: "#ffffff",
  chatBubbleTheirs: "#ffffff",
  chatBubbleTheirsBorder: "#e8e8e8",
  chatBubbleTheirsText: "#222222",
  chatBg: "#fafafa",
  avatarBg: "#f5dce6",
  avatarText: "#a51d50",
} as const;

export const TYPOGRAPHY = {
  fontFamily: "Arial",
  fontFamilySerif: "Georgia",
  h1: {
    fontFamily: "Georgia",
    fontSize: 32,
    fontWeight: "500" as const,
    letterSpacing: -1.8,
    color: "#292321",
  },
  h2: {
    fontFamily: "Georgia",
    fontSize: 24,
    fontWeight: "500" as const,
    letterSpacing: -1.8,
    color: "#292321",
  },
  h3: {
    fontFamily: "Georgia",
    fontSize: 20,
    fontWeight: "500" as const,
    color: "#292321",
  },
  body: {
    fontSize: 13,
    lineHeight: 1.8,
    color: "#766d69",
  },
  caption: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
    color: "#514844",
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 2,
    color: "#a83d50",
    textTransform: "uppercase" as const,
  },
} as const;

export const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BORDER_RADIUS = {
  sm: 5,
  md: 7,
  lg: 12,
  xl: 14,
  pill: 999,
} as const;

export const SHADOWS = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.035,
    shadowRadius: 35,
    elevation: 4,
  },
  button: {
    shadowColor: "#c95767",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
} as const;

export const BUTTON = {
  primary: {
    backgroundColor: "#c95767",
    borderColor: "#c95767",
  },
  primaryDark: {
    backgroundColor: "#a83d50",
    borderColor: "#a83d50",
  },
} as const;

export const MAX_PHOTOS = 6;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
] as const;

export const PREFERRED_GENDER_OPTIONS = [
  { value: "everyone", label: "Everyone" },
  { value: "male", label: "Men" },
  { value: "female", label: "Women" },
  { value: "non-binary", label: "Non-binary people" },
] as const;

export const RELATIONSHIP_GOAL_OPTIONS = [
  { value: "long-term", label: "Long-term relationship" },
  { value: "short-term", label: "Short-term relationship" },
  { value: "friendship", label: "Friendship" },
  { value: "unsure", label: "Still figuring it out" },
] as const;

export const DISCLOSURED_GENDERS = ["male", "female", "non-binary", "other"];

export const APP_NAME = "LetsDate";
export const HEART_MARK = "♡";
