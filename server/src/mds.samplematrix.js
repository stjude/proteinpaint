/*
The /samplematrix route handler of legacy mds datasets, moved from app.unorg.js, see routes/samplematrix.ts
*/

import { mdssvcnv_do_copyneutralloh, setGenomes as setSharedGenomes } from './mds.shared.js'
import serverconfig from './serverconfig.js'
import path from 'path'
import readline from 'readline'
import * as utils from './utils.js'
import * as common from '#shared/common.js'
import * as vcf from '#shared/vcf.js'
import { tabixnoterror } from './utils.js'

const tabix = serverconfig.tabix
// set by the route init, so that the moved code can use genomes as in app.unorg.js
let genomes

export { handle_samplematrix }

export function setGenomes(_genomes) {
	genomes = _genomes
	setSharedGenomes(_genomes)
}

/***********  __smat ************/

function handle_samplematrix(req, res) {
	/*
    fetch values for a set of features, over a common set of samples
    for singular feature, the datatype & file format is implied
    for feature spanning multiple data types, will need to query multiple data tracks, each track must be identified with "type" e.g. common.tkt.mdsvcf
    */

	Promise.resolve()
		.then(() => {
			const gn = genomes[req.query.genome]
			if (!gn) throw 'invalid genome'

			let ds

			if (req.query.iscustom) {
				if (!req.query.querykey2tracks) throw 'querykey2tracks{} missing for custom dataset'
				ds = { queries: {} }

				for (const key in req.query.querykey2tracks) {
					// the key is arbitrary

					const tk = req.query.querykey2tracks[key]

					if (!tk.type) throw 'missing "type" for a data track'
					utils.checkTrackFile(tk.file)

					if (tk.type == common.tkt.mdsvcf) {
						// special treatment for vcf
						const tk = req.query.querykey2tracks[key]
						tk.type = common.mdsvcftype.vcf

						ds.queries[key] = {
							type: common.tkt.mdsvcf,
							info: tk.info, // comply with multi-vcf track mds
							tracks: [tk]
						}
					} else if (tk.type == common.tkt.mdssvcnv) {
						ds.queries[key] = tk
					} else if (tk.type == common.tkt.mdsexpressionrank) {
						// gene expression is currently not used in custom track...
						ds.queries[key] = tk
					} else {
						throw 'unknown type of data track: ' + tk.type
					}
				}
			} else {
				// from native dataset
				if (!gn.datasets) throw 'genome is not equipped with datasets'
				if (!req.query.dslabel) throw 'dslabel missing'
				ds = gn.datasets[req.query.dslabel]
				if (!ds) throw 'invalid dslabel'
				if (!ds.queries) throw 'dataset is not equipped with queries'
			}

			/*
		impose certain limits to restrict to a set of samples
		merge different logic of limits into one set
		share in different feature processor
		*/
			let usesampleset

			if (req.query.sampleset) {
				usesampleset = new Set(req.query.sampleset)
			} else if (req.query.limitsamplebyeitherannotation) {
				// must be official ds
				if (!ds.cohort) throw 'limitsamplebyeitherannotation but no cohort in ds'
				if (!ds.cohort.annotation) throw 'limitsamplebyeitherannotation but no cohort.annotation in ds'
				usesampleset = new Set()
				for (const n in ds.cohort.annotation) {
					const a = ds.cohort.annotation[n]
					for (const filter of req.query.limitsamplebyeitherannotation) {
						if (a[filter.key] == filter.value) {
							// use this sample
							usesampleset.add(n)
							break
						}
					}
				}
			}

			const tasks = []

			for (const feature of req.query.features) {
				let dsquery
				let dsquerylst = []

				// allow other types of query, e.g. checking sample metadata

				if (feature.querykey) {
					if (!ds.queries) throw 'using querykey for a feature but no ds.queries'
					dsquery = ds.queries[feature.querykey]
					if (!dsquery) throw 'unknown dsquery by key ' + feature.querykey
				} else if (feature.querykeylst) {
					if (!ds.queries) throw 'using querykeylst for a feature but no ds.queries'
					for (const k of feature.querykeylst) {
						const q = ds.queries[k]
						if (!q) throw 'unknown key "' + k + '" from querykeylst'
						dsquerylst.push(q)
					}
					if (dsquerylst.length == 0) throw 'no valid keys in querykeylst'
				} else if (feature.issampleattribute) {
					// no need for dsquery
				} else {
					throw 'unknown way to query a feature'
				}

				// types of feature/query

				if (feature.isgenevalue) {
					const [err, q] = samplematrix_task_isgenevalue(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with isgenevalue: ' + err
					tasks.push(q)
				} else if (feature.iscnv) {
					const [err, q] = samplematrix_task_iscnv(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with iscnv: ' + err
					tasks.push(q)
				} else if (feature.isloh) {
					const [err, q] = samplematrix_task_isloh(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with isloh: ' + err
					tasks.push(q)
				} else if (feature.isvcf) {
					const [err, q] = samplematrix_task_isvcf(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with isvcf: ' + err
					tasks.push(q)
				} else if (feature.isitd) {
					const [err, q] = samplematrix_task_isitd(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with isitd: ' + err
					tasks.push(q)
				} else if (feature.issvfusion) {
					const [err, q] = samplematrix_task_issvfusion(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with issvfusion: ' + err
					tasks.push(q)
				} else if (feature.issvcnv) {
					const [err, q] = samplematrix_task_issvcnv(feature, ds, dsquery, usesampleset)
					if (err) throw 'error with issvcnv: ' + err
					tasks.push(q)
				} else if (feature.ismutation) {
					const [err, q] = samplematrix_task_ismutation(feature, ds, dsquerylst, usesampleset)
					if (err) throw 'error with ismutation: ' + err
					tasks.push(q)
				} else if (feature.issampleattribute) {
					const [err, q] = samplematrix_task_issampleattribute(feature, ds, usesampleset)
					if (err) throw 'error with issampleattribute: ' + err
					tasks.push(q)
				} else {
					throw 'unknown type of feature'
				}
			}

			return Promise.all(tasks)
		})
		.then(results => {
			res.send({ results: results })
		})
		.catch(err => {
			res.send({ error: typeof err == 'string' ? err : err.message })
			if (err.stack) console.error(err.stack)
		})
}

function samplematrix_task_issampleattribute(feature, ds, usesampleset) {
	if (!feature.key) return ['.key missing']
	if (!ds.cohort) return ['ds.cohort missing']
	if (!ds.cohort.annotation) return ['ds.cohort.annotation missing']
	const q = Promise.resolve().then(() => {
		const items = []
		for (const samplename in ds.cohort.annotation) {
			if (usesampleset && !usesampleset.has(samplename)) continue

			const anno = ds.cohort.annotation[samplename]

			const value = anno[feature.key]
			if (value == undefined) continue
			items.push({
				sample: samplename,
				value: value
			})
		}
		return {
			id: feature.id,
			items: items
		}
	})
	return [null, q]
}

function samplematrix_task_isgenevalue(feature, ds, dsquery, usesampleset) {
	if (!feature.genename) return ['genename missing']
	const genename = feature.genename.toLowerCase()
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['gene feature too long (> 10Mb)']

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = utils.spawnTool(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})

				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					if (!j.gene) return
					if (j.gene.toLowerCase() != genename) return

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}
					resolve({
						id: feature.id,
						items: data
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_iscnv(feature, ds, dsquery, usesampleset) {
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']
	if (feature.valuecutoff != undefined) {
		if (!Number.isFinite(feature.valuecutoff)) return ['invalid value for valuecutoff']
	}
	if (feature.focalsizelimit != undefined) {
		if (!Number.isInteger(feature.focalsizelimit)) return ['invalid value for focalsizelimit']
	}

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = utils.spawnTool(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})
				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					// loh and sv data could be present in same file
					if (j.dt != common.dtcnv) return

					if (feature.valuecutoff && Math.abs(j.value) < feature.valuecutoff) return

					j.chr = l[0]
					j.start = Number.parseInt(l[1])
					j.stop = Number.parseInt(l[2])

					if (feature.focalsizelimit && j.stop - j.start >= feature.focalsizelimit) return

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}
					resolve({
						id: feature.id,
						items: data
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_isloh(feature, ds, dsquery, usesampleset) {
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']
	if (feature.valuecutoff != undefined) {
		if (!Number.isFinite(feature.valuecutoff)) return ['invalid value for valuecutoff']
	}
	if (feature.focalsizelimit != undefined) {
		if (!Number.isInteger(feature.focalsizelimit)) return ['invalid value for focalsizelimit']
	}

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = utils.spawnTool(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})
				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					if (j.dt != common.dtloh) return

					if (feature.valuecutoff && j.segmean < feature.valuecutoff) return

					j.chr = l[0]
					j.start = Number.parseInt(l[1])
					j.stop = Number.parseInt(l[2])

					if (feature.focalsizelimit && j.stop - j.start >= feature.focalsizelimit) return

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}
					resolve({
						id: feature.id,
						items: data
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_isitd(feature, ds, dsquery, usesampleset) {
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = utils.spawnTool(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})
				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					if (j.dt != common.dtitd) return

					j.chr = l[0]
					j.start = Number.parseInt(l[1])
					j.stop = Number.parseInt(l[2])

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}
					resolve({
						id: feature.id,
						items: data
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_issvfusion(feature, ds, dsquery, usesampleset) {
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = utils.spawnTool(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})
				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					if (j.dt != common.dtsv && j.dt != common.dtfusionrna) return

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					j._chr = l[0]
					j._pos = Number.parseInt(l[1])
					if (j.chrA) {
						j.chrB = j._chr
						j.posB = j._pos
					} else {
						j.chrA = j._chr
						j.posA = j._pos
					}

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}
					resolve({
						id: feature.id,
						items: data
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_issvcnv(feature, ds, dsquery, usesampleset) {
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']

	const q = Promise.resolve()
		.then(() => {
			if (dsquery.file) return
			return utils.cache_index(dsquery.url, dsquery.indexURL)
		})
		.then(dir => {
			return new Promise((resolve, reject) => {
				const data = []
				const ps = utils.spawnTool(
					tabix,
					[
						dsquery.file ? path.join(serverconfig.tpmasterdir, dsquery.file) : dsquery.url,
						feature.chr + ':' + feature.start + '-' + feature.stop
					],
					{ cwd: dir }
				)
				const rl = readline.createInterface({
					input: ps.stdout
				})
				rl.on('line', line => {
					const l = line.split('\t')

					const j = JSON.parse(l[3])

					if (!j.sample) return
					if (usesampleset && !usesampleset.has(j.sample)) return

					// keep all data and return

					if (j.dt == common.dtsv || j.dt == common.dtfusionrna) {
						if (j.dt == common.dtsv && feature.sv && feature.sv.hidden) return

						if (j.dt == common.dtfusionrna && feature.fusion && feature.fusion.hidden) return

						j._chr = l[0]
						j._pos = Number.parseInt(l[1])
						if (j.chrA) {
							j.chrB = j._chr
							j.posB = j._pos
						} else {
							j.chrA = j._chr
							j.posA = j._pos
						}
					} else if (j.dt == common.dtcnv) {
						if (feature.cnv && feature.cnv.hidden) return

						if (feature.cnv && feature.cnv.valuecutoff && Math.abs(j.value) < feature.cnv.valuecutoff) return
						j.chr = l[0]
						j.start = Number.parseInt(l[1])
						j.stop = Number.parseInt(l[2])
						if (feature.cnv && feature.cnv.focalsizelimit && j.stop - j.start >= feature.cnv.focalsizelimit) return
					} else if (j.dt == common.dtloh) {
						if (feature.loh && feature.loh.hidden) return

						if (feature.loh && feature.loh.valuecutoff && j.segmean < feature.loh.valuecutoff) return
						j.chr = l[0]
						j.start = Number.parseInt(l[1])
						j.stop = Number.parseInt(l[2])
						if (feature.loh && feature.loh.focalsizelimit && j.stop - j.start >= feature.loh.focalsizelimit) return
					} else if (j.dt == common.dtitd) {
						if (feature.itd && feature.itd.hidden) return

						j.chr = l[0]
						j.start = Number.parseInt(l[1])
						j.stop = Number.parseInt(l[2])
					} else {
						console.error('unknown datatype', j.dt)
						return
					}

					data.push(j)
				})

				const errout = []
				ps.stderr.on('data', i => errout.push(i))
				ps.on('close', code => {
					const e = errout.join('')
					if (e && !tabixnoterror(e)) {
						reject(e)
						return
					}

					const sample2item = new Map()
					for (const i of data) {
						if (!sample2item.has(i.sample)) sample2item.set(i.sample, [])
						sample2item.get(i.sample).push(i)
					}

					if (dsquery.hideLOHwithCNVoverlap) {
						mdssvcnv_do_copyneutralloh(sample2item)
					}

					const newlst = []
					for (const [n, lst] of sample2item) {
						for (const i of lst) {
							newlst.push(i)
						}
					}

					resolve({
						id: feature.id,
						items: newlst
					})
				})
			})
		})
	return [null, q]
}

function samplematrix_task_ismutation(feature, ds, dsquerylst, usesampleset) {
	/*
    load mutation of any type:
    	snvindel from vcf file
    	cnv/loh/sv/fusion/itd from svcnv file

    no expression data here

    */
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 10000000) return ['look range too big (>10Mb)']

	const tasks = []

	for (const query of dsquerylst) {
		if (query.type == common.tkt.mdsvcf) {
			const [err, q] = samplematrix_task_isvcf(feature, ds, query, usesampleset)
			if (err) return [err]
			tasks.push(q)
		} else if (query.type == common.tkt.mdssvcnv) {
			const [err, q] = samplematrix_task_issvcnv(feature, ds, query, usesampleset)
			if (err) return [err]
			tasks.push(q)
		} else {
			return ['unsupported track type: ' + query.type]
		}
	}

	return [
		null,
		Promise.all(tasks).then(results => {
			const items = []
			for (const r of results) {
				for (const i of r.items) {
					items.push(i)
				}
			}
			return {
				id: results[0].id,
				items: items
			}
		})
	]
}

function samplematrix_task_isvcf(feature, ds, dsquery, usesampleset) {
	/*
    if is custom, will pass the lines to client for processing
    */
	if (!dsquery.tracks) return 'tracks[] missing from dsquery'
	if (!feature.chr) return ['chr missing']
	if (!Number.isInteger(feature.start) || !Number.isInteger(feature.stop)) return ['invalid start/stop coordinate']
	if (feature.stop - feature.start > 3000000) return ['look range too big (>3Mb)']

	const tasks = []

	for (const tk of dsquery.tracks) {
		const q = Promise.resolve()
			.then(() => {
				if (tk.file) return
				return utils.cache_index(tk.url, tk.indexURL)
			})
			.then(dir => {
				return new Promise((resolve, reject) => {
					const data = []
					const ps = utils.spawnTool(
						tabix,
						[
							tk.file ? path.join(serverconfig.tpmasterdir, tk.file) : tk.url,
							(tk.nochr ? feature.chr.replace('chr', '') : feature.chr) + ':' + feature.start + '-' + (feature.stop + 1)
							// must add 1 to stop so to get snv data
						],
						{ cwd: dir }
					)
					const rl = readline.createInterface({
						input: ps.stdout
					})
					rl.on('line', line => {
						if (dsquery.iscustom) {
							// info/format are at client, pass them over
							data.push(line)
							return
						}

						if (tk.type == common.mdsvcftype.vcf) {
							// snv/indel

							const [badinfok, mlst, altinvalid] = vcf.vcfparseline(line, {
								nochr: tk.nochr,
								samples: tk.samples,
								info: dsquery.info,
								format: tk.format
							})

							for (const m of mlst) {
								if (!m.sampledata) {
									// do not allow
									continue
								}

								// extract class/mname from vep csq etc, must be done here but not on client
								common.vcfcopymclass(m, {})

								if (feature.snvindel) {
									if (feature.snvindel.excludeclasses && feature.snvindel.excludeclasses[m.class]) {
										// m class is one of excluded
										continue
									}
								}

								// filters on samples

								if (usesampleset) {
									const samplesnothidden = []
									for (const s of m.sampledata) {
										if (usesampleset.has(s.sampleobj.name)) {
											samplesnothidden.push(s)
										}
									}
									if (samplesnothidden.length == 0) {
										continue
									}
									m.sampledata = samplesnothidden
								}

								// delete the obsolete attr
								for (const sb of m.sampledata) {
									delete sb.allele2readcount
								}

								delete m._m
								delete m.vcf_ID
								delete m.name

								m.dt = common.dtsnvindel

								data.push(m)
							}
						} else {
							console.error('type not one of mdsvcftype: ' + tk.type)
						}
					})

					const errout = []
					ps.stderr.on('data', i => errout.push(i))
					ps.on('close', code => {
						const e = errout.join('')
						if (e && !tabixnoterror(e)) {
							reject(e)
							return
						}
						resolve(data)
					})
				})
			})
		tasks.push(q)
	}

	return [
		null,
		Promise.all(tasks).then(results => {
			const lst = []
			for (const i of results) {
				for (const m of i) {
					lst.push(m)
				}
			}
			return {
				id: feature.id,
				items: lst
			}
		})
	]
}
