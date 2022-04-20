const ds = require('../../server/dataset/pnet.hg19.js')
const bettersqlite = require('better-sqlite3')
const initBinConfig = require('../../server/shared/termdb.initbinconfig')

const cn = new bettersqlite('db', {
	readonly: false,
	fileMustExist: true
})

const annoSamples = cn.prepare(`SELECT distinct(sample) FROM annotations`).all()
for (const sample of annoSamples) {
	// clean up the sample name
	const sname = sample.sample
		.split(';')[0]
		.trim()
		.split('_')[0]
		.trim()
	if (sname != sample.sample) {
		cn.prepare(`UPDATE annotations SET sample=? WHERE sample=?`).run([sname, sample.sample])
	}
}

const survSamples = cn.prepare(`SELECT distinct(sample) FROM survival`).all()
for (const sample of survSamples) {
	// clean up the sample name
	const sname = sample.sample
		.split(';')[0]
		.trim()
		.split('_')[0]
		.trim()
	if (sname != sample.sample) {
		cn.prepare(`UPDATE survival SET sample=? WHERE sample=?`).run([sname, sample.sample])
	}
}

const annoTerms = cn.prepare(`SELECT distinct(term_id) as id FROM annotations`).all()

for (const term of annoTerms) {
	const values = cn.prepare(`SELECT value FROM annotations WHERE term_id=?`).all([term.id])
	// for pnet, for now assume that there are no uncomputable values, except when not numeric
	if (values.filter(v => isNumeric(v.value)).length == values.length) {
		const vals = values.map(v => Number(v.value))
		const bins = {
			default: initBinConfig(vals)
		}
		const type = vals.filter(Number.isInteger).length == vals.length ? 'integer' : 'float'
		const jsondata = JSON.stringify({
			type,
			name: term.id,
			bins,
			isleaf: true
		})

		cn.prepare(`UPDATE terms SET jsondata=?, type=?, isleaf=? WHERE id=?`).run([jsondata, type, 1, term.id])
	} else {
		const termvals = {}
		for (const v of values) {
			termvals[v] = { key: v, label: v }
		}
		const type = 'categorical'
		const jsondata = JSON.stringify({
			type,
			name: term.id,
			values: termvals,
			groupsetting: {
				disabled: true
			},
			isleaf: true
		})

		cn.prepare(`UPDATE terms SET jsondata=?, type=?, isleaf=? WHERE id=?`).run([jsondata, type, 1, term.id])
	}
}

const survRoot = 'Survival outcome'
const survTerms = cn.prepare(`SELECT distinct(term_id) as id FROM survival`).all()
for (const term of survTerms) {
	const type = 'survival'
	const jsondata = JSON.stringify({
		type,
		name: term.id,
		isleaf: true,
		unit: 'years'
	})
	cn.prepare(`UPDATE terms SET jsondata=?, type=?, isleaf=? WHERE id=?`).run([jsondata, type, 1, term.id])
}

function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n)
}

function numericSorter(a, b) {
	return a.value - b.value
}
