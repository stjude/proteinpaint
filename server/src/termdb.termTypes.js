const get_flagset = require('./bulk.mset').get_flagset

export async function getData(q, ds) {
	try {
		const ids = JSON.parse(q.ids)
		const qmarks = ids.map(() => '?').join(',')
		const sql = `SELECT id, name, type, jsondata, parent_id FROM terms WHERE id IN (${qmarks}) OR name IN (${qmarks})`
		const rows = ds.cohort.db.connection.prepare(sql).all([...ids, ...ids])
		const terms = {}
		for (const r of rows) {
			if (r.jsondata) Object.assign(r, JSON.parse(r.jsondata))
			terms[r.id] = r
		}

		const remainingIds = ids.filter(id => !terms[id])
		const flagset = await get_flagset(ds, q.genome)
		for (const flagname in flagset) {
			const flag = flagset[flagname]
			if (!flag.data) continue
			for (const name of remainingIds) {
				if (name in flag.data && !(name in terms)) terms[name] = { name, type: 'geneVariant' }
			}
		}

		return terms
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}
