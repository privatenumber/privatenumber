// pnpm tsx --env-file=.env ./scripts/fetch-sponsors.ts
import fs from 'fs/promises';
import { graphql } from '@octokit/graphql';
import { gql } from 'code-tag';
import commentMark from 'comment-mark';

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
	Fetch extends (cursor?: string) => Promise<GraphQlResult<Property, unknown>>
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

type SponsorEntity = {
	nodes: {
		sponsorEntity: {
			login: string;
			__typename: SponsorType;
		};
	}[];
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
							... on User { login }
							... on Organization {login}
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

const generateHtml = (
	sponsors: string[],
) => `
	<p align="center">${
		sponsors
			.map(
				username => `<a href="https://github.com/${username}" title="${username}"><img src="https://github.com/${username}.png?size=60" width="30"></a>`,
			)
			.join(' ')
	}</p>
	`.trim();

(async () => {
	const resultPages = await getAllPages('sponsorshipsAsMaintainer', getSponsors);

	const userSponsors: string[] = [];
	const orgSponsors: string[] = [];

	for (const page of resultPages) {
		for (const { sponsorEntity } of page.nodes) {
			if (sponsorEntity.__typename === 'User') {
				userSponsors.push(sponsorEntity.login);
			} else {
				orgSponsors.push(sponsorEntity.login);
			}
		}
	}

	type SponsorsData = {
		users: string[];
		organizations: string[];
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
		JSON.stringify(currentSponsorsData.users) === JSON.stringify(data.users)
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
	readme = commentMark(readme, {
		sponsors: generateHtml([
			...orgSponsors,
			...userSponsors,
		]),
	});
	await fs.writeFile('./README.md', readme);
})();
