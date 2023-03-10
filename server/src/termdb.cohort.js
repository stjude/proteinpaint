const { getCohortsData } = require('./termdb.sql.cohort')

export async function trigger_getCohortsData(q, res, ds) {
	const result = getCohortsData(ds)
	res.send(result)
}
