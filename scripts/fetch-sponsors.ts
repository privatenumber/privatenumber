import fs from 'fs/promises';
import { cli } from 'cleye';
import { graphql } from '@octokit/graphql';
import { gql } from 'code-tag';
import { commentMark } from 'comment-mark';

const argv = cli({
	name: 'fetch-sponsors',
	flags: {
		force: {
			type: Boolean,
			alias: 'f',
			description: 'Force update even if no changes detected',
		},
	},
});

type GitHubGraphQlPageInfo = {
	endCursor: string;
	hasNextPage: boolean;
};

type GraphQlResult<Property extends string, T> = {
	viewer: {
		[Key in Property]: T & {
			totalCount: number;
			pageInfo: GitHubGraphQlPageInfo;
		};
	};
};

const getAllPages = async <
	Property extends string,
	Fetch extends (cursor?: string) => Promise<GraphQlResult<Property, unknown>>,
>(
	property: Property,
	getPage: Fetch,
) => {
	const allItems: unknown[] = [];
	let pageInfo: GitHubGraphQlPageInfo | undefined;
	do {
		const page = await getPage(pageInfo?.endCursor);
		const result = page.viewer[property];
		allItems.push(result);

		pageInfo = result.pageInfo;
	} while (pageInfo.hasNextPage);

	return allItems as Awaited<ReturnType<Fetch>>['viewer'][Property][];
};

type SponsorType = 'User' | 'Organization';

type Sponsor = {
	login: string;
	avatarUrl: string;
};

type SponsorEntity = {
	nodes: {
		sponsorEntity: Sponsor & {
			__typename: SponsorType;
		};
	}[];
};

const readmeAvatarSize = 60;

const getCanonicalAvatarUrl = (
	avatarUrl: string,
) => {
	const url = new URL(avatarUrl);
	url.searchParams.delete('s');
	return url.toString();
};

const getSizedAvatarUrl = (
	avatarUrl: string,
	size: number,
) => {
	const url = new URL(avatarUrl);
	const searchParams = new URLSearchParams([
		['s', String(size)],
	]);
	for (const [key, value] of url.searchParams) {
		if (key !== 's') {
			searchParams.append(key, value);
		}
	}
	url.search = searchParams.toString();
	return url.toString();
};

const getSponsors = async (
	cursor?: string,
) => graphql<GraphQlResult<'sponsorshipsAsMaintainer', SponsorEntity>>(
	gql`
		query {
			viewer {
				sponsorshipsAsMaintainer(
					first: 100,
					orderBy: { field: CREATED_AT, direction: ASC },
					activeOnly: false,
					${cursor ? `after: "${cursor}"` : ''}
				) {
					totalCount
					pageInfo {
						endCursor
						hasNextPage
					}
					nodes {
						${

						/**
						 * We don't need to filter by privacy level
						 * because includePrivate defaults to false
						 */
						''
						}
						sponsorEntity {
							__typename
							... on User { login avatarUrl }
							... on Organization { login avatarUrl }
						}
					}
				}
			}
		}
	`,
	{
		headers: {
			authorization: `token ${process.env.GH_TOKEN}`,
		},
	},
);

const escapeHtmlAttribute = (
	value: string,
) => value
	.replaceAll('&', '&amp;')
	.replaceAll('"', '&quot;')
	.replaceAll('<', '&lt;')
	.replaceAll('>', '&gt;');

const generateHtml = (
	sponsors: Sponsor[],
) => `
	<p align="center">${
		sponsors
			.map(
				({ avatarUrl, login }) => `<a href="https://github.com/${escapeHtmlAttribute(login)}" title="${escapeHtmlAttribute(login)}"><img src="${escapeHtmlAttribute(getSizedAvatarUrl(avatarUrl, readmeAvatarSize))}" width="30"></a>`,
			)
			.join(' ')
	}</p>
	`.trim();

(async () => {
	const resultPages = await getAllPages('sponsorshipsAsMaintainer', getSponsors);

	const userSponsors: Sponsor[] = [];
	const orgSponsors: Sponsor[] = [];

	for (const page of resultPages) {
		for (const { sponsorEntity } of page.nodes) {
			const sponsor = {
				login: sponsorEntity.login,
				avatarUrl: getCanonicalAvatarUrl(sponsorEntity.avatarUrl),
			};
			if (sponsorEntity.__typename === 'User') {
				userSponsors.push(sponsor);
			} else {
				orgSponsors.push(sponsor);
			}
		}
	}

	type SponsorsData = {
		users: Sponsor[];
		organizations: Sponsor[];
		fetched: Date;
	};

	const data: SponsorsData = {
		users: userSponsors,
		organizations: orgSponsors,
		fetched: new Date(),
	};

	const currentSponsorsDataString = await fs.readFile('./sponsors.json', 'utf8');
	const currentSponsorsData = JSON.parse(currentSponsorsDataString) as SponsorsData;
	if (
		!argv.flags.force
		&& JSON.stringify(currentSponsorsData.users) === JSON.stringify(data.users)
		&& JSON.stringify(currentSponsorsData.organizations) === JSON.stringify(data.organizations)
	) {
		console.log('No changes detected');
		return;
	}

	console.log(data);

	await fs.writeFile(
		'./sponsors.json',
		`${JSON.stringify(data)}\n`,
	);

	let readme = await fs.readFile('./README.md', 'utf8');
	readme = String(commentMark(readme, {
		sponsors: generateHtml([
			...orgSponsors,
			...userSponsors,
		]),
	}));
	await fs.writeFile('./README.md', readme);
})();
