import tape from 'tape'
import { getSCTermId, isPOCScoreTerm, getYesNoItems, getSCPercentsByLabel } from '../profileForms.js'

/*
Tests for how the profileForms Yes/No tab pairs Point of Care (POC) terms with Site Coordinator
(SC) terms, and how SC answers are keyed for the bar colors.

  • the SC twin of a POC term has the POC id without the POC prefix
  • only multivalue terms are POC score terms, even when a SC term carries the same subtype
  • a POC term with a SC twin, a POC-only term and a SC-only term each become one item, in that order
  • SC answers are keyed by label whether the SC term stores codes or labels
*/

const YN = 'YN Graph'
const poc = (id: string) => ({ term: { id, type: 'multivalue', subtype: YN } })
const sc = (id: string, values: any = {}) => ({ term: { id, type: 'categorical', subtype: YN, values } })

tape('\n', function (test) {
	test.comment('-***- profile/profileFormsYesNo -***-')
	test.end()
})

tape('getSCTermId() drops only a leading POC prefix', function (test) {
	test.equal(getSCTermId('POCFNCNPQ7'), 'FNCNPQ7', 'should drop the POC prefix')
	test.equal(getSCTermId('FDIQ1_MRI'), 'FDIQ1_MRI', 'should leave an id without the prefix unchanged')
	test.equal(getSCTermId('FPOC1'), 'FPOC1', 'should not drop POC in the middle of an id')
	test.end()
})

tape('isPOCScoreTerm() accepts only multivalue terms of the tab subtype', function (test) {
	test.ok(isPOCScoreTerm(poc('POCFNCNPQ7'), YN), 'should accept a multivalue term of the subtype')
	test.notOk(isPOCScoreTerm(sc('FNCNPQ7'), YN), 'should reject a SC term with the same subtype')
	test.notOk(isPOCScoreTerm(poc('POCFX1'), 'Likert Graph'), 'should reject a term of another subtype')
	test.end()
})

tape('getYesNoItems() pairs POC and SC terms and keeps POC-only and SC-only items', function (test) {
	const paired = poc('POCFNCNPQ7')
	const pocOnly = poc('POCFNCNPQ11_INCLUSIVE')
	const twin = sc('FNCNPQ7')
	const scOnly = sc('FDIQ1_MRI')
	const items = getYesNoItems([paired, pocOnly], { FNCNPQ7: twin, FDIQ1_MRI: scOnly }, [scOnly])
	test.deepEqual(
		items,
		[{ tw: paired, scTW: twin }, { tw: pocOnly, scTW: undefined }, { scTW: scOnly }],
		'should return the paired item, the POC-only item, then the SC-only item'
	)
	test.deepEqual(getYesNoItems([], {}, []), [], 'should return no items for a tab without terms')
	test.end()
})

tape('getSCPercentsByLabel() keys SC answers by label', function (test) {
	const values = { '1': { label: 'Yes' }, '0': { label: 'No' }, '-99': { label: 'Do not know' } }
	test.deepEqual(
		getSCPercentsByLabel({ '1': 34, '0': 12, '99': 2 }, sc('FNCNPQ7', values)),
		{ Yes: 34, No: 12, '99': 2 },
		'should map codes to labels and keep a key without a label'
	)
	test.deepEqual(
		getSCPercentsByLabel({ Yes: 47, No: 1 }, sc('FDIQ1_MRI', values)),
		{ Yes: 47, No: 1 },
		'should keep keys that are already labels'
	)
	test.deepEqual(
		getSCPercentsByLabel({ '1': 2, Yes: 3 }, sc('FX', values)),
		{ Yes: 5 },
		'should add up a code and a label for the same category'
	)
	test.end()
})
