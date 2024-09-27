/////////////////////////////////
//
// client/server shared
//
/////////////////////////////////

import * as common from './common.js'
import * as bulk from './bulk.js'

// work for both sv/fusion
// must tell if the data is fusion or sv

export function parseheader(line, flag) {
	const header = line.toLowerCase().split('\t')
	if (header.length <= 1) return 'invalid file header for svjson'
	const htry = (...lst) => {
		for (const a of lst) {
			const j = header.indexOf(a)
			if (j != -1) return j
		}
		return -1
	}
	let i = htry('sample')
	if (i != -1) header[i] = 'sample'
	i = htry('sampletype')
	if (i != -1) header[i] = 'sampletype'
	i = htry('patient')
	if (i != -1) header[i] = 'patient'
	i = htry('json', 'jsontext')
	if (i == -1) return ['json missing from header']
	header[i] = 'jsontext'
	return [null, header]
}

export function parseline(i, line, flag, header) {
	if (line == '' || line[0] == '#') return
	const lst = line.split('\t')
	const m = {}
	const badlines = flag.svjson.badlines

	for (let j = 0; j < header.length; j++) {
		m[header[j]] = lst[j]
	}
	if (!m.jsontext) {
		badlines.push([i, 'missing jsontext', lst])
		return
	}
	if (bulk.parsesample(m, flag, i, lst, badlines)) {
		return
	}
	let json
	try {
		json = JSON.parse(m.jsontext)
	} catch (e) {
		badlines.push([i, 'invalid JSON text', lst])
		return
	}
	// duplicating logic in pediatric.js
	if (Array.isArray(json)) {
		// json is pairlst
		for (const pair of json) {
			if (pair.a && pair.a.name && pair.a.isoform) {
				flag.good++
				const m2 = {
					dt: common.dtfusionrna,
					class: common.mclassfusionrna,
					isoform: pair.a.isoform,
					mname: pair.b.name
				}
				for (const k in m) {
					if (k != 'jsontext') m2[k] = m[k]
				}
				m2.pairlst = duplicate(json)
				const n = pair.a.name.toUpperCase()
				if (!flag.data[n]) {
					flag.data[n] = []
				}
				flag.data[n].push(m2)
			}
			if (pair.b && pair.b.name && pair.b.isoform) {
				flag.good++
				const m2 = {
					dt: common.dtfusionrna,
					class: common.mclassfusionrna,
					isoform: pair.b.isoform,
					mname: pair.a.name
				}
				for (const k in m) {
					if (k != 'jsontext') m2[k] = m[k]
				}
				m2.pairlst = duplicate(json)
				const n = pair.b.name.toUpperCase()
				if (!flag.data[n]) {
					flag.data[n] = []
				}
				flag.data[n].push(m2)
			}
		}
	} else {
		json.dt = json.typecode
		delete json.typecode
		switch (json.dt) {
			case common.dtitd:
				json.class = common.mclassitd
				json.mname = 'ITD'
				break
			case common.dtnloss:
				json.class = common.mclassnloss
				json.mname = 'N-loss'
				break
			case common.dtcloss:
				json.class = common.mclasscloss
				json.mname = 'C-loss'
				break
			case common.dtdel:
				json.class = common.mclassdel
				json.mname = 'Del'
				break
			case common.dtsv:
				json.class = common.mclasssv
				json.mname = 'SV'
				break
			default:
				badlines.push([i, 'unknown datatype', lst])
				return
		}
		// record only about a single gene
		if (!json.gene) {
			badlines.push([i, 'json.gene missing', lst])
			return
		}
		flag.good++
		for (const k in m) {
			if (k != 'jsontext') {
				json[k] = m[k]
			}
		}
		const n = flag.geneToUpper ? json.gene.toUpperCase() : json.gene.toUpperCase()
		if (!flag.data[n]) {
			flag.data[n] = []
		}
		flag.data[n].push(json)
	}
}

function duplicate(lst) {
	const d = []
	for (const pair of lst) {
		const p = { a: {}, b: {} }
		for (const k in pair) {
			if (k != 'a' && k != 'b') p[k] = pair[k]
		}
		for (const k in pair.a) {
			p.a[k] = pair.a[k]
		}
		for (const k in pair.b) {
			p.b[k] = pair.b[k]
		}
		d.push(p)
	}
	return d
}
