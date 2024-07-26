import tape from 'tape'
import * as d3s from 'd3-selection'
import { AppHeader } from '../AppHeader'
import { Menu } from '../../../dom/menu.js'
import { hg38, hg19 } from '../../../test/testdata/genomes'
import { detectOne, detectGte } from '../../../test/test.helpers'

/**************
 helper functions
***************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

function getHeader(opts) {
	const genomes = { hg19, hg38 }
	const _opts = {
		headtip: new Menu({ padding: '0px' }),
		app: {
			cardsPath: 'cards',
			genomes,
			holder: opts.holder
		},
		data: {
			cardsPath: 'cards',
			codedate: 'Fri Jul 12 2024',
			genomes
		},
		jwt: {}
	}

	return new AppHeader(Object.assign(_opts, opts))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- src/header/AppHeader -***-')
	test.end()
})

tape('Validate app header rendering, makeheader()', async test => {
	test.timeoutAfter(3000)
	const holder = getHolder()
	const header = getHeader({ holder })
	header.makeheader()

	const findSearchBox = await detectOne({
		selector: '.sjpp-input-search',
		target: holder.node()
	})
	test.ok(findSearchBox, 'Should render search box')
	test.equal(
		findSearchBox.placeholder,
		'Gene, position, SNP, app, or dataset',
		'Should render search box with unique placeholder'
	)

	const findDropDown = await detectOne({
		selector: '.sjpp-genome-select',
		target: holder.node()
	})

	test.ok(findDropDown, 'Should render genome dropdown')
	const genomes = Object.keys(header.app.genomes)
	for (const n of findDropDown.options) {
		test.ok(
			genomes.some(g => g == n.value),
			`Should render options for "${n.value}" in genome dropdown.`
		)
	}

	const genomeBtn = await detectOne({
		selector: '#genome_btn',
		target: holder.node()
	})
	test.ok(genomeBtn, 'Should render genome browser button')

	const appsBtn = await detectOne({
		selector: '.sjpp-apps-btn-wrapper > .sja_menuoption',
		target: holder.node()
	})
	test.ok(appsBtn, 'Should render Apps button')

	const helpBtn = await detectOne({
		selector: '#sjpp-header-help-btn',
		target: holder.node()
	})
	test.ok(helpBtn, 'Should render Help button')

	const pubsBtn = await detectOne({
		selector: '#sjpp-header-publications-btn',
		target: holder.node()
	})
	test.ok(pubsBtn, 'Should render Publications button')

	const codeMessage = holder.select('#sjpp-serverstat > span').node()
	test.ok(
		codeMessage && codeMessage['textContent'].includes(header.data.codedate),
		'Should render server status message with the codedate'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Change genome selection', async test => {
	test.timeoutAfter(3000)
	const holder = getHolder()
	const header = getHeader({ holder })
	header.makeheader()

	const newGenome = 'hg38'

	const findDropDown = await detectOne({
		selector: '.sjpp-genome-select',
		target: holder.node()
	})
	findDropDown.value = newGenome
	test.equal(header.app.selectgenome.node().value, newGenome, `Should change genome selection to ${newGenome}`)

	header.update_genome_browser_btn(header.app)
	//Wait for change to take effect
	const genomeBtn = await detectOne({
		selector: '#genome_btn',
		target: holder.node()
	})
	test.ok(
		genomeBtn['textContent'] == `${newGenome} genome browser`,
		`Should update genome in button text to ${newGenome}`
	)

	genomeBtn.click()

	const genomeBrowser = await detectGte({
		selector: '.sjpp-output-sandbox-header > div',
		target: holder.node()
	})
	const sandboxHeaderText = genomeBrowser.some(g => g.textContent == `${newGenome} genome browser`)
	test.ok(sandboxHeaderText, `Should render genome browser for ${newGenome}`)

	test.end()
})
