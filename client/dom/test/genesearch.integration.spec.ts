import tape from 'tape'
import { hg38 } from '../../test/testdata/genomes'
import * as d3s from 'd3-selection'
import { addGeneSearchbox, string2variant, debounceDelay } from '../genesearch.ts'
import { Menu } from '../menu'
import { sleep, detectOne, detectGte, detectLst } from '../../test/test.helpers.js'

/* Tests
    SKIPPED string2variant() - HGVS deletion and delins variants
	search by p53 should find TP53
	searchOnly=gene
	searchOnly=gene with "p53" returns {geneSymbol:"TP53"}
	searchOnly=genes with "p53" returns {geneSymbol:"TP53"}
	searchOnly=genes with "kras tp53" returns {genes:[...]} with both KRAS and TP53
	searchOnly=null, "p53" returns {geneSymbol,chr,start,stop}
	searchOnly=null, "chr:start-stop" returns coordinate object
	allowVariant=true with "chr2.208248388.C.T" returns variant object
*/

/**************
 helper functions
***************/

function getHolder() {
	return d3s.select('body').append('div').style('padding', '5px').style('margin', '5px')
}

function getRow(holder) {
	return holder.append('div').style('border', '1px solid #aaa').style('padding', '5px')
}

async function getSearchBox(holder, opts = {}) {
	const _opts = {
		genome: hg38,
		tip: new Menu({ padding: '' }),
		row: getRow(holder)
	}

	const args = Object.assign(_opts, opts)
	return addGeneSearchbox(args)
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/genesearch.integration -***-')
	test.end()
})

/*** Tests cannot be run on CI because the fasta file is not available ***
Run manually as needed. */
tape.skip('string2variant() - HGVS deletion and delins variants', async test => {
	test.timeoutAfter(300)

	let variant, expected

	//HGVS variant -> deletion
	variant = await string2variant('chr17:g.7673802delCGCACCTCAAAGCTGTTC', hg38)
	expected = {
		isVariant: true,
		chr: 'chr17',
		pos: 7673802,
		ref: 'CGCACCTCAAAGCTGTTC',
		alt: '-'
	}
	test.deepEqual(variant, expected, 'Should parse HGVS string into a Deletion variant object')

	variant = await string2variant('chr2:g.119955155_119955159del', hg38)
	expected = {
		isVariant: true,
		chr: 'chr2',
		ref: 'AGCTG', //on CI this shows as undefined because the fasta file is not available
		alt: '-'
	}
	test.deepEqual(
		variant,
		expected,
		'Should return correct deletion variant object when start and stop positions are present but not a reference allele.'
	)

	variant = await string2variant('chr17:g.abcdelCGCACCTCAAAGCTGTTC', hg38)
	expected = undefined
	test.equal(variant, expected, 'Should return undefined for invalid position for deletion format')

	variant = await string2variant('chr2:g.abc_119955159del', hg38)
	//expected = undefined
	test.equal(
		variant,
		expected,
		'Should return undefined for invalid start position for deletion with no reference allele'
	)

	variant = await string2variant('chr2:g.119955155_abcdel', hg38)
	//expected = undefined
	test.equal(
		variant,
		expected,
		'Should return undefined for invalid stop position for deletion with no reference allele'
	)

	//HGVS variant -> deletion/insertion
	variant = await string2variant('chr2:g.119955155_119955159delinsTTTTT', hg38)
	expected = {
		isVariant: true,
		chr: 'chr2',
		pos: 119955155,
		ref: 'AGCTG', //on CI this shows as undefined because the fasta file is not available
		alt: 'TTTTT'
	}
	test.deepEqual(variant, expected, 'Should parse HGVS string into a Delins variant object')

	variant = await string2variant('chr2:g._delinsTTTTT', hg38)
	expected = undefined
	test.equal(variant, expected, 'Should return undefined for invalid delins format')

	variant = await string2variant('chr2:g.abc_119955159delinsTTTTT', hg38)
	expected = undefined
	test.equal(variant, expected, 'Should return undefined for invalid position for delins format')

	test.end()
})

tape('search by p53 should find TP53', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	const tip = new Menu({ padding: '' })
	await getSearchBox(holder, { tip })
	const searchInput = holder.select('input').node() as HTMLInputElement

	/** Leave this
	 * Options populate slightly slower than tgit he menu
	 * Need to wait for options to appear before testing
	 */
	const gene = 'p53'
	const result = await detectOne({
		selector: '.sja_menuoption',
		target: tip.dnode,
		trigger() {
			searchInput.value = gene
			searchInput.dispatchEvent(new KeyboardEvent('keyup'))
		}
	})
	test.equal(result.textContent, 'TP53', 'found TP53') // p53=TP53 is fact and is not subject to change with test data unlike termdb data

	if (test['_ok']) {
		if (tip.dnode) tip.dnode.remove()
		holder.remove()
	}
	test.end()
})

tape('searchOnly=gene', async test => {
	test.timeoutAfter(2000)
	const holder = getHolder()
	const tip = new Menu({ padding: '' })
	getSearchBox(holder, { tip, searchOnly: 'gene' })
	const searchInput: HTMLInputElement = await detectOne({
		elem: holder.node(),
		selector: 'input'
	})

	// The line below is for typescript to stop complaining
	if (!searchInput) test.fail('No gene search box created')
	test.ok(searchInput.tagName == 'INPUT', 'Should create an input element')
	test.equal(searchInput.placeholder, 'Gene', 'Should display the default placeholder text')

	searchInput.value = 'KRAS'

	const matchingResults = await detectGte({
		elem: tip.d.node(),
		selector: '.sja_menuoption',
		count: 1,
		trigger: () => {
			// simulate the last character typed for KRAS
			searchInput.dispatchEvent(
				new KeyboardEvent('keyup', {
					code: 's',
					key: 'KeyS',
					charCode: 0,
					keyCode: 83,
					view: window,
					bubbles: true
				})
			)
		}
	})

	test.equal(matchingResults.length, 1, `should display 1 matching results`)

	// simulate an immediate Enter keypress
	await detectLst({
		elem: tip.d.node(),
		selector: '.sja_menuoption',
		count: 0,
		trigger: () => {
			searchInput.dispatchEvent(
				new KeyboardEvent('keyup', {
					code: 'Enter',
					key: 'Enter',
					charCode: 13,
					keyCode: 13,
					view: window,
					bubbles: true
				})
			)
		}
	})

	// slight wait for the color style to be applied in DOM, not dependent on data request
	await sleep(20)
	test.equal(
		(searchInput.nextSibling as HTMLElement).style.color,
		'green',
		`should have green checkmark after an immediate Enter`
	)

	searchInput.value = 'KRAS'

	const matchingResults2 = await detectGte({
		elem: tip.d.node(),
		selector: '.sja_menuoption',
		count: 1,
		trigger: () => {
			// simulate the last character typed for KRAS
			searchInput.dispatchEvent(
				new KeyboardEvent('keyup', {
					code: 's',
					key: 'KeyS',
					charCode: 0,
					keyCode: 83,
					view: window,
					bubbles: true
				})
			)
		}
	})

	test.equal(matchingResults2.length, 1, `should display 1 matching matchingResult`)

	// simulate a delayed Enter keypress, longer than debounceDelay
	await sleep(debounceDelay + 10)
	await detectLst({
		elem: tip.d.node(),
		selector: '.sja_menuoption',
		count: 0,
		trigger: () => {
			// simulate the last character typed for KRAS
			// simulate a fast enter
			searchInput.dispatchEvent(
				new KeyboardEvent('keyup', {
					code: 'Enter',
					key: 'Enter',
					charCode: 13,
					keyCode: 13,
					view: window,
					bubbles: true
				})
			)
		}
	})

	// slight wait for the color style to be applied in DOM, not dependent on data request
	await sleep(20)
	test.equal(
		(searchInput.nextSibling as HTMLElement).style.color,
		'green',
		`should have green checkmark after a delayed Enter`
	)

	if (test['_ok']) {
		if (tip.dnode) tip.dnode.remove()
		holder.remove()
	}
	test.end()
})

tape('searchOnly=gene with "p53" returns {geneSymbol:"TP53"}', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	const tip = new Menu({ padding: '' })
	const result = await getSearchBox(holder, { tip, searchOnly: 'gene' })
	const searchInput = holder.select('input').node() as HTMLInputElement

	// Search for p53
	const gene = 'p53'
	await detectOne({
		selector: '.sja_menuoption',
		target: tip.dnode,
		trigger() {
			searchInput.value = gene
			searchInput.dispatchEvent(new KeyboardEvent('keyup'))
		}
	})

	// Press Enter to select
	await detectLst({
		elem: tip.d.node(),
		selector: '.sja_menuoption',
		count: 0,
		trigger: () => {
			searchInput.dispatchEvent(
				new KeyboardEvent('keyup', {
					code: 'Enter',
					key: 'Enter',
					charCode: 13,
					keyCode: 13,
					view: window,
					bubbles: true
				})
			)
		}
	})

	// Wait for result to be populated
	await sleep(50)

	test.equal(result.geneSymbol, 'TP53', 'result should contain geneSymbol: TP53')
	test.notOk(result.chr, 'result should not contain chr for searchOnly=gene')
	test.notOk(result.start, 'result should not contain start for searchOnly=gene')

	if (test['_ok']) {
		if (tip.dnode) tip.dnode.remove()
		holder.remove()
	}
	test.end()
})

tape('searchOnly=genes with "p53" returns {geneSymbol:"TP53"}', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	const tip = new Menu({ padding: '' })
	const result = await getSearchBox(holder, { tip, searchOnly: 'genes' })
	const searchInput = holder.select('input').node() as HTMLInputElement

	// Search for p53
	const gene = 'p53'
	await detectOne({
		selector: '.sja_menuoption',
		target: tip.dnode,
		trigger() {
			searchInput.value = gene
			searchInput.dispatchEvent(new KeyboardEvent('keyup'))
		}
	})

	// Press Enter to select
	await detectLst({
		elem: tip.d.node(),
		selector: '.sja_menuoption',
		count: 0,
		trigger: () => {
			searchInput.dispatchEvent(
				new KeyboardEvent('keyup', {
					code: 'Enter',
					key: 'Enter',
					charCode: 13,
					keyCode: 13,
					view: window,
					bubbles: true
				})
			)
		}
	})

	// Wait for result to be populated
	await sleep(50)

	test.equal(result.geneSymbol, 'TP53', 'result should contain geneSymbol: TP53')
	test.notOk(result.chr, 'result should not contain chr for single gene with searchOnly=genes')

	if (test['_ok']) {
		if (tip.dnode) tip.dnode.remove()
		holder.remove()
	}
	test.end()
})

tape('searchOnly=genes with "kras tp53" returns {genes:[...]} with both KRAS and TP53', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	const tip = new Menu({ padding: '' })
	const result = await getSearchBox(holder, { tip, searchOnly: 'genes' })
	const searchInput = holder.select('input').node() as HTMLInputElement

	// Search for multiple genes
	searchInput.value = 'kras tp53'
	searchInput.dispatchEvent(new KeyboardEvent('keyup'))

	// Wait a bit for debounce
	await sleep(debounceDelay + 50)

	// Press Enter
	searchInput.dispatchEvent(
		new KeyboardEvent('keyup', {
			code: 'Enter',
			key: 'Enter',
			charCode: 13,
			keyCode: 13,
			view: window,
			bubbles: true
		})
	)

	// Wait for result to be populated
	await sleep(100)

	test.ok(result.genes, 'result should contain genes array')
	test.equal(result.genes?.length, 2, 'result should contain 2 genes')

	const geneSymbols = result.genes?.map(g => g.geneSymbol).sort()
	test.deepEqual(geneSymbols, ['KRAS', 'TP53'], 'result should contain both KRAS and TP53')

	if (test['_ok']) {
		if (tip.dnode) tip.dnode.remove()
		holder.remove()
	}
	test.end()
})

tape('searchOnly=null, "p53" returns {geneSymbol,chr,start,stop}', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	const tip = new Menu({ padding: '' })
	const result = await getSearchBox(holder, { tip })
	const searchInput = holder.select('input').node() as HTMLInputElement

	// Search for p53
	const gene = 'p53'
	await detectOne({
		selector: '.sja_menuoption',
		target: tip.dnode,
		trigger() {
			searchInput.value = gene
			searchInput.dispatchEvent(new KeyboardEvent('keyup'))
		}
	})

	// Press Enter to select
	await detectLst({
		elem: tip.d.node(),
		selector: '.sja_menuoption',
		count: 0,
		trigger: () => {
			searchInput.dispatchEvent(
				new KeyboardEvent('keyup', {
					code: 'Enter',
					key: 'Enter',
					charCode: 13,
					keyCode: 13,
					view: window,
					bubbles: true
				})
			)
		}
	})

	// Wait for result to be populated
	await sleep(100)

	test.equal(result.chr, 'chr17', 'result should contain chr17')
	test.equal(result.start, 7661778, 'result should contain correct start position')
	test.equal(result.stop, 7687537, 'result should contain correct stop position')
	test.equal(result.geneSymbol, 'TP53', 'result should contain geneSymbol: TP53')
	test.equal(result.fromWhat, 'TP53', 'result should contain fromWhat: TP53')

	if (test['_ok']) {
		if (tip.dnode) tip.dnode.remove()
		holder.remove()
	}
	test.end()
})

tape('searchOnly=null, "chr:start-stop" returns coordinate object', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	const tip = new Menu({ padding: '' })
	const result = await getSearchBox(holder, { tip })
	const searchInput = holder.select('input').node() as HTMLInputElement

	searchInput.value = 'chr17:7661000-7662000'
	searchInput.dispatchEvent(new KeyboardEvent('keyup'))

	// Wait for debounce
	await sleep(debounceDelay + 50)

	// Press Enter
	searchInput.dispatchEvent(
		new KeyboardEvent('keyup', {
			code: 'Enter',
			key: 'Enter',
			charCode: 13,
			keyCode: 13,
			view: window,
			bubbles: true
		})
	)

	// Wait for result to be populated
	await sleep(50)

	test.equal(result.chr, 'chr17', 'result should contain chr17')
	test.equal(result.start, 7661000, 'result should contain start: 7661000')
	test.equal(result.stop, 7662000, 'result should contain stop: 7662000')
	test.equal(result.fromWhat, 'Valid coordinate', 'result should contain fromWhat: Valid coordinate')

	if (test['_ok']) {
		if (tip.dnode) tip.dnode.remove()
		holder.remove()
	}
	test.end()
})

tape('allowVariant=true with "chr2.208248388.C.T" returns variant object', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	const tip = new Menu({ padding: '' })
	const result = await getSearchBox(holder, { tip, allowVariant: true })
	const searchInput = holder.select('input').node() as HTMLInputElement

	// Enter variant
	searchInput.value = 'chr2.208248388.C.T'
	searchInput.dispatchEvent(new KeyboardEvent('keyup'))

	// Wait for debounce
	await sleep(debounceDelay + 50)

	// Press Enter
	searchInput.dispatchEvent(
		new KeyboardEvent('keyup', {
			code: 'Enter',
			key: 'Enter',
			charCode: 13,
			keyCode: 13,
			view: window,
			bubbles: true
		})
	)

	// Wait for result to be populated
	await sleep(50)

	test.equal(result.chr, 'chr2', 'result should contain chr2')
	test.equal(result.pos, 208248388, 'result should contain pos: 208248388')
	test.equal(result.ref, 'C', 'result should contain ref: C')
	test.equal(result.alt, 'T', 'result should contain alt: T')
	test.equal(result.fromWhat, 'chr2.208248388.C.T', 'result should contain fromWhat with variant string')

	if (test['_ok']) {
		if (tip.dnode) tip.dnode.remove()
		holder.remove()
	}
	test.end()
})
