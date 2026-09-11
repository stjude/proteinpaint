import tape from 'tape'
import { groupColors } from '../groupColors'

/*
test sections:

groupColors: reads the colour the picker assigned to each group
groupColors: omits what is missing rather than substituting
*/

/** The two groups are learned by colour in the picker, so every plot launched from the analysis
 * has to keep them. A missing colour must come back absent, not as a stand-in: the receiving plot
 * has tuned defaults, and a fallback here would silently override them. */

const cfg = (v: any, names = ['Male', 'Female']) => ({
	tw: { term: { values: v } },
	samplelst: { groups: names.map(name => ({ name })) }
})

tape('\n', t => {
	t.comment('-***- groupColors specs -***-')
	t.end()
})

tape('groupColors reads both group colours from the samplelst term', t => {
	const c = groupColors(cfg({ Male: { color: '#6ba57a' }, Female: { color: '#b5651d' } }))
	t.deepEqual(c, { group1: '#6ba57a', group2: '#b5651d' }, 'group1 is the control, group2 the case')
	t.end()
})

tape('groupColors omits what is absent rather than substituting', t => {
	t.deepEqual(groupColors(cfg({ Male: { color: '#6ba57a' } })), { group1: '#6ba57a' }, 'only the one that exists')
	t.deepEqual(groupColors(cfg({})), {}, 'a term carrying no colours yields none')
	t.deepEqual(groupColors({}), {}, 'no term at all is not an error')
	t.deepEqual(groupColors(cfg({ Male: {} })), {}, 'a value with no color field contributes nothing')
	t.end()
})

tape('groupColors matches on group NAME, not position', t => {
	/* The picker keys colours by the group's name, so renaming a group and keeping its colour must
	follow the name -- reading values[0] would silently mis-colour a reordered pair. */
	const c = groupColors(cfg({ Treated: { color: '#111111' }, Control: { color: '#222222' } }, ['Control', 'Treated']))
	t.deepEqual(c, { group1: '#222222', group2: '#111111' }, 'group1 takes Control, its own colour')
	t.end()
})

tape('groupColors falls back to the colour on the group itself', t => {
	/* getSamplelstTW writes the picker's colour to both the term values and the group; a caller
	holding only the groups must still get them. */
	const c = groupColors({
		samplelst: {
			groups: [
				{ name: 'A', color: '#123456' },
				{ name: 'B', color: '#654321' }
			]
		}
	})
	t.deepEqual(c, { group1: '#123456', group2: '#654321' }, 'read off the groups when there is no term')
	const both = groupColors({
		tw: { term: { values: { A: { color: '#aaaaaa' } } } },
		samplelst: {
			groups: [
				{ name: 'A', color: '#123456' },
				{ name: 'B', color: '#654321' }
			]
		}
	})
	t.deepEqual(both, { group1: '#aaaaaa', group2: '#654321' }, 'the term wins where it has one, group fills the rest')
	t.end()
})
