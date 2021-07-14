const ds = require('../../server/dataset/pnet.hg19.js')
const bettersqlite = require('better-sqlite3')

const cn = new bettersqlite('db', {
	readonly: false,
	fileMustExist: true
})

const annoSamples = cn.prepare(`SELECT distinct(sample) FROM annotations`).all()
for (const sample of annoSamples) {
	const sname = sample.sample
		.split(';')[0]
		.trim()
		.split('_')[0]
		.trim()
	if (sname != sample.sample) {
		cn.prepare(`UPDATE annotations SET sample=? WHERE sample=?`).run([sname, sname])
	}
}

const survSamples = cn.prepare(`SELECT distinct(sample) FROM survival`).all()
for (const sample of survSamples) {
	const sname = sample.sample
		.split(';')[0]
		.trim()
		.split('_')[0]
		.trim()
	if (sname != sample.sample) {
		cn.prepare(`UPDATE survival SET sample=? WHERE sample=?`).run([sname, sname])
	}
}

const annoTerms = cn.prepare(`SELECT distinct(term_id) as id FROM annotations`).all()

for (const term of annoTerms) {
	const values = cn.prepare(`SELECT distinct(value) FROM annotations WHERE term_id=?`).all([term.id])
	if (values.filter(v => isNumeric(v.value)).length == values.length) {
		let maxDecimals = 0
		values.forEach(v => {
			v.value = Number(v.value)
			const numDecimals = v.value.toString().split('.')[1]
			if (numDecimals && numDecimals.length > maxDecimals) {
				maxDecimals = numDecimals.length
			}
		})

		const type = values.filter(v => Number.isInteger(v.value)).length == values.length ? 'integer' : 'float'
		values.sort(numericSorter)
		const bin_size = (values[values.length - 1].value - values[0].value) / 6
		const bins = {
			default: {
				type: 'regular',
				bin_size,
				first_bin: {
					stop: values[0].value + bin_size
				},
				rounding: `.${maxDecimals}f`
			}
		}
		const jsondata = JSON.stringify({
			type,
			name: term.id,
			bins,
			isleaf: true
		})

		cn.prepare(`UPDATE terms SET jsondata=? WHERE id=?`).run([jsondata, term.id])
	} else {
		const termvals = {}
		for (const v of values) {
			termvals[v] = { key: v, label: v }
		}
		const jsondata = JSON.stringify({
			type: 'categorical',
			name: term.id,
			values: termvals,
			groupsetting: {
				disabled: true
			},
			isleaf: true
		})

		cn.prepare(`UPDATE terms SET jsondata=? WHERE id=?`).run([jsondata, term.id])
	}
}

const survRoot = 'Survival outcome'
const survTerms = cn.prepare(`SELECT distinct(term_id) as id FROM survival`).all()
for (const term of survTerms) {
	const jsondata = JSON.stringify({
		type: 'survival',
		name: term.id,
		isleaf: true,
		unit: 'days'
	})
	cn.prepare(`UPDATE terms SET jsondata=? WHERE id=?`).run([jsondata, term.id])
}

function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n)
}

function numericSorter(a, b) {
	return a.value - b.value
}
