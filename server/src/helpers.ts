import serverconfig from './serverconfig.js'

/*****************************************
NOTE
- here contains backend helpers that are not shared with client and not supposed to run on client
- migrate utils.js stuff here
- unit test at test/helpers.unit.spec.js
*****************************************/

// convenient helper to only print log on dev environments, and reduce pollution on prod
// call as mayLog('this query takes',n,'seconds')
export function mayLog(...args) {
	if (serverconfig.debugmode) console.log(...args) // do not use args.join() to allow numbers printed in different color on terminal
}
