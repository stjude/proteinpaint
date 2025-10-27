import { tabixnoterror, cache_index } from './utils.js'
import { spawn } from 'child_process'
import serverconfig from './serverconfig.js'
import path from 'path'
import readline from 'readline'

export function handle_mdssvcnv_expression(ds, dsquery, req, data_cnv) {
	if (req.query.singlesample) {
		// no expression rank check in single-sample: will be handled in a separate track
		return []
	}

	// multi-sample
	// expression data?
	let expressionquery
	if (dsquery.iscustom) {
		expressionquery = dsquery.checkexpressionrank
	} else {
		// official
		if (dsquery.expressionrank_querykey) {
			if (ds.queries[dsquery.expressionrank_querykey]) {
				expressionquery = ds.queries[dsquery.expressionrank_querykey]
			}
		}
	}
	if (!expressionquery) {
		// no expression query
		return []
	}

	let viewrangeupperlimit = expressionquery.viewrangeupperlimit
	if (!viewrangeupperlimit && dsquery.iscustom) {
		// no limit set for custom track, set a hard limit
		viewrangeupperlimit = 5000000
	}
	if (viewrangeupperlimit) {
		const len = req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0)
		if (len >= viewrangeupperlimit) {
			return [viewrangeupperlimit]
		}
	}

	return Promise.resolve()
		.then(() => {
			// cache expression index

			if (expressionquery.file) return ''
			return cache_index(expressionquery.url, expressionquery.indexURL)
		})
		.then(dir => {
			// get expression data

			const gene2sample2obj = new Map()
			// k: gene
			// v: { chr, start, stop, samples:Map }
			//    sample : { value:V, outlier:{}, ase:{} }

			const tasks = []
			for (const r of req.query.rglst) {
				const task = new Promise((resolve, reject) => {
					const data = []
					const ps = spawn(
						serverconfig.tabix,
						[
							expressionquery.file ? path.join(serverconfig.tpmasterdir, expressionquery.file) : expressionquery.url,
							r.chr + ':' + r.start + '-' + r.stop
						],
						{ cwd: dir }
					)
					const rl = readline.createInterface({
						input: ps.stdout
					})
					rl.on('line', line => {
						const l = line.split('\t')
						let j
						try {
							j = JSON.parse(l[3])
						} catch (e) {
							// invalid json
							return
						}
						if (!j.gene) return
						if (!j.sample) return
						if (!Number.isFinite(j.value)) return

						/* hiddenmattr hiddensampleattr are not applied here
					cnv/vcf data from those samples will be dropped, so their expression won't show
					but their expression will still be used in calculating rank of visible samples
					*/

						if (!gene2sample2obj.has(j.gene)) {
							gene2sample2obj.set(j.gene, {
								chr: l[0],
								start: Number.parseInt(l[1]),
								stop: Number.parseInt(l[2]),
								samples: new Map()
							})
						}
						gene2sample2obj.get(j.gene).samples.set(j.sample, {
							value: j.value,
							ase: j.ase
							// XXX OHE is temporarily disabled!!!
							//outlier: j.outlier
						})
					})
					const errout = []
					ps.stderr.on('data', i => errout.push(i))
					ps.on('close', code => {
						const e = errout.join('')
						if (e && !tabixnoterror(e)) {
							reject(e)
							return
						}
						resolve()
					})
				})
				tasks.push(task)
			}

			return Promise.all(tasks).then(() => {
				return [false, gene2sample2obj]
			})
		})
}
