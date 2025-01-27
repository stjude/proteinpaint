function joinUrl(p1, p2) {
	if (typeof p1 != 'string' || typeof p2 != 'string') throw `both arguments must be string type`
	if (!p1 || !p2) throw 'blank string not allowed'
	if (p1.indexOf('?') != -1) throw 'search string not allowed'
	return (p1.endsWith('/') ? p1 : p1 + '/') + (p2.startsWith('/') ? p2.substring(1) : p2)
}
export { joinUrl }
