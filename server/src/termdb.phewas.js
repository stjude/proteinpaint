import fs from 'fs'
import path from 'path'
import * as utils from './utils'
import * as termdbsql from './termdb.sql'
import { createCanvas } from 'canvas'
import * as termdb from './termdb'
import readline from 'readline'
import serverconfig from './serverconfig'

/*
********************** EXPORTED
trigger
update_image
do_precompute
********************** INTERNAL
get_numsample_pergenotype
get_maxlogp
plot_canvas

#for precompute
get_samplefilter4termtype
helper_rows2categories
helper_conditiongroups2categories
*/

const minimum_total_sample = 10

export async function trigger(q, res, ds) {
	/* run on the fly phewas
	q{}
	.ssid
	*/
	if (!ds.cohort) throw 'ds.cohort missing'
	if (!ds.cohort.termdb) throw 'cohort.termdb missing'
	if (!ds.cohort.termdb.phewas) throw 'not allowed on this dataset'
	if (!q.ssid) throw 'ssid missing'

	// to be sent to client
	const result = {
		//minimum_total_sample,
		//skipped_byminimumsample: 0
	}

	// optional filter on samples
	let samplefilterset
	if (q.filter) {
		samplefilterset = new Set(await termdbsql.get_samples(q, ds))
	}

	const [sample2gt, genotype2sample] = await utils.loadfile_ssid(q.ssid, samplefilterset)
	// sample2gt: Map { sample : gt }
	// genotype2sample: Map { gt : Set(samples) }

	result.numberofsamples = sample2gt.size

	// from vcf file, total number of samples per genotype
	const het0 = genotype2sample.has(utils.genotype_types.het) ? genotype2sample.get(utils.genotype_types.het).size : 0
	const href0 = genotype2sample.has(utils.genotype_types.href) ? genotype2sample.get(utils.genotype_types.href).size : 0
	const halt0 = genotype2sample.has(utils.genotype_types.halt) ? genotype2sample.get(utils.genotype_types.halt).size : 0

	const tests = get_phewas_tests(q.filter, ds, sample2gt, het0, href0, halt0)

	result.testcount = tests.length

	///////// fisher
	{
		const lines = []
		for (let i = 0; i < tests.length; i++) {
			lines.push(i + '\t' + tests[i].table.join('\t'))
		}
		const plines = await lines2R(path.join(serverconfig.binpath, 'utils/fisher.2x3.R'), lines)
		let i = 0
		for (const line of plines) {
			tests[i++].pvalue = Number(line.split('\t')[7])
		}
	}

	result.maxlogp = get_maxlogp(tests)

	const groups = group_categories(tests)
	result.tmpfile = await write_resultfile(groups)
	plot_canvas(groups, result, q)

	{
		// collect hover-dots above cutoff
		const cutoff = 0.05
		result.hoverdots = tests.filter(i => i.pvalue <= cutoff)
	}

	res.send(result)
}

function get_phewas_tests(filter, ds, sample2gt, het0, href0, halt0) {
	/* list of test objects, one for each category
	.term: {id,name}
	.category: name of the category
	.q: {}
		term type-specific parameter on how the categories are synthesized
		https://docs.google.com/document/d/18Qh52MOnwIRXrcqYR43hB9ezv203y_CtJIjRgDcI42I/edit#heading=h.ljho28ohkqr8
	.table: [ contigency table ]
	*/

	const tests = []

	let checksubcohort
	if (ds.cohort.termdb.selectCohort) {
		// cohort selection enabled
		if (filter) {
			// it is really expected that filter is provided with the tag:cohortFilter tvs
			// which is used to generate checksubcohort and restrict test terms
			const tvs = filter.lst.find(i => i.tag == 'cohortFilter')
			if (tvs) {
				checksubcohort = tvs.tvs.values
					.map(i => i.key)
					.sort()
					.join(',')
			} else {
				// in what case will no cohort filter be given
			}
		} else {
			// in what case will no filter be given
		}
	}

	for (const cacherow of ds.cohort.termdb.q.getcategory2vcfsample()) {
		if (checksubcohort) {
			// in this case, cacherow.subcohort is expected to exist
			if (cacherow.subcohort != checksubcohort) continue
		}

		/************** each cached row is one term
		.group_name
		.term_id
		.parent_name
		.q{}
		.categories[]
		*/

		const term = termdb.copy_term(ds.cohort.termdb.q.termjsonByOneid(cacherow.term_id))

		for (const category of cacherow.categories) {
			/************ each category a case
			.group1label
			.group2label
			.group1lst
			.group2lst
			*/

			// number of samples by genotype in case
			const [het1, halt1, href1] = get_numsample_pergenotype(sample2gt, category.group1lst)

			// number of samples by genotype in control
			let het2, halt2, href2

			if (category.group2lst) {
				;[het2, halt2, href2] = get_numsample_pergenotype(sample2gt, category.group2lst)
			} else {
				het2 = het0 - het1
				halt2 = halt0 - halt1
				href2 = href0 - href1
			}

			if (het1 + het2 + halt1 + halt2 + href1 + href2 == 0) {
				// possible as group1/2 may be very small, and the variant happens not to be called in any of these samples
				continue
			}

			tests.push({
				term,
				group_name: cacherow.group_name,
				parent_name: cacherow.parent_name,
				group1label: category.group1label,
				group2label: category.group2label,
				//q: q.term1_q,
				table: [
					href1,
					href2,
					het1,
					het2,
					halt1,
					halt2
					/* by allele count
					het + 2 * halt, // case alt
					het + 2 * href, // case ref
					het2 + 2 * halt2, // ctrl alt
					het2 + 2 * href2 // ctrl ref
					*/
				]
			})
		}
	}
	return tests
}

/*
for precomputing
after bundling, run following command:

$ node server phewas-precompute hg38 SJLife

programmatically generate list of samples for each category of a term
as well as list of control samples for condition terms

use get_rows()
- categorical: no config
- numerical: use default binning scheme
- condition: hardcoded scheme

will automatically restrict to only those samples in the vcf file
*/
export async function do_precompute(ds) {
	if (!ds.cohort) throw 'ds.cohort missing'
	if (!ds.cohort.termdb) throw 'cohort.termdb missing'
	if (!ds.cohort.termdb.phewas) throw 'not allowed on this dataset'
	if (ds.cohort.termdb.selectCohort) {
		await precompute_withCohortSelection(ds)
	} else {
		await precompute_noCohortSelection(ds)
	}
}

async function precompute_withCohortSelection(ds) {
	const subcohortTermtype2samples = await may_subcohortTermtype2samples(ds)
	// optional; same structure as ds.cohort.termdb.phewas.precompute_subcohort2totalsamples

	const term2cohort = get_term2cohort(ds)

	const fwrite = fs.createWriteStream('category2vcfsample')
	const emptyterms = []

	for (const { group_name, term } of ds.cohort.termdb.q.getAlltermsbyorder()) {
		if (!term.type) continue
		if (!term2cohort.has(term.id)) {
			// a term with no cohort assignemnt, could be no samples annotated to it
			emptyterms.push(term.id)
			continue
		}

		let parentname = ''
		{
			const t = ds.cohort.termdb.q.getTermParent(term.id)
			if (t) parentname = t.name
		}

		// generates list of queries
		const querylst = getquerylst4term(term, ds, term2cohort)

		for (const q of querylst) {
			///// run query for this term

			const re = await termdbsql.get_rows(q)
			/* each row is { sample, key1, val1 }
			where key1 is the category label, matching with term.values[k].label, but not key!!
			however there's no strutured tvs associated for each key1
			*/

			let categories
			/* a category {}
				  .group1label
				  .group2label
				  .group1lst[]
				  .group2lst[]
			   list of control samples (group2lst) is optional
			   may only be used for condition terms since they may have type-specific filter
			*/

			if (term.type == 'categorical' || term.type == 'integer' || term.type == 'float') {
				categories = helper_rows2categories(re.lst, term, ds)
			} else if (term.type == 'condition') {
				if (ds.cohort.termdb.phewas.comparison_groups) {
					// predefined comparison groups
					categories = helper_conditiongroups2categories(re.lst, ds)
				} else {
					// no predefined group, treat like categorical
					categories = helper_rows2categories(re.lst, term, ds)
				}
			} else {
				throw 'unknown term type'
			}

			categories = may_set_group2lst({ categories, q, subcohortTermtype2samples, term })

			// log
			for (const c of categories) {
				console.log(
					c.group1lst.length +
						(c.group2lst ? '/' + c.group2lst.length : '') +
						'\t' +
						c.group1label +
						'\t' +
						term.name +
						'\t' +
						q.cohortname
				)
			}
			/* columns
			1. group name
			2: term id
			3: parent name
			4: term setting
			5: list of categories
			*/
			fwrite.write(
				q.cohortname +
					'\t' +
					group_name +
					'\t' +
					term.id +
					'\t' +
					parentname +
					'\t' +
					(q.term1_q ? JSON.stringify(q.term1_q) : '{}') +
					'\t' +
					JSON.stringify(categories) +
					'\n'
			)
		}
	}

	fwrite.end(() => {
		console.log('Phewas precompute result written to file "category2vcfsample".')
		if (emptyterms.length) {
			console.log(emptyterms.length + ' empty terms:')
			console.log(emptyterms.join('\n'))
		}
	})
}

function may_set_group2lst(opts) {
	/* list of categories are generated from one term, by get_rows
none of these categories have group2lst

may set list of group2 samples if:
1. predefined term-type specific sample exclusion rules
2. some of the categories are uncomputable

works for subcohort enabled or not
*/

	const { categories, q, term, subcohortTermtype2samples, condition_samplelst } = opts

	if (
		subcohortTermtype2samples &&
		subcohortTermtype2samples[q.cohortname] &&
		subcohortTermtype2samples[q.cohortname].termtype &&
		subcohortTermtype2samples[q.cohortname].termtype[term.type]
	) {
		// there are filters for this type of term restricting samples of a control set
		// must create list of control samplesfor each category
		const restrictsamples = subcohortTermtype2samples[q.cohortname].termtype[term.type].samples

		for (const c of categories) {
			if (c.group2lst) {
				// already has control, filter it
				c.group2lst = c.group2lst.filter(s => restrictsamples.indexOf(s) != -1)
			} else {
				// no control yet
				if (c.copycontrolfrom1stgroup) {
					// use the control from the first group/category!!
					c.group2lst = []
					for (const s of categories[0].group2lst) {
						c.group2lst.push(s)
					}
				} else {
					// generate control from the filtered sample lst
					const set = new Set(c.group1lst)
					c.group2lst = restrictsamples.filter(s => !set.has(s))
				}
			}
		}
		return categories
	}

	if (condition_samplelst && term.type == 'condition') {
		// there are filters for condition terms restricting samples of a control set, must create list of control samplesfor each category
		for (const c of categories) {
			if (c.group2lst) {
				// already has control, filter it
				c.group2lst = c.group2lst.filter(s => condition_samplelst.indexOf(s) != -1)
			} else {
				// no control yet
				if (c.copycontrolfrom1stgroup) {
					// use the control from the first group/category!!
					c.group2lst = []
					for (const s of categories[0].group2lst) {
						c.group2lst.push(s)
					}
				} else {
					// generate control from the filtered sample lst
					const set = new Set(c.group1lst)
					c.group2lst = condition_samplelst.filter(s => !set.has(s))
				}
			}
		}
		return categories
	}

	// consider hidden categories

	if (!term.values) {
		// not applicable
		return categories
	}
	// as group1label is just label but not key
	const hiddenlabels = new Set()
	for (const k in term.values) {
		if (term.values[k].uncomputable) hiddenlabels.add(term.values[k].label)
	}
	if (hiddenlabels.size == 0) {
		// no hidden categories
		return categories
	}
	const unhiddencategories = []
	for (const c of categories) {
		if (hiddenlabels.has(c.group1label)) {
			console.log('skip ' + c.group1label + ', ' + term.id)
			continue
		}
		unhiddencategories.push(c)
	}
	// for remaining categories, each will have group2lst combined from all the other visible categories except this one
	for (let i = 0; i < unhiddencategories.length; i++) {
		const c = unhiddencategories[i]
		c.group2lst = []
		for (let j = 0; j < unhiddencategories.length; j++) {
			if (j == i) continue
			c.group2lst.push(...unhiddencategories[j].group1lst)
		}
	}
	return unhiddencategories
}

async function may_subcohortTermtype2samples(ds) {
	if (!ds.cohort.termdb.phewas.precompute_subcohort2totalsamples) return
	for (const key in ds.cohort.termdb.phewas.precompute_subcohort2totalsamples) {
		const config = ds.cohort.termdb.phewas.precompute_subcohort2totalsamples[key]
		if (config.termtype) {
			for (const type in config.termtype) {
				config.termtype[type].samples = await termdbsql.get_samples({ filter: config.termtype[type].filter }, ds)
			}
		}
	}
	return ds.cohort.termdb.phewas.precompute_subcohort2totalsamples
}

function get_term2cohort(ds) {
	const t2s = new Map()
	const s = ds.cohort.db.connection.prepare('SELECT * FROM subcohort_terms')
	for (const { term_id, cohort } of s.all()) {
		if (!t2s.has(term_id)) t2s.set(term_id, new Set())
		t2s.get(term_id).add(cohort)
	}
	return t2s
}

async function precompute_noCohortSelection(ds) {
	/* need to test if it really work for a datasset without cohort selection
	 */

	//////////// optional sample filter by term type
	const [condition_samplelst] = await get_samplefilter4termtype(ds)

	// text rows to be loaded to db table
	const rows = []

	for (const { group_name, term } of ds.cohort.termdb.q.getAlltermsbyorder()) {
		if (!term.type) {
			// requires a valid term type
			continue
		}

		let parentname = ''
		{
			const t = ds.cohort.termdb.q.getTermParent(term.id)
			if (t) parentname = t.name
		}

		const querylst = getquerylst4term(term, ds)

		for (const q of querylst) {
			///// run query for this term

			const re = await termdbsql.get_rows(q)

			let categories
			/* a category {}
			      .group1label
				  .group2label
				  .group1lst[]
				  .group2lst[]
			   list of control samples (group2lst)is optional
			   may only be used for condition terms since they may have type-specific filter
			*/

			if (term.type == 'categorical' || term.type == 'integer' || term.type == 'float') {
				categories = helper_rows2categories(re.lst, term, ds)
			} else if (term.type == 'condition') {
				if (ds.cohort.termdb.phewas.comparison_groups) {
					// predefined comparison groups
					categories = helper_conditiongroups2categories(re.lst, ds)
				} else {
					// no predefined group, treat like regular category
					categories = helper_rows2categories(re.lst, term, ds)
				}
			} else {
				throw 'unknown term type'
			}

			categories = may_set_group2lst({ categories, q, term, condition_samplelst })

			// log
			for (const c of categories) {
				console.log(
					c.group1lst.length + (c.group2lst ? '/' + c.group2lst.length : '') + '\t' + c.group1label + '\t' + term.name
				)
			}

			/* columns
			1. group name
			2: term id
			3: parent name
			4: term setting
			5: list of categories
			*/
			rows.push(
				group_name +
					'\t' +
					term.id +
					'\t' +
					parentname +
					'\t' +
					(q.term1_q ? JSON.stringify(q.term1_q) : '{}') +
					'\t' +
					JSON.stringify(categories)
			)
		}
	}

	fs.writeFileSync('category2vcfsample', rows.join('\n'))
	console.log('Phewas precompute result written to file "category2vcfsample".')
}

function getquerylst4term(term, ds, term2cohort) {
	/* prep queries for this term
queries as is accepted by get_rows(), to pull out list of samples for each category based on that query
one term may generate multiple queries, e.g. cohort selection, or special config
*/
	const qlst = []
	if (ds.cohort.termdb.selectCohort) {
		// has cohort selection

		if (!term2cohort) throw 'term2cohort is required when cohort selection is enabled'

		// for each cohort choice, to generate a query
		for (const cohortchoice of ds.cohort.termdb.selectCohort.values) {
			const cohortname = cohortchoice.keys.sort().join(',')

			if (!term2cohort.get(term.id).has(cohortname)) {
				// this term is not associated with this cohort
				continue
			}

			const filter = {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: ds.cohort.termdb.selectCohort.term,
							values: cohortchoice.keys.map(i => {
								return { key: i }
							})
						}
					}
				]
			}
			if (term.type == 'categorical') {
				qlst.push({
					cohortname,
					filter: JSON.parse(JSON.stringify(filter)),
					ds,
					term1_id: term.id
				})
			} else if (term.type == 'float' || term.type == 'integer') {
				qlst.push({
					cohortname,
					filter: JSON.parse(JSON.stringify(filter)),
					ds,
					term1_id: term.id,
					term1_q: term.bins.default
				})
			} else if (term.type == 'condition') {
				// for both leaf and non-leaf
				// should only use grades as bars to go along with termdb.comparison_groups
				// no need to test on subconditions
				qlst.push({
					cohortname,
					filter: JSON.parse(JSON.stringify(filter)),
					ds,
					term1_id: term.id,
					term1_q: { bar_by_grade: true, value_by_max_grade: true }
				})
			} else {
				throw 'unknown term type'
			}
		}
	} else {
		// no cohort selection
		if (term.type == 'categorical') {
			qlst.push({
				ds,
				term1_id: term.id
			})
		} else if (term.type == 'float' || term.type == 'integer') {
			qlst.push({
				ds,
				term1_id: term.id,
				term1_q: term.bins.default
			})
		} else if (term.type == 'condition') {
			// for both leaf and non-leaf
			// should only use grades as bars to go along with termdb.comparison_groups
			// no need to test on subconditions
			qlst.push({
				ds,
				term1_id: term.id,
				term1_q: { bar_by_grade: true, value_by_max_grade: true }
			})
		} else {
			throw 'unknown term type'
		}
	}
	return qlst
}

///////////// precompute helper
function helper_rows2categories(rows, term, ds) {
	// simply use .key1 as category, to summarize into list of samples by categories
	const key2cat = new Map()
	for (const row of rows) {
		if (ds.track && ds.track.vcf && ds.track.vcf.sample2arrayidx) {
			if (!ds.track.vcf.sample2arrayidx.has(row.sample)) {
				// not a sample in vcf
				continue
			}
		}
		const category = row.key1
		if (!key2cat.has(category)) {
			let label = category
			if (term.values) label = term.values[category] ? term.values[category].label : category
			key2cat.set(category, {
				group1label: label,
				group2label: 'All others',
				group1lst: []
			})
		}
		key2cat.get(category).group1lst.push(row.sample)
	}
	return [...key2cat.values()]
}
function helper_conditiongroups2categories(rows, ds) {
	/* with predefined comparison groups in ds
	 */
	const categories = []
	for (const groupdef of ds.cohort.termdb.phewas.comparison_groups) {
		// divide samples from rows into two groups based on group definition

		const group1lst = []
		const group2lst = []
		for (const row of rows) {
			if (ds.track && ds.track.vcf && ds.track.vcf.sample2arrayidx) {
				if (!ds.track.vcf.sample2arrayidx.has(row.sample)) {
					// not a sample in vcf
					continue
				}
			}

			const grade = Number(row.key1) // should be safe to assume key1 is grade
			// group1grades is required
			if (groupdef.group1grades.has(grade)) {
				group1lst.push(row.sample)
				continue
			}
			// group2grades
			if (groupdef.group2grades && groupdef.group2grades.has(grade)) {
				group2lst.push(row.sample)
			}
		}

		if (group1lst.length == 0) {
			// nothing in group1, skip
			console.log('Empty group1: ' + groupdef.group1label)
			continue
		}

		categories.push({
			group1label: groupdef.group1label,
			group2label: groupdef.group2label,
			group1lst,
			group2lst: group2lst.length ? group2lst : undefined,
			// must pass over this flag!
			copycontrolfrom1stgroup: groupdef.copycontrolfrom1stgroup
		})
	}
	return categories
}

export async function update_image(q, res) {
	/*
called by changing ymax on client
*/
	const str = await utils.read_file(path.join(serverconfig.cachedir, q.file))
	const groups = []
	for (const line of str.trim().split('\n')) {
		const [group_name, tmp] = line.split('\t', 2)
		const logp = Number(tmp)
		if (groups.length == 0 || groups[groups.length - 1].group_name != group_name) {
			groups.push({ group_name, categories: [] })
		}
		groups[groups.length - 1].categories.push({ logp })
	}
	const result = {
		maxlogp: Number(q.max)
	}
	plot_canvas(groups, result, q)
	res.send(result)
}

function get_maxlogp(tests) {
	// set actual max for returning to client
	let m = 0
	for (const t of tests) {
		if (t.pvalue == 0) {
			t.logp = 100
		} else {
			t.logp = -Math.log10(t.pvalue)
		}
		m = Math.max(m, t.logp)
	}
	return m
}

function plot_canvas(groups, result, q) {
	/*
.groups[]
array of test objects
as generated by group_categories()
will add .width and .dotshiftx to each group

group.width reflects number of categories and is always bigger than label font size

|groupxspace ..dots... groupxspace|groupxspace ...dots... groupxspace|

*/

	const intendwidth = Number(q.intendwidth),
		axisheight = Number(q.axisheight),
		groupnamefontsize = Number(q.groupnamefontsize),
		dotradius = Number(q.dotradius),
		groupxspace = Number(q.groupxspace),
		leftpad = Number(q.leftpad),
		rightpad = Number(q.rightpad),
		toppad = Number(q.toppad),
		bottompad = Number(q.bottompad),
		dotcolor = 'black',
		columnbgcolor = '#FDFEE2',
		devicePixelRatio = Number(q.devicePixelRatio)

	// defines dot density for groups with many dots
	// groups with fewer dots will have fixed width and lower varying density
	const dotshiftx = intendwidth / groups.reduce((i, j) => i + j.categories.length, 0)

	const canvas = createCanvas(10, 10) // width is dynamic
	const ctx = canvas.getContext('2d')

	// set canvas width based on groups and number of tests in each
	let x = 0
	for (const g of groups) {
		const w = g.categories.length * dotshiftx
		g.width = Math.max(w, groupnamefontsize) + groupxspace * 2
		if (w > groupnamefontsize) {
			g.dotshiftx = dotshiftx
		} else {
			g.dotshiftx = groupnamefontsize / g.categories.length
		}
		x += g.width
	}
	const canvaswidth = leftpad + x + rightpad
	canvas.width = canvaswidth * devicePixelRatio

	// set canvas height by max length of group label
	const canvasheight = toppad + axisheight + bottompad
	canvas.height = canvasheight * devicePixelRatio

	if (devicePixelRatio > 1) {
		ctx.scale(devicePixelRatio, devicePixelRatio)
	}

	///////// plot bg
	x = 0
	ctx.fillStyle = columnbgcolor
	for (const [i, g] of groups.entries()) {
		if (i % 2 == 0) {
			ctx.fillRect(x, toppad, g.width, axisheight)
		}
		x += g.width
	}

	///////// plot dots
	x = 0
	ctx.fillStyle = dotcolor
	result.grouplabels = [] // collect name and pos of group labels for showing in svg
	for (const g of groups) {
		result.grouplabels.push({
			name: g.group_name,
			x: x + g.width / 2,
			y: toppad + axisheight + dotradius * 2
		})
		/*
		ctx.save()
		ctx.translate( x+g.width/2-groupnamefontsize/4, toppad+axisheight+dotlabelyspace )
		ctx.rotate(Math.PI/2)
		ctx.fillText( g.group_name, 0, 0 )
		ctx.restore()
		*/

		let x2 = 0
		for (const test of g.categories) {
			const h =
				result.maxlogp == 0 ? 0 : test.logp >= result.maxlogp ? axisheight : (axisheight * test.logp) / result.maxlogp
			ctx.beginPath()
			ctx.arc(x + groupxspace + x2, toppad + axisheight - h, dotradius, 0, 2 * Math.PI)
			ctx.fill()
			test.x = x + groupxspace + x2
			x2 += g.dotshiftx
		}
		x += g.width
	}

	result.canvaswidth = canvaswidth
	result.canvasheight = canvasheight
	result.toppad = toppad
	result.bottompad = bottompad
	result.axisheight = axisheight
	result.dotradius = dotradius
	result.groupnamefontsize = groupnamefontsize
	result.src = canvas.toDataURL()
}

async function get_samplefilter4termtype(ds) {
	/* when a sample filter is provided for a type of term
must restrict to these samples for the term
only used for precomputing, not for on the fly
*/
	let condition_samples = null

	if (ds.cohort.termdb.phewas.samplefilter4termtype) {
		if (ds.cohort.termdb.phewas.samplefilter4termtype.condition) {
			const samples = await termdbsql.get_samples(
				{ filter: ds.cohort.termdb.phewas.samplefilter4termtype.condition.filter },
				ds
			)
			if (ds.track && ds.track.vcf && ds.track.vcf.sample2arrayidx) {
				// must also restrict to vcf samples
				condition_samples = []
				for (const s of samples) {
					if (ds.track.vcf.sample2arrayidx.has(s)) condition_samples.push(s)
				}
			} else {
				condition_samples = samples
			}
		}
		// filters for other term types
	}
	return [condition_samples]
}

function get_numsample_pergenotype(sample2gt, samples) {
	/*
	 */
	const gt2count = new Map()
	// k: gt, v: #samples
	for (const sample of samples) {
		const genotype = sample2gt.get(sample)
		if (!genotype) {
			// no genotype
			// may happen when there's no sequencing coverage at this variant for this sample
			// or this sample is excluded by filtering
			continue
		}
		gt2count.set(genotype, 1 + (gt2count.get(genotype) || 0))
	}
	return [
		gt2count.get(utils.genotype_types.het) || 0,
		gt2count.get(utils.genotype_types.halt) || 0,
		gt2count.get(utils.genotype_types.href) || 0
	]
}

function group_categories(tests) {
	const k2lst = new Map()
	for (const i of tests) {
		if (!k2lst.has(i.group_name)) k2lst.set(i.group_name, [])
		k2lst.get(i.group_name).push(i)
	}
	const lst = []
	for (const [k, o] of k2lst) {
		lst.push({
			group_name: k,
			categories: o
		})
	}
	return lst
}

function write_resultfile(groups) {
	/*
1. group name
2. logp
3. pvalue
4. stringified json object {}, the test object
	.term{}
	.category STR
	.q{}
	.table[]
*/
	const lines = []
	for (const g of groups) {
		for (const c of g.categories) {
			lines.push(g.group_name + '\t' + c.logp + '\t' + c.pvalue + '\t' + JSON.stringify(c))
		}
	}
	return utils.write_tmpfile(lines.join('\n'))
}

export async function getgroup(q, res) {
	if (!q.file) throw 'file missing'
	return new Promise((resolve, reject) => {
		const categories = []
		const rl = readline.createInterface({ input: fs.createReadStream(path.join(serverconfig.cachedir, q.file)) })
		rl.on('line', line => {
			if (!line.startsWith(q.getgroup + '\t')) return
			const l = line.split('\t')
			const j = JSON.parse(l[3])
			j.pvalue = Number(l[2])
			categories.push(j)
		})
		rl.on('close', () => {
			res.send({ categories })
			resolve()
		})
	})
}
