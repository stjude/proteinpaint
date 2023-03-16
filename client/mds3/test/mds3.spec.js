const tape = require('tape')
const d3s = require('d3-selection')
const {
	sleep,
	detectLst,
	detectOne,
	detectZero,
	whenHidden,
	whenVisible,
	detectGte
} = require('../../test/test.helpers')

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

/**************
 test sections

### gdc dataset is based on GDC API
GDC - gene symbol KRAS
GDC - GENCODE transcript ENST00000407796
GDC - GENCODE gene ENSG00000133703
GDC - RefSeq NM_005163
GDC - KRAS SSM ID
geneSearch4GDCmds3

### ash dataset is based on bcf file with samples
ASH - gene BCR

### clinvar dataset is based on sample-less bcf file
Clinvar - gene kras

Incorrect dataset name: ah instead of ASH

Launch variant table from track variant label

### via gdc api
GDC - sample summaries table, create subtrack

### via bcf and termdb
ASH - sample summaries table, create subtrack

###
GDC - mclass filtering
ASH - mclass filtering
Clinvar - mclass filtering

Collapse and expand mutations from variant link
Launch sample table from sunburst plot

### custom data
Numeric mode custom dataset
Custom dataset with custom variants, NO samples
Custom variants, missing or wrong mclass
Custom dataset with custom variants, WITH samples
Custom data with samples and sample selection
***************/

tape('\n', function(test) {
	test.pass('-***- mds3 -***-')
	test.end()
})

/*
run test with a runpp callback, which eliminates need of sleep()
for that to work, the tape() callback function must not be "async"
*/

tape('GDC - gene symbol KRAS', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		genome: 'hg38',
		gene: 'kras',
		tracks: [{ type: 'mds3', dslabel: 'GDC', callbackOnRender }]
	})
	function callbackOnRender(tk, bb) {
		// tk is gdc mds3 track object; bb is block object
		test.equal(bb.usegm.name, 'KRAS', 'block.usegm.name="KRAS"')
		test.equal(bb.tklst.length, 2, 'should have two tracks')
		test.ok(tk.skewer.rawmlst.length > 0, 'mds3 tk should have loaded many data points')
		// in this first test, verify all ui parts are rendered
		test.ok(tk.leftlabels.doms.variants, 'tk.leftlabels.doms.variants is set')
		test.ok(tk.leftlabels.doms.samples, 'tk.leftlabels.doms.samples is set')
		test.notOk(tk.leftlabels.doms.filterObj, 'tk.leftlabels.doms.filterObj is not set')
		test.notOk(tk.leftlabels.doms.close, 'tk.leftlabels.doms.close is not set')
		test.ok(tk.legend.mclass, 'tk.legend.mclass{} is set')
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('GDC - GENCODE transcript ENST00000407796', test => {
	test.timeoutAfter(8000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene: 'ENST00000407796',
		tracks: [{ type: 'mds3', dslabel: 'GDC', callbackOnRender }]
	})
	function callbackOnRender(tk, bb) {
		test.equal(bb.usegm.isoform, 'ENST00000407796', 'block.usegm.isoform="ENST00000407796"')
		test.equal(bb.tklst.length, 2, 'should have two tracks')
		test.ok(tk.skewer.rawmlst.length > 0, 'mds3 tk should have loaded many data points')
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('GDC - GENCODE gene ENSG00000133703', test => {
	// this GENCODE gene is kras
	// due to change of genedb in which ENSG are treated as aliases, they now map to refseq instead
	// can change back when this behavior is restored
	test.timeoutAfter(8000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene: 'ENSG00000133703',
		tracks: [{ type: 'mds3', dslabel: 'GDC', callbackOnRender }]
	})
	function callbackOnRender(tk, bb) {
		test.equal(bb.usegm.name, 'KRAS', 'ENSG00000133703 is mapped to block.usegm.name="KRAS"')
		test.ok(tk.skewer.rawmlst.length > 0, 'mds3 tk should have loaded many data points')
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('GDC - RefSeq NM_005163', test => {
	test.timeoutAfter(8000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene: 'NM_005163',
		tracks: [{ type: 'mds3', dslabel: 'GDC', callbackOnRender }]
	})
	function callbackOnRender(tk, block) {
		test.equal(bb.usegm.isoform, 'NM_005163', 'block.usegm.isoform="NM_005163"')
		test.ok(tk.skewer.rawmlst.length > 0, 'mds3 tk should have loaded many data points')
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('GDC - KRAS SSM ID', test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	const ssm_id = '4fb37566-16d1-5697-9732-27c359828bc7' // kras G12V
	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		mds3_ssm2canonicalisoform: { dslabel: 'GDC', ssm_id },
		tracks: [{ type: 'mds3', dslabel: 'GDC', callbackOnRender }]
	})

	function callbackOnRender(tk, bb) {
		test.equal(bb.usegm.name, 'KRAS', 'ssm is converted to block.usegm.name="KRAS"')
		test.ok(tk.skewer.rawmlst.length > 0, 'mds3 tk should have loaded many data points')
		test.ok(tk.skewer.hlssmid.has(ssm_id), 'highlighted ssm id is in tk.skewer.hlssmid{}')
		const hlbox = tk.skewer.g.select('.sja_mds3_skewer_ssmhlbox')?._groups?.[0]?.[0]?.tagName
		test.equal(hlbox, 'rect', '<rect> is rendered for ssm highlight box')
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('geneSearch4GDCmds3', async test => {
	// enter a gene name into search box, find the gene match in tooltip, select matched gene to launch block with gdc track
	const holder = getHolder()
	const gene = 'HOXA1'
	await runproteinpaint({
		holder,
		noheader: 1,
		geneSearch4GDCmds3: { postRender }
	})
	async function postRender(arg) {
		// arg={tip}; convenient method to provide the tooltip used by gene search <input> (remove some hassle of finding this tooltip)_
		const searchBox = await detectOne({ elem: holder, selector: '.sja_genesearchinput' })
		test.ok(searchBox, 'Gene search box is made')

		const blockHolder = await detectOne({ elem: holder, selector: '.sja_geneSearch4GDCmds3_blockdiv' })
		test.ok(blockHolder, 'Block holder is made')

		// enter gene name and trigger search
		searchBox.value = gene
		searchBox.dispatchEvent(new Event('keyup'))

		await whenVisible(arg.tip.d.node())
		const geneHitDivs = await detectGte({ elem: arg.tip.d.node(), selector: '.sja_menuoption', count: 1 })
		test.equal(geneHitDivs[0].innerHTML, gene, 'Gene search found ' + gene)
		geneHitDivs[0].dispatchEvent(new Event('click'))

		const blockDiv = await detectOne({ elem: blockHolder, selector: '.sja_Block_div' })
		test.ok(blockDiv, 'A block is rendered')
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('ASH - gene BCR', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene: 'BCR',
		tracks: [{ type: 'mds3', dslabel: 'ASH', callbackOnRender }]
	})
	function callbackOnRender(tk, bb) {
		test.equal(bb.usegm.name, 'BCR', 'block.usegm.name="BCR"')
		test.equal(bb.tklst.length, 2, 'should have two tracks')
		test.ok(tk.skewer.rawmlst.length > 0, 'mds3 tk should have loaded many data points')
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Clinvar - gene kras', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene: 'kras',
		tracks: [{ type: 'mds3', dslabel: 'clinvar', callbackOnRender }]
	})
	function callbackOnRender(tk, bb) {
		test.equal(bb.tklst.length, 2, 'should have two tracks')
		test.ok(tk.skewer.rawmlst.length > 0, 'mds3 tk should have loaded many data points')
		test.ok(tk.leftlabels.doms.variants, 'tk.leftlabels.doms.variants is set')
		test.notOk(tk.leftlabels.doms.samples, 'tk.leftlabels.doms.samples is absent')
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Incorrect dataset name: ah instead of ASH', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene: 'BCR',
		tracks: [{ type: 'mds3', dslabel: 'ah', callbackOnRender }]
	})
	function callbackOnRender(tk, bb) {
		// Confirm mds3 track sent to block instance but not rendering
		test.ok(tk.uninitialized == true, 'Should not render mds3 track and not throw')
		// Confirm error message appears
		const errorDivFound = tk.gmiddle
			.selectAll('text')
			.nodes()
			.find(i => i.textContent == 'Error: invalid dsname')
		test.ok(errorDivFound, 'Should display invalid dsname error')
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Launch variant table from track variant label', test => {
	test.timeoutAfter(10000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene: 'kras',
		tracks: [{ type: 'mds3', dslabel: 'GDC', callbackOnRender }]
	})
	function callbackOnRender(tk, bb) {
		//Click on track variant link to open menu
		tk.leftlabels.doms.variants.node().dispatchEvent(new Event('click'))

		//Click 'List' menu option
		const listMenuOptionFound = tk.menutip.d
			.selectAll('.sja_menuoption')
			.nodes()
			.find(e => e.innerHTML == 'List')
		test.ok(listMenuOptionFound, 'Should open menu from clicking on variant link beneath track label')
		listMenuOptionFound.dispatchEvent(new Event('click'))

		//Click on the first variant bar in the list
		const E3KvariantFound = tk.menutip.d
			.selectAll('div.sja_menuoption')
			.nodes()
			.find(e => e.innerText == 'E3KMISSENSEchr12:25245378, C>T')
		E3KvariantFound.dispatchEvent(new Event('click'))

		//Confirm variant annotation table appears
		const variantTableFound = tk.menutip.d
			.selectAll('span')
			.nodes()
			.find(e => e.innerText == 'E3K')
		test.ok(variantTableFound, 'Should display variant annotation table')

		//Close orphaned popup window
		tk.menutip.d.remove()

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('GDC - sample summaries table, create subtrack', test => {
	//If dispatchEvent error in browser, run again before debugging
	test.timeoutAfter(5000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene: 'kras',
		tracks: [{ type: 'mds3', dslabel: 'GDC', callbackOnRender }]
	})

	async function callbackOnRender(tk, bb) {
		//Click on track cases link to open table
		tk.leftlabels.doms.samples.node().dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d)

		const div = await detectOne({ elem: tk.menutip.d.node(), selector: '.sja_mds3samplesummarydiv' })
		test.ok(div, 'Sample summary table rendered in menutip')

		for (const tw of tk.mds.variant2samples.twLst) {
			// each tw should show up in div as a tab
			const twDiv = tk.menutip.d
				.selectAll('div')
				.nodes()
				.find(e => e.innerText.startsWith(tw.term.name))
			// the found div is <div>TW.name <span></span></div>, thus must use startsWith
			test.ok(twDiv, 'Should display tab for ' + tw.term.name)
		}

		// find one of the clickable label for a category
		// attach this callback on bb (block instance) to be triggered when the subtrack is loaded
		bb.onloadalltk_always = () => {
			test.equal(
				bb.tklst.length,
				3,
				'now bb has 3 tracks after clicking a category from mds3 tk sample summaries table'
			)
			const subtk = bb.tklst[2]
			test.equal(subtk.type, 'mds3', '3rd track type is mds3 (subtrack launched from main track)')

			test.ok(
				Number(tk.leftlabels.doms.variants.text().split(' ')[0]) >
					Number(subtk.leftlabels.doms.variants.text().split(' ')[0]),
				'subtrack has fewer number of mutations than main track'
			)
			test.ok(
				Number(tk.leftlabels.doms.samples.text().split(' ')[0]) >
					Number(subtk.leftlabels.doms.samples.text().split(' ')[0]),
				'subtrack has fewer number of samples than main track'
			)

			test.ok(subtk.leftlabels.doms.filterObj, '.leftlabels.doms.filterObj is set on subtrack')
			// TODO trigger click on filterObj and detect filter ui

			test.ok(subtk.leftlabels.doms.close, '.leftlabels.doms.close is set on subtrack')

			// Close orphaned popup window
			tk.menutip.d.remove()
			if (test._ok) holder.remove()
			test.end()
		}

		const categoryDiv = tk.menutip.d.select('.sja_clbtext2')
		categoryDiv.node().dispatchEvent(new Event('click'))
	}
})

tape('ASH - sample summaries table, create subtrack', test => {
	//If dispatchEvent error in browser, run again before debugging
	test.timeoutAfter(5000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene: 'kras',
		tracks: [{ type: 'mds3', dslabel: 'ash', callbackOnRender }]
	})

	async function callbackOnRender(tk, bb) {
		//Click on track cases link to open table
		tk.leftlabels.doms.samples.node().dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d)

		const div = await detectOne({ elem: tk.menutip.d.node(), selector: '.sja_mds3samplesummarydiv' })
		test.ok(div, 'Sample summary table rendered in menutip')

		for (const tw of tk.mds.variant2samples.twLst) {
			// each tw should show up in div as a tab
			const twDiv = tk.menutip.d
				.selectAll('div')
				.nodes()
				.find(e => e.innerText.startsWith(tw.term.name))
			// the found div is <div>TW.name <span></span></div>, thus must use startsWith
			test.ok(twDiv, 'Should display tab for ' + tw.term.name)
		}

		// find one of the clickable label for a category
		// attach this callback on bb (block instance) to be triggered when the subtrack is loaded
		bb.onloadalltk_always = () => {
			test.equal(
				bb.tklst.length,
				3,
				'now bb has 3 tracks after clicking a category from mds3 tk sample summaries table'
			)
			const subtk = bb.tklst[2]
			test.equal(subtk.type, 'mds3', '3rd track type is mds3 (subtrack launched from main track)')

			test.ok(
				Number(tk.leftlabels.doms.variants.text().split(' ')[0]) >
					Number(subtk.leftlabels.doms.variants.text().split(' ')[0]),
				'subtrack has fewer number of mutations than main track'
			)
			test.ok(
				Number(tk.leftlabels.doms.samples.text().split(' ')[0]) >
					Number(subtk.leftlabels.doms.samples.text().split(' ')[0]),
				'subtrack has fewer number of samples than main track'
			)

			test.ok(subtk.leftlabels.doms.filterObj, '.leftlabels.doms.filterObj is set on subtrack')
			test.ok(subtk.leftlabels.doms.close, '.leftlabels.doms.close is set on subtrack')

			// Close orphaned popup window
			tk.menutip.d.remove()
			if (test._ok) holder.remove()
			test.end()
		}

		const categoryDiv = tk.menutip.d.select('.sja_clbtext2')
		categoryDiv.node().dispatchEvent(new Event('click'))
	}
})

tape('GDC - mclass filtering', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		genome: 'hg38',
		gene: 'kras',
		tracks: [{ type: 'mds3', dslabel: 'GDC', callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		const allMcount = tk.skewer.rawmlst.length
		test.ok(tk.skewer.rawmlst.find(m => m.class == 'M'), 'has class=M before filtering')
		tk.legend.mclass.hiddenvalues.add('M')
		// must delete this to not to trigger the same function on rerendering
		delete tk.callbackOnRender
		bb.onloadalltk_always = () => {
			test.ok(allMcount > tk.skewer.rawmlst.length, 'fewer mutations left after filtering by mclass')
			test.notOk(tk.skewer.rawmlst.find(m => m.class == 'M'), 'no longer has class=M after filtering')
			if (test._ok) holder.remove()
			test.end()
		}
		await tk.load()
	}
})
tape('ASH - mclass filtering', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		genome: 'hg38',
		gene: 'kras',
		tracks: [{ type: 'mds3', dslabel: 'ash', callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		const allMcount = tk.skewer.rawmlst.length
		test.ok(tk.skewer.rawmlst.find(m => m.class == 'M'), 'has class=M before filtering')
		tk.legend.mclass.hiddenvalues.add('M')
		// must delete this to not to trigger the same function on rerendering
		delete tk.callbackOnRender
		bb.onloadalltk_always = () => {
			test.ok(allMcount > tk.skewer.rawmlst.length, 'fewer mutations left after filtering by mclass')
			test.notOk(tk.skewer.rawmlst.find(m => m.class == 'M'), 'no longer has class=M after filtering')
			if (test._ok) holder.remove()
			test.end()
		}
		await tk.load()
	}
})
tape('Clinvar - mclass filtering', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		genome: 'hg38',
		gene: 'kras',
		tracks: [{ type: 'mds3', dslabel: 'clinvar', callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		const allMcount = tk.skewer.rawmlst.length
		test.ok(tk.skewer.rawmlst.find(m => m.class == 'M'), 'has class=M before filtering')
		tk.legend.mclass.hiddenvalues.add('M')
		// must delete this to not to trigger the same function on rerendering
		delete tk.callbackOnRender
		bb.onloadalltk_always = () => {
			test.ok(allMcount > tk.skewer.rawmlst.length, 'fewer mutations left after filtering by mclass')
			test.notOk(tk.skewer.rawmlst.find(m => m.class == 'M'), 'no longer has class=M after filtering')
			if (test._ok) holder.remove()
			test.end()
		}
		await tk.load()
	}
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
				dslabel: 'ASH',
				callbackOnRender: async (tk, bb) => {
					const mtk = bb.tklst.find(i => i.type == 'mds3')

					//Click on track variant link to open menu
					const variantsControl = tk.leftlabels.doms.variants.node()
					variantsControl.dispatchEvent(new Event('click'))

					//Click 'Collapse' menu option
					const collaspseOptionFound = tk.menutip.d
						.selectAll('.sja_menuoption')
						.nodes()
						.find(e => e.innerHTML == 'Collapse')
					collaspseOptionFound.dispatchEvent(new Event('click'))

					//Ensure only collapsed data points appear
					const onlyCollapsedCircles = tk.skewer.selection
						.selectAll('text.sja_aa_disclabel')
						.nodes()
						.some(e => e.attributes.transform.value == 'scale(1)')
					test.ok(!onlyCollapsedCircles, 'Should collaspe data points')

					//Go back and click on 'Expand' to test the circle expanding
					variantsControl.dispatchEvent(new Event('click'))
					const expandOptionFound = tk.menutip.d
						.selectAll('.sja_menuoption')
						.nodes()
						.find(e => e.innerHTML == 'Expand')
					expandOptionFound.dispatchEvent(new Event('click'))

					await sleep(1000) //Still required. The animation takes too long to find dom elements

					//Confirm expanded mutations
					const expandedCircleFound = mtk.skewer.g
						.selectAll('.sja_aa_disclabel')
						.nodes()
						.some(e => e.attributes['fill-opacity'].value == '1')
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
					// Click on track variant link to open menu
					const discFound = tk.skewer.g
						.selectAll('circle.sja_aa_disckick')
						.nodes()
						.find(e => e.__data__.occurrence >= '310')
					test.ok(discFound, 'Should display sunburst for G12D')
					discFound.dispatchEvent(new Event('click'))

					//Still required. Sunburst takes too long to render for the rest of the test to proceed
					await sleep(2000)

					// Click 'Info' in the center
					const clickInfo = tk.g.selectAll('rect.sja_info_click').node()
					clickInfo.dispatchEvent(new Event('click'))

					// Confirm sample table launched
					await sleep(500)
					const multiSampleTableFound = tk.itemtip.d.node()
					test.ok(multiSampleTableFound != null && multiSampleTableFound != undefined, 'Should display sample table')

					await sleep(500)
					if (test._ok) multiSampleTableFound.remove()
					if (test._ok) holder.remove()
					test.end()
				}
			}
		]
	})
})

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
		noheader: true,
		genome: 'hg19',
		gene: 'NM_002467',
		tracks: [
			{
				type: 'mds3',
				name: 'Test, without occurrence',
				custom_variants,
				callbackOnRender
			}
		]
	})
	function callbackOnRender(tk, bb) {
		//Confirm number of custom variants matches in block instance
		test.equal(
			tk.custom_variants.length,
			custom_variants.length,
			`Should render total # of custom variants = ${custom_variants.length}`
		)

		for (const variant of custom_variants) {
			//Test all custom variant entries successfully passed to block instance
			const variantFound = tk.custom_variants.find(i => i.mname == variant.mname)
			test.ok(variantFound, `Should render data point for ${variant.mname}`)
		}

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Custom variants, missing or wrong mclass', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const custom_variants = [
		{ chr: 'chr8', pos: 128750685, mname: 'P75', dt: 1 }, // missing class
		{ chr: 'chr8', pos: 128750680, mname: 'T73', class: 'xxyy', dt: 1 } // wrong mclass
	]

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg19',
		gene: 'NM_002467',
		tracks: [
			{
				type: 'mds3',
				name: 'Test, without occurrence',
				custom_variants,
				callbackOnRender
			}
		]
	})
	function callbackOnRender(tk, bb) {
		//Confirm number of custom variants matches in block instance
		test.equal(
			tk.custom_variants.length,
			custom_variants.length,
			`Should render total # of custom variants = ${custom_variants.length}`
		)
		for (const variant of custom_variants) {
			const variantFound = tk.custom_variants.find(i => i.mname == variant.mname)
			test.ok(variantFound, `Should render data point for ${variant.mname}`)
			test.equal(variantFound.class, 'X', 'class="X" is assigned for missing or wrong class')
		}

		//if (test._ok) holder.remove()
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

tape('Custom data with samples and sample selection', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const custom_variants = [
		{ chr: 'chr17', pos: 7670699, mname: 'R337H', class: 'M', dt: 1, ref: 'G', alt: 'C', sample: 's1' },
		{
			gene1: 'AKT1',
			chr1: 'chr14',
			pos1: 104776000,
			strand1: '-',
			gene2: 'TP53',
			chr2: 'chr17',
			pos2: 7670500,
			strand2: '-',
			dt: 2,
			class: 'Fuserna',
			sample: 's2'
		},

		{
			gene1: 'TP53',
			chr2: 'chr17',
			pos2: 7674000,
			strand2: '-',
			gene2: 'AKT1',
			chr1: 'chr14',
			pos1: 104792000,
			strand1: '-',
			dt: 5,
			class: 'SV',
			sample: 's3'
		}
	]
	const sampleAnnotation = {
		terms: [{ id: 'diagnosis', type: 'categorical' }],
		annotations: {
			s1: {
				diagnosis: 'AA'
			},
			s2: {
				diagnosis: 'BB'
			},
			s3: {
				diagnosis: 'AA'
			}
		}
	}
	runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg38', // ready for hg38-test
		gene: 'NM_000546', // tp53
		tracks: [
			{
				type: 'mds3',
				name: 'Custom data',
				custom_variants,
				sampleAnnotation,
				allow2selectSamples: {
					// trigger sample selection
					buttonText: 'RandomText', // hardcoded text should show in selection button
					callback: () => {}
				}
			}
		],
		onloadalltk_always: checkTrack
	})
	async function checkTrack(bb) {
		const tk = bb.tklst.find(i => i.type == 'mds3')
		test.equal(tk.skewer.selection._groups[0].length, 3, 'Should render 3 skewers')

		{
			const lab = tk.leftlabels.doms.variants
			test.ok(lab, '"Variants" leftlabel should be displayed')
			test.equal(lab.node().innerHTML, '3 variants', 'Variant leftlabel should print "3 variants"')
		}
		{
			const lab = tk.leftlabels.doms.samples
			test.ok(lab, '"Samples" leftlabel should be displayed')
			test.equal(lab.node().innerHTML, '3 samples', 'Sample leftlabel should print "3 samples"')

			// click "samples" leftlabel
			lab.node().dispatchEvent(new Event('click'))
			await sleep(100) // sleep to allow menu to render

			// menu of leftlabel; first option should be "List 3 samples"
			const option = tk.menutip.d.select('.sja_menuoption').nodes()[0]
			test.equal(option.innerHTML, 'List 3 samples', 'First menu option should be named "List 3 samples"')
			option.dispatchEvent(new Event('click'))
			await sleep(100) // sleep to allow menu to render

			// table.js should render a <button> with given text
			const selectSampleButton = tk.menutip.d.select('button').nodes()[0]
			test.ok(selectSampleButton, 'Sample table should contain a <button>')
			test.equal(selectSampleButton.innerHTML, 'RandomText', 'The sample select <button> should have the given name')
		}

		// how to trigger a click on
		if (test._ok) holder.remove()
		test.end()
	}
})
