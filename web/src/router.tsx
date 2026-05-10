// Router factory consumed by TanStack Start. The `basepath` matches
// the GH Pages subpath; `scrollRestoration` keeps the browser's
// position after route transitions.

import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createRouter({
		routeTree,
		basepath: "/github-stars/",
		defaultPreload: "intent",
		scrollRestoration: true,
	});

	return router;
}
