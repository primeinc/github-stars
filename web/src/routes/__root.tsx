// Root document for the github-stars site. TanStack Start owns the
// `<html>` shell so the prerender step can flush static markup.
//
// The route declares head() metadata (title, viewport, charset, css
// link) and a RootComponent that renders the `<Outlet />` for child
// routes (currently only `/`).

/// <reference types="vite/client" />

import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRoute,
} from "@tanstack/react-router";
import * as React from "react";
import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{ title: "web" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	component: RootComponent,
});

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen">
				{children}
				<Scripts />
			</body>
		</html>
	);
}
