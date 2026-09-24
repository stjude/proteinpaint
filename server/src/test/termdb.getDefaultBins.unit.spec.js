import tape from 'tape'
import { trigger_getDefaultBins } from '../termdb.getDefaultBins.js'

tape('getDefaultBins routes pseudobulk through the nested single-cell query handler', async test => {
	let receivedArgs
	const ds = {
		queries: {
			singleCell: {
				pseudobulk: {
					async get(args) {
						receivedArgs = args
						return { term2sample2value: new Map([['pseudobulk-tw', { sample1: 1, sample2: 3 }]]) }
					}
				}
			}
		}
	}
	const q = {
		genome: 'hg38',
		dslabel: 'test',
		tw: {
			$id: 'pseudobulk-tw',
			term: {
				type: 'pseudobulk',
				name: 'geneExpression Blast TP53',
				assay: 'geneExpression',
				memberId: 'Cell Type',
				category: 'Blast',
				gene: 'TP53'
			},
			q: { mode: 'discrete', type: 'regular-bin' }
		}
	}
	let response

	await trigger_getDefaultBins(q, ds, {
		send(value) {
			response = value
		}
	})

	test.ok(receivedArgs, 'calls the pseudobulk query handler')
	test.equal(receivedArgs.terms[0], q.tw, 'passes the pseudobulk term wrapper')
	test.equal(response.min, 1, 'returns the minimum pseudobulk value')
	test.equal(response.max, 3, 'returns the maximum pseudobulk value')
	test.equal(response.error, undefined, 'does not return a routing error')
	test.end()
})

tape('getDefaultBins rejects a reserved tw.$id before touching the single-cell bins cache', async test => {
	const ds = {
		queries: {
			singleCell: {
				geneExpression: {
					sample2gene2expressionBins: {},
					async get() {
						test.fail('should not query gene expression data for a rejected $id')
						return {}
					}
				}
			}
		}
	}
	const q = {
		tw: { $id: '__proto__', term: { type: 'singleCellGeneExpression', sample: 's1', gene: 'TP53' } }
	}
	let response
	await trigger_getDefaultBins(q, ds, { send: value => (response = value) })

	test.ok(response.error, 'returns an error instead of caching through $id')
	test.notOk({}.bins, 'does not pollute Object.prototype')
	test.end()
})

tape(
	'getDefaultBins rejects a reserved tw.term.sample instead of resolving the outer cache key through Object.prototype',
	async test => {
		const sample2gene2expressionBins = {}
		const ds = {
			queries: {
				singleCell: {
					geneExpression: {
						sample2gene2expressionBins,
						async get() {
							return { c1: 1, c2: 2 }
						}
					}
				}
			}
		}
		const q = {
			tw: { $id: 'someGeneId', term: { type: 'singleCellGeneExpression', sample: '__proto__', gene: 'TP53' } }
		}
		let response
		await trigger_getDefaultBins(q, ds, { send: value => (response = value) })

		test.equal(response.error, undefined, 'processes normally instead of resolving binsCache to Object.prototype')
		test.notOk({}.someGeneId, 'does not pollute Object.prototype')
		test.ok(
			Object.hasOwn(sample2gene2expressionBins, '__proto__'),
			'stores the cache entry as a real own property of the outer map'
		)
		test.end()
	}
)
