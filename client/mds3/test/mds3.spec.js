const tape = require('tape')
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
	test.pass('-***- mds3 -***-')
	test.end()
})

/*
run test with a runpp callback, which eliminates need of sleep()
for that to work, the tape() callback function must not be "async"
*/

tape('Run GDC dataset, gene symbol: KRAS', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		gene: 'kras',
		tracks: [{ type: 'mds3', dslabel: 'GDC' }],
		onloadalltk_always: checkTrack
	})
	function checkTrack(bb) {
		// bb is the block instance

		test.equal(bb.tklst.length, 2, 'should have two tracks')

		//Confirm track type
		const mtk = bb.tklst.find(i => i.type == 'mds3')
		test.ok(mtk, 'type=mds3 track should be found')

		//Confirm correct dataset
		test.ok(mtk.dslabel == 'GDC', 'Should render GDC dataset')

		//Confirm gene symbol used to call track
		test.ok(bb.usegm.name == 'KRAS', 'Should render KRAS track in GDC dataset')

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Run GDC dataset, ensembl transcript: ENST00000407796', test => {
	test.timeoutAfter(8000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		gene: 'ENST00000407796',
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC'
			}
		],
		onloadalltk_always: checkTrack
	})

	function checkTrack() {
		//Confirm track type
		const mds3Track = bb.tklst.find(i => i.type == 'mds3')
		test.ok(mds3Track, 'type=mds3 track should be found')

		//Confirm correct dataset
		test.ok(mds3Track.dslabel == 'GDC', 'Should render GDC dataset')

		//Confirm gene symbol used to call track
		test.ok(bb.usegm.isoform == 'ENST00000407796', 'Should render ENST00000407796 track in GDC dataset')

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Run GDC dataset, ensembl gene: ENSG00000133703', test => {
	// kras, should map to canonical isoform ENST00000256078
	test.timeoutAfter(8000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		gene: 'ENSG00000133703',
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC'
			}
		],
		onloadalltk_always: checkTrack
	})

	function checkTrack() {
		//Confirm track type
		const mds3Track = bb.tklst.find(i => i.type == 'mds3')
		test.ok(mds3Track, 'type=mds3 track should be found')

		//Confirm correct dataset
		test.ok(mds3Track.dslabel == 'GDC', 'Should render GDC dataset')

		//Confirm gene symbol used to call track
		test.ok(bb.usegm.isoform == 'ENST00000256078', 'Should render ENST00000256078 track in GDC dataset')

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Run GDC dataset, RefSeq ID: NM_005163', test => {
	test.timeoutAfter(8000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		gene: 'NM_005163',
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC'
			}
		],
		onloadalltk_always: checkGeneTrack
	})

	function checkGeneTrack() {
		//Confirm track type
		const mds3Track = bb.tklst.find(i => i.type == 'mds3')
		test.ok(mds3Track, 'type=mds3 track should be found')

		//Confirm correct dataset
		test.ok(mds3Track.dslabel == 'GDC', 'Should render GDC dataset')

		//Confirm gene symbol used to call track
		test.ok(bb.usegm.isoform == 'NM_005163', 'Should render NM_005163 track in GDC dataset')

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Launch GDC dataset by SSM ID, KRAS', test => {
	test.timeoutAfter(10000)
	const holder = getHolder()

	const ssm_id = '4fb37566-16d1-5697-9732-27c359828bc7' // kras G12V

	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		mds3_ssm2canonicalisoform: {
			dslabel: 'GDC',
			ssm_id
		},
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC'
			}
		],
		onloadalltk_always: checkTrack
	})

	function checkTrack(bb) {
		//Confirm ssm_id passed to block
		const mds3Track = bb.tklst.find(i => i.type == 'mds3')
		test.ok(mds3Track.skewer.hlssmid.has(ssm_id), `Should render mds3 KRAS track from ssm_id: ${ssm_id}`)

		//TODO check G12V mutation is focused
		// test.ok(mds3Track, 'Should render mds3 KRAS track with focused G12V mutation')

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Render gene track from search box, KRAS', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	const gene = 'KRAS'

	await runproteinpaint({
		holder,
		noheader: 1,
		geneSearch4GDCmds3: true
	})

	await sleep(1000)

	//Enter KRAS into search box
	const searchBox = d3s.select('input')._groups[0][0]
	searchBox.value = gene
	searchBox.dispatchEvent(new Event('keyup'))

	//Click on first menu option -> 'KRAS'
	await sleep(1000)
	const geneFoundInMenu = d3.select('div.sja_menuoption')._groups[0][0]
	geneFoundInMenu.dispatchEvent(new Event('click'))

	//Verify track renders
	await sleep(3000)
	const geneTrackFound = d3
		.selectAll('span.sja_clbtext')
		.nodes()
		.some(elem => elem.innerText.includes(gene))
	test.true(geneTrackFound, `Should render default ${gene} track`)

	if (test._ok) holder.remove()
	test.end()
})

tape('Launch ASH dataset, BCR', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg38',
		gene: 'BCR',
		tracks: [{ type: 'mds3', dslabel: 'ASH' }],
		onloadalltk_always: checkTrack
	})

	function checkTrack(bb) {
		//Test if BCR track renders from mds3 track, in ASH dataset
		const mds3Track = bb.tklst.find(i => i.type == 'mds3')
		test.ok(mds3Track.dslabel == 'ASH', 'Should render ASH dataset')

		test.ok(bb.usegm.name == 'BCR', 'Should render BCR track')

		//TODO test G12V mutation focus

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Incorrect dataset name: ah instead of ASH', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg38',
		gene: 'BCR',
		tracks: [
			{
				type: 'mds3',
				dslabel: 'ah',
				callbackOnRender: (tk, bb) => {
					// Confirm mds3 track sent to block instance but not rendering
					const mds3Track = bb.tklst.find(i => i.type == 'mds3')
					test.ok(mds3Track.uninitialized == true, 'Should not render mds3 track and not throw')

					//Confirm error message appears
					const errorDivFound = d3s
						.selectAll('text')
						.nodes()
						.find(i => i.textContent == 'Error: invalid dsname')
					test.ok(errorDivFound, 'Should display invalid dsname error')

					if (test._ok) holder.remove()
					test.end()
				}
			}
		]
	})
})

tape('Custom dataset with custom variants, NO samples', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const custom_variants = [
		{ chr: 'chr8', pos: 128750685, mname: 'P75', class: 'M', dt: 1 },
		{ chr: 'chr8', pos: 128750680, mname: 'T73', class: 'M', dt: 1 },
		{ chr: 'chr8', pos: 128750685, mname: 'WTPinsP75', class: 'I', dt: 1 }
	]

	runproteinpaint({
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
				custom_variants
			}
		],
		onloadalltk_always: checkTrack
	})

	function checkTrack(bb) {
		//Confirm number of custom variants matches in block instance
		const mds3Track = bb.tklst.find(i => i.type == 'mds3')
		test.equal(
			mds3Track.custom_variants.length,
			custom_variants.length,
			`Should render total # of custom variants = ${custom_variants.length}`
		)

		for (const variant of custom_variants) {
			//Test all custom variant entries successfully passed to block instance
			const variantFound = mds3Track.custom_variants.find(i => i.mname == variant.mname)
			test.ok(variantFound, `Should render data point for ${variant.mname}`)
		}

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Custom dataset with custom variants, WITH samples', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const custom_variants = [
		{ chr: 'chr8', pos: 128750685, mname: 'P75', class: 'M', dt: 1, sample: 'sample 1' },
		{ chr: 'chr8', pos: 128750680, mname: 'T73', class: 'M', dt: 1, sample: 'sample 2' },
		{ chr: 'chr8', pos: 128750685, mname: 'WTPinsP75', class: 'I', dt: 1, sample: 'sample 3' },
		{ chr: 'chr8', pos: 128750685, mname: 'WTPinsP75', class: 'I', dt: 1, sample: 'sample 4' }
	]

	runproteinpaint({
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
				custom_variants
			}
		],
		onloadalltk_always: checkTrack
	})

	function checkTrack(bb) {
		const mds3Track = bb.tklst.find(i => i.type == 'mds3')

		const variantNum = new Set()
		for (const variant of custom_variants) {
			//Test all custom variant entries successfully passed to block instance
			const variantFound = mds3Track.custom_variants.find(i => i.mname == variant.mname)
			test.ok(variantFound, `Should render data point at ${variant.chr}-${variant.pos} for ${variant.mname}`)

			variantNum.add(variant.mname)

			//Test number of samples passed to block
			if (variant.samples) {
				test.equal(
					variantFound.samples.length,
					variant.samples.length,
					`Should render # of sample(s) = ${variant.samples.length} for variant = ${variant.mname}`
				)
			}
		}
		//Confirm number of custom variants matches in block instance
		test.equal(
			mds3Track.custom_variants.length,
			variantNum.size,
			`Should render total # of custom variants = ${variantNum.size}`
		)

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Launch variant table from track variant label', test => {
	//If dispatchEvent error in browser, run again before debugging
	test.timeoutAfter(10000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		gene: 'kras',
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC',
				callbackOnRender: (tk, bb) => {
					const mtk = bb.tklst.find(i => i.type == 'mds3')
					//Click on track variant link to open menu
					const variantsControl = d3s
						.selectAll('text.sja_clbtext2')
						.nodes()
						.find(e => e.innerHTML == mtk.leftlabels.doms.variants.nodes()[0].innerHTML)
					variantsControl.dispatchEvent(new Event('click'))

					//Click 'List' menu option
					const listMenuOptionFound = d3s
						.selectAll('div.sja_menuoption')
						.nodes()
						.find(e => e.innerHTML == 'List')
					test.ok(listMenuOptionFound, 'Should open menu from clicking on variant link beneath track label')
					listMenuOptionFound.dispatchEvent(new Event('click'))

					//Click on the first variant bar in the list
					const E3KvariantFound = d3s
						.selectAll('div.sja_menuoption')
						.nodes()
						.find(e => e.innerText == 'E3KMISSENSEchr12:25245378, C>T')
					test.ok(E3KvariantFound, 'Should display variant list')
					E3KvariantFound.dispatchEvent(new Event('click'))

					//Confirm variant annotation table appears
					const variantTableFound = d3s
						.selectAll('div.sja_menuoption > span')
						.nodes()
						.find(e => e.innerText == 'E3K')
					test.ok(variantTableFound, 'Should display variant annotation table')

					//Close orphaned popup window
					const findMenu = d3s
						.selectAll('div.sja_menu_div')
						.nodes()
						.find(e => e.style.display == 'block')
					findMenu.remove()

					if (test._ok) holder.remove()
					test.end()
				}
			}
		]
	})
})

tape('Launch cases from track cases label', test => {
	//If dispatchEvent error in browser, run again before debugging
	test.timeoutAfter(5000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		gene: 'kras',
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC',
				callbackOnRender: async (tk, bb) => {
					const mtk = bb.tklst.find(i => i.type == 'mds3')
					//Click on track cases link to open table
					const casesControl = d3s
						.selectAll('text.sja_clbtext2')
						.nodes()
						.find(e => e.innerHTML == mtk.leftlabels.doms.samples.nodes()[0].innerHTML)
					casesControl.dispatchEvent(new Event('click'))

					await sleep(1000) //Still required. Callback executes to quickly for dom
					// elements to render

					// Confirm table opened
					const diseaseTypeFound = d3s
						.selectAll('div')
						.nodes()
						.find(e => e.innerText.includes('Disease type'))
					test.ok(diseaseTypeFound, "Should display cases table with 'Disease type' as the first tab")

					//Close orphaned popup window
					const findMenu = d3s
						.selectAll('div.sja_menu_div')
						.nodes()
						.find(e => e.style.display == 'block')
					findMenu.remove()

					if (test._ok) holder.remove()
					test.end()
				}
			}
		]
	})
})

tape('Collapse and expand mutations from variant link', test => {
	test.timeoutAfter(10000) //Fix for succeeding tape tests running before this one finishes
	//Will throw a not ok error if another test fires
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		gene: 'kras',
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC',
				callbackOnRender: async (tk, bb) => {
					const mtk = bb.tklst.find(i => i.type == 'mds3')
					//Click on track variant link to open menu
					const variantsControl = d3s
						.selectAll('text.sja_clbtext2')
						.nodes()
						.find(e => e.innerHTML == mtk.leftlabels.doms.variants.nodes()[0].innerHTML)
					variantsControl.dispatchEvent(new Event('click'))

					//Click 'Collapse' menu option
					const collaspseOptionFound = d3s
						.selectAll('div.sja_menuoption')
						.nodes()
						.find(e => e.innerHTML == 'Collapse')
					collaspseOptionFound.dispatchEvent(new Event('click'))

					//Ensure only collapsed data points appear
					const onlyCollapsedCircles = d3s
						.selectAll('text.sja_aa_disclabel')
						.nodes()
						.some(e => e.attributes.transform.value == 'scale(1)')
					test.ok(!onlyCollapsedCircles, 'Should collaspe data points')

					//Go back and click on 'Expand' to test the circle expanding
					variantsControl.dispatchEvent(new Event('click'))
					const expandOptionFound = d3s
						.selectAll('div.sja_menuoption')
						.nodes()
						.find(e => e.innerHTML == 'Expand')
					expandOptionFound.dispatchEvent(new Event('click'))

					await sleep(2000) //Still required. The animation takes too long to
					// find dom elements

					//Confirm expanded mutations
					const expandedCircleFound = d3s
						.selectAll('text.sja_aa_disclabel')
						.nodes()
						.some(e => e.attributes.transform.value == 'scale(1,1)')
					test.ok(expandedCircleFound, 'Should expand mutation points')

					if (test._ok) holder.remove()
					test.end()
				}
			}
		]
	})
})

tape('Launch sample table from sunburst plot', test => {
	//If dispatchEvent error in browser, run again before debugging
	test.timeoutAfter(8000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		gene: 'kras',
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC',
				callbackOnRender: async (tk, bb) => {
					//Click on track variant link to open menu
					const discFound = d3s
						.selectAll('circle.sja_aa_disckick')
						.nodes()
						.find(e => e.__data__.occurrence >= '310')
					test.ok(discFound, 'Should display sunburst for G12D')
					discFound.dispatchEvent(new Event('click'))

					await sleep(2000) //Still required. Sunburst takes too long to render for the rest
					// of the test to proceed

					//Click 'Info' in the center
					const clickInfo = d3s.selectAll('rect.sja_info_click').node()
					clickInfo.dispatchEvent(new Event('click'))

					//Confirm sample table launched
					const multiSampleTableFound = d3s.selectAll('div.sjpp-sample-table-div').nodes()
					test.ok(multiSampleTableFound, 'Should display sample table')

					await sleep(500) //Still required. Callback executes to quickly for dom
					// elements to render

					const multiSampleTable = d3s
						.selectAll('div.sja_menu_div')
						.nodes()
						.find(e => e.style.display == 'block')

					if (test._ok) multiSampleTable.remove()
					if (test._ok) holder.remove()
					test.end()
				}
			}
		]
	})
})

/*
********* LEAVE THIS TEST LAST *********
mclassOverride persists between tests! All missense mutations will appear as 'AA'. 
Proteinin likewise will appear as 'BB'. 

TODO: Find out why mclassOverride persists between runproteinpaint calls.
****************************************
*/
tape('Numeric mode custom dataset', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const skewerModes = [
		{ type: 'numeric', byAttribute: 'lpv', label: '-log10(p-value)', inuse: true, axisheight: 100 },
		{ type: 'numeric', byAttribute: 'value2', label: 'other numbers', axisheight: 200 }
	]

	const custom_variants = [
		{ chr: 'chr8', pos: 128750685, mname: 'P75', class: 'M', dt: 1, lpv: 1, value2: 4 },
		{ chr: 'chr8', pos: 128750680, mname: 'T73', class: 'M', dt: 1, lpv: 2, value2: 5 },
		{ chr: 'chr8', pos: 128750685, mname: 'WTPinsP75', class: 'I', dt: 1, lpv: 3, value2: 6 },
		{ chr: 'chr8', pos: 128750754, mname: 'data point', class: 'I', dt: 1 }
	]

	runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg19',
		gene: 'NM_002467',
		tracks: [
			{
				type: 'mds3',
				skewerModes,
				name: 'AA sites with numbers',
				custom_variants
			}
		],
		mclassOverride: {
			className: 'Phospho',
			classes: {
				M: { label: 'AA', desc: 'AA desc' },
				I: { label: 'BB', desc: 'BB desc' }
			}
		},
		onloadalltk_always: checkTrack
	})

	function checkTrack(bb) {
		const mds3Track = bb.tklst.find(i => i.type == 'mds3')

		for (const skewer of skewerModes) {
			//Test numeric skewers successfully passed to block instance
			if (skewer.type == 'numeric') {
				const skewerFound = mds3Track.skewer.viewModes.find(i => i.byAttribute == skewer.byAttribute)
				test.ok(skewerFound, `Should provide numeric option for ${skewer.label}`)
			}
		}

		// for (const variant of custom_variants) {
		//TODO test skewer value passed for each variant
		// }

		if (test._ok) holder.remove()
		test.end()
	}
})
