/*
The /mdsexpressionrank route handler of legacy mds datasets, see routes/mdsexpressionrank.ts
*/

import { mds_query_arg_check, get_rank_from_sortedarray, setGenomes as setSharedGenomes } from './mds.shared.js'
import serverconfig from './serverconfig.js'
import path from 'path'
import * as utils from './utils.js'
import * as common from '#shared/common.js'

// set by the route init, so that the handler code can use the loaded genomes
let genomes

export { handle_mdsexpressionrank }

export function setGenomes(_genomes) {
	genomes = _genomes
	setSharedGenomes(_genomes)
}

function handle_mdsexpressionrank(req, res) {
	/*
    for a given sample, check expression rank of its gene expression as compared with its cohort
    similar task done in svcnv

    where is the data?
    - custom file
    - official ds, a query of flag isgenenumeric

    sample: req.query.sample
    range: req.query.coord
    cohort: for official, defined by req.query.attributes
            for custom, will use all available samples other than this one
    */
	let gn,
		ds,
		dsquery,
		samples = new Set() // to record all samples seen and report the total number

	Promise.resolve()
		.then(() => {
			if (!req.query.sample) throw 'sample missing'

			if (req.query.iscustom) {
				gn = genomes[req.query.genome]
				if (!gn) throw 'invalid genome'
				if (!req.query.file && !req.query.url) throw 'no file or url for expression data'
				utils.checkTrackFile(req.query.file)
				ds = {}
				dsquery = {
					file: req.query.file,
					url: req.query.url,
					indexURL: req.query.indexURL
				}
			} else {
				// official
				const [err, gn1, ds1, dsquery1] = mds_query_arg_check(req.query)
				if (err) throw err
				gn = gn1
				ds = ds1
				dsquery = dsquery1

				if (!dsquery.samples) throw 'total samples missing from server config'
				// check if the said sample exists
				if (dsquery.samples.indexOf(req.query.sample) == -1) throw { nodata: 1 }
			}

			if (req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0) > 10000000)
				throw 'Zoom in below 10 Mb to show expression rank'

			if (dsquery.viewrangeupperlimit) {
				if (req.query.rglst.reduce((i, j) => i + j.stop - j.start, 0) > dsquery.viewrangeupperlimit)
					throw 'zoom in under ' + common.bplen(dsquery.viewrangeupperlimit) + ' to view data'
			}

			if (req.query.levelkey) {
				// only for official ds
				if (!req.query.levelvalue) throw 'levelvalue is required when levelkey is used'
				if (!ds.cohort || !ds.cohort.annotation) throw '.cohort.annotation missing from dataset'
			}

			if (dsquery.file) return
			if (!dsquery.url) throw 'file or url missing'

			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			const tasks = []

			for (const r of req.query.rglst) {
				tasks.push(
					new Promise((resolve, reject) => {
						const gene2value = new Map()

						utils
							.readTabixLines({
								file: dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
								regions: [{ chr: r.chr, start: r.start, stop: r.stop }],
								dir,
								callback: line => {
									const l = line.split('\t')
									const j = JSON.parse(l[3])

									if (!j.gene) return

									if (!j.sample) return

									if (!Number.isFinite(j.value)) return

									const chr = l[0]
									const start = Number.parseInt(l[1])
									const stop = Number.parseInt(l[2])

									if (j.sample == req.query.sample) {
										// a gene for the current sample
										if (!gene2value.has(j.gene)) {
											gene2value.set(j.gene, {
												chr: chr,
												start: start,
												stop: stop,
												allvalues: []
											})
										}
										gene2value.get(j.gene).thisvalue = j.value

										// additional stats about gene expression
										/* XXX OHE!!
                                if (j.outlier) {
                                	gene2value.get(j.gene).outlier = j.outlier
                                }
                                */
										if (j.ase) {
											gene2value.get(j.gene).ase = j.ase
										}
										return
									}

									if (req.query.attributes) {
										// official only,
										// filter for samples of the same cohort
										const sanno = ds.cohort.annotation[j.sample]
										if (!sanno) {
											// sample has no annotation
											return
										}
										for (const attr of req.query.attributes) {
											if (attr.k && attr.kvalue) {
												if (attr.kvalue != sanno[attr.k]) {
													// not a sample for this cohort
													return
												}
											}
										}
									}

									// now it is a sample for the group

									samples.add(j.sample)

									if (!gene2value.has(j.gene)) {
										gene2value.set(j.gene, {
											chr: chr,
											start: start,
											stop: stop,
											allvalues: []
										})
									}
									gene2value.get(j.gene).allvalues.push({
										value: j.value
									})
								}
							})
							.then(
								() => resolve(gene2value),
								e => reject({ message: e })
							)
					})
				)
			}

			return Promise.all(tasks)
		})
		.then(results => {
			const lst = []
			for (const gene2value of results) {
				for (const [gene, o] of gene2value) {
					if (o.thisvalue == undefined) continue

					o.allvalues.sort((i, j) => i.value - j.value)
					o.rank = get_rank_from_sortedarray(o.thisvalue, o.allvalues)
					delete o.allvalues

					o.gene = gene
					lst.push(o)
				}
			}
			res.send({
				result: lst,
				samplecount: samples.size
			})
		})
		.catch(err => {
			if (err.stack) console.log(err)
			if (err.nodata) {
				res.send({ nodata: 1 })
			} else {
				res.send({ error: err.message ? err.message : err })
			}
		})
}
