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
GDC - ssm by range
geneSearch4GDCmds3

### ash dataset is based on bcf file with samples
ASH - gene BCR

Mbmeta - gene p53 - Disco button
GDC - gene p53 - Disco button

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

tape('\n', function (test) {
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

tape('GDC - ssm by range', test => {
	test.timeoutAfter(10000)
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		block: 1,
		nobox: 1,
		position: 'chr14:104769348-104795751', // akt1
		tracks: [
			{ type: 'mds3', dslabel: 'GDC', callbackOnRender }
			//{type:'bedj',file:'anno/refGene.hg38.gz',name:'RefGene',__isgene:true}
		]
	})

	function callbackOnRender(tk, bb) {
		test.ok(tk.skewer.rawmlst.length > 0, 'mds3 tk should have loaded many data points')
		// FIXME click sample left label breaks
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

/*
want to apply both disco/cnv plot button test on both mbmeta and gdc
as the data are served from different sources
somehow running both tests will cause it to be stuck at mbmeta
*/
tape('Mbmeta - gene p53 - Disco button', test => {
	testClickDiscForDiscoButtons(test, 'p53', 'MB_meta_analysis')
})
tape('GDC - gene p53 - Disco button', test => {
	testClickDiscForDiscoButtons(test, 'hoxa1', 'GDC')
})

async function testClickDiscForDiscoButtons(test, gene, dslabel) {
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene,
		tracks: [{ type: 'mds3', dslabel, callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		test.ok(tk.skewer.data.length > 0, 'mds3 tk should be showing some skewers')
		// find a singleton skewer, click disc
		const singletonMutationDisc = tk.skewer.g
			.selectAll('.sja_aa_disckick')
			.nodes()
			.find(i => i.__data__.occurrence == 1)
		test.ok(singletonMutationDisc, 'a singleton mutation is found') // if not found can change to different gene
		// click the singleton disc to show itemtip
		singletonMutationDisc.dispatchEvent(new Event('click'))
		await whenVisible(tk.itemtip.d)
		test.pass('itemtip shows with variant table')

		/* surprise
		in mbmeta, as soon as itemtip.d is shown, buttons are already created; calling detectLst() will timeout
		in gdc, there's a delay (api request) for buttons to be shown after itemtip, thus must use detectLst
		*/
		let buttons = tk.itemtip.d.selectAll('button').nodes()
		if (buttons.length == 0) {
			buttons = await detectLst({ elem: tk.itemtip.d.node(), selector: 'button' })
		}
		/* multiplt buttons can be shown, based on data availability
		#1: disco
		#2: methylation cnv
		*/
		test.ok(buttons.length >= 1, '1 or more buttons are showing in itemtip')

		for (const btn of buttons) {
			switch (btn.innerHTML) {
				case 'Disco plot':
					await testDisco(btn, tk)
					break
				case 'MethylationArray':
					await testCnv(btn, tk)
					break
				default:
					throw 'unknown button: ' + btn.innerHTML
			}
		}
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

		// TODO disco now shows in new sandbox

		//await whenVisible(tk.menutip.d) // upon clicking btn, this menu shows to display content
		//test.pass(`clicking 1st button ${name} the menutip shows`)
		//const svg = await detectOne({elem: tk.menutip.d.node(), selector:'svg'})
		//test.ok(svg, '<svg> created in tk.menutip.d as disco plot')
	}
	async function testCnv(btn, tk) {
		const name = 'MethylationArray'
		test.equal(btn.innerHTML, name, '2nd button is called ' + name)
		btn.dispatchEvent(new Event('click'))

		// TODO cnv now shows in new sandbox

		/*
		await whenVisible(tk.menutip.d) // upon clicking btn, this menu shows to display content
		test.pass(`clicking 2nd button ${name} the menutip shows`)
		const img = await detectOne({ elem: tk.menutip.d.node(), selector: 'img' })
		test.ok(img, '<img> found in menutip')
		// TODO click at a particular position on img, detect if block shows up
		*/
	}
}

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

// same tests applied on two datasets, each using a different data source
// somehow calling helper twice in one tape() call will break, thus calling tape twice
tape('GDC - sample summaries table, create subtrack (tk.filterObj)', test => {
	testSampleSummary2subtrack('IDH1', 'GDC', test)
})
tape('ASH - sample summaries table, create subtrack (tk.filterObj)', test => {
	testSampleSummary2subtrack('KRAS', 'ASH', test)
})

// a helper shared by above two tests
async function testSampleSummary2subtrack(gene, dslabel, test) {
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38',
		gene,
		tracks: [{ type: 'mds3', dslabel, callbackOnRender }]
	})

	async function callbackOnRender(tk, bb) {
		// click on "xx samples" left label, to open sample summary panel
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

			const subtk = bb.tklst[2] // mds3 sub-track object created off main one (tk)

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

			// click on "samples" left label of subtk, to open sample summary panel
			subtk.leftlabels.doms.samples.node().dispatchEvent(new Event('click'))
			await whenVisible(subtk.menutip.d)
			// same as in main tk, must await for the summary table to be shown in subtk.menutip
			// that means leftlabels.__samples_data is now created
			await detectOne({ elem: subtk.menutip.d.node(), selector: '.sja_mds3samplesummarydiv' })

			compareSummary(tk, subtk)

			test.ok(subtk.leftlabels.doms.filterObj, '.leftlabels.doms.filterObj is set on subtrack')
			// click on the filterObj left label to show menu with filter UI
			subtk.leftlabels.doms.filterObj.node().dispatchEvent(new Event('click'))
			await whenVisible(subtk.menutip.d)
			test.pass('subtk.menutip is shown (with filter UI), after clicking leftlabels.doms.filterObj')

			test.ok(subtk.leftlabels.doms.close, '.leftlabels.doms.close is set on subtrack')

			if (test._ok) {
				holder.remove()
				subtk.menutip.d.remove() // Close orphaned popup window
			}
			test.end()
		}

		const categoryDiv = tk.menutip.d.select('.sja_clbtext2')
		categoryDiv.node().dispatchEvent(new Event('click'))
	}

	// compare sample summary data between sub and main tk
	function compareSummary(tk, subtk) {
		test.ok(
			subtk.leftlabels.__samples_data.length == tk.leftlabels.__samples_data.length,
			'main and sub track returned summaries for the same number of terms'
		)
		// assuming order of terms in the array are identical between main and sub tk
		// for the same catgory from same term, sub track must show <= samplecount than main

		// since 'sub<=main' must be used in tests but not 'sub<main', verify at least one category shows sub<main
		let subLTmainCount = 0

		for (const [i, main] of tk.leftlabels.__samples_data.entries()) {
			const sub = subtk.leftlabels.__samples_data[i]
			if (main.numbycategory) {
				test.ok(
					main.numbycategory.length >= sub.numbycategory.length,
					'main.numbycategory.length >= sub for ' + main.termname
				)
				const k2c = new Map()
				for (const a of main.numbycategory) {
					// a=[categorylabel, #mutated, #total]
					k2c.set(a[0], { mutated: a[1], total: a[2] })
				}
				for (const a of sub.numbycategory) {
					const a2 = k2c.get(a[0])
					if (!a2) throw 'a2 not found'
					test.ok(
						a[1] <= a2.mutated && a[2] <= a2.total,
						`sub<=main for mutated/total counts of ${a[0]}, ${main.termname}`
					)
					if (a[2] < a2.total) subLTmainCount++
				}
			} else if (main.density_data) {
				if (!Number.isInteger(main.density_data.samplecount)) throw 'main.density_data.samplecount is not integer'
				test.ok(
					sub.density_data.samplecount <= main.density_data.samplecount,
					'sub<=main for density_data.samplecount for ' + main.termname
				)
				if (sub.density_data.samplecount < main.density_data.samplecount) subLTmainCount++
			} else {
			}
		}

		test.ok(subLTmainCount > 0, subLTmainCount + ' categories have reduced sample count in subtk')
	}
}

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
		test.ok(
			tk.skewer.rawmlst.find(m => m.class == 'M'),
			'has class=M before filtering'
		)
		tk.legend.mclass.hiddenvalues.add('M')
		// must delete this to not to trigger the same function on rerendering
		delete tk.callbackOnRender
		bb.onloadalltk_always = () => {
			test.ok(allMcount > tk.skewer.rawmlst.length, 'fewer mutations left after filtering by mclass')
			test.notOk(
				tk.skewer.rawmlst.find(m => m.class == 'M'),
				'no longer has class=M after filtering'
			)
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
		test.ok(
			tk.skewer.rawmlst.find(m => m.class == 'M'),
			'has class=M before filtering'
		)
		tk.legend.mclass.hiddenvalues.add('M')
		// must delete this to not to trigger the same function on rerendering
		delete tk.callbackOnRender
		bb.onloadalltk_always = () => {
			test.ok(allMcount > tk.skewer.rawmlst.length, 'fewer mutations left after filtering by mclass')
			test.notOk(
				tk.skewer.rawmlst.find(m => m.class == 'M'),
				'no longer has class=M after filtering'
			)
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
		test.ok(
			tk.skewer.rawmlst.find(m => m.class == 'M'),
			'has class=M before filtering'
		)
		tk.legend.mclass.hiddenvalues.add('M')
		// must delete this to not to trigger the same function on rerendering
		delete tk.callbackOnRender
		bb.onloadalltk_always = () => {
			test.ok(allMcount > tk.skewer.rawmlst.length, 'fewer mutations left after filtering by mclass')
			test.notOk(
				tk.skewer.rawmlst.find(m => m.class == 'M'),
				'no longer has class=M after filtering'
			)
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
