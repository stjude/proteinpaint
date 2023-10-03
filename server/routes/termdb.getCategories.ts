// import { getgetCategoriesRequest, getgetCategoriesResponse } from '#shared/types/routes/termdb.getCategories'
import { trigger_getcategories } from '#src/termdb.js'

export const api: any = {
	endpoint: 'termdb/getCategories',
	methods: {
		get: {
			init,
			request: {
				typeId: 'getgetCategoriesRequest'
			},
			response: {
				typeId: 'getgetCategoriesResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg38-test',
							dslabel: 'TermdbTest',
							embedder: 'localhost',
							getcategories: 1,
							tid: 'diaggrp',
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
		const q = req.query // as getgetCategoriesRequest
		try {
			const g = genomes[req.query.genome]
			const ds = g.datasets[req.query.dslabel]
			const tdb = ds.cohort.termdb

			if (!g) throw 'invalid genome name'
			if (!ds) throw 'invalid dataset name'
			if (!tdb) throw 'invalid termdb object'
			await trigger_getcategories(q, res, tdb, ds, g) // as getgetCategoriesResponse
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
