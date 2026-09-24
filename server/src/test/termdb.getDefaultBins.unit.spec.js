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
					sample2gene2expressionBins: new Map(),
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
	'getDefaultBins stores a __proto__-named tw.term.sample as an ordinary Map key, not a prototype reassignment',
	async test => {
		const sample2gene2expressionBins = new Map()
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

		test.equal(response.error, undefined, 'processes normally, no special-casing needed for a Map key')
		test.notOk({}.someGeneId, 'does not pollute Object.prototype')
		test.ok(
			sample2gene2expressionBins.has('__proto__'),
			'stores the cache entry under an ordinary Map key, same as any other sample name'
		)
		test.equal(
			sample2gene2expressionBins.get('__proto__').get('someGeneId').min,
			1,
			'the cached bin config is retrievable from the nested Map'
		)
		test.end()
	}
)

// tw.term.sample for a singleCellGeneExpression term is often a {sID, eID?} object, deserialized
// fresh from JSON on every request -- a new object identity each time even for the same logical
// sample. A Map compares object keys by identity, so caching on the raw object would never hit
// across requests and would grow the cache unboundedly. The cache key must be normalized to the
// stable sID instead.
tape(
	'getDefaultBins caches by the stable sID, not by object identity, for an object-shaped tw.term.sample',
	async test => {
		let getCalls = 0
		const sample2gene2expressionBins = new Map()
		const ds = {
			queries: {
				singleCell: {
					geneExpression: {
						sample2gene2expressionBins,
						async get() {
							getCalls++
							return { c1: 1, c2: 2 }
						}
					}
				}
			}
		}
		// two separate requests: JSON.parse produces a new object each time, but with the same sID
		const makeReq = () => ({
			tw: {
				$id: 'geneA',
				term: { type: 'singleCellGeneExpression', sample: JSON.parse('{"sID":"sample1"}'), gene: 'TP53' }
			}
		})
		let response1, response2
		await trigger_getDefaultBins(makeReq(), ds, { send: v => (response1 = v) })
		await trigger_getDefaultBins(makeReq(), ds, { send: v => (response2 = v) })

		test.equal(getCalls, 1, 'the second request hits the cache instead of re-querying expression data')
		test.equal(
			sample2gene2expressionBins.size,
			1,
			'the outer cache does not grow on repeated requests for the same sample'
		)
		test.deepEqual(response1, response2, 'both requests get the same cached result')
		test.end()
	}
)
