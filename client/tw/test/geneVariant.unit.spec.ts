import test from 'tape'
import { mayMakeGroups } from '../geneVariant.ts'

/* Tests:
	mayMakeGroups: fills groups for >2 classes
	mayMakeGroups: fills groups for 2 classes
	mayMakeGroups: fills groups for >2 classes (WT absent)
	mayMakeGroups: fills groups for 2 classes (WT absent)
	mayMakeGroups: fills groups with origins
	mayMakeGroups: skips dtTerms with < 2 classes
	mayMakeGroups: does nothing if groups already present
	mayMakeGroups: throws if dtTerms missing
*/

test('\n', t => {
	t.pass('-***- tw/geneVariant.unit -***-')
	t.end()
})

test('mayMakeGroups: fills groups for >2 classes', t => {
	const dtTerm = {
		name: 'SNV/indel',
		values: {
			M: { label: 'MISSENSE' },
			F: { label: 'FRAMESHIFT' },
			D: { label: 'PROTEINDEL' },
			WT: { label: 'Wildtype' }
		}
	}
	const tw: any = {
		q: { type: 'custom-groupset' },
		term: { childTerms: [dtTerm] }
	}
	mayMakeGroups(tw)
	t.equal(tw.q.customset.groups.length, 3, 'Should create 3 groups')
	const grp1 = tw.q.customset.groups[1]
	const grp2 = tw.q.customset.groups[2]
	t.equal(grp1.name, 'Wildtype', 'Group 1 name should be Wildtype')
	t.equal(grp2.name, 'SNV/indel', 'Group 2 name should be SNV/indel')
	t.equal(grp1.filter.lst.length, 1, 'Group 1 filter.lst should have 1 item')
	t.equal(grp2.filter.lst.length, 1, 'Group 2 filter.lst should have 1 item')
	const grp1Item = grp1.filter.lst[0]
	const grp2Item = grp2.filter.lst[0]
	t.equal(grp1Item.type, 'tvs', 'Group 1 filter item should be a tvs')
	t.equal(grp2Item.type, 'tvs', 'Group 2 filter item should be a tvs')
	t.deepEqual(grp1Item.tvs.term, dtTerm, 'Group 1 tvs term should equal dtTerm')
	t.deepEqual(grp2Item.tvs.term, dtTerm, 'Group 2 tvs term should equal dtTerm')
	t.equal(grp1Item.tvs.values.length, 1, 'Group 1 tvs.values should have a single value')
	t.equal(grp2Item.tvs.values.length, 1, 'Group 2 tvs.values should have a single value')
	const grp1Value = grp1Item.tvs.values[0]
	const grp2Value = grp2Item.tvs.values[0]
	t.deepEqual(grp1Value, { key: 'WT', label: 'Wildtype', value: 'WT' }, 'Group 1 value should be a wildtype object')
	t.deepEqual(grp2Value, { key: 'WT', label: 'Wildtype', value: 'WT' }, 'Group 2 value should be a wildtype object')
	t.false(grp1Item.tvs.isnot, 'Group 1 tvs.isnot should be undefined')
	t.true(grp2Item.tvs.isnot, 'Group 2 tvs.isnot should be true')
	const grp0 = tw.q.customset.groups[0]
	t.true(grp0.uncomputable, 'First group should be uncomputable')
	t.end()
})

test('mayMakeGroups: fills groups for 2 classes', t => {
	const dtTerm = {
		name: 'SNV/indel',
		values: {
			M: { label: 'MISSENSE' },
			WT: { label: 'Wildtype' }
		}
	}
	const tw: any = {
		q: { type: 'custom-groupset' },
		term: { childTerms: [dtTerm] }
	}
	mayMakeGroups(tw)
	t.equal(tw.q.customset.groups.length, 3, 'Should create 3 groups')
	const grp1 = tw.q.customset.groups[1]
	const grp2 = tw.q.customset.groups[2]
	t.equal(grp1.name, 'Wildtype', 'Group 1 name should be Wildtype')
	t.equal(grp2.name, 'MISSENSE', 'Group 2 name should be MISSENSE')
	t.equal(grp1.filter.lst.length, 1, 'Group 1 filter.lst should have 1 item')
	t.equal(grp2.filter.lst.length, 1, 'Group 2 filter.lst should have 1 item')
	const grp1Item = grp1.filter.lst[0]
	const grp2Item = grp2.filter.lst[0]
	t.equal(grp1Item.type, 'tvs', 'Group 1 filter item should be a tvs')
	t.equal(grp2Item.type, 'tvs', 'Group 2 filter item should be a tvs')
	t.deepEqual(grp1Item.tvs.term, dtTerm, 'Group 1 tvs term should equal dtTerm')
	t.deepEqual(grp2Item.tvs.term, dtTerm, 'Group 2 tvs term should equal dtTerm')
	t.equal(grp1Item.tvs.values.length, 1, 'Group 1 tvs.values should have a single value')
	t.equal(grp2Item.tvs.values.length, 1, 'Group 2 tvs.values should have a single value')
	const grp1Value = grp1Item.tvs.values[0]
	const grp2Value = grp2Item.tvs.values[0]
	t.deepEqual(grp1Value, { key: 'WT', label: 'Wildtype', value: 'WT' }, 'Group 1 value should be a wildtype object')
	t.deepEqual(grp2Value, { key: 'M', label: 'MISSENSE', value: 'M' }, 'Group 2 value should be a missense object')
	t.false(grp1Item.tvs.isnot, 'Group 1 tvs.isnot should be undefined')
	t.false(grp2Item.tvs.isnot, 'Group 2 tvs.isnot should be undefined')
	const grp0 = tw.q.customset.groups[0]
	t.true(grp0.uncomputable, 'First group should be uncomputable')
	t.end()
})

test('mayMakeGroups: fills groups for >2 classes (WT absent)', t => {
	const dtTerm = {
		name: 'SNV/indel',
		values: {
			M: { label: 'MISSENSE' },
			F: { label: 'FRAMESHIFT' },
			D: { label: 'PROTEINDEL' }
		}
	}
	const tw: any = {
		q: { type: 'custom-groupset' },
		term: { childTerms: [dtTerm] }
	}
	mayMakeGroups(tw)
	t.equal(tw.q.customset.groups.length, 3, 'Should create 3 groups')
	const grp1 = tw.q.customset.groups[1]
	const grp2 = tw.q.customset.groups[2]
	t.equal(grp1.name, 'MISSENSE', 'Group 1 name should be MISSENSE')
	t.equal(grp2.name, 'Other SNV/indel', 'Group 2 name should be Other SNV/indel')
	t.equal(grp1.filter.lst.length, 1, 'Group 1 filter.lst should have 1 item')
	t.equal(grp2.filter.lst.length, 1, 'Group 2 filter.lst should have 1 item')
	const grp1Item = grp1.filter.lst[0]
	const grp2Item = grp2.filter.lst[0]
	t.equal(grp1Item.type, 'tvs', 'Group 1 filter item should be a tvs')
	t.equal(grp2Item.type, 'tvs', 'Group 2 filter item should be a tvs')
	t.deepEqual(grp1Item.tvs.term, dtTerm, 'Group 1 tvs term should equal dtTerm')
	t.deepEqual(grp2Item.tvs.term, dtTerm, 'Group 2 tvs term should equal dtTerm')
	t.equal(grp1Item.tvs.values.length, 1, 'Group 1 tvs.values should have a single value')
	t.equal(grp2Item.tvs.values.length, 1, 'Group 2 tvs.values should have a single value')
	const grp1Value = grp1Item.tvs.values[0]
	const grp2Value = grp2Item.tvs.values[0]
	t.deepEqual(grp1Value, { key: 'M', label: 'MISSENSE', value: 'M' }, 'Group 1 value should be a missense object')
	t.deepEqual(grp2Value, { key: 'M', label: 'MISSENSE', value: 'M' }, 'Group 2 value should be a missense object')
	t.false(grp1Item.tvs.isnot, 'Group 1 tvs.isnot should be undefined')
	t.true(grp2Item.tvs.isnot, 'Group 2 tvs.isnot should be true')
	const grp0 = tw.q.customset.groups[0]
	t.true(grp0.uncomputable, 'First group should be uncomputable')
	t.end()
})

test('mayMakeGroups: fills groups for 2 classes (WT absent)', t => {
	const dtTerm = {
		name: 'SNV/indel',
		values: {
			M: { label: 'MISSENSE' },
			F: { label: 'FRAMESHIFT' }
		}
	}
	const tw: any = {
		q: { type: 'custom-groupset' },
		term: { childTerms: [dtTerm] }
	}
	mayMakeGroups(tw)
	t.equal(tw.q.customset.groups.length, 3, 'Should create 3 groups')
	const grp1 = tw.q.customset.groups[1]
	const grp2 = tw.q.customset.groups[2]
	t.equal(grp1.name, 'MISSENSE', 'Group 1 name should be MISSENSE')
	t.equal(grp2.name, 'FRAMESHIFT', 'Group 2 name should be FRAMESHIFT')
	t.equal(grp1.filter.lst.length, 1, 'Group 1 filter.lst should have 1 item')
	t.equal(grp2.filter.lst.length, 1, 'Group 2 filter.lst should have 1 item')
	const grp1Item = grp1.filter.lst[0]
	const grp2Item = grp2.filter.lst[0]
	t.equal(grp1Item.type, 'tvs', 'Group 1 filter item should be a tvs')
	t.equal(grp2Item.type, 'tvs', 'Group 2 filter item should be a tvs')
	t.deepEqual(grp1Item.tvs.term, dtTerm, 'Group 1 tvs term should equal dtTerm')
	t.deepEqual(grp2Item.tvs.term, dtTerm, 'Group 2 tvs term should equal dtTerm')
	t.equal(grp1Item.tvs.values.length, 1, 'Group 1 tvs.values should have a single value')
	t.equal(grp2Item.tvs.values.length, 1, 'Group 2 tvs.values should have a single value')
	const grp1Value = grp1Item.tvs.values[0]
	const grp2Value = grp2Item.tvs.values[0]
	t.deepEqual(grp1Value, { key: 'M', label: 'MISSENSE', value: 'M' }, 'Group 1 value should be a wildtype object')
	t.deepEqual(grp2Value, { key: 'F', label: 'FRAMESHIFT', value: 'F' }, 'Group 2 value should be a missense object')
	t.false(grp1Item.tvs.isnot, 'Group 1 tvs.isnot should be undefined')
	t.false(grp2Item.tvs.isnot, 'Group 2 tvs.isnot should be undefined')
	const grp0 = tw.q.customset.groups[0]
	t.true(grp0.uncomputable, 'First group should be uncomputable')
	t.end()
})

test('mayMakeGroups: fills groups with origins', t => {
	const dtTerm = {
		name: 'SNV/indel (somatic)',
		values: {
			M: { label: 'MISSENSE' },
			F: { label: 'FRAMESHIFT' },
			D: { label: 'PROTEINDEL' },
			WT: { label: 'Wildtype' }
		},
		origin: 'somatic'
	}
	const tw: any = {
		q: { type: 'custom-groupset' },
		term: { childTerms: [dtTerm] }
	}
	mayMakeGroups(tw)
	t.equal(tw.q.customset.groups.length, 3, 'Should create 3 groups')
	const grp1 = tw.q.customset.groups[1]
	const grp2 = tw.q.customset.groups[2]
	t.equal(grp1.name, 'Wildtype (somatic)', 'Group 1 name should be Wildtype (somatic)')
	t.equal(grp2.name, 'SNV/indel (somatic)', 'Group 2 name should be SNV/indel (somatic)')
	t.equal(grp1.filter.lst.length, 1, 'Group 1 filter.lst should have 1 item')
	t.equal(grp2.filter.lst.length, 1, 'Group 2 filter.lst should have 1 item')
	const grp1Item = grp1.filter.lst[0]
	const grp2Item = grp2.filter.lst[0]
	t.equal(grp1Item.type, 'tvs', 'Group 1 filter item should be a tvs')
	t.equal(grp2Item.type, 'tvs', 'Group 2 filter item should be a tvs')
	t.deepEqual(grp1Item.tvs.term, dtTerm, 'Group 1 tvs term should equal dtTerm')
	t.deepEqual(grp2Item.tvs.term, dtTerm, 'Group 2 tvs term should equal dtTerm')
	t.end()
})

test('mayMakeGroups: skips dtTerms with < 2 classes', t => {
	const dtTerm1 = {
		name: 'SNV/indel',
		values: {
			WT: { label: 'Wildtype' }
		}
	}
	const dtTerm2 = {
		name: 'CNV',
		values: {
			CNV_amp: { label: 'Focal amplification' },
			WT: { label: 'Wildtype' }
		}
	}
	const tw: any = {
		q: { type: 'custom-groupset' },
		term: { childTerms: [dtTerm1, dtTerm2] }
	}
	mayMakeGroups(tw)
	t.equal(tw.q.customset.groups.length, 3, 'Should create 3 groups')
	const grp1 = tw.q.customset.groups[1]
	const grp2 = tw.q.customset.groups[2]
	t.equal(grp1.name, 'Wildtype', 'Group 1 name should be Wildtype')
	t.equal(grp2.name, 'Focal amplification', 'Group 2 name should be Focal amplification')
	t.equal(grp1.filter.lst.length, 1, 'Group 1 filter.lst should have 1 item')
	t.equal(grp2.filter.lst.length, 1, 'Group 2 filter.lst should have 1 item')
	const grp1Item = grp1.filter.lst[0]
	const grp2Item = grp2.filter.lst[0]
	t.equal(grp1Item.type, 'tvs', 'Group 1 filter item should be a tvs')
	t.equal(grp2Item.type, 'tvs', 'Group 2 filter item should be a tvs')
	t.deepEqual(grp1Item.tvs.term, dtTerm2, 'Group 1 tvs term should equal dtTerm2')
	t.deepEqual(grp2Item.tvs.term, dtTerm2, 'Group 2 tvs term should equal dtTerm2')
	t.end()
})

test('mayMakeGroups: does nothing if groups already present', t => {
	const grp1 = { name: 'existing' }
	const tw: any = {
		q: { type: 'custom-groupset', customset: { groups: [grp1] } },
		term: { childTerms: [] }
	}
	mayMakeGroups(tw)
	t.equal(tw.q.customset.groups.length, 1, 'Number of groups should be 1')
	t.deepEqual(tw.q.customset.groups[0], grp1, 'Group 1 should equal grp1')
	t.end()
})

test('mayMakeGroups: throws if dtTerms missing', t => {
	const tw: any = {
		q: { type: 'custom-groupset' },
		term: {}
	}
	t.throws(
		() => {
			mayMakeGroups(tw)
		},
		/dtTerms is missing/,
		'Throws if dtTerms missing'
	)
	t.end()
})
