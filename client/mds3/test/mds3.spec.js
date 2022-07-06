const tape = require('tape')
const helpers = require('../../test/front.helpers.js')
const d3s = require('d3-selection')
const host = window.location.origin

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- mds3/gdc -***-')
	test.end()
})

tape('Run GDC dataset via gene symbol, ensembl ID and RefSeq ID', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()

	const genes = [
		{ gene: 'KRAS', isoform: '' },
		{ gene: 'AKT1', isoform: 'ENST00000407796' },
		{ gene: 'AKT1', isoform: 'NM_005163' }
	]
	for (const g of genes) {
		await runproteinpaint({
			holder,
			noheader: true,
			nobox: true,
			genome: 'hg38',
			gene: g.isoform || g.gene,
			tracks: [
				{
					type: 'mds3',
					dslabel: 'GDC'
				}
			]
		})

		await sleep(2300)
		const geneFound = [...holder.querySelectorAll('span')].some(elem =>
			elem.innerText == g.isoform ? `${g.gene} ${g.isoform}` : `${g.gene}`
		)
		test.true(geneFound, `Should render ${g.isoform || g.gene} track`)
	}

	test.end()
})

tape('Launch GDC dataset by SSM ID', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()

	await runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		mds3_ssm2canonicalisoform: {
			dslabel: 'GDC',
			ssm_id: '4fb37566-16d1-5697-9732-27c359828bc7' // kras G12V
		},
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC'
			}
		]
	})
	await sleep(2300)
	const ssmFound = [...holder.querySelectorAll('.sja_aa_disclabel')].some(elem => elem.innerHTML == 'G12V')
	test.true(ssmFound, `Should render KRAS track with focused G12V mutation`)

	test.end()
})

tape('Render gene track from search box', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()

	await runproteinpaint({
		holder,
		noheader: 1,
		geneSearch4GDCmds3: true
	})

	await sleep(2300)

	//Enter KRAS into search box
	const searchBox = d3s.select('input')._groups[0][0]
	searchBox.value = 'KRAS'
	searchBox.dispatchEvent(new Event('keyup'))

	//Click on first menu option -> 'KRAS'
	await sleep(2300)
	// const geneFoundInMenu = d3.select('div.sja_menuoption')._groups[0][0]
	const geneFoundInMenu = [...document.querySelectorAll('div.sja_menuoption')].find(elem => elem.innerText == 'KRAS')
	geneFoundInMenu.dispatchEvent(new Event('click'))

	//Verify track renders
	await sleep(2300)
	const geneTrackFound = [...holder.querySelectorAll('span.sja_clbtext')].some(
		elem => elem.innerText == 'KRAS ENST00000256078'
	)
	test.true(geneTrackFound, `Should render default KRAS ENST00000256078 track`)

	test.end()
})

tape('Launch ASH dataset', async test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	await runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg38',
		gene: 'BCR',
		tracks: [
			{
				type: 'mds3',
				dslabel: 'ASH'
			}
		]
	})
	await sleep(2300)
	const customVariantFound = [...holder.querySelectorAll('span.sja_clbtext')].some(
		elem => elem.innerText == 'BCR NM_004327'
	)
	test.true(customVariantFound, `Should render default BCR track in ASH dataset`)

	test.end()
})

tape('Custom dataset with custom variants, NO samples', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()

	await runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg19',
		gene: 'NM_002467',
		tracks: [
			{
				type: 'mds3',
				name: 'Test, without occurrence',
				custom_variants: [
					{ chr: 'chr8', pos: 128750685, mname: 'P75', class: 'M', dt: 1 },
					{ chr: 'chr8', pos: 128750680, mname: 'T73', class: 'M', dt: 1 },
					{ chr: 'chr8', pos: 128750685, mname: 'WTPinsP75', class: 'I', dt: 1 }
				]
			}
		]
	})
	await sleep(2300)
	//TODO, maybe?: Check for all mnames
	const customVariantFound = [...holder.querySelectorAll('.sja_aa_disclabel')].some(
		elem => elem.innerHTML == 'WTPinsP75'
	)
	test.true(customVariantFound, `Should render custom dataset with ad hoc WTPinsP75 variant`)

	test.end()
})

tape('Custom dataset with custom variants, WITH samples', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()

	await runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg19',
		gene: 'NM_002467',
		tracks: [
			{
				type: 'mds3',
				name: 'Test, with sample name',
				custom_variants: [
					{ chr: 'chr8', pos: 128750685, mname: 'P75', class: 'M', dt: 1, sample: 'sample 1' },
					{ chr: 'chr8', pos: 128750680, mname: 'T73', class: 'M', dt: 1, sample: 'sample 2' },
					{ chr: 'chr8', pos: 128750685, mname: 'WTPinsP75', class: 'I', dt: 1, sample: 'sample 3' },
					{ chr: 'chr8', pos: 128750685, mname: 'WTPinsP75', class: 'I', dt: 1, sample: 'sample 4' }
				]
			}
		]
	})
	await sleep(2300)
	//TODO, maybe?: Check for all mnames
	const customVariantFound = [...holder.querySelectorAll('.sja_aa_discnum')].some(elem => elem.innerHTML == '2')
	test.true(customVariantFound, `Should render custom dataset with 2 samples for WTPinsP75 variant`)

	test.end()
})

tape('Numeric mode custom dataset', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()

	await runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg19',
		gene: 'NM_002467',
		tracks: [
			{
				type: 'mds3',
				skewerModes: [
					{ type: 'numeric', byAttribute: 'lpv', label: '-log10(p-value)', inuse: true, axisheight: 100 },
					{ type: 'numeric', byAttribute: 'value2', label: 'other numbers', axisheight: 200 }
				],
				name: 'AA sites with numbers',
				custom_variants: [
					{ chr: 'chr8', pos: 128750685, mname: 'P75', class: 'M', dt: 1, lpv: 1, value2: 4 },
					{ chr: 'chr8', pos: 128750680, mname: 'T73', class: 'M', dt: 1, lpv: 2, value2: 5 },
					{ chr: 'chr8', pos: 128750685, mname: 'WTPinsP75', class: 'I', dt: 1, lpv: 3, value2: 6 },
					{ chr: 'chr8', pos: 128750754, mname: 'data point', class: 'I', dt: 1 }
				]
			}
		],
		mclassOverride: {
			className: 'Phospho',
			classes: {
				M: { label: 'AA', desc: 'AA desc' },
				I: { label: 'BB', desc: 'BB desc' }
			}
		}
	})
	await sleep(2300)
	const customVariantFound = [...holder.querySelectorAll('text')].some(elem => elem.innerHTML == '-log10(p-value)')
	test.true(customVariantFound, `Should render custom dataset in numeric mode with -log10(p-value) scale`)

	test.end()
})
