const ds = require('../../server/dataset/pnet.hg19.js')
const bettersqlite = require('better-sqlite3')

console.log(ds)

const cn = new bettersqlite('db', {
	readonly: false,
	fileMustExist: true
})

const annoTerms = cn.prepare(`SELECT distinct(term_id) as id FROM annotations`).all()
console.log(annoTerms)
for (const term of annoTerms) {
	//console.log(15, term)
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
		console.log(values[0].value, values[values.length - 1].value)
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
		if (term.id == 'Age') console.log(jsondata)

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
	console.log(15, term.id)
	const jsondata = JSON.stringify({
		type: 'survival',
		name: term.id,
		isleaf: true
	})
	cn.prepare(`UPDATE terms SET jsondata=? WHERE id=?`).run([jsondata, term.id])
}

function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n)
}

function numericSorter(a, b) {
	return a.value - b.value
}
