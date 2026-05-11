// TanStack Start static-prerender configuration for the github-stars
// site. Build target: GitHub Pages at
// https://primeinc.github.io/github-stars/.
//
// Doctrine sources (canonical, from refs/TanStack/router/examples/react/):
//   - start-basic-static/vite.config.ts — SPA + prerender shape
//   - start-tailwind-v4/vite.config.ts  — @tailwindcss/vite plugin
//
// Build output stays at web/dist (the TanStack-canonical layout)
// so the SSR prerender step can resolve `react` from
// web/node_modules. The 04-build-site.yml workflow copies
// `web/dist/client/*` → `docs/` for the GH Pages artifact.

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	base: "/github-stars/",
	server: {
		port: 3000,
	},
	resolve: {
		tsconfigPaths: true,
	},
	// Build output stays inside web/dist (default) so the SSR
	// prerender step can resolve `react` from web/node_modules.
	// The deploy workflow (04-build-site.yml) copies dist/client/* to
	// docs/ for the GitHub Pages publish artifact.
	plugins: [
		tailwindcss(),
		tanstackStart({
			spa: {
				enabled: true,
				prerender: {
					crawlLinks: true,
				},
			},
			prerender: {
				failOnError: true,
			},
		}),
		viteReact(),
	],
});
