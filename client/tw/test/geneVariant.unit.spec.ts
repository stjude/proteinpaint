import tape from 'tape'
import { getGvQLabel, isCustomizedGvQ } from '../geneVariant.ts'

/* test sections

isCustomizedGvQ()
getGvQLabel()
*/

function getCustomGsQ(...groupNames: string[]) {
	return {
		type: 'custom-groupset',
		customset: { groups: groupNames.map(name => ({ name, type: 'filter', filter: {} })) }
	}
}

tape('\n', function (test) {
	test.comment('-***- tw/geneVariant helpers -***-')
	test.end()
})

tape('isCustomizedGvQ()', t => {
	t.equal(isCustomizedGvQ(getCustomGsQ('BCR-ABL1 fusion', 'Others')), true, 'a custom groupset is a user setting')
	t.equal(
		isCustomizedGvQ({ type: 'custom-groupset', customset: { groups: [] } }),
		false,
		'a custom groupset with no groups is not'
	)
	t.equal(
		isCustomizedGvQ({ type: 'predefined-groupset', predefined_groupset_idx: 1 }),
		false,
		'a predefined groupset is not, being what the gene search radio already selects'
	)
	t.equal(isCustomizedGvQ({ type: 'values' }), false, 'a plain values q is the default, not a setting')
	t.equal(
		isCustomizedGvQ({ type: 'values', variantFilter: { type: 'tvslst', lst: [] } }),
		false,
		'a variantFilter is left out until a UI authors one'
	)
	t.equal(isCustomizedGvQ(undefined), false, 'tolerates a missing q')
	t.end()
})

tape('getGvQLabel()', t => {
	const term = {
		type: 'geneVariant',
		name: 'BCR',
		groupsetting: { disabled: false, lst: [{ name: 'SNV/indel' }, { name: 'Fusion' }] }
	}
	t.equal(
		getGvQLabel(term, getCustomGsQ('BCR-ABL1 fusion', 'Others')),
		'BCR-ABL1 fusion / Others',
		'names a custom groupset by its groups, so two settings of one gene can be told apart'
	)
	t.equal(getGvQLabel(term, getCustomGsQ()), 'custom groups', 'falls back for a custom groupset with no groups')
	t.equal(
		getGvQLabel(term, { type: 'predefined-groupset', predefined_groupset_idx: 1 }),
		'Fusion',
		'names a predefined groupset by the selected groupset'
	)
	t.equal(
		getGvQLabel({ type: 'geneVariant', name: 'BCR' }, { type: 'predefined-groupset', predefined_groupset_idx: 1 }),
		'predefined groups',
		'falls back when the term carries no groupset listing, e.g. before it is filled'
	)
	t.equal(getGvQLabel(term, { type: 'values' }), 'any variant class', 'names a plain values q')
	t.end()
})
