const fs = require('fs');
const _ = require('lodash');

const commentMark = require('comment-mark');
const projects = require('../projects');

projects.sort((a, b) => a.name.localeCompare(b.name));

const table = require('markdown-table');
 
const mdTable = table([
	['Project', 'Use-case'],
	...projects.map(row => {
		return [
			`[${row.name}](${row.repoUrl})`,
			`<a href="https://npm.im/${row.name}"><img src="https://badgen.net/npm/dm/${row.name}"></a>`,
			row.description,
		];
	}),
]);

const src = fs.readFileSync('./README.md').toString();

const dist = commentMark(
	src,
	{
		projects: Object.entries(_.groupBy(projects, 'category'))
			.sort((a,b) => a[0].localeCompare(b[0]))
			.map((([categoryName, projects]) => {
				return [
					'#### ' + categoryName,
					projects.map(p => {
						const description = p.description.replace('When you want to ', '');
						return `- [${p.name}](${p.repoUrl}) - ${description}`;
						// const id = new URL(p.repoUrl).pathname.slice(1);
						// return `<img align="top" src="https://gh-card.dev/repos/${id}.svg">`;
					}).join('\n'),
				].join('\n');
			}))
			.join('\n\n'),
	}
);

console.log(dist);


/*.map(({ name, npm, repoUrl, description }) => {
			return `### [${name}](${repoUrl})  ${npm ? `<a href="https://npm.im/${name}"><img src="https://badgen.net/npm/dm/${name}"></a>` : ''}
	${description}`;
		}).join('\n\n')*/