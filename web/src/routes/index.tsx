// Single-route SPA index — port of the previous web/src/App.jsx.
// All filtering, sorting, and faceting happens client-side against
// `data.json` (committed to docs/ alongside the static build by
// .github/workflows/04-build-site.yml).

import { createFileRoute } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { Github } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RepoCard } from "../components/RepoCard";
import type {
	Filters,
	ManifestData,
	ManifestRepoEntry,
	Repo,
	SortKey,
} from "../types";

export const Route = createFileRoute("/")({
	component: IndexPage,
});

function normalize(entries: ManifestRepoEntry[]): Repo[] {
	return entries.map((repo) => ({
		repo: repo.repo,
		summary: repo.summary ?? "",
		categories: repo.categories ?? [],
		archived: Boolean(repo.archived),
		html_url:
			repo.github_metadata?.html_url ?? `https://github.com/${repo.repo}`,
		homepage_url: repo.github_metadata?.homepage_url ?? null,
		stars: repo.github_metadata?.stargazers_count ?? 0,
		forks: repo.github_metadata?.forks_count ?? 0,
		language: repo.github_metadata?.language ?? "Unknown",
		topics: repo.github_metadata?.topics ?? [],
		user_starred_at: repo.user_starred_at ?? null,
		pushed_at: repo.github_metadata?.repo_pushed_at ?? null,
		is_template: Boolean(repo.github_metadata?.is_template),
		avatar: repo.github_metadata?.owner_avatar ?? null,
	}));
}

type FilterKey = "category" | "language" | "topic";

function IndexPage() {
	const [repos, setRepos] = useState<Repo[]>([]);
	const [loading, setLoading] = useState(true);
	const [filters, setFilters] = useState<Filters>({
		search: "",
		category: null,
		language: null,
		topic: null,
		archived: false,
		template: false,
	});
	const [sortBy, setSortBy] = useState<SortKey>("starred");

	useEffect(() => {
		fetch("data.json")
			.then((res) => res.json() as Promise<ManifestData>)
			.then((data) => {
				setRepos(normalize(data.repositories ?? []));
				setLoading(false);
			})
			.catch((err: unknown) => {
				console.error(err);
				setLoading(false);
			});
	}, []);

	const fuse = useMemo(
		() =>
			new Fuse(repos, {
				keys: ["repo", "summary", "categories", "language", "topics"],
				threshold: 0.3,
			}),
		[repos],
	);

	const getFilteredRepos = useCallback(
		(excludeKey: FilterKey | "archived" | "template" | null = null) => {
			let result = repos;
			if (filters.search) {
				result = fuse.search(filters.search).map((r) => r.item);
			}
			return result.filter((repo) => {
				if (excludeKey !== "archived" && !filters.archived && repo.archived)
					return false;
				if (excludeKey !== "template" && filters.template && !repo.is_template)
					return false;
				if (
					excludeKey !== "category" &&
					filters.category &&
					!repo.categories.includes(filters.category)
				)
					return false;
				if (
					excludeKey !== "language" &&
					filters.language &&
					repo.language !== filters.language
				)
					return false;
				if (
					excludeKey !== "topic" &&
					filters.topic &&
					!repo.topics.includes(filters.topic)
				)
					return false;
				return true;
			});
		},
		[repos, filters, fuse],
	);

	const filteredRepos = useMemo(() => {
		const filtered = getFilteredRepos();
		const list = [...filtered];
		switch (sortBy) {
			case "starred":
				return list.sort((a, b) => {
					const at = a.user_starred_at
						? new Date(a.user_starred_at).getTime()
						: Number.NEGATIVE_INFINITY;
					const bt = b.user_starred_at
						? new Date(b.user_starred_at).getTime()
						: Number.NEGATIVE_INFINITY;
					return bt - at;
				});
			case "stars":
				return list.sort((a, b) => b.stars - a.stars);
			case "pushed":
				return list.sort(
					(a, b) =>
						new Date(b.pushed_at ?? 0).getTime() -
						new Date(a.pushed_at ?? 0).getTime(),
				);
			case "name":
				return list.sort((a, b) => a.repo.localeCompare(b.repo));
		}
	}, [getFilteredRepos, sortBy]);

	const facets = useMemo(() => {
		const getCounts = (
			items: Repo[],
			key: keyof Repo,
			isArray: boolean,
		): Array<[string, number]> => {
			const counts = new Map<string, number>();
			for (const item of items) {
				const val = item[key];
				if (isArray && Array.isArray(val)) {
					for (const v of val as string[]) {
						counts.set(v, (counts.get(v) ?? 0) + 1);
					}
				} else if (typeof val === "string" && val) {
					counts.set(val, (counts.get(val) ?? 0) + 1);
				}
			}
			return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
		};
		return {
			categories: getCounts(getFilteredRepos("category"), "categories", true).slice(
				0,
				15,
			),
			languages: getCounts(getFilteredRepos("language"), "language", false).slice(
				0,
				10,
			),
			topics: getCounts(getFilteredRepos("topic"), "topics", true).slice(0, 15),
		};
	}, [getFilteredRepos]);

	return (
		<div className="flex min-h-screen flex-col md:flex-row">
			<aside className="w-full shrink-0 border-r p-4 md:w-72 md:overflow-y-auto">
				<div className="mb-4 flex items-center gap-2 text-lg font-semibold">
					<Github className="h-5 w-5" />
					<span>Star Vault</span>
				</div>
				<div className="space-y-4 text-sm">
					<div className="space-y-2">
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={filters.archived}
								onChange={(e) =>
									setFilters((f) => ({ ...f, archived: e.target.checked }))
								}
							/>
							Show Archived
						</label>
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={filters.template}
								onChange={(e) =>
									setFilters((f) => ({ ...f, template: e.target.checked }))
								}
							/>
							Templates Only
						</label>
					</div>

					<FacetSection
						title="Categories"
						active={filters.category}
						items={facets.categories}
						onPick={(v) =>
							setFilters((f) => ({
								...f,
								category: f.category === v ? null : v,
							}))
						}
						onClear={() => setFilters((f) => ({ ...f, category: null }))}
					/>
					<FacetSection
						title="Languages"
						active={filters.language}
						items={facets.languages}
						onPick={(v) =>
							setFilters((f) => ({
								...f,
								language: f.language === v ? null : v,
							}))
						}
						onClear={() => setFilters((f) => ({ ...f, language: null }))}
					/>
				</div>
			</aside>

			<main className="flex-1 p-4">
				<div className="mb-4 flex items-center gap-2">
					<input
						type="text"
						placeholder="Search repositories..."
						className="flex-1 rounded border bg-white px-3 py-2 text-sm dark:bg-gray-900"
						value={filters.search}
						onChange={(e) =>
							setFilters((f) => ({ ...f, search: e.target.value }))
						}
					/>
					<select
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value as SortKey)}
						className="rounded border bg-white px-3 py-2 text-sm dark:bg-gray-900"
					>
						<option value="starred">Recently Starred</option>
						<option value="stars">Most Stars</option>
						<option value="pushed">Recently Updated</option>
						<option value="name">Name (A-Z)</option>
					</select>
				</div>

				{loading ? (
					<div className="p-8 text-center text-gray-500">
						Loading repositories...
					</div>
				) : filteredRepos.length === 0 ? (
					<div className="p-8 text-center text-gray-500">
						No repositories found matching filters.
					</div>
				) : (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{filteredRepos.map((repo) => (
							<RepoCard key={repo.html_url} repo={repo} />
						))}
					</div>
				)}
			</main>
		</div>
	);
}

function FacetSection({
	title,
	active,
	items,
	onPick,
	onClear,
}: {
	title: string;
	active: string | null;
	items: Array<[string, number]>;
	onPick: (value: string) => void;
	onClear: () => void;
}) {
	return (
		<div>
			<div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
				<span>{title}</span>
				{active ? (
					<button
						type="button"
						className="text-blue-500 hover:underline"
						onClick={onClear}
					>
						Clear
					</button>
				) : null}
			</div>
			<div className="flex flex-col gap-1">
				{items.map(([value, count]) => (
					<button
						key={value}
						type="button"
						onClick={() => onPick(value)}
						className={`flex justify-between rounded px-2 py-1 text-left text-sm ${
							active === value
								? "bg-blue-100 dark:bg-blue-900"
								: "hover:bg-gray-100 dark:hover:bg-gray-800"
						}`}
					>
						<span className="truncate">{value}</span>
						<span className="text-gray-500">{count}</span>
					</button>
				))}
			</div>
		</div>
	);
}
