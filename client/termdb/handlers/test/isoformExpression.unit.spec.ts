import tape from 'tape'
import { SearchHandler, filterIsoforms } from '../isoformExpression.ts'
import type { GeneModel } from '#dom/types/isoformSelect'
import { ISOFORM_EXPRESSION } from '#shared/terms.js'

/** Helper to create a minimal GeneModel for testing */
function mockGm(isoform: string): GeneModel {
	return { isoform, chr: 'chr1', start: 0, stop: 100, exon: [[0, 100]] }
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/isoformExpression -***-')
	test.end()
})

tape('selectIsoform() should call callback with configured unit from termdbConfig', test => {
	const handler = new SearchHandler()
	let selected: any

	handler.callback = t => {
		selected = t
	}
	handler.app = {
		vocabApi: {
			termdbConfig: {
				queries: {
					isoformExpression: { unit: 'TPM' }
				}
			}
		}
	} as any

	handler.selectIsoform('ENST00000269305', 'TP53')
	test.equal(selected?.isoform, 'ENST00000269305', 'Should pass selected isoform')
	test.equal(selected?.gene, 'TP53', 'Should pass gene')
	test.equal(selected?.name, 'ENST00000269305 TPM', 'Should include configured unit in term name')
	test.equal(selected?.type, ISOFORM_EXPRESSION, 'Should set type to isoformExpression')

	test.end()
})

tape('selectIsoform() should use default unit when not configured', test => {
	const handler = new SearchHandler()
	let selected: any

	handler.callback = t => {
		selected = t
	}
	handler.app = {
		vocabApi: {
			termdbConfig: {
				queries: {}
			}
		}
	} as any

	handler.selectIsoform('ENST00000269305', 'TP53')
	test.equal(selected?.isoform, 'ENST00000269305', 'Should pass selected isoform')
	test.equal(selected?.name, 'ENST00000269305 Isoform Expression', 'Should use default unit')
	test.equal(selected?.type, ISOFORM_EXPRESSION, 'Should set type to isoformExpression')

	test.end()
})

tape('filterIsoforms() should return only ENST isoforms present in availableItems', test => {
	const gmlst = [mockGm('ENST00000269305'), mockGm('ENST00000413465'), mockGm('NM_000546'), mockGm('ENST00000359597')]
	const availableItems = ['ENST00000269305', 'ENST00000359597']

	const result = filterIsoforms(gmlst, availableItems)
	test.equal(result.length, 2, 'Should return 2 matching isoforms')
	test.equal(result[0].isoform, 'ENST00000269305', 'First match correct')
	test.equal(result[1].isoform, 'ENST00000359597', 'Second match correct')

	test.end()
})

tape('filterIsoforms() should exclude non-ENST isoforms even if in availableItems', test => {
	const gmlst = [mockGm('NM_000546'), mockGm('NR_176326'), mockGm('ENST00000269305')]
	const availableItems = ['NM_000546', 'ENST00000269305']

	const result = filterIsoforms(gmlst, availableItems)
	test.equal(result.length, 1, 'Should only return ENST isoform')
	test.equal(result[0].isoform, 'ENST00000269305', 'Should be the ENST match')

	test.end()
})

tape('filterIsoforms() should return all ENST isoforms when availableItems is empty', test => {
	const gmlst = [mockGm('ENST00000269305'), mockGm('ENST00000413465'), mockGm('NM_000546')]

	const result = filterIsoforms(gmlst, [])
	test.equal(result.length, 2, 'Should return all ENST isoforms when no filter')
	test.equal(result[0].isoform, 'ENST00000269305', 'First ENST correct')
	test.equal(result[1].isoform, 'ENST00000413465', 'Second ENST correct')

	test.end()
})

tape('filterIsoforms() should return empty array when no ENST isoforms match', test => {
	const gmlst = [mockGm('ENST00000269305'), mockGm('ENST00000413465')]
	const availableItems = ['ENST00000999999']

	const result = filterIsoforms(gmlst, availableItems)
	test.equal(result.length, 0, 'Should return empty when no matches')

	test.end()
})
