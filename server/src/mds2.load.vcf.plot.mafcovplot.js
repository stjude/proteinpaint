import * as utils from './utils'
import * as vcf from '#shared/vcf'
import { scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import * as termdbsql from './termdb.sql'

/*
********************** EXPORTED
handle_mafcovplot
********************** INTERNAL
*/

const unannotated_color = '#aaa'
const bcfformat = '%CHROM\t%POS\t%ID\t%REF\t%ALT\t%QUAL\t%FILTER\t%INFO\t%FORMAT\n'

export async function plot(q, genome, ds, result) {
	try {
		if (!ds.track) throw 'ds.track missing'
		const tk = ds.track.vcf
		if (!tk) throw 'ds.track.vcf missing'
		if (ds.iscustom) {
			// custom track always enable plot?
			tk.plot_mafcov = {
				show_samplename: 1
			}
		} else {
			if (!tk.plot_mafcov) throw 'maf-cov plot is not supported on this track'
			// TODO jwt access control
		}
		if (!q.m) throw '.m{} missing'

		if (!tk.AD) throw 'vcf.AD{} missing'

		const coord = (tk.AD.nochr ? q.m.chr.replace('chr', '') : q.m.chr) + ':' + (q.m.pos + 1) + '-' + (q.m.pos + 1)
		const file = tk.AD.chr2bcffile[q.m.chr]
		if (!file) throw 'chr not in tk.AD.chr2bcffile'

		let m

		await utils.get_lines_bigfile({
			isbcf: true,
			args: ['query', '-r', coord, '-f', bcfformat, file],
			dir: tk.AD.dir,
			callback: line => {
				const [e, mlst, e2] = vcf.vcfparseline(line, tk.AD)
				for (const m2 of mlst) {
					//if( tk.nochr ) m.chr = 'chr'+m.chr
					if (m2.pos == q.m.pos && m2.ref == q.m.ref && m2.alt == q.m.alt) {
						m = m2
						return
					}
				}
			}
		})

		if (!m) throw 'variant not found'

		// hardcoded to use AD

		// client side rendering
		result.plotgroups = mafcov_getdata4clientrendering(m, tk, ds)

		if (q.overlay_term) {
			const re = await termdbsql.get_rows({
				ds,
				term1_id: q.overlay_term,
				term1_q: q.overlay_term_q
			})

			const anysample2category = new Map()
			// re.lst contains all samples of cohort
			for (const i of re.lst) {
				anysample2category.set(i.sample, i.key1)
			}

			const colorfunc = scaleOrdinal(schemeCategory10)
			const categories = new Map()
			let unannotated_samplecount = 0 // vcf sample may be unannotated, e.g. ctcae
			// plot groups contain only a subset of all samples
			for (const plot of result.plotgroups) {
				for (const o of plot.lst) {
					const category = anysample2category.get(o.sampleobj.name)
					if (category) {
						const color = colorfunc(category)
						o.sampleobj.color = color
						if (!categories.has(category)) {
							categories.set(category, { count: 0, color, label: category })
						}
						categories.get(category).count++
					} else {
						// not annotated
						unannotated_samplecount++
						o.sampleobj.color = unannotated_color
					}
				}
			}

			// TODO get labels for categories, e.g. '1-mild' for '1'

			result.categories = []

			if (re.CTE1 && re.CTE1.name2bin) {
				// is numeric term, return order of bins as in the name2bin map
				// TODO return binning scheme for customization
				for (const n of re.CTE1.name2bin.keys()) {
					const o = categories.get(n)
					if (o) result.categories.push(o)
				}
			} else {
				for (const [c, o] of categories) {
					result.categories.push(o)
				}
			}

			if (unannotated_samplecount) {
				result.categories.push({ count: unannotated_samplecount, color: unannotated_color, label: 'Unannotated' })
			}
		}

		// conditional, may do server-side rendering instead
	} catch (e) {
		result.error = e.message || e
		if (e.stack) console.log(e.stack)
	}
}

function mafcov_getdata4clientrendering(m, tk, ds) {
	const plotgroups = []
	// make a separate plot for each group
	// e.g. germline and tumor of the same patient goes to either group
	// TODO implement that logic later

	// for the moment, all go to one group

	const group = {
		name: '?',
		lst: []
	}
	for (const sample of m.sampledata) {
		const refcount = sample.AD[m.ref] || 0
		const altcount = sample.AD[m.alt] || 0
		const total = refcount + altcount
		const o = {
			mut: altcount,
			total: refcount + altcount,
			maf: total == 0 ? 0 : altcount / total
		}
		if (tk.plot_mafcov.show_samplename) {
			o.sampleobj = {
				name: ds.cohort.termdb.q.id2sampleName(sample.sampleobj.name)
			}
		}

		group.lst.push(o)
	}

	plotgroups.push(group)
	return plotgroups
}
