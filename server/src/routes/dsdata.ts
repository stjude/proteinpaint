import type { RoutePayload, RouteApi } from '#types'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { validateRglst, spawnTool } from '#src/utils.js'
import * as common from '#shared/common.js'
import type { DsDataRequest, DsDataResponse } from '#types'
import { genomes } from '#src/initGenomesDs.js'

const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one legacy ds is loaded
	get init() {
		return hasLegacyDs(genomes) ? init : null
	},
	request: { typeId: 'DsDataRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DsDataResponse' }
}

export const api: RouteApi = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun (method is based on HTTP GET, POST, etc)
	// - don't add 'Data' as response is assumed to be data
	endpoint: 'dsdata',
	methods: {
		get: payload,
		post: payload
	}
}

/*
returns true when any genome has a legacy (non-mds, non-mds3) ds, identified by ds.queries[] as an array,
which is iterated by this route; mds and mds3 use an object for ds.queries{}
a legacy ds may not have ds.dbfile, e.g. a vcf-only ds
*/
export function hasLegacyDs(genomes) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) => Array.isArray(ds.queries))
	)
}

export function init({ genomes }) {
	return async function handle_dsdata(req, res) {
		/*
	    poor mechanism, only for old-style official dataset
	    to be totally replaced by mds, which can identify queries in a mds by querykeys
	    */
		try {
			const q: DsDataRequest = req.query
			if (!genomes[q.genome]) throw 'invalid genome'
			if (!q.dsname) throw '.dsname missing'
			const ds = genomes[q.genome].datasets[q.dsname]
			if (!ds) throw 'invalid dsname'

			const data: any = []

			for (const query of ds.queries) {
				if (q.expressiononly && !query.isgeneexpression) {
					/*
          expression data only
          TODO mds should know exactly which data type to query, or which vending button to use
          */
					continue
				}
				if (q.noexpression && query.isgeneexpression) {
					// skip expression data
					continue
				}

				if (query.dsblocktracklst) {
					/*
          do not load any tracks here yet
          TODO should allow loading some/all, when epaint is not there
          */
					continue
				}

				if (query.vcffile) {
					// validates range chr/start/stop before they are used to build the tabix region
					validateRglst({ rglst: [req.query.range] }, genomes[q.genome])
					const d = await handle_dsdata_vcf(query, req)
					data.push(d)
					continue
				}

				if (query.makequery) {
					const d = handle_dsdata_makequery(ds, query, req, genomes)
					data.push(d)
					continue
				}

				throw 'unknow type from one of ds.queries[]'
			}

			res.send({ data } satisfies DsDataResponse)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}

function handle_dsdata_makequery(ds, query, req, genomes) {
	// query from ds.newconn

	if (req.query.isoform) {
		// quick fix!! deflect attacks from isoform parameter to avoid db query
		if (genomes[req.query.genome].genomicNameRegexp.test(req.query.isoform)) return
	}

	const [sqlstr, values] = query.makequery(req.query)
	if (!sqlstr) {
		// when not using gm, will not query tables such as expression
		return
	}
	const rows = ds.newconn.prepare(sqlstr).all(values)
	let lst
	if (query.tidy) {
		lst = rows.map(i => query.tidy(i))
	} else {
		lst = rows
	}
	const result: any = {}
	if (query.isgeneexpression) {
		result.lst = lst
		result.isgeneexpression = true
		result.config = query.config

		/*
        	loading of junction track as a dependent of epaint
        	attach junction track info in this result, for making the junction button in epaint
        	await user to click that button

        	replace-by-mds

        	*/

		for (const q2 of ds.queries) {
			if (!q2.dsblocktracklst) continue
			for (const tk of q2.dsblocktracklst) {
				if (tk.type == common.tkt.junction) {
					result.config.dsjunctiontk = tk
				}
			}
		}
	} else {
		result.lst = lst
	}
	return result
}

function handle_dsdata_vcf(query, req) {
	const par = [
		path.join(serverconfig.tpmasterdir, query.vcffile),
		(query.vcf.nochr ? req.query.range.chr.replace('chr', '') : req.query.range.chr) +
			':' +
			req.query.range.start +
			'-' +
			req.query.range.stop
	]
	return new Promise((resolve, reject) => {
		const ps = spawnTool(serverconfig.tabix, par)
		const out: any[] = [],
			out2: any[] = []
		ps.stdout.on('data', i => out.push(i))
		ps.stderr.on('data', i => out2.push(i))
		ps.on('close', (/*code*/) => {
			const e = out2.join('').trim()
			if (e != '') reject('error querying vcf file')
			const tmp = out.join('').trim()
			resolve({
				lines: tmp == '' ? [] : tmp.split('\n'),
				vcfid: query.vcf.vcfid
			})
		})
	})
}
