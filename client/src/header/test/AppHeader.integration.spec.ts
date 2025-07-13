import tape from 'tape'
import * as d3s from 'd3-selection'
import { AppHeader } from '../AppHeader'
import { Menu } from '../../../dom/menu.js'
import { hg38, hg19 } from '../../../test/testdata/genomes'
import { detectOne } from '../../../test/test.helpers'

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
			// cardsPath: 'cards',
			pkgver: '1.0.0',
			codedate: 'Wed Oct 09 2024',
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
	test.comment('-***- src/header/AppHeader -***-')
	test.end()
})

tape('Validate app header rendering, makeheader()', async test => {
	test.timeoutAfter(3000)
	const holder = getHolder()
	const header = getHeader({ holder })
	header.makeheader()

	const omniSearch = await detectOne({
		selector: '.sjpp-input-search',
		target: holder.node()
	})
	test.ok(omniSearch, 'Should render search box')
	test.equal(
		omniSearch.placeholder,
		'Gene, position, SNP, app, or dataset',
		'Should render search box with unique placeholder'
	)

	const genomeDropDown = await detectOne({
		selector: '.sjpp-genome-select',
		target: holder.node()
	})

	test.ok(genomeDropDown, 'Should render genome dropdown')
	for (const n of genomeDropDown.options) {
		test.ok(hg38.name == n.value || hg19.name == n.value, `Should render options for "${n.value}" in genome dropdown.`)
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

	//Not able to access citations.json on CI.
	// const pubsBtn = await detectOne({
	// 	selector: '#sjpp-header-publications-btn',
	// 	target: holder.node()
	// })
	// test.ok(pubsBtn, 'Should render Publications button')

	const codeMessage = holder.select('#sjpp-serverstat > span').node()
	test.ok(
		codeMessage?.['textContent']?.includes(header.data.pkgver),
		'Should render server status message with the package version'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Change genome selection', async test => {
	test.timeoutAfter(5000)
	const holder = getHolder()
	const header = getHeader({ holder })
	header.makeheader()

	const newGenome = 'hg38-test'

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
	test.equal(
		genomeBtn['textContent'],
		`${newGenome} genome browser`,
		`Should update genome in button text to ${newGenome}`
	)

	/** Test works locally but click event fails on CI. */
	//Wait till genome browser is rendered
	// const genomeBrowser = await detectOne({
	// 	selector: '#sandbox-header-text',
	// 	target: holder.node(),
	// 	trigger() {
	// 		// Doesn't work
	//		genomeBtn.click()
	// 		// Also doesn't work
	// 		genomeBtn.dispatchEvent(new Event('click'))
	// 	}
	// })

	// test.equal(
	// 	genomeBrowser['textContent'],
	// 	`${newGenome} genome browser`,
	// 	`Should render genome browser sandbox for ${newGenome}`
	// )

	if (test['_ok']) holder.remove()
	test.end()
})
