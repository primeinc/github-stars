// Single-card presenter. Class `repository-card` is preserved as a
// playwright selector hook (web/tests/smoke.spec.ts).

import { GitFork, Star } from "lucide-react";
import type { Repo } from "../types";

const LANG_COLORS: Record<string, string> = {
	JavaScript: "#f1e05a",
	TypeScript: "#3178c6",
	Python: "#3572A5",
	Java: "#b07219",
	Go: "#00ADD8",
	Rust: "#dea584",
	"C++": "#f34b7d",
	C: "#555555",
	Shell: "#89e051",
	HTML: "#e34c26",
	CSS: "#563d7c",
	Vue: "#41b883",
	Ruby: "#701516",
	"C#": "#178600",
	PHP: "#4F5D95",
	Kotlin: "#A97BFF",
	Swift: "#F05138",
	Dart: "#00B4AB",
};

function formatNumber(num: number): string {
	if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
	if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
	return String(num);
}

const FALLBACK_AVATAR =
	'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="%23ccc"/></svg>';

export function RepoCard({ repo }: { repo: Repo }) {
	const fallbackAvatar = `https://github.com/${repo.repo.split("/")[0]}.png`;
	return (
		<div className="repository-card flex flex-col gap-2 rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-gray-900">
			<div className="flex items-center gap-2">
				<img
					src={repo.avatar ?? fallbackAvatar}
					alt=""
					loading="lazy"
					className="h-6 w-6 rounded-full"
					onError={(e) => {
						(e.currentTarget as HTMLImageElement).src = FALLBACK_AVATAR;
					}}
				/>
				<a
					href={repo.html_url}
					target="_blank"
					rel="noopener noreferrer"
					className="truncate font-mono text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
				>
					{repo.repo}
				</a>
			</div>
			<p
				className="line-clamp-3 text-sm text-gray-600 dark:text-gray-300"
				title={repo.summary}
			>
				{repo.summary || "No description provided."}
			</p>
			<div className="mt-auto flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
				<span className="flex items-center gap-1" title="Stars">
					<Star size={14} />
					<span>{formatNumber(repo.stars)}</span>
				</span>
				<span className="flex items-center gap-1" title="Forks">
					<GitFork size={14} />
					<span>{formatNumber(repo.forks)}</span>
				</span>
				{repo.language ? (
					<span className="flex items-center gap-1">
						<span
							className="inline-block h-2 w-2 rounded-full"
							style={{ backgroundColor: LANG_COLORS[repo.language] ?? "#ccc" }}
						/>
						<span>{repo.language}</span>
					</span>
				) : null}
			</div>
		</div>
	);
}
