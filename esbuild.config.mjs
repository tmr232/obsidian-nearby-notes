import * as esbuild from "esbuild";

const production = process.argv.includes("production");
const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian"],
	format: "cjs",
	target: "es2018",
	platform: "browser",
	outfile: "main.js",
	sourcemap: production ? false : "inline",
	minify: production,
	logLevel: "info",
});
if (production) {
	await context.rebuild();
	await context.dispose();
} else {
	await context.watch();
}
