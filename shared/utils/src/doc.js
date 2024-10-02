const test = {}
function doc(opts) {
	if (opts.type in test) throw `test['${opts.type}'] already exists`
	test[opts.type] = opts.test
}
export { doc, test }
