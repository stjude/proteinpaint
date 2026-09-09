import tape from 'tape'
import { SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION, SINGLECELL_NUMERIC_VALUE } from '#types'
import { getAuthApi, authApi } from '../../auth.js'
import { init, processSamples } from '../plotsRoute.ts'

/**
 * Tests
 *  - singleCell color legend/category counting behavior
 *  - unsupported coordTWs + colorTW combination guard
 */

function makeRes(test) {
	const response: { payload?: any; statusCode?: number } = {}
	return {
		response,
		res: {
			status(code) {
				response.statusCode = code
				return this
			},
			send(payload) {
				response.payload = payload
				test.ok(true, 'response sent')
			}
		}
	}
}

async function ensureOpenAuth() {
	if (authApi) return
	const app = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
	await getAuthApi(app, {}, {}, true)
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- #singleCell/plotsRoute -***-')
	test.end()
})

tape('singleCellPlots: categoryCounts from colorData generates color legend entries', async test => {
	await ensureOpenAuth()
	const ds = {
		cohort: { termdb: {} },
		queries: {
			singleCell: {
				data: {
					get: async () => ({
						plots: [
							{
								expCells: [
									{ cellId: 'cell1', category: 'A', x: 1, y: 2, geneExp: 0.2 },
									{ cellId: 'cell2', category: 'B', x: 2, y: 3, geneExp: 0.6 }
								],
								noExpCells: []
							}
						]
					})
				},
				samples: {
					getFilteredSingleCellSamples: async () => new Set<string>()
				},
				terms: [
					{
						name: 'cellType',
						values: {
							A: { color: '#111111' },
							B: { color: '#222222' }
						}
					}
				]
			}
		}
	}

	const genomes = { hg38: { datasets: { testds: ds } } }
	const handler = init({ genomes })
	const { response, res } = makeRes(test)

	const req = {
		query: {
			genome: 'hg38',
			dslabel: 'testds',
			singleCellPlot: { name: 'plotA', sample: { sID: 'S1' } },
			canvasSettings: { cutoff: 1000 },
			colorTW: {
				term: {
					type: SINGLECELL_CELLTYPE,
					name: 'cellType',
					values: {
						A: { color: '#111111' },
						B: { color: '#222222' }
					}
				},
				q: {}
			}
		}
	}

	await handler(req as any, res as any)

	test.ok(response.payload, 'returns payload')
	test.notOk(response.payload?.error, 'does not return error')
	const colorLegend = response.payload?.result?.Default?.colorLegend || []
	test.equal(colorLegend.length, 2, 'returns 2 color legend entries')
	const legendByCategory = new Map<string, any>(colorLegend as [string, any][])
	test.equal(legendByCategory.get('A')?.sampleCount, 1, 'category A count is 1')
	test.equal(legendByCategory.get('B')?.sampleCount, 1, 'category B count is 1')
	test.equal(legendByCategory.get('A')?.color, '#111111', 'category A color is mapped')
	test.equal(legendByCategory.get('B')?.color, '#222222', 'category B color is mapped')
	test.end()
})

tape('singleCellPlots: coordTWs + colorTW returns explicit not-implemented error', async test => {
	const ds = {
		cohort: { termdb: {} },
		queries: {
			singleCell: {
				data: {
					get: async () => {
						throw new Error('singleCell.data.get should not run for unsupported combined mode')
					}
				},
				samples: {
					getFilteredSingleCellSamples: async () => new Set<string>()
				}
			}
		}
	}

	const genomes = { hg38: { datasets: { testds: ds } } }
	const handler = init({ genomes })
	const { response, res } = makeRes(test)

	const req = {
		query: {
			genome: 'hg38',
			dslabel: 'testds',
			singleCellPlot: { name: 'plotA', sample: { sID: 'S1' } },
			canvasSettings: { cutoff: 1000 },
			colorTW: {
				term: { type: SINGLECELL_CELLTYPE, name: 'cellType' },
				q: {}
			},
			coordTWs: [
				{
					term: { type: SINGLECELL_GENE_EXPRESSION, gene: 'TP53', name: 'tp53' },
					q: {}
				}
			]
		}
	}

	await handler(req as any, res as any)

	test.ok(response.payload?.error, 'returns error payload')
	test.match(
		String(response.payload.error),
		/coordTWs with colorTW is not implemented/,
		'returns explicit unsupported combination error'
	)
	test.end()
})

tape('singleCellPlots: gene-expression colorTW populates gene range', async test => {
	await ensureOpenAuth()
	const ds = {
		cohort: { termdb: {} },
		queries: {
			singleCell: {
			geneExpression: {
				get: async () => ({ cell1: 0.1, cell2: 0.9 })
			},
				data: {
					get: async arg => {
						test.equal(arg.terms[0].term.gene, 'TP53', 'passes colorTW gene to singleCell data query')
						return {
							plots: [
								{
									expCells: [
										{ cellId: 'cell1', category: 'Default', x: 1, y: 2, geneExp: 0.1 },
										{ cellId: 'cell2', category: 'Default', x: 2, y: 3, geneExp: 0.9 }
									],
									noExpCells: []
								}
							]
						}
					}
				},
				samples: {
					getFilteredSingleCellSamples: async () => new Set<string>()
				}
			}
		}
	}

	const genomes = { hg38: { datasets: { testds: ds } } }
	const handler = init({ genomes })
	const { response, res } = makeRes(test)

	const req = {
		query: {
			genome: 'hg38',
			dslabel: 'testds',
			singleCellPlot: { name: 'plotA', sample: { sID: 'S1' } },
			canvasSettings: { cutoff: 1000 },
			colorTW: {
				term: { type: SINGLECELL_GENE_EXPRESSION, gene: 'TP53', name: 'tp53' },
				q: {}
			}
		}
	}

	await handler(req as any, res as any)

	test.notOk(response.payload?.error, 'does not return error')
	test.equal(response.payload?.range?.geMin, 0.1, 'returns finite geMin')
	test.equal(response.payload?.range?.geMax, 0.9, 'returns finite geMax')
	test.end()
})


tape('singleCellPlots: numeric colors reuse validated matrix values and bins', test => {
	const cells = ['missing', 'zero', 'negative', 'positive'].map((cellId, i) => ({
		cellId, x: i, y: i, category: 'wrong column'
	}))
	const colorData: any = { plots: [{ expCells: [], noExpCells: cells }] }
	const data: any = { samples: {
		zero: { score: { value: 0, key: 0 } },
		negative: { score: { value: -2, key: -2 } },
		positive: { score: { value: 3, key: 3 } }
	} }
	const tw: any = { $id: 'score', term: { type: SINGLECELL_NUMERIC_VALUE }, q: { mode: 'continuous' } }
	const result = processSamples([], colorData, new Set(), tw, {}, {}, data)
	test.deepEqual(result.samples.map(s => s.category), ['0', '-2', '3'], 'uses matrix values and omits missing cells')
	test.equal(result.geMin, -2, 'negative minimum')
	test.equal(result.geMax, 3, 'positive maximum')
	test.equal(result.totalCellCount, 3, 'counts valid cells, including zero')
	test.equal(result.categoryCounts.size, 0, 'does not allocate one legend entry per continuous value')

	tw.q = { mode: 'discrete', hiddenValues: { low: true } }
	data.samples.zero.score.key = 'low'
	data.samples.negative.score.key = 'low'
	data.samples.positive.score.key = 'high'
	const binned = processSamples([], colorData, new Set(), tw, {}, {}, data)
	test.deepEqual([...binned.categoryCounts], [['low', 2], ['high', 1]], 'counts matrix bins')
	test.deepEqual(binned.samples.map(s => s.sampleId), ['positive'], 'omits hidden bins from rendering')
	test.end()
})
