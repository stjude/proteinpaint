import tape from 'tape'
import { getFilterName } from '../filterName'

tape('\n', test => {
	test.pass('-***- mds3/getFilterName-***-')
	test.end()
})

// TODO multivalue

const catTerm = { type: 'categorical', name: 'TermA', values: { A: { label: 'Aname' } } }
const cohortTvs = {
	tag: 'cohortFilter',
	type: 'tvs',
	tvs: {
		term: { name: 'Cohort', type: 'multivalue', id: 'subcohort', isleaf: false, groupsetting: { disabled: true } },
		values: [{ key: 'ABC', label: 'ABC' }]
	}
}

const fCat = {
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: catTerm,
				values: [{ key: 'A' }]
			}
		}
	]
}

const fCohort = { lst: [cohortTvs] }

const fCatCohort = {
	lst: [
		cohortTvs,
		{
			type: 'tvs',
			tvs: {
				term: catTerm,
				values: [{ key: 'A' }]
			}
		}
	]
}

const fInt = {
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: { type: 'integer' },
				ranges: [{ start: 10, stop: 20 }]
			}
		}
	]
}
const fFloat = {
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: { type: 'float' },
				ranges: [{ start: 1.123456, stop: 2.56778 }]
			}
		}
	]
}

tape('getFilterName', test => {
	test.timeoutAfter(100)
	//test.plan(3)

	test.equal(getFilterName(fCohort), 'No filter', 'filter with just cohortFilter is shown as empty')

	test.equal(
		getFilterName(fCat),
		catTerm.name + ': Aname',
		'combined string is short enough for term name to be included'
	)

	catTerm.name = 'Term11111112222222'
	test.equal(getFilterName(fCat), 'Aname', 'combined name is too long thus only show category name')

	test.equal(getFilterName(fCatCohort), 'Aname', 'tvs with tag=cohortFilter is ignored')

	test.equal(getFilterName(fInt), '10<x<20')

	test.equal(getFilterName(fFloat), '1.1<x<2.6')

	fFloat.lst[0].tvs.term.type = 'geneExpression'
	test.equal(getFilterName(fFloat), '1.1<x<2.6', 'geneExpression tvs')

	fFloat.lst[0].tvs.term.type = 'metaboliteIntensity'
	test.equal(getFilterName(fFloat), '1.1<x<2.6', 'metaboliteIntensity tvs')

	test.end()
})
