
const createPtrn = (key, type) => new RegExp(`<!--\\s*${key}:${type}\\s*-->`);
const { stringify: str } = JSON;

function mdInterpolate(md, obj) {
	Object.entries(obj).forEach(([key, value]) => {
		const startCommentPtrn = createPtrn(key, 'start');
		const startComment = md.match(startCommentPtrn);
		if (!startComment) {
			console.warn(`[md-interpolate] No start comment found for ${str(key)}`);
			return;
		}
		const endCommentPtrn = createPtrn(key, 'end');
		const endComment = md.match(endCommentPtrn);
		if (!endComment) {
			console.warn(`[md-interpolate] No end comment found for ${str(key)}`);
			return;
		}

		md = md.slice(0, startComment.index + startComment[0].length) + '\n' + value + '\n' + md.slice(endComment.index);
	});

	return md;
}


module.exports = mdInterpolate;
