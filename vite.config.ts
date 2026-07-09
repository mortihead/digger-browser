import { defineConfig } from "vite";

// Относительный base, чтобы собранная игра работала из подпапки
// (например, https://<user>.github.io/digger-browser/) без привязки к имени репозитория.
export default defineConfig({
  base: "./",
});
