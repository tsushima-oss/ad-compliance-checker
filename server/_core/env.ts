export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY ?? "",
  // Kept for backward compat (unused)
  ownerOpenId: "",
  forgeApiUrl: "",
  forgeApiKey: "",
};
