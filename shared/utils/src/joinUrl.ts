/*
joins two parts of url into one
part 1 must be https://domain, with optional "path" or "path/", must not include search value e.g. ?k=v
part 2 must be a path of "path" or "/path"

the function is simple and doesn't support rest parameter.
when you have 3 pieces to join, do joinUrl( joinUrl(p1,p2), p3)

cannot do below:
- path.join() normalizes double-slash '://' to ':/' single-slash
  also cannot use path on client
- url.resolve() replaces the path string after the domain, instead of appending to it
*/
export function joinUrl(p1: string, p2: string): string {
	// p1 and p2 both shouldn't be blank string. if so, return null to alert
	if (typeof p1 != 'string' || typeof p2 != 'string') throw `both arguments must be string type`
	if (!p1 || !p2) throw 'blank string not allowed'
	if (p1.indexOf('?') != -1) throw 'search string not allowed' // search string not allowed in p1. if usecase arises can support it
	return (p1.endsWith('/') ? p1 : p1 + '/') + (p2.startsWith('/') ? p2.substring(1) : p2)
}
