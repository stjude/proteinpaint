/*
	Expose selected internals for unit testing

	work-around for babelify not being able to dynamically import
	filenames with a variable/expression
*/
export { termsettingInit } from '../src/common/termsetting'
