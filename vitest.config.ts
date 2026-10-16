import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: { obsidian: import.meta.resolve("obsidian-test-mocks/obsidian") },
	},
	test: {
		environment: "happy-dom",
		setupFiles: ["obsidian-test-mocks/vitest-setup"],
	},
});
