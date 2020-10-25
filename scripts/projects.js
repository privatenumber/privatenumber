const sortKeys = require('sort-keys');

let projects = require('../projects');

projects.sort((a, b) => a.name.localeCompare(b.name));


const keys = ['name', 'npm', 'description', 'repoUrl'];
const keyCompare = (a, b) => keys.indexOf(a) - keys.indexOf(b);

projects = projects.map(proj => sortKeys(Object.assign(proj, {
	npm: proj.name,
}), { compare: keyCompare }))

console.log(JSON.stringify(projects, null, 4));