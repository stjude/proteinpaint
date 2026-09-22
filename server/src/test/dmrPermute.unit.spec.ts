import tape from 'tape'
import { permuteGroups } from '#src/utils/dmrPermute.ts'

/*
test sections:

permuteGroups: sizes, determinism, independence across seeds, value pass-through
*/

/* The null this builds is the only calibrated FDR a scan can have, so the shuffle has to be
right in ways that are easy to get subtly wrong: sizes must not drift (an FDR estimated at a
different n describes a different contrast), the same seed must reproduce (a draw has to be
re-runnable), and sequential seeds must not correlate (B draws from near-identical splits would
understate the null's spread). */

const g1 = Array.from({ length: 44 }, (_, i) => ({ sampleId: `case${i}` }))
const g2 = Array.from({ length: 292 }, (_, i) => ({ sampleId: `ctrl${i}` }))

tape('\n', t => {
	t.comment('-***- dmrPermute specs -***-')
	t.end()
})

tape('permuteGroups preserves sizes and the exact value objects', t => {
	const p = permuteGroups(g1, g2, 1)
	t.equal(p.group1.length, 44, 'group1 keeps its size')
	t.equal(p.group2.length, 292, 'group2 keeps its size')
	const all = [...p.group1, ...p.group2]
	t.equal(new Set(all).size, 336, 'every sample appears exactly once')
	t.ok(
		all.every(v => g1.includes(v as any) || g2.includes(v as any)),
		'values pass through by reference, so any id shape survives'
	)
	/* The inputs are still what was actually contrasted and get reported as such. */
	t.equal(g1.length, 44, 'the input arrays are not mutated')
	t.equal(g1[0].sampleId, 'case0', 'nor their contents reordered')
	t.end()
})

tape('permuteGroups is deterministic in the seed and independent across seeds', t => {
	const a = permuteGroups(g1, g2, 7)
	const b = permuteGroups(g1, g2, 7)
	t.deepEqual(
		a.group1.map(v => v.sampleId),
		b.group1.map(v => v.sampleId),
		'same seed reproduces the same split'
	)
	const ids = (p: any) => new Set(p.group1.map((v: any) => v.sampleId))
	const s1 = ids(permuteGroups(g1, g2, 1))
	const s2 = ids(permuteGroups(g1, g2, 2))
	const shared = [...s1].filter(x => s2.has(x)).length
	t.notDeepEqual([...s1], [...s2], 'consecutive seeds give different splits')
	/* Under independence the expected overlap of two 44-draws from 336 is 44*44/336 = 5.8.
	Anything near 44 would mean the seeds are producing correlated shuffles. */
	t.ok(shared < 20, `consecutive seeds are not correlated (overlap ${shared}, chance ~6 of 44)`)
	t.end()
})

tape('permuteGroups actually mixes the two groups', t => {
	/* A shuffle that returned the input unchanged would produce a null identical to the observed
	run and an FDR of 1.0, which reads as "nothing is real" rather than as a broken shuffle. */
	const p = permuteGroups(g1, g2, 3)
	const fromCase = p.group1.filter(v => v.sampleId.startsWith('case')).length
	t.ok(fromCase < 20, `group1 is mostly former controls (${fromCase} of 44 were cases; chance ~6)`)
	t.end()
})

tape('permuteGroups handles degenerate inputs', t => {
	t.deepEqual(permuteGroups([], [], 1), { group1: [], group2: [] }, 'two empty groups')
	const one = permuteGroups([{ sampleId: 'a' }], [], 5)
	t.equal(one.group1.length, 1, 'a single sample stays in group1')
	t.end()
})
