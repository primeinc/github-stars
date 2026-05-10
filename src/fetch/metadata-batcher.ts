// Stage 2: per-repo metadata via aliased GraphQL batches.
// One request fetches N repos by aliasing r0..rN-1, all sharing one
// fragment. Local repro: 25 repos / batch / ~3.4s.

import { BAD_CREDENTIALS_ERROR } from "./list-paginator.js";
import type { OctokitClient } from "./octokit-client.js";
import {
	classifyPartial,
	errorMessage,
	errorStatus,
	isBadCredentials,
} from "./partial-graphql.js";
import type { FetchedRepo, StarListEntry } from "./types.js";

/**
 * Default per-batch size for stage-2 GraphQL batches. Tuned at
 * 25 — local repro shows ~3.4s per batch at this width.
 *
 * @public
 */
export const DEFAULT_METADATA_BATCH_SIZE = 25;

type RepoNode = {
	description: string | null;
	primaryLanguage: { name: string } | null;
	repositoryTopics: { nodes: Array<{ topic: { name: string } }> };
	isArchived: boolean;
	isFork: boolean;
	isPrivate: boolean;
	stargazerCount: number;
	forkCount: number;
	updatedAt: string;
	pushedAt: string;
	diskUsage: number | null;
	owner: { avatarUrl: string };
	url: string;
	defaultBranchRef: { name: string; target: { oid: string } | null } | null;
	homepageUrl: string | null;
	isMirror: boolean;
	mirrorUrl: string | null;
	licenseInfo: { spdxId: string | null } | null;
	latestRelease: { tagName: string; publishedAt: string } | null;
};

/**
 * Aggregate stage-2 result. `repos` is the hydrated metadata; the
 * org-blocked accumulator and the structured partial-failure reason
 * mirror the stage-1 paginators for symmetry.
 *
 * @public
 */
export type BatchOutcome = {
	repos: FetchedRepo[];
	batchCount: number;
	blockedOrgs: Set<string>;
	partialFailureReason: string;
};

/**
 * Options for {@link fetchMetadataInBatches}. `fragment` is the
 * GraphQL fragment loaded from `queries/stars-metadata-fragment.graphql`;
 * supplied as a string so tests can substitute without disk access.
 *
 * @public
 */
export type BatchOptions = {
	octokit: OctokitClient;
	fragment: string;
	list: StarListEntry[];
	batchSize?: number;
	log?: (msg: string) => void;
	warn?: (msg: string) => void;
};

/**
 * Fetch per-repo metadata in aliased GraphQL batches. One request
 * fetches `batchSize` repos by aliasing them as `r0..r{N-1}` against
 * a shared fragment.
 *
 * @remarks
 * `repository(owner, name)` is `serverToServer: true` so this path
 * works under all auth modes (including App installation tokens),
 * unlike `viewer.starredRepositories`.
 *
 * @param opts - Pre-authenticated client + fragment + stage-1 list.
 * @returns The hydrated metadata plus partial-failure context.
 *
 * @public
 */
export async function fetchMetadataInBatches(
	opts: BatchOptions,
): Promise<BatchOutcome> {
	const log = opts.log ?? (() => {});
	const warn = opts.warn ?? (() => {});
	const batchSize = opts.batchSize ?? DEFAULT_METADATA_BATCH_SIZE;
	const starredAtByRepo = new Map(
		opts.list.map((s) => [s.repo, s.user_starred_at]),
	);

	const repos: FetchedRepo[] = [];
	const blockedOrgs = new Set<string>();
	let batchCount = 0;
	let partialFailureReason = "";

	for (let i = 0; i < opts.list.length; i += batchSize) {
		// `s.repo` is `<owner>/<name>` per StarListEntry contract; under
		// noUncheckedIndexedAccess the destructured slots are typed
		// `string | undefined`. Skip malformed entries instead of letting
		// undefined leak into the GraphQL variables map.
		const batch = opts.list
			.flatMap((s) => {
				const [owner, name] = s.repo.split("/");
				if (!owner || !name) return [];
				return [{ owner, name, full: s.repo }];
			})
			.slice(i, i + batchSize);
		batchCount++;
		const query = buildBatchQuery(batch, opts.fragment);
		const vars: Record<string, string> = {};
		batch.forEach((b, j) => {
			vars[`o${j}`] = b.owner;
			vars[`n${j}`] = b.name;
		});

		let resp: Record<string, RepoNode | null> | null = null;
		try {
			resp = await opts.octokit.graphql<Record<string, RepoNode | null>>(
				query,
				vars,
			);
		} catch (error: unknown) {
			if (isBadCredentials(error)) {
				partialFailureReason = `bad_credentials_at_batch_${batchCount}`;
				warn(BAD_CREDENTIALS_ERROR);
				break;
			}
			const partial = classifyPartial(error);
			if (partial?.data && typeof partial.data === "object") {
				resp = partial.data as Record<string, RepoNode | null>;
				for (const org of partial.blockedOrgs) blockedOrgs.add(org);
			} else {
				partialFailureReason = `metadata_batch_${batchCount}_failed_after_${repos.length}_repos_status=${errorStatus(error)}_msg=${errorMessage(error)}`;
				warn(
					`Stage 2 batch ${batchCount} failed: ${errorMessage(error)}. ` +
						`Will write ${repos.length} partial results and fail.`,
				);
				break;
			}
		}

		if (resp) {
			for (let j = 0; j < batch.length; j++) {
				const node = resp[`r${j}`];
				const entry = batch[j];
				if (node && entry) {
					repos.push(transformNode(entry.full, node, starredAtByRepo));
				}
			}
			if (batchCount % 10 === 0) {
				log(
					`  batch ${batchCount}: ${repos.length}/${opts.list.length} fetched`,
				);
			}
		}
	}

	return { repos, batchCount, blockedOrgs, partialFailureReason };
}

/**
 * Compose a single GraphQL document that fetches metadata for `batch`
 * repositories in one round-trip. Each repo is aliased `r{i}` and
 * shares the supplied fragment; the variable declarations follow the
 * `$o{i}: String!, $n{i}: String!` convention.
 *
 * @remarks
 * Exposed for unit testing the document shape without spinning up
 * the full batcher loop.
 *
 * @param batch - The batch of `{ owner, name }` pairs to alias.
 * @param fragment - The shared GraphQL fragment text.
 * @returns The composed multi-alias GraphQL document.
 *
 * @public
 */
export function buildBatchQuery(
	batch: ReadonlyArray<{ owner: string; name: string }>,
	fragment: string,
): string {
	const varDecls = batch
		.map((_, i) => `$o${i}: String!, $n${i}: String!`)
		.join(", ");
	const aliases = batch
		.map(
			(_, i) =>
				`r${i}: repository(owner: $o${i}, name: $n${i}) { ...RepoMetadata }`,
		)
		.join("\n  ");
	return `${fragment}\nquery(${varDecls}) {\n  ${aliases}\n}`;
}

function transformNode(
	repoFullName: string,
	node: RepoNode,
	starredAtByRepo: Map<string, string>,
): FetchedRepo {
	return {
		repo: repoFullName,
		description: node.description ?? "",
		language: node.primaryLanguage?.name ?? null,
		topics: node.repositoryTopics.nodes.map((n) => n.topic.name),
		archived: node.isArchived,
		fork: node.isFork,
		private: node.isPrivate,
		stargazers_count: node.stargazerCount,
		forks_count: node.forkCount,
		updated_at: node.updatedAt,
		pushed_at: node.pushedAt,
		disk_usage: node.diskUsage,
		owner_avatar: node.owner.avatarUrl,
		html_url: node.url,
		default_branch: node.defaultBranchRef?.name ?? "main",
		last_commit_sha: node.defaultBranchRef?.target?.oid ?? null,
		user_starred_at: starredAtByRepo.get(repoFullName) ?? null,
		homepage_url: node.homepageUrl,
		is_mirror: node.isMirror,
		mirror_url: node.mirrorUrl,
		license: node.licenseInfo?.spdxId ?? null,
		latest_release: node.latestRelease
			? {
					tag: node.latestRelease.tagName,
					published_at: node.latestRelease.publishedAt,
				}
			: null,
	};
}
