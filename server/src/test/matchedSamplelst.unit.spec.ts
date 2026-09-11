import tape from 'tape'
import { matchedSamplelst } from '#src/utils/methylationMatrix.ts'

/*
test sections:

matchedSamplelst keeps only the samples with methylation data, as ids, per group
*/

/** Every expression step after a methylation contrast runs on these groups. Leaking a sample
 * without methylation back in would silently make the expression and methylation readings come
 * from different cohorts, which is the confound this exists to remove. */

tape('\n', t => {
	t.comment('-***- matchedSamplelst specs -***-')
	t.end()
})

tape('matchedSamplelst keeps only samples with methylation data, as ids', async t => {
	const names: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' }
	const ids: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 }
	const ds = {
		cohort: {
			termdb: {
				hasSampleAncestry: false,
				q: { id2sampleName: (i: number) => names[i], sampleName2id: (n: string) => ids[n] }
			}
		}
	}
	const eligible = new Set(['A', 'C', 'D'])
	const out = await matchedSamplelst(
		{
			groups: [
				{ name: 'g1', in: true, values: [{ sampleId: 1 }, { sampleId: 2 }] },
				{ name: 'g2', in: true, values: [{ sampleId: 3 }, { sampleId: 4 }, { sampleId: 99 }] }
			]
		},
		eligible,
		ds
	)
	t.deepEqual(
		out,
		{
			groups: [
				{ name: 'g1', in: true, values: [{ sampleId: 1 }] },
				{ name: 'g2', in: true, values: [{ sampleId: 3 }, { sampleId: 4 }] }
			]
		},
		'B (no methylation) and 99 (unknown) are dropped; name, `in` and order are kept; values are ids again'
	)
	t.end()
})
