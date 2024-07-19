import { getcategoriesRequest, getcategoriesResponse } from '#shared/types/routes/termdb.categories.ts'
import { getOrderedLabels } from '#src/termdb.barchart.js'
import { getData } from '#src/termdb.matrix.js'
// import { Term } from '#shared/types/terms/term.ts'
// import { TermWrapper } from '#shared/types/terms/tw.ts'
// import { NumericTerm } from '#shared/types/terms/numeric.ts'
// import { TermTypes } from '#shared/terms.js'

export const api: any = {
	endpoint: 'termdb/categories',
	methods: {
		get: {
			init,
			request: {
				typeId: 'getcategoriesRequest'
			},
			response: {
				typeId: 'getcategoriesResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg38-test',
							dslabel: 'TermdbTest',
							embedder: 'localhost',
							getcategories: 1,
							term: { id: 'diaggrp' },
							filter: {
								type: 'tvslst',
								in: true,
								join: '',
								lst: [
									{
										tag: 'cohortFilter',
										type: 'tvs',
										tvs: {
											term: {
												name: 'Cohort',
												type: 'categorical',
												values: { ABC: { label: 'ABC' }, XYZ: { label: 'XYZ' } },
												id: 'subcohort',
												isleaf: false,
												groupsetting: { disabled: true }
											},
											values: [{ key: 'ABC', label: 'ABC' }]
										}
									}
								]
							}
						}
					},
					response: {
						header: { status: 200 }
					}
				}
			]
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q = req.query as getcategoriesRequest
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'

			await trigger_getcategories(q, res, tdb, ds, g) // as getcategoriesResponse
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function trigger_getcategories(
	q,
	res: any,
	tdb: any,
	ds: { assayAvailability: { byDt: { [s: string]: any } | ArrayLike<any> } },
	genome: any
) {
	// only one term per request, so can hardcode a known string tw.$id if missing
	// and $id is not used in the response payload/metadata
	if (!q.tw.$id) q.tw.$id = '_'
	const $id = q.tw.$id
	const arg = {
		filter: q.filter,
		terms: [q.tw],
		currentGeneNames: q.currentGeneNames, // optional, from mds3 mayAddGetCategoryArgs()
		rglst: q.rglst // optional, from mds3 mayAddGetCategoryArgs()
	}

	const data = await getData(arg, ds, genome)
	if (data.error) throw data.error

	const lst: any[] = []
	if (q.tw.term.type == 'geneVariant' && !q.tw.q.groupsetting?.inuse) {
		// specialized data processing for geneVariant term when
		// groupsetting is not in use
		const samples = data.samples as { [sampleId: string]: any }
		const dtClassMap = new Map()
		if (ds.assayAvailability?.byDt) {
			for (const [dtType, dtValue] of Object.entries(ds.assayAvailability.byDt)) {
				if (dtValue.byOrigin) {
					dtClassMap.set(parseInt(dtType), { byOrigin: { germline: {}, somatic: {} } })
				}
			}
		}
		const sampleCountedFor = new Set() // if the sample is counted
		for (const sampleData of Object.values(samples)) {
			const key = $id
			const values = sampleData[key].values
			sampleCountedFor.clear()
			/* values here is an array of result entires, one or more entries for each dt. e.g.
			[
				{ dt: 1, class: 'Blank', _SAMPLEID_: 1, origin: 'germline' },
				{ dt: 1, class: 'WT', _SAMPLEID_: 1, origin: 'somatic' },
				{ dt: 2, class: 'Blank', _SAMPLEID_: 1 },
				{ dt: 4, class: 'WT', _SAMPLEID_: 1 }
			]
			*/
			for (const value of values) {
				if (!dtClassMap.has(value.dt)) {
					dtClassMap.set(value.dt, {})
				}
				const dtClasses = dtClassMap.get(value.dt)
				if (dtClasses.byOrigin) {
					if (!dtClasses.byOrigin[value.origin][value.class]) {
						dtClasses.byOrigin[value.origin][value.class] = 1
						sampleCountedFor.add(`${value.dt} ${value.origin} ${value.class}`)
					}
					if (!sampleCountedFor.has(`${value.dt} ${value.origin} ${value.class}`)) {
						sampleCountedFor.add(`${value.dt} ${value.origin} ${value.class}`)
						dtClasses.byOrigin[value.origin][value.class] += 1
					}
				} else {
					if (!dtClasses[value.class]) {
						sampleCountedFor.add(`${value.dt} ${value.class}`)
						dtClasses[value.class] = 1
					}
					if (!sampleCountedFor.has(`${value.dt} ${value.class}`)) {
						sampleCountedFor.add(`${value.dt} ${value.class}`)
						dtClasses[value.class] += 1
					}
				}
			}
		}
		for (const [dt, classes] of dtClassMap) {
			lst.push({
				dt,
				classes
			})
		}
	} else {
		const key2count = new Map()
		// k: category key
		// v: number of samples
		for (const sid in data.samples) {
			const v = data.samples[sid][$id]
			if (!v) continue
			if (!('key' in v)) continue
			key2count.set(v.key, 1 + (key2count.get(v.key) || 0))
		}
		for (const [key, count] of key2count) {
			lst.push({
				samplecount: count,
				key,
				label:
					data.refs?.byTermId?.[$id]?.events?.find((e: { event: any }) => e.event === key).label ||
					q.tw.term?.values?.[key]?.label ||
					key
			})
		}
	}

	const orderedLabels = getOrderedLabels(
		q.tw.term,
		data.refs?.byTermId?.[$id]?.bins || [],
		data.refs?.byTermId?.[$id]?.events,
		q.tw.q
	)
	if (orderedLabels.length) {
		lst.sort((a, b) => orderedLabels.indexOf(a.label) - orderedLabels.indexOf(b.label))
	}
	res.send({
		lst,
		orderedLabels
	} as getcategoriesResponse)
}
