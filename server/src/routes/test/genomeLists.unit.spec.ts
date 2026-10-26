import tape from 'tape'
import { api as isoformlstApi } from '../isoformlst.ts'
import { api as pdomainApi } from '../pdomain.ts'
import { api as translategmApi } from '../translategm.ts'
import { validatePercentiles } from '../termdb.percentile.ts'

/*
Specs for the request limits of the genome-level routes

test sections:
- /isoformlst: distinct isoforms
- /pdomain: distinct isoforms
- /translategm: gene and coding regions
- /termdb/getpercentile: validatePercentiles()
*/

const maxIsoforms = 1000

// a genome whose sqlite lookups record the isoforms they are called with
function getGenome() {
	const looked: string[] = []
	return {
		looked,
		genomicNameRegexp: /[^a-zA-Z0-9.:_-]/,
		genomefile: 'NA',
		chrlookup: { CHR1: { name: 'chr1', len: 248956422 } },
		genedb: {
			getjsonbyisoform: {
				all: (isoform: string) => {
					looked.push(isoform)
					return [{ genemodel: JSON.stringify({ isoform }) }]
				}
			}
		},
		proteindomain: {
			getbyisoform: {
				all: (isoform: string) => {
					looked.push(isoform)
					return [{ data: '{}' }]
				}
			}
		}
	}
}

// resolves with the res.send() payload
function send(api: any, genome: any, query: any): Promise<any> {
	const handler = (api.methods.get || api.methods.post).init({ genomes: { hg38: genome } })
	return new Promise(resolve => {
		Promise.resolve(handler({ query: { genome: 'hg38', ...query } }, { send: resolve })).catch(e =>
			resolve({ error: String(e) })
		)
	})
}

const isoformNames = (n: number) => Array.from({ length: n }, (_, i) => 'NM_' + i)

tape('\n', test => {
	test.comment('-***- routes genome-level request limits -***-')
	test.end()
})

tape('/isoformlst: distinct isoforms', async test => {
	const g = getGenome()
	const dup = await send(isoformlstApi, g, { lst: Array(5000).fill('NM_1') })
	test.equal(dup.error, undefined, 'should accept a repeated isoform')
	test.equal(dup.lst.length, 1, 'should return a repeated isoform once')
	test.deepEqual(g.looked, ['NM_1'], 'should look up a repeated isoform once')

	const atLimit = await send(isoformlstApi, getGenome(), { lst: isoformNames(maxIsoforms) })
	test.equal(atLimit.lst?.length, maxIsoforms, 'should accept the maximum number of isoforms')

	const g2 = getGenome()
	const overLimit = await send(isoformlstApi, g2, { lst: isoformNames(maxIsoforms + 1) })
	test.ok(String(overLimit.error).includes('must have 1000 or fewer'), 'should reject too many isoforms')
	test.equal(g2.looked.length, 0, 'should not look up any isoform when there are too many')
	test.end()
})

tape('/pdomain: distinct isoforms', async test => {
	const g = getGenome()
	const dup = await send(pdomainApi, g, { isoforms: Array(5000).fill('NM_1') })
	test.equal(dup.error, undefined, 'should accept a repeated isoform')
	test.equal(dup.lst.length, 1, 'should return a repeated isoform once')
	test.deepEqual(g.looked, ['NM_1'], 'should look up a repeated isoform once')

	const g2 = getGenome()
	const overLimit = await send(pdomainApi, g2, { isoforms: isoformNames(maxIsoforms + 1) })
	test.ok(String(overLimit.error).includes('must have 1000 or fewer'), 'should reject too many isoforms')
	test.equal(g2.looked.length, 0, 'should not look up any isoform when there are too many')
	test.end()
})

tape('/translategm: gene and coding regions', async test => {
	const gm = { chr: 'chr1', start: 100, stop: 130, strand: '+', coding: [[100, 130]] }
	const valid = await send(translategmApi, getGenome(), { gm })
	test.equal(valid.error, undefined, 'should accept a gene with a coding region inside it')
	test.ok(valid.frame !== undefined, 'should return the frame')

	for (const [label, gm2, message] of [
		['a gene longer than 5 Mb', { ...gm, stop: 100 + 5_000_001, coding: undefined }, 'longer than'],
		['a gene with stop not after start', { ...gm, stop: 100 }, 'not after'],
		['a coding range outside of the gene', { ...gm, coding: [[90, 120]] }, 'outside of the gene'],
		['repeated coding ranges', { ...gm, coding: Array(1000).fill([100, 130]) }, 'longer than the gene'],
		['a coding range that is not a pair of integers', { ...gm, coding: [['100', 130]] }, 'invalid range']
	] as const) {
		const r = await send(translategmApi, getGenome(), { gm: gm2 })
		test.ok(String(r.error).includes(message), `should reject ${label}`)
	}
	test.end()
})

tape('/termdb/getpercentile: validatePercentiles()', test => {
	test.doesNotThrow(() => validatePercentiles([1, 50, 99]), 'should accept percentiles between 0 and 100')
	test.doesNotThrow(
		() => validatePercentiles(Array.from({ length: 100 }, (_, i) => i + 1)),
		'should accept the maximum number of percentiles'
	)
	test.throws(() => validatePercentiles(Array(101).fill(50)), /must have 100 or fewer/, 'should reject too many')
	test.throws(() => validatePercentiles([]), /missing/, 'should reject an empty list')
	test.throws(() => validatePercentiles('50'), /missing/, 'should reject a non-array')
	test.throws(() => validatePercentiles([101]), /between 0 and 100/, 'should reject a value over 100')
	test.throws(() => validatePercentiles(['50']), /between 0 and 100/, 'should reject a non-number')
	test.end()
})
