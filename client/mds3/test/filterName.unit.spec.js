import tape from 'tape'
import { getFilterName } from '../filterName'

tape('\n', test => {
	test.pass('-***- mds3/getFilterName-***-')
	test.end()
})

const catTerm = { type: 'categorical', name: 'TermA', values: { A: { label: 'Aname' } } }

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

	// combined string is short enough for term name to be included
	test.equal(getFilterName(fCat), catTerm.name + ': Aname')

	catTerm.name = 'Term11111112222222' // name too long and it no longer appears
	test.equal(getFilterName(fCat), 'Aname')

	test.equal(getFilterName(fInt), '10<x<20')

	test.equal(getFilterName(fFloat), '1.1<x<2.6')

	fFloat.lst[0].tvs.term.type = 'geneExpression' // pretend the floating range filter is gene exp
	test.equal(getFilterName(fFloat), '1.1<x<2.6') // and it's treated same as float

	fFloat.lst[0].tvs.term.type = 'metaboliteIntensity' // pretend the floating range filter is metabolite
	test.equal(getFilterName(fFloat), '1.1<x<2.6') // and it's treated same as float

	test.end()
})
