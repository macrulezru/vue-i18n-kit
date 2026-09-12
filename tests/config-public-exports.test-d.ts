import { describe, it, expect } from "vitest";
import type {
  I18nKitConfig,
  LocaleConfig,
  LocaleMeta,
} from "../src/config/public.js";

// Regression: I18nKitConfig/LocaleConfig/LocaleMeta describe the actual
// i18n-kit.config.json shape and are used pervasively by every CLI command,
// but used to live only behind src/config/index.ts (internal I/O helpers,
// not a build entry) — a consumer type-checking a hand-written or generated
// i18n-kit.config.json programmatically couldn't import them from the
// public `vue-i18n-kit/config` subpath (built from src/config/public.ts,
// see tsup.config.ts's `'config/index': 'src/config/public.ts'` entry).
describe("config/public.ts type exports", () => {
  it("exports I18nKitConfig, LocaleConfig, LocaleMeta for consumers to type-check their own config", () => {
    const meta: LocaleMeta = { display: "English" };
    const locale: LocaleConfig = {
      code: "en",
      path: "locales/en.json",
      meta,
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
    };
    const config: I18nKitConfig = {
      version: 1,
      localesDir: "locales",
      toolkitDir: ".i18n-kit",
      locales: [locale],
      integrations: { pluginAdded: false, lastUpdated: "2024-01-01" },
    };
    expect(config.locales).toHaveLength(1);
  });
});
