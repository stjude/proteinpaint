import tape from 'tape'
import { SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION } from '#shared/terms.js'
import { init } from '../plotsRoute.ts'

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

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- #singleCell/plotsRoute -***-')
	test.end()
})

tape('singleCellPlots: categoryCounts from colorData generates color legend entries', async test => {
	const ds = {
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
