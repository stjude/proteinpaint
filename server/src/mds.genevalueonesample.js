/*
The /mdsgenevalueonesample route handler of legacy mds datasets, moved from app.unorg.js,
see routes/mdsgenevalueonesample.ts
*/

import { mds_query_arg_check, setGenomes as setSharedGenomes } from './mds.shared.js'
import serverconfig from './serverconfig.js'
import path from 'path'
import * as utils from './utils.js'

// set by the route init, so that the moved code can use genomes as in app.unorg.js
let genomes

export { handle_mdsgenevalueonesample }

export function setGenomes(_genomes) {
	genomes = _genomes
	setSharedGenomes(_genomes)
}

async function handle_mdsgenevalueonesample(req, res) {
	/*
.genes[]
.dslabel
.querykey
.iscustom
.file
.url
.sample
*/
	const q = req.query

	try {
		if (!q.sample) throw '.sample missing'
		if (!q.genes) throw '.genes[] missing'

		let gn, ds, dsquery

		if (req.query.iscustom) {
			gn = genomes[q.genome]
			if (!gn) throw 'invalid genome'
			if (!q.file && !q.url) throw 'no file or url for expression data'
			utils.checkTrackFile(q.file)
			ds = {}
			dsquery = {
				file: q.file,
				url: q.url,
				indexURL: q.indexURL
			}
		} else {
			const [err, gn1, ds1, dsquery1] = mds_query_arg_check(q)
			if (err) throw err
			gn = gn1
			ds = ds1
			dsquery = dsquery1
		}
		const dir = dsquery.file ? null : await utils.cache_index(dsquery.url, dsquery.indexURL)

		const gene2value = {}
		let nodata = true
		for (const gene of q.genes) {
			let v
			await utils.get_lines_bigfile({
				args: [
					dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
					gene.chr + ':' + gene.start + '-' + gene.stop
				],
				dir,
				callback: line => {
					const l = line.split('\t')
					if (!l[3]) return
					const j = JSON.parse(l[3])
					if (j.gene == gene.gene && j.sample == q.sample) {
						v = j.value
					}
				}
			})
			if (Number.isFinite(v)) {
				gene2value[gene.gene] = v
				nodata = false
			}
		}
		if (nodata) {
			res.send({ nodata: 1 })
		} else {
			res.send({ result: gene2value })
		}
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}
