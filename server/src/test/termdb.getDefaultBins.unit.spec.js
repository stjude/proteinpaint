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
