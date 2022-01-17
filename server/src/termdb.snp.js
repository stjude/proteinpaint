const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')
const termdb = require('./termdb')
const readline = require('readline')
const serverconfig = require('./serverconfig')

/*
********************** EXPORTED
validate()
********************** INTERNAL
*/

/*
q{}
	.genome
	.dslabel
	.snptext: str, same as input
	.filter: stringified json
*/
export async function validate(q, tdb, ds, genome) {
	try {
		if (!q.snptext) throw '.snptext missing'
		const snps = []
		console.log(q)
		return {}
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: 'error validating snps: ' + (e.message || e) }
	}
}
