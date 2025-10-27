import path from 'path'
import * as utils from './utils.js'
import serverconfig from './serverconfig.js'
import * as common from '#shared/common.js'
import * as vcf from '#shared/vcf.js'
import { run_R } from '@sjcrh/proteinpaint-r'

/*
function cascade

get_samples
divide_samples
	dividesamples_genevaluepercentilecutoff
		get_genevalue
	dividesamples_genevaluequartile
	dividesamples_mutationanyornone
		get_mutatedsamples
			query_svcnv
			query_vcf
get_pvalue
pvalue_may4eachmutatedset
pvalue_may4expquartile
do_plot
*/

export function handle_mdssurvivalplot(genomes) {
	return async (req, res) => {
		try {
			const q = req.query
			const gn = genomes[q.genome]
			if (!gn) throw 'invalid genome'
			const ds = gn.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset'
			if (!ds.cohort) throw 'no cohort for dataset'
			if (!ds.cohort.annotation) throw 'cohort.annotation missing for dataset'

			const sp = ds.cohort.survivalplot
			if (!sp) throw 'survivalplot not supported for this dataset'
			if (!sp.plots) throw '.plots{} missing'

			if (req.query.init) {
				res.send(sp.init)
				return
			}

			// make plot

			if (!q.type) throw '.type missing'
			const plottype = sp.plots[q.type]
			if (!plottype) throw 'unknown plot type: ' + q.type

			const samples = get_samples(q, ds, plottype)

			const samplesets = await divide_samples(samples, q, ds, samples)

			let pvalue
			if (samplesets.length > 1) {
				pvalue = await get_pvalue(samplesets)
			}

			await pvalue_may4eachmutatedset(q, samplesets)
			await pvalue_may4expquartile(q, samplesets)

			for (const s of samplesets) {
				do_plot(s)
				delete s.lst
			}

			const result = { samplesets, pvalue }

			if (q.samplerule.set && q.samplerule.set.mutation) {
				result.count_snvindel = q.samplerule.set.samples_snvindel.size
				result.count_cnv = q.samplerule.set.samples_cnv.size
				result.count_loh = q.samplerule.set.samples_loh.size
				result.count_sv = q.samplerule.set.samples_sv.size
				result.count_fusion = q.samplerule.set.samples_fusion.size
				result.count_itd = q.samplerule.set.samples_itd.size
			}
			res.send(result)
		} catch (err) {
			if (err.stack) console.error(err.stack)
			res.send({ error: err.message || err })
		}
	}
}

async function get_pvalue(samplesets) {
	/* [ each_set ]
.lst[]
	.serialtime
	.censored
*/
	const lines = ['futime\tfustat\trx']
	for (const [i, set] of samplesets.entries()) {
		for (const v of set.lst) {
			lines.push(v.serialtime + '\t' + v.censored + '\t' + i)
		}
	}
	const p = await run_R('km.R', lines.join('\n'))
	return Number(p)
}

async function pvalue_may4eachmutatedset(q, samplesets) {
	if (!q.samplerule.mutated_sets) return
	const nomut_set = samplesets.find(i => i.is_notmutated)
	if (!nomut_set) return
	for (const s of samplesets) {
		if (s.is_notmutated) continue
		// is a not mutated set
		const pvalue = await get_pvalue([s, nomut_set])
		s.pvalue = pvalue
	}
}
async function pvalue_may4expquartile(q, samplesets) {
	if (!q.samplerule.set) return // possible when using "mutated_sets"
	if (!q.samplerule.set.geneexpression) return // hardcoded for gene exp
	if (!q.samplerule.set.byquartile) return // hardcoded for quartile
	if (samplesets.length != 4) return // should throw
	if (q.samplerule.set.against1st) {
		for (let i = 1; i < 4; i++) {
			samplesets[i].pvalue = await get_pvalue([samplesets[0], samplesets[i]])
		}
		return
	}
	if (q.samplerule.set.against4th) {
		for (let i = 0; i < 3; i++) {
			samplesets[i].pvalue = await get_pvalue([samplesets[i], samplesets[3]])
		}
		return
	}
}

async function divide_samples(samples, q, ds, plottype) {
	/*
samples[]
	.name
	.o{}
q{}
ds{}
	.queries{}
plottype{}
*/
	if (q.samplerule.mutated_sets) {
		/*
        each set
        {
        	name:STR,
        	samplenames:[ name ]
        }
        */
		const nomutsampleset = new Set(samples.map(i => i.name)) // to remove mutated samples leaving only unmutated ones
		const sets = q.samplerule.mutated_sets.reduce((sets, s) => {
			const thisset = new Set(s.samplenames)
			s.lst = samples.filter(i => thisset.has(i.name))
			for (const n of s.samplenames) nomutsampleset.delete(n)
			delete s.samplenames
			sets.push(s)
			return sets
		}, [])
		sets.push({
			name: 'No mutation (n=' + nomutsampleset.size + ')',
			lst: samples.filter(i => nomutsampleset.has(i.name)),
			// to be compared against by each other mutated sets to get p-value for each set
			is_notmutated: true
		})
		return sets
	}

	const st = q.samplerule.set
	if (!st) {
		// no rule for sets -- make one
		return [{ name: 'All', lst: samples }]
	}
	if (st.geneexpression) {
		if (!st.gene) throw '.gene missing from samplerule.set'
		if (!st.chr) throw '.chr missing from samplerule.set'
		if (!Number.isInteger(st.start)) throw '.start not integer from samplerule.set'
		if (!Number.isInteger(st.stop)) throw '.start not integer from samplerule.set'
		if (st.bymedian) {
			return await dividesamples_genevaluepercentilecutoff(samples, q, ds, plottype)
		}
		if (st.byquartile) {
			return await dividesamples_genevaluequartile(samples, q, ds, plottype)
		}
	}
	if (st.mutation) {
		if (!st.chr) throw '.chr missing from samplerule.set'
		if (!Number.isInteger(st.start)) throw '.start not integer from samplerule.set'
		if (!Number.isInteger(st.stop)) throw '.start not integer from samplerule.set'
		return await dividesamples_mutationanyornone(samples, q, ds, plottype)
	}
	throw 'unknown rule for samplerule.set{}'
}

async function dividesamples_mutationanyornone(samples, q, ds) {
	const st = q.samplerule.set

	// init sample count for each type of mutation, to be returned to client
	st.samples_snvindel = new Set()
	st.samples_cnv = new Set()
	st.samples_loh = new Set()
	st.samples_sv = new Set()
	st.samples_fusion = new Set()
	st.samples_itd = new Set()

	if (st.cnv && !st.snvindel && !st.loh && !st.sv && !st.fusion && !st.itd) {
		// just cnv, samples will be divided into loss/gain/nochange
		const [gainset, lossset] = await get_mutatedsamples(samples, q, ds, true)
		const samples_gain = []
		const samples_loss = []
		const samples_nomut = []
		for (const s of samples) {
			if (gainset.has(s.name)) {
				samples_gain.push(s)
			} else if (lossset.has(s.name)) {
				samples_loss.push(s)
			} else {
				samples_nomut.push(s)
			}
		}
		const returnsets = []
		if (samples_loss.length) {
			returnsets.push({
				name: 'Copy number loss (n=' + samples_loss.length + ')',
				lst: samples_loss
			})
		}
		if (samples_gain.length) {
			returnsets.push({
				name: 'Copy number gain (n=' + samples_gain.length + ')',
				lst: samples_gain
			})
		}
		if (samples_nomut.length) {
			returnsets.push({
				name: 'No copy number variation (n=' + samples_nomut.length + ')',
				lst: samples_nomut
			})
		}
		return returnsets
	}

	// otherwise, divide to 2 groups: has mut/no mut
	const samples_withmut = await get_mutatedsamples(samples, q, ds)
	const samples_nomut = []
	for (const s of samples) {
		if (!samples_withmut.find(i => i.name == s.name)) {
			samples_nomut.push(s)
		}
	}
	const returnsets = []
	if (samples_withmut.length) {
		returnsets.push({
			name: 'With mutation (n=' + samples_withmut.length + ')',
			lst: samples_withmut
		})
	}
	if (samples_nomut.length) {
		returnsets.push({
			name: 'No mutation (n=' + samples_nomut.length + ')',
			lst: samples_nomut
		})
	}
	return returnsets
}

async function get_mutatedsamples(fullsamples, q, ds, cnvonly) {
	/*
if is cnvonly, will return two groups of samples, gain and loss each
if not, will return all mutated samples
*/
	const fullsamplenameset = new Set(fullsamples.map(i => i.name))

	const st = q.samplerule.set

	let vcfquery
	let svcnvquery
	for (const k in ds.queries) {
		const v = ds.queries[k]
		if (v.type == common.tkt.mdsvcf) {
			vcfquery = v
		} else if (v.type == common.tkt.mdssvcnv) {
			svcnvquery = v
		}
	}

	const mutsamples = new Set()

	if (st.cnv || st.loh || st.sv || st.fusion || st.itd) {
		if (!svcnvquery) throw 'no svcnv found in ds.queries'

		if (cnvonly) {
			// cnv only, returns two groups for gain or loss
			return await query_svcnv(svcnvquery, fullsamplenameset, q, true)
		}

		// not just cnv
		const names = await query_svcnv(svcnvquery, fullsamplenameset, q)
		for (const n of names) {
			mutsamples.add(n)
		}
	}

	if (st.snvindel) {
		if (!vcfquery) throw 'no vcf found in ds.queries'
		for (const tk of vcfquery.tracks) {
			await query_vcf(vcfquery, tk, fullsamplenameset, mutsamples, q)
		}
	}

	return fullsamples.filter(i => mutsamples.has(i.name))
}

async function query_svcnv(tk, samplenameset, q, cnvonly) {
	/*
if not cnvonly, return set of altered sample names
if cnvonly, return two sets, for gain/loss
tk is from ds.queries{}
*/

	// more configs are here
	const st = q.samplerule.set

	const dir = tk.url ? await utils.cache_index(tk.url, tk.indexURL) : null // does km ever work on custom track?

	const gain = new Set() // use if cnvonly
	const loss = new Set()
	const mutsamples = new Set() // use if has other types in addition to cnv

	await utils.get_lines_bigfile({
		args: [
			tk.file ? path.join(serverconfig.tpmasterdir, tk.file) : tk.url,
			(tk.nochr ? st.chr.replace('chr', '') : st.chr) + ':' + st.start + '-' + (st.stop + 1)
		],
		dir,
		callback: line => {
			const l = line.split('\t')
			const start = Number.parseInt(l[1])
			const stop = Number.parseInt(l[2])
			const j = JSON.parse(l[3])

			if (!samplenameset.has(j.sample)) {
				// sample not from the full set
				return
			}

			if (j.dt == common.dtcnv) {
				if (!st.cnv) {
					// not look at cnv
					return
				}
				if (st.cnv.focalsizelimit && stop - start >= st.cnv.focalsizelimit) {
					return
				}
				if (st.cnv.valuecutoff && Math.abs(j.value) < st.cnv.valuecutoff) {
					return
				}

				if (cnvonly) {
					if (j.value > 0) {
						gain.add(j.sample)
					} else {
						loss.add(j.sample)
					}
				} else {
					mutsamples.add(j.sample)
				}

				st.samples_cnv.add(j.sample)
				return
			}
			if (j.dt == common.dtloh) {
				if (!st.loh) return
				if (st.loh.focalsizelimit && stop - start >= st.loh.focalsizelimit) return
				if (st.loh.valuecutoff && j.segmean < st.loh.valuecutoff) return
				mutsamples.add(j.sample)
				st.samples_loh.add(j.sample)
				return
			}
			if (j.dt == common.dtsv) {
				if (!st.sv) return
				mutsamples.add(j.sample)
				st.samples_sv.add(j.sample)
				return
			}
			if (j.dt == common.dtfusionrna) {
				if (!st.fusion) return
				mutsamples.add(j.sample)
				st.samples_fusion.add(j.sample)
				return
			}
			if (j.dt == common.dtitd) {
				if (!st.itd) return
				mutsamples.add(j.sample)
				st.samples_itd.add(j.sample)
				return
			}
		}
	})
	if (cnvonly) return [gain, loss]
	return mutsamples
}

async function query_vcf(vcfquery, tk, samplenameset, mutsamples, q) {
	/*
only return the set of mutated sample names
*/

	// more configs are here
	const st = q.samplerule.set

	const dir = tk.url ? await utils.cache_index(tk.url, tk.indexURL) : null

	await utils.get_lines_bigfile({
		args: [
			tk.file ? path.join(serverconfig.tpmasterdir, tk.file) : tk.url,
			(tk.nochr ? st.chr.replace('chr', '') : st.chr) + ':' + st.start + '-' + (st.stop + 1)
		],
		dir,
		callback: line => {
			if (tk.type == common.mdsvcftype.vcf) {
				// vcf
				const [badinfok, mlst, altinvalid] = vcf.vcfparseline(line, {
					nochr: tk.nochr,
					samples: tk.samples,
					info: vcfquery.info,
					format: tk.format
				})

				for (const m of mlst) {
					if (!m.sampledata) {
						continue
					}

					if (st.snvindel.ref) {
						// client provided specific alleles, to restrict to it
						if (m.ref != st.snvindel.ref || m.alt != st.snvindel.alt) {
							continue
						}
					}

					if (st.snvindel.hiddenclass) {
						// filtering on mclass, must set mclass for the variant
						common.vcfcopymclass(m, {})
						if (st.snvindel.hiddenclass[m.class]) {
							continue
						}
					}

					for (const s of m.sampledata) {
						if (samplenameset.has(s.sampleobj.name)) {
							mutsamples.add(s.sampleobj.name)
							st.samples_snvindel.add(s.sampleobj.name)
						}
					}
				}
			} else {
				// support another snvindel file type?
			}
		}
	})
}

async function dividesamples_genevaluequartile(samples, q, ds, plottype) {
	const st = q.samplerule.set
	const [genenumquery, samplewithvalue] = await get_genevalue(samples, q, ds)
	const i1 = Math.ceil(samplewithvalue.length * 0.25)
	const i2 = Math.ceil(samplewithvalue.length * 0.5)
	const i3 = Math.ceil(samplewithvalue.length * 0.75)
	const v1 = samplewithvalue[i1 - 1].genevalue
	const v2 = samplewithvalue[i2 - 1].genevalue
	const v3 = samplewithvalue[i3 - 1].genevalue
	return [
		{
			name: st.gene + ' ' + genenumquery.datatype + ' from 1st quartile (n=' + i1 + ', value<' + v1 + ')',
			lst: samplewithvalue.slice(0, i1),
			isfirstquartile: true
		},
		{
			name:
				st.gene +
				' ' +
				genenumquery.datatype +
				' from 2nd quartile (n=' +
				(i2 - i1) +
				', ' +
				v1 +
				'<=value<' +
				v2 +
				')',
			lst: samplewithvalue.slice(i1, i2)
		},
		{
			name:
				st.gene +
				' ' +
				genenumquery.datatype +
				' from 3rd quartile (n=' +
				(i3 - i2) +
				', ' +
				v2 +
				'<=value<' +
				v3 +
				')',
			lst: samplewithvalue.slice(i2, i3)
		},
		{
			name:
				st.gene +
				' ' +
				genenumquery.datatype +
				' from 4th quartile (n=' +
				(samplewithvalue.length - i3) +
				', value>=' +
				v3 +
				')',
			lst: samplewithvalue.slice(i3, samplewithvalue.length),
			isfourthquartile: true
		}
	]
}

async function dividesamples_genevaluepercentilecutoff(samples, q, ds, plottype) {
	// hardcoded median
	const st = q.samplerule.set
	const [genenumquery, samplewithvalue] = await get_genevalue(samples, q, ds)
	const i = Math.ceil(samplewithvalue.length / 2)
	const v = samplewithvalue[i - 1].genevalue
	return [
		{
			name: st.gene + ' ' + genenumquery.datatype + ' below median (n=' + i + ', value<' + v + ')',
			lst: samplewithvalue.slice(0, i)
		},
		{
			name:
				st.gene +
				' ' +
				genenumquery.datatype +
				' above median (n=' +
				(samplewithvalue.length - i) +
				', value>=' +
				v +
				')',
			lst: samplewithvalue.slice(i, samplewithvalue.length)
		}
	]
}

async function get_genevalue(samples, q, ds) {
	if (!ds.queries) throw '.queries{} missing from ds'
	let genenumquery // gene numeric value query
	for (const k in ds.queries) {
		if (ds.queries[k].isgenenumeric) {
			genenumquery = ds.queries[k]
		}
	}
	if (!genenumquery) throw 'no gene numeric query from ds'

	const dir = genenumquery.url ? await utils.cache_index(genenumquery.url, genenumquery.indexURL) : null

	const st = q.samplerule.set

	const sample2genevalue = new Map()
	await utils.get_lines_bigfile({
		args: [
			genenumquery.file ? path.join(serverconfig.tpmasterdir, genenumquery.file) : genenumquery.url,
			st.chr + ':' + st.start + '-' + st.stop
		],
		dir,
		callback: line => {
			const j = JSON.parse(line.split('\t')[3])
			if (!j.sample || !Number.isFinite(j.value) || j.gene != st.gene) return
			sample2genevalue.set(j.sample, j.value)
		}
	})

	const samplewithvalue = []
	for (const s of samples) {
		if (sample2genevalue.has(s.name)) {
			s.genevalue = sample2genevalue.get(s.name)
			samplewithvalue.push(s)
		}
	}
	samplewithvalue.sort((a, b) => a.genevalue - b.genevalue)
	return [genenumquery, samplewithvalue]
}

export function do_plot(s) {
	/*
    .name
    .lst[]
    	{name, serialtime, censored}

    hardcoded integer 0/1 value for censored
    */
	s.lst.sort((a, b) => a.serialtime - b.serialtime)

	let thistotal = s.lst.length
	let thiscensored = []
	let y = 0
	s.steps = []
	for (const a of s.lst) {
		if (a.censored == 0) {
			thiscensored.push(a.serialtime)
			continue
		}
		// otherwise a.censored==1 has event
		const drop = ((1 - y) * 1) / (thistotal - thiscensored.length)
		s.steps.push({
			x: a.serialtime,
			y: y,
			drop: drop,
			censored: thiscensored
		})
		y += drop
		thistotal -= thiscensored.length + 1
		thiscensored = []
	}
	if (thiscensored.length > 0) {
		// censored at the end
		s.steps.push({
			x: s.lst[s.lst.length - 1].serialtime, // last time
			y: y,
			drop: 0,
			censored: thiscensored
		})
	}
}

function get_samples(q, ds, plottype) {
	if (!q.samplerule) throw '.samplerule missing'
	if (!q.samplerule.full) throw '.samplerule.full missing'

	const lst1 = []

	if (q.samplerule.full.byattr) {
		const key = q.samplerule.full.key
		if (!key) throw 'key missing from samplerule.full{}'
		const value = q.samplerule.full.value
		if (value == undefined) throw 'value missing from samplerule.full{}'
		for (const sn in ds.cohort.annotation) {
			const o = ds.cohort.annotation[sn]
			if (o[key] == value) {
				lst1.push({
					name: sn,
					o: o
				})
			}
		}
	} else if (q.samplerule.full.useall) {
		for (const sn in ds.cohort.annotation) {
			const o = ds.cohort.annotation[sn]
			lst1.push({
				name: sn,
				o: o
			})
		}
	} else if (q.samplerule.full.usesampleset) {
		const sampleset = q.samplerule.full.sampleset
		for (const i in sampleset) {
			const sn = sampleset[i]
			const o = ds.cohort.annotation[sn]
			if (o == undefined) continue
			lst1.push({
				name: sn,
				o: o
			})
		}
	} else {
		throw 'unknown rule for samplerule.full'
	}

	const lst2 = [] // with valid serialtimekey
	for (const s of lst1) {
		if (Number.isFinite(s.o[plottype.serialtimekey])) {
			s.serialtime = s.o[plottype.serialtimekey]
			s.censored = s.o[plottype.iscensoredkey]
			lst2.push(s)
		}
	}
	if (lst2.length == 0) throw 'no samples found for full set'
	return lst2
}
