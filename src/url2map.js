export default function() {
	const urlp = new Map()
	for (const s of decodeURIComponent(location.search.substr(1)).split('&')) {
		const l = s.split('=')
		if (l.length == 2) {
			urlp.set(l[0], l[1])
		}
	}
	return urlp
}
