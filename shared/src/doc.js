'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.doc = exports.test = void 0
exports.test = {}
function doc(opts) {
	if (opts.type in exports.test) throw "test['".concat(opts.type, "'] already exists")
	exports.test[opts.type] = opts.test
}
exports.doc = doc
