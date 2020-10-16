// to subset oncotree text file based on codes only used in table.oncoid
const fs = require('fs')

exports.default = file => {
	const lines = fs
		.readFileSync(file, { encoding: 'utf8' })
		.trim()
		.split('\n')

	const c2p = new Map()
	// k: child id, v: parent id

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]
		const l = line.split('\t')
		const L1 = getid(l[0])
		const L2 = getid(l[1])
		const L3 = getid(l[2])
		const L4 = getid(l[3])
		const L5 = getid(l[4])
		const L6 = getid(l[5])
		const L7 = getid(l[6])
		if (L2) {
			c2p.set(L2, L1)
			if (L3) {
				c2p.set(L3, L2)
				if (L4) {
					c2p.set(L4, L3)
					if (L5) {
						c2p.set(L5, L4)
						if (L6) {
							c2p.set(L6, L5)
							if (L7) {
								c2p.set(L7, L6)
							}
						}
					}
				}
			}
		}
	}
	return c2p
}

function getid(s) {
	return s ? s.split(' (')[1].split(')')[0] : null
}
