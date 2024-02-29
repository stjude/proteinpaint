export const api: any = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun (method is based on HTTP GET, POST, etc)
	// - don't add 'Data' as response is assumed to be data
	endpoint: 'dsdata',
	methods: {
		get: {
			init,
			request: {
				typeId: 'any'
			},
			response: {
				typeId: 'any'
			}
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async function handle_dsdata(req, res) {
		/*
	    poor mechanism, only for old-style official dataset
	    to be totally replaced by mds, which can identify queries in a mds by querykeys
	    */
		try {
			if (!genomes[req.query.genome]) throw 'invalid genome'
			if (!req.query.dsname) throw '.dsname missing'
			const ds = genomes[req.query.genome].datasets[req.query.dsname]
			if (!ds) throw 'invalid dsname'

			const data = []

			for (const query of ds.queries) {
				if (req.query.expressiononly && !query.isgeneexpression) {
					/*
          expression data only
          TODO mds should know exactly which data type to query, or which vending button to use
          */
					continue
				}
				if (req.query.noexpression && query.isgeneexpression) {
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
					const d = await handle_dsdata_vcf(query, req)
					data.push(d)
					continue
				}

				if (query.makequery) {
					const d = handle_dsdata_makequery(ds, query, req)
					data.push(d)
					continue
				}

				throw 'unknow type from one of ds.queries[]'
			}

			res.send({ data })
		} catch (e) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}

function handle_dsdata_makequery(ds, query, req) {
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
	const result = {}
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
		const ps = spawn(tabix, par)
		const out = [],
			out2 = []
		ps.stdout.on('data', i => out.push(i))
		ps.stderr.on('data', i => out2.push(i))
		ps.on('close', code => {
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
