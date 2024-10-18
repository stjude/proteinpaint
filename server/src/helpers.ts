/*****************************************
NOTE
- here contains backend helpers that are not shared with client and not supposed to run on client
- migrate utils.js stuff here
- unit test at test/helpers.unit.spec.js
*****************************************/

/*
joins two parts of url into one
part 1 must be https://domain, with optional "path" or "path/", must not include search value e.g. ?k=v
part 2 must be a path of "path" or "/path"

the function is simple and doesn't support rest parameter.
when you have 3 pieces to join, do joinUrl( joinUrl(p1,p2), p3)

cannot do below:
- path.join() normalizes double-slash '://' to ':/' single-slash
- url.resolve() replaces the path string after the domain, instead of appending to it
*/
export function joinUrl(p1: string, p2: string): string | null {
	// p1 and p2 both shouldn't be blank string. if so, return null to alert
	if (!p1 || !p2) return null
	if (p1.indexOf('?') != -1) return null // search string not allowed in p1. if usecase arises can support it
	return (p1.endsWith('/') ? p1 : p1 + '/') + (p2.startsWith('/') ? p2.substring(1) : p2)
}
