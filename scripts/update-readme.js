const fs = require('fs');
const assert = require('assert');
const _ = require('lodash');
const commentMark = require('comment-mark');

let projects = require('../projects.json');

projects.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

fs.writeFileSync('./projects.json', JSON.stringify(projects, null, '\t'));

projects = Object.entries(_.groupBy(projects, 'category'))
			.sort((a,b) => a[0].localeCompare(b[0]))
			.map(
				([categoryName, projects]) => [
					`#### ${categoryName}`,
					projects
						.sort((a, b) => a.name.localeCompare(b.name))
						.map(p => {
							assert(p.description.startsWith('When you want to '), `Description for "${p.name}" must start with "When you want to "`);
							const description = p.description.replace('When you want to ', '');
							return `- [${p.name}](${p.repoUrl}) - ${description}`;
						})
						.join('\n'),
				].join('\n')
			)
			.join('\n\n')

const readme = commentMark(
	fs.readFileSync('./README.md'),
	{ projects }
);

fs.writeFileSync('./README.md', readme);
