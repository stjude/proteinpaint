function joinUrl(p1, ...p2) {
	if (typeof p1 != 'string') throw `first argument must be string type`
	if (!p1) throw 'blank string not allowed'
	if (p1.indexOf('?') != -1) throw 'search string not allowed'
	let url = p1
	for (const p of p2) {
		if (typeof p != 'string') throw `all arguments must be string type`
		if (!p) throw 'blank string not allowed'
		if (url.slice(-1) != '/') url += '/'
		url += p.startsWith('/') ? p.substring(1) : p
	}
	return url
}
export { joinUrl }
