import tape from 'tape'
import { pathwayRows, signedLogQ } from '../pathwayHeatmap'

/*
Tests:
	- pathwayRows keeps sets significant in some column, the most significant merged first
	- signedLogQ is negative for sets whose genes went down or lost methylation
*/

const layer = (q: number, direction = 1) => ({ log10q: Math.log10(q), direction, overlap: 3 })
const set = (id: string, qs: number[]) => ({ id, size: 20, genes: [], layers: qs.map(q => layer(q)) as any })

tape('pathwayRows keeps sets significant in some column, the most significant merged first', t => {
	const ap: any = {
		sets: [set('none', [0.5, 0.5, 0.5]), set('weak', [0.01, 0.3, 0.04]), set('strong', [0.2, 0.2, 1e-5])]
	}
	t.deepEqual(
		pathwayRows(ap, 40).map(s => s.id),
		['strong', 'weak']
	)
	t.deepEqual(
		pathwayRows(ap, 1).map(s => s.id),
		['strong'],
		'cut to maxRows'
	)
	t.end()
})

tape('signedLogQ is negative for sets whose genes went down or lost methylation', t => {
	t.equal(signedLogQ(layer(0.01, -1)), -2)
	t.equal(signedLogQ(layer(0.01, 1)), 2)
	t.equal(signedLogQ(layer(0.01, 0)), 2, 'no genes picked: unsigned')
	t.end()
})
