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
	let t = cn.prepare(`SELECT * FROM terms WHERE id=?`).all(term.id)[0]
	if (!t) t = { id: term.id, name: term.id }
	t.jsondata = JSON.parse(t.jsondata || '{}')

	if (!t.jsondata.values) {
		const values = cn.prepare(`SELECT distinct(value) FROM annotations WHERE term_id=?`).all([term.id])
		// for pnet, for now assume that there are no uncomputable values, except when not numeric
		if (values.filter(v => isNumeric(v.value)).length == values.length) {
			const vals = values.map(v => Number(v.value))
			if (vals.filter(Number.isInteger).length == vals.length) {
				// hardcoded assumption that a max of two unique integer values indicate a categorical term
				t.type = vals.length < 3 ? 'categorical' : 'integer'
			} else {
				t.type = 'float'
			}

			if (!t.jsondata.bins) {
				t.jsondata.bins = {
					default: initBinConfig(vals)
				}
			}
		} else if (values.length < 50) {
			// hardcoded limit of 50 categorical values
			t.type = 'categorical'
			t.jsondata.values = {}
			for (const v of values) {
				t.jsondata.values[v.value] = { key: v.value }
			}
		} else {
			throw `the term.type cannot be automatically assigned`
		}
	}

	if (t.type == 'float' || t.type == 'integer') {
		const jsondata = JSON.stringify({
			type: t.type,
			name: t.name,
			bins: t.jsondata.bins,
			isleaf: true,
			// unhandled uncomputable values, assumed to be either undefined or preloaded to terms table
			values: t.jsondata.values
		})

		cn.prepare(`UPDATE terms SET jsondata=?, type=?, isleaf=? WHERE id=?`).run([jsondata, t.type, 1, term.id])
	} else if (t.type == 'categorical') {
		if (!t.jsondata.groupsetting) {
			t.jsondata.groupsetting = { disabled: true }
		}
		const jsondata = JSON.stringify({
			type: t.type,
			name: t.name,
			values: t.jsondata.values,
			groupsetting: t.jsondata.groupsetting,
			isleaf: true
		})

		cn.prepare(`UPDATE terms SET jsondata=?, type=?, isleaf=? WHERE id=?`).run([jsondata, t.type, 1, term.id])
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
