import tape from 'tape'
import { SearchHandler } from '../snp.ts'

/*************************
 reusable helper functions
**************************/

function getGeneSearchWithCoordinates(overrides: any = {}) {
	return {
		chr: 'chr17',
		ref: 'G',
		alt: 'A',
		fromWhat: 'rs1234567',
		start: 7670618,
		stop: 7670619,
		...overrides
	}
}

function getGeneSearchWithPos(overrides: any = {}) {
	return {
		chr: 'chr13',
		ref: 'T',
		alt: 'C',
		fromWhat: 'BRCA2:c.68_69delAA',
		pos: 32889612,
		...overrides
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/snp -***-')
	test.end()
})

tape('selectSnp() should throw when required fields are missing', async test => {
	const handler = new SearchHandler()
	handler.callback = () => {}

	try {
		await handler.selectSnp({ chr: 'chr1', ref: 'A', alt: 'T' })
		test.fail('Should throw when fromWhat is missing')
	} catch (e) {
		test.match(String(e), /missing chr, ref, alt, or fromWhat/, 'Should throw when fromWhat is missing')
	}

	try {
		await handler.selectSnp({ ref: 'A', alt: 'T', fromWhat: 'rs123' })
		test.fail('Should throw when chr is missing')
	} catch (e) {
		test.match(String(e), /missing chr, ref, alt, or fromWhat/, 'Should throw when chr is missing')
	}

	try {
		await handler.selectSnp({ chr: 'chr1', alt: 'T', fromWhat: 'rs123' })
		test.fail('Should throw when ref is missing')
	} catch (e) {
		test.match(String(e), /missing chr, ref, alt, or fromWhat/, 'Should throw when ref is missing')
	}

	try {
		await handler.selectSnp({ chr: 'chr1', ref: 'A', fromWhat: 'rs123' })
		test.fail('Should throw when alt is missing')
	} catch (e) {
		test.match(String(e), /missing chr, ref, alt, or fromWhat/, 'Should throw when alt is missing')
	}

	test.end()
})

tape('selectSnp() should throw when coordinate is missing', async test => {
	const handler = new SearchHandler()
	handler.callback = () => {}

	try {
		await handler.selectSnp({
			chr: 'chr17',
			ref: 'G',
			alt: 'A',
			fromWhat: 'rs1234567'
		})
		test.fail('Should throw when coordinate is missing')
	} catch (e) {
		test.match(String(e), /missing coordinate of snp/, 'Should throw expected message for missing coordinate')
	}

	test.end()
})

tape('selectSnp() should call callback with term object using start/stop coordinates', async test => {
	const handler = new SearchHandler()
	let selected: any

	handler.callback = t => {
		selected = t
	}

	const geneSearch = getGeneSearchWithCoordinates()
	await handler.selectSnp(geneSearch)

	test.equal(selected?.id, 'rs1234567', 'Should set id to fromWhat')
	test.equal(selected?.chr, 'chr17', 'Should pass chr')
	test.equal(selected?.start, 7670618, 'Should pass start coordinate')
	test.equal(selected?.stop, 7670619, 'Should pass stop coordinate')
	test.equal(selected?.ref, 'G', 'Should pass ref')
	test.deepEqual(selected?.alt, ['A'], 'Should convert alt string to array')
	test.equal(selected?.name, 'rs1234567', 'Should set name to fromWhat')
	test.equal(selected?.type, 'snp', 'Should set type to snp')

	test.end()
})

tape('selectSnp() should call callback with term object using pos coordinate', async test => {
	const handler = new SearchHandler()
	let selected: any

	handler.callback = t => {
		selected = t
	}

	const geneSearch = getGeneSearchWithPos()
	await handler.selectSnp(geneSearch)

	test.equal(selected?.id, 'BRCA2:c.68_69delAA', 'Should set id to fromWhat')
	test.equal(selected?.chr, 'chr13', 'Should pass chr')
	test.equal(selected?.start, 32889611, 'Should convert pos-1 to start')
	test.equal(selected?.stop, 32889612, 'Should set stop to pos')
	test.equal(selected?.ref, 'T', 'Should pass ref')
	test.deepEqual(selected?.alt, ['C'], 'Should convert alt string to array')
	test.equal(selected?.name, 'BRCA2:c.68_69delAA', 'Should set name to fromWhat')
	test.equal(selected?.type, 'snp', 'Should set type to snp')

	test.end()
})

tape('selectSnp() should handle alt as array when already in array format', async test => {
	const handler = new SearchHandler()
	let selected: any

	handler.callback = t => {
		selected = t
	}

	const geneSearch = getGeneSearchWithCoordinates({ alt: ['A', 'T'] })
	await handler.selectSnp(geneSearch)

	test.deepEqual(selected?.alt, ['A', 'T'], 'Should preserve alt array when provided as array')

	test.end()
})

tape('selectSnp() should handle various chromosome formats', async test => {
	const handler = new SearchHandler()
	const chromosomes = ['chr1', 'chr22', 'chrX', 'chrY', 'chrM']

	for (const chr of chromosomes) {
		let selected: any
		handler.callback = t => {
			selected = t
		}

		const geneSearch = getGeneSearchWithCoordinates({ chr })
		await handler.selectSnp(geneSearch)

		test.equal(selected?.chr, chr, `Should handle chromosome ${chr}`)
	}

	test.end()
})
