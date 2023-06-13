const tape = require('tape')
const d3s = require('d3-selection')
const { detectLst, detectOne, detectZero, whenHidden, whenVisible, detectGte } = require('../../test/test.helpers')

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
Mbmeta - gene p53

### clinvar dataset is based on sample-less bcf file
Clinvar - gene kras

Incorrect dataset name: ah instead of ASH

Launch variant table from track variant label

### via gdc api
GDC - sample summaries table, create subtrack (tk.filterObj)

### via bcf and termdb
ASH - sample summaries table, create subtrack (tk.filterObj)

###
GDC - mclass filtering
ASH - mclass filtering
Clinvar - mclass filtering

Collapse and expand mutations from variant link

Launch sample table from sunburst

### custom data
Numeric mode custom dataset, with mode change
***************/
function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}

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

tape('Mbmeta - gene p53', test => {
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene: 'p53',
		tracks: [{ type: 'mds3', dslabel: 'MB_meta_analysis', callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		test.ok(tk.skewer.data.length > 0, 'mds3 tk should be showing some skewers')
		// click disc of first skewer, it should be a single mutation
		tk.skewer.g
			.select('.sja_aa_disckick')
			.nodes()[0]
			.dispatchEvent(new Event('click'))

		await whenVisible(tk.itemtip.d)
		test.pass('itemtip shows with variant table')
		const buttons = tk.itemtip.d.selectAll('button').nodes()
		test.ok(buttons.length == 2, 'two buttons are showing in itemtip')

		await testDisco(buttons[0], tk)
		await testCnv(buttons[1], tk)

		if (test._ok) {
			holder.remove()
			tk.itemtip.d.remove()
			tk.menutip.d.remove()
		}
		test.end()
	}
	async function testDisco(btn, tk) {
		const name = 'Disco plot'
		test.equal(btn.innerHTML, name, '1st button is called ' + name)
		btn.dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d) // upon clicking btn, this menu shows to display content
		test.pass(`clicking 1st button ${name} the menutip shows`)
		//const svg = await detectOne({elem: tk.menutip.d.node(), selector:'svg'})
		//test.ok(svg, '<svg> created in tk.menutip.d as disco plot')
	}
	async function testCnv(btn, tk) {
		const name = 'MethylationArray'
		test.equal(btn.innerHTML, name, '2nd button is called ' + name)
		btn.dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d) // upon clicking btn, this menu shows to display content
		test.pass(`clicking 2nd button ${name} the menutip shows`)
		const img = await detectOne({ elem: tk.menutip.d.node(), selector: 'img' })
		test.ok(img, '<img> found in menutip')
		// TODO click at a particular position on img, detect if block shows up
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

tape('GDC - sample summaries table, create subtrack (tk.filterObj)', test => {
	//If dispatchEvent error in browser, run again before debugging
	test.timeoutAfter(5000)
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene: 'idh1',
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
		bb.onloadalltk_always = async () => {
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
			// click on the filterObj left label to show menu with filter UI
			subtk.leftlabels.doms.filterObj.node().dispatchEvent(new Event('click'))
			await whenVisible(subtk.menutip.d)
			test.pass('subtk.menutip is shown (with filter UI), after clicking leftlabels.doms.filterObj')

			test.ok(subtk.leftlabels.doms.close, '.leftlabels.doms.close is set on subtrack')

			if (test._ok) {
				holder.remove()
				tk.menutip.d.remove() // Close orphaned popup window
			}
			test.end()
		}

		const categoryDiv = tk.menutip.d.select('.sja_clbtext2')
		categoryDiv.node().dispatchEvent(new Event('click'))
	}
})

tape('ASH - sample summaries table, create subtrack (tk.filterObj)', test => {
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
		tracks: [{ type: 'mds3', dslabel: 'ASH', callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		//Click on variant leftlabel to open menu
		const variantsLeftlabel = tk.leftlabels.doms.variants.node()
		variantsLeftlabel.dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d)

		//Click 'Collapse' menu option
		tk.menutip.d
			.selectAll('.sja_menuoption')
			.nodes()
			.find(e => e.innerHTML == 'Collapse')
			.dispatchEvent(new Event('click'))

		// as soon as collapsing animation starts, none of the sja_aa_disclabel should have "scale(1)"
		{
			const expandedText = tk.skewer.selection
				.selectAll('text.sja_aa_disclabel')
				.nodes()
				.some(e => {
					//console.log(e)
					e.attributes.transform.value == 'scale(1)'
				})
			test.notOk(expandedText, 'No expanded skewer found after collapsing')
		}

		//Go back and click on 'Expand' to test skewer expanding
		variantsLeftlabel.dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d)

		tk.menutip.d
			.selectAll('.sja_menuoption')
			.nodes()
			.find(e => e.innerHTML == 'Expand')
			.dispatchEvent(new Event('click'))

		// as soon as expanding animation starts, some sja_aa_disclabel should have opacity!=0
		{
			const expandedText = tk.skewer.g
				.selectAll('.sja_aa_disclabel')
				.nodes()
				.some(e => e.attributes['fill-opacity'].value != '0')
			test.ok(expandedText, 'Should find some expanded skewers')
		}

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Launch sample table from sunburst', test => {
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		gene: 'kras',
		tracks: [{ type: 'mds3', dslabel: 'GDC', callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		// Click on track variant link to open menu
		const discFound = tk.skewer.g
			.selectAll('circle.sja_aa_disckick')
			.nodes()
			.find(e => e.__data__.occurrence >= 310)
		test.ok(discFound, 'Found a mutation with occurrence >= 310, click on it to show sunburst')
		discFound.dispatchEvent(new Event('click'))

		const clickInfo = await detectOne({ elem: tk.skewer.g.node(), selector: 'rect.sja_info_click' })
		test.ok(clickInfo, 'Info button from sunburst is found')
		clickInfo.dispatchEvent(new Event('click'))

		// Confirm sample table launched
		await whenVisible(tk.itemtip.d)
		test.pass('tk.itemtip displayed showing the sample table after clicking "Info" from sunburst')

		// this test doesn't work
		//const divFound = await detectOne({elem:tk.itemtip.d.node(), selector:':scope>div'}) // use :scope> to select immediate children
		//test.ok(divFound,'Found <div> as variant/sample table in tooltip')

		if (test._ok) {
			holder.remove()
			tk.itemtip.d.remove()
		}
		test.end()
	}
})

tape('Numeric mode custom dataset, with mode change', test => {
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
		noheader: true,
		genome: 'hg19',
		gene: 'NM_002467',
		tracks: [
			{
				type: 'mds3',
				skewerModes,
				name: 'AA sites with numbers',
				custom_variants,
				callbackOnRender
			}
		]
	})

	// TODO all data points should be rendered in svg

	function callbackOnRender(tk, bb) {
		// verify that all custom data points are present in tk
		for (const m of custom_variants) {
			const m2 = tk.skewer.rawmlst.find(i => i.mname == m.mname)
			test.ok(m2, `custom variant "${m.mname}" exists in tk`)
		}

		// tricky: tk.skewer.viewModes[] is the same array as skewerModes[] (by pointer)
		// thus no need to test that all elements in skewerModes are present in tk.skewer.viewModes
		// also a new element has been auto added to the array
		// [0] pvalue, [1] other number, [2] skewer (not numeric)

		// get the numericmode axis label
		const n = tk.g.select('.sjpp-mds3-nm-axislabel')
		test.equal(
			tk.skewer.viewModes.find(i => i.inuse).label,
			n.text(),
			`numericmode axis label "${n.text()}" matches with view mode obj`
		)

		// switch to a new numeric mode
		// quick fix: assume the 2nd mode is not in use yet
		tk.skewer.viewModes[0].inuse = false
		tk.skewer.viewModes[1].inuse = true

		tk.callbackOnRender = viewModeChange
		tk.load()
	}

	function viewModeChange(tk, bb) {
		const n = tk.g.select('.sjpp-mds3-nm-axislabel')
		test.equal(
			tk.skewer.viewModes.find(i => i.inuse).label,
			n.text(),
			`numericmode axis label "${n.text()}" matches with view mode obj after switching mode`
		)
		if (test._ok) holder.remove()
		test.end()
	}
})
