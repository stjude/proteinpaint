import tape from 'tape'
import { value2urlsOrText } from '../sampletable'

/***
test sections:

value2urlsOrText()
*/

tape('\n', test => {
	test.comment('-***- sampletable unit-***-')
	test.end()
})

tape('value2urlsOrText()', test => {
	// number, no url
	test.equal(value2urlsOrText(123, {}), 123, 'should return value as-is if no baseURL or pmidOrDoi')
	// text, no url
	test.equal(value2urlsOrText('abc', {}), 'abc', 'should return value as-is if no baseURL or pmidOrDoi')
	//  array, no url
	test.equal(value2urlsOrText(['a', 'b'], {}), 'a<br>b', 'should join array with <br> if no baseURL or pmidOrDoi')
	// single baseURL
	test.equal(
		value2urlsOrText('abc', { baseURL: 'https://example.com/' }),
		'<a href=https://example.com/abc target=_blank>abc</a>',
		'should return single link when baseURL is defined and value is string'
	)
	// multiple baseURL
	test.equal(
		value2urlsOrText(['x', 'y'], { baseURL: 'https://example.com/' }),
		'<a href=https://example.com/x target=_blank>x</a><br><a href=https://example.com/y target=_blank>y</a>',
		'should return multiple links joined by <br> when baseURL is defined and value is array'
	)
	// single doi
	test.equal(
		value2urlsOrText('doi: 10.1000/xyz', { pmidOrDoi: true }),
		'<a href=https://doi.org/10.1000/xyz target=_blank>doi: 10.1000/xyz</a>',
		'should generate DOI link'
	)
	// single pmid
	test.equal(
		value2urlsOrText('12345678', { pmidOrDoi: true }),
		'<a href=https://pubmed.ncbi.nlm.nih.gov/12345678 target=_blank>12345678</a>',
		'should generate PubMed link'
	)
	// mixed pmid and doi
	test.equal(
		value2urlsOrText(['doi: 10.1/abc', '87654321'], { pmidOrDoi: true }),
		'<a href=https://doi.org/10.1/abc target=_blank>doi: 10.1/abc</a><br><a href=https://pubmed.ncbi.nlm.nih.gov/87654321 target=_blank>87654321</a>',
		'should handle mixed array of DOI and PMID'
	)
	test.end()
})
