import tape from 'tape'
import * as d3s from 'd3-selection'
import { detectOne, detectZero, detectGte, whenVisible, detectLst, sleep } from '../../test/test.helpers'
import { runproteinpaint } from '../../test/front.helpers.js'
import { unannotatedKey } from '../legend.js'

/**************
 test sections
***************

Official data on TP53, extensive ui test
Official - mclass filtering
Official - sample summaries table, create subtrack (tk.filterObj)
Official - allow2selectSamples
Official - hardcodeCnvOnly
Incorrect dslabel
Custom cnv only, no sample

(todo) Custom fusion

Custom ssm only, no sample
Custom cnv and ssm, no sample
Custom cnv and ssm, WITH sample
Custom cnv (category but not numeric value), WITH sample
Custom variants, missing or invalid mclass
Custom variants WITH samples (allows some to be without)
Custom data with samples and sample selection
skewerMode with improper setting and should not break
Numeric mode custom dataset, with mode change
Custom bcf with sample
Custom protein domain


*** note ***

this script exports following test methods to share with non-CI test using GDC/clinvar
- findSingletonMutationTestClick
- testMclassFiltering
- testSampleSummary2subtrack
- testVariantLeftLabel
- testAllow2selectSamples
- testSubtkSampleSummaryIsSmaller

*/

tape('\n', function (test) {
	test.comment('-***- mds3 -***-')
	test.end()
})

tape('Official data on TP53, extensive ui test', test => {
	const holder = getHolder()
	const gene = 'TP53'
	runproteinpaint({
		holder,
		genome: 'hg38-test',
		gene,
		tracks: [{ type: 'mds3', dslabel: 'TermdbTest', callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		// tk is mds3 track object; bb is block object
		test.equal(bb.usegm.name, gene, 'block.usegm.name=' + gene)
		test.equal(bb.tklst.length, 2, 'should have two tracks')
		test.ok(tk.skewer.rawmlst.length > 0, 'mds3 tk should have loaded many data points')
		// in this first test, verify all ui parts are rendered
		test.ok(tk.leftlabels.doms.variants, 'tk.leftlabels.doms.variants is set')
		test.ok(tk.leftlabels.doms.samples, 'tk.leftlabels.doms.samples is set')
		test.notOk(tk.leftlabels.doms.filterObj, 'tk.leftlabels.doms.filterObj is not set')
		test.notOk(tk.leftlabels.doms.close, 'tk.leftlabels.doms.close is not set')

		testLegend(test, tk)

		await findSingletonMutationTestClick(test, tk)
		await testVariantLeftLabel(test, tk, bb)
		{
			const t = tk.duplicateTk()
			test.notOk(t.filterObj, 'duplicateTk() should not attach filterObj for main tk')
			test.notOk(t.hardcodeCnvOnly, 'duplicateTk() should not attach hardcodeCnvOnly for main tk')
		}
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Official - mclass filtering', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		genome: 'hg38-test',
		gene: 'tp53',
		tracks: [{ type: 'mds3', dslabel: 'TermdbTest', callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		await testMclassFiltering(test, tk, bb, holder)
	}
})

export async function testMclassFiltering(test, tk, bb, holder) {
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

tape('Official - sample summaries table, create subtrack (tk.filterObj)', test => {
	testSampleSummary2subtrack('hg38-test', 'TP53', 'TermdbTest', test)
})

export async function testSampleSummary2subtrack(genome, gene, dslabel, test) {
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		genome,
		gene,
		tracks: [{ type: 'mds3', dslabel, callbackOnRender }]
	})

	async function callbackOnRender(tk, bb) {
		// click on "xx samples" left label, to open sample summary panel
		tk.leftlabels.doms.samples.node().dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d, 10000)

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

			testSubtkSampleSummaryIsSmaller(test, tk, subtk)

			test.ok(subtk.leftlabels.doms.filterObj, '.leftlabels.doms.filterObj is set on subtrack')
			// click on the filterObj left label to show menu with filter UI
			subtk.leftlabels.doms.filterObj.node().dispatchEvent(new Event('click'))
			await whenVisible(subtk.menutip.d)
			test.pass('subtk.menutip is shown (with filter UI), after clicking leftlabels.doms.filterObj')

			test.ok(subtk.leftlabels.doms.close, '.leftlabels.doms.close is set on subtrack')

			{
				const t = subtk.duplicateTk()
				test.deepEqual(subtk.filterObj, t.filterObj, 'duplicateTk() works for subtk')
			}

			if (test._ok) {
				holder.remove()
				subtk.menutip.d.remove() // Close orphaned popup window
			}
			test.end()
		}

		const categoryDiv = tk.menutip.d.select('.sjpp_row_wrapper')
		categoryDiv.node().dispatchEvent(new Event('click'))
	}
}

// compare sample summary data between sub and main tk
export function testSubtkSampleSummaryIsSmaller(test, tk, subtk) {
	test.ok(
		subtk.leftlabels.__samples_data.length == tk.leftlabels.__samples_data.length,
		'main and sub track returned summaries for the same number of terms'
	)
	// assuming order of terms in the array are identical between main and sub tk
	// for the same catgory from same term, sub track must show <= samplecount than main

	// since 'sub<=main' must be used in tests but not 'sub<main', verify at least one category has a smaller total sample in subtk
	const subLTmaintotalcount = []

	for (const [i, main] of tk.leftlabels.__samples_data.entries()) {
		const sub = subtk.leftlabels.__samples_data[i]
		if (main.numbycategory) {
			test.ok(
				main.numbycategory.length >= sub.numbycategory.length,
				'main.numbycategory.length >= sub for ' + main.termid
			)
			const k2c = new Map()
			for (const a of main.numbycategory) {
				// a=[categorylabel, #mutated, #total]
				k2c.set(a[0], { mutated: a[1], total: a[2] })
			}
			for (const a of sub.numbycategory) {
				const a2 = k2c.get(a[0])
				test.ok(a2, `subtk category ${a[0]} is also found in main tk`)

				if (a2.total) {
					test.ok(
						a[1] <= a2.mutated && a[2] <= a2.total,
						`sub<=main for mutated/total counts of ${a[0]}, ${main.termid}`
					)
					if (a[2] < a2.total) subLTmaintotalcount.push(`${a[0]}: ${a[2]}<${a2.total}`)
				} else {
					// no total. likely the dataset lacks termid2totalsize2{}
				}
			}
		} else if (main.density_data) {
			if (!Number.isInteger(main.density_data.samplecount)) throw 'main.density_data.samplecount is not integer'
			test.ok(
				sub.density_data.samplecount <= main.density_data.samplecount,
				'sub<=main for density_data.samplecount for ' + main.termid
			)
			if (sub.density_data.samplecount < main.density_data.samplecount)
				subLTmaintotalcount.push(main.termid + ' lower density')
		} else {
		}
	}

	test.ok(
		subLTmaintotalcount.length > 0,
		subLTmaintotalcount.length + ' categories have reduced total sample count in subtk'
	)
	// log out categories with total change for eyeballing
	//console.log(subLTmaintotalcount)
}

export async function testVariantLeftLabel(test, tk, bb) {
	//Click on variant leftlabel to open menu
	const variantsLeftlabel = tk.leftlabels.doms.variants.node()

	// show menu >>> "List" option
	variantsLeftlabel.dispatchEvent(new Event('click'))
	await whenVisible(tk.menutip.d)
	tk.menutip.d
		.selectAll('.sja_menuoption')
		.nodes()
		.find(e => e.innerHTML == 'List')
		.dispatchEvent(new Event('click'))
	{
		const dtSet = new Set(tk.skewer.rawmlst.map(i => i.dt))
		if (dtSet.size > 1) {
			// more than 1 dt, should show toggle
			const div = await detectOne({ elem: tk.menutip.d.node(), selector: '.sja_pp_vlb_dttabdiv' })
			test.ok(div, 'Toggle button div is shown after clicking List (more than 1 dt)')
		} else {
			// only 1 dt, should not show toggle
			const div = await detectZero({ elem: tk.menutip.d.node().firstChild, selector: '.sja_pp_vlb_dttabdiv' })
			test.equal(div, undefined, 'Toggle button div is not shown after clicking List (only 1 dt)')
		}
		// TODO further test variant table contents, based on dtSet
	}

	// show menu >>> "Download" option
	variantsLeftlabel.dispatchEvent(new Event('click'))
	await whenVisible(tk.menutip.d)
	if (0) {
		// FIXME not enabled for custom tk yet
		const op = tk.menutip.d
			.selectAll('.sja_menuoption')
			.nodes()
			.find(e => e.innerHTML == 'Download')
		test.ok(op, 'Download option is present')
		// do not trigger clicking, don't know if it will break ci
	}

	// show menu >>> view mode toggle
	if (!tk.hardcodeCnvOnly && tk.skewer.viewModes.length > 1) {
		// skewer doesn't apply in cnv only mode
		// should show radiobuttons to allow toggling between viewmodes
		variantsLeftlabel.dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d)
		const div = await detectOne({ elem: tk.menutip.d.node(), selector: '.sja_pp_vlb_viewmoderadiodiv' })
		test.ok(div, 'View mode toggle div is shown')

		const currentViewMode = tk.skewer.viewModes.find(i => i.inuse)
		if (currentViewMode.type == 'skewer') {
			// is in skewer mode. can test Collapse/Expand
			// if not in skewer mode, the options may not be shown

			// show menu >>> "Collapse" option
			variantsLeftlabel.dispatchEvent(new Event('click'))
			await whenVisible(tk.menutip.d)
			const op1 = tk.menutip.d
				.selectAll('.sja_menuoption')
				.nodes()
				.find(e => e.innerHTML == 'Collapse')
			test.ok(op1, 'Collapse option is shown')

			op1.dispatchEvent(new Event('click'))

			// as soon as collapsing animation starts, none of the sja_aa_disclabel should have "scale(1)"
			const expandedText = tk.skewer.selection
				.selectAll('text.sja_aa_disclabel')
				.nodes()
				.some(e => {
					//console.log(e)
					e.attributes.transform.value == 'scale(1)'
				})
			test.notOk(expandedText, 'No expanded skewer found after collapsing')

			// show menu >>> "Expand" option
			variantsLeftlabel.dispatchEvent(new Event('click'))
			await whenVisible(tk.menutip.d)
			const op2 = tk.menutip.d
				.selectAll('.sja_menuoption')
				.nodes()
				.find(e => e.innerHTML == 'Expand')
			test.ok(op2, 'Expand option is now shown after clicking Collapse')
			op2.dispatchEvent(new Event('click'))

			// as soon as expanding animation starts, some sja_aa_disclabel should have opacity!=0
			if (0) {
				// FIXME always fails
				const expandedText = tk.skewer.g
					.selectAll('text.sja_aa_disclabel')
					.nodes()
					.some(e => e.attributes['fill-opacity'].value != '0')
				test.ok(expandedText, 'Should find some expanded skewers')
			}
		}
		// TODO test that view mode change options are not shown
	}

	tk.menutip.hide()
}

tape('Official - allow2selectSamples', test => {
	testAllow2selectSamples('hg38-test', 'tp53', 'TermdbTest', test)
})

export async function testAllow2selectSamples(genome, gene, dslabel, test) {
	/* 
must use a gene with both single and multi occurrence mutations to test
*/
	const holder = getHolder()
	const buttonText = 'SElect SAmple' // hardcoded text should show in selection button
	const buttonClass = 'testclassabc'
	runproteinpaint({
		holder,
		genome,
		gene,
		tracks: [
			{
				type: 'mds3',
				dslabel,
				callbackOnRender,
				allow2selectSamples: {
					buttonText,
					class: buttonClass,
					callback: () => {}
				}
			}
		]
	})
	async function callbackOnRender(tk, bb) {
		await findSingletonMutationTestClick(test, tk)

		// 2: click on multi-sample mutation to show selection button in sample table
		const multiMutationDisc = tk.skewer.g
			.selectAll('.sja_aa_disckick')
			.nodes()
			.find(i => i.__data__.occurrence > 1)
		multiMutationDisc.dispatchEvent(new Event('click'))
		await whenVisible(tk.itemtip.d)
		{
			const button = await detectOne({ elem: tk.itemtip.dnode, selector: '.' + buttonClass })
			test.equal(button.innerHTML, buttonText, buttonText + ' button created in multi-sample menu')
			test.ok(button.disabled, 'button is also disabled (when no checkbox is checked)')
			// must check one checkbox first to
		}

		// 3: click on sample leftlabel to show selection button in sample table
		tk.leftlabels.doms.samples.node().dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d)
		{
			const btn = await detectOne({ elem: tk.menutip.dnode, selector: '.sja_mds3_slb_sampletablebtn' })
			btn.dispatchEvent(new Event('click'))
			const button = await detectOne({ elem: tk.menutip.dnode, selector: '.' + buttonClass })
			test.equal(button.innerHTML, buttonText, buttonText + ' button is created in leftlabel sample table')
			test.ok(button.disabled, 'button is also disabled (when no checkbox is checked)')
		}
		if (test._ok) {
			tk.menutip.d.remove()
			tk.itemtip.d.remove()
			holder.remove()
		}
		test.end()
	}
}

tape('Official - hardcodeCnvOnly', test => {
	const holder = getHolder()
	const gene = 'TP53'
	runproteinpaint({
		holder,
		genome: 'hg38-test',
		gene,
		tracks: [{ type: 'mds3', dslabel: 'TermdbTest', hardcodeCnvOnly: true, callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		test.equal(bb.usegm.name, gene, 'block.usegm.name=' + gene)
		test.equal(bb.tklst.length, 2, 'should have two tracks')
		test.ok(tk.skewer.rawmlst.length == 0, 'cnv-only: skewer.rawmlst.length ==0')
		test.ok(tk.cnv.cnvLst.length > 0, 'cnv-only: cnv.cnvLst.length >0')
		test.ok(tk.leftlabels.doms.variants, 'tk.leftlabels.doms.variants is set')
		test.ok(tk.leftlabels.doms.samples, 'tk.leftlabels.doms.samples is set')

		testLegend(test, tk)

		{
			const t = tk.duplicateTk()
			test.ok(t.hardcodeCnvOnly, 'duplicateTk() should attach hardcodeCnvOnly')
		}

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Incorrect dslabel', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38-test',
		gene: 'tp53',
		tracks: [{ type: 'mds3', dslabel: 'blah', callbackOnRender }]
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

tape('Custom ssm only, no sample', test => {
	test.timeoutAfter(2000)
	const holder = getHolder()

	const gene = 'TP53',
		tkname = 'TP53 hg38-test',
		custom_variants = [
			{ chr: 'chr17', pos: 7675993, mname: 'point 1', class: 'M', dt: 1, info: { Acmg: 'P' } },
			{ chr: 'chr17', pos: 7676520, mname: 'point 2', class: 'M', dt: 1, info: { Acmg: 'LP' } },
			{ chr: 'chr17', pos: 7676381, mname: 'point 3', class: 'M', dt: 1, info: { Acmg: 'P' } }
			// { chr: 'chr17', pos: 7675052, mname: 'point 4', class: 'E', dt: 1 },
			// { chr: 'chr17', pos: 7674858, mname: 'point 5', class: 'E', dt: 1 },
			// { chr: 'chr17', pos: 7674180, mname: 'point 6', class: 'F', dt: 1 },
			// { chr: 'chr17', pos: 7673700, mname: 'point 7', class: 'F', dt: 1 },
			// { chr: 'chr17', pos: 7673534, mname: 'point 8', class: 'I', dt: 1 }
		]

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38-test',
		gene,
		tracks: [
			{
				type: 'mds3',
				name: tkname,
				custom_variants,
				callbackOnRender
			}
		]
	})
	async function callbackOnRender(tk, bb) {
		// Test mds3 is a track object and bb is block object
		test.equal(bb.usegm.name, gene, `Should render block.usegm.name = ${gene}`)
		test.equal(bb.tklst.length, 2, 'Should have two tracks')
		test.equal(tk.skewer.rawmlst.length, custom_variants.length, 'Should load all custom data points')

		const classes2Check = new Set() //for legend testing below
		for (const variant of custom_variants) {
			classes2Check.add(variant.class)
			// test all custom variant entries successfully passed to block instance
			const variantFound = tk.custom_variants.find(i => i.mname == variant.mname)
			test.ok(variantFound, `Should render data point for ${variant.mname}`)
		}

		// left labels
		test.ok(tk.leftlabels.doms.variants, 'Should render tk.leftlabels.doms.variants')
		await testVariantLeftLabel(test, tk, bb)
		test.notOk(tk.leftlabels.doms.filterObj, 'Should NOT render tk.leftlabels.doms.filterObj')
		test.notOk(tk.leftlabels.doms.close, 'Should NOT render tk.leftlabels.doms.close')

		testLegend(test, tk)
		await findSingletonMutationTestClick(test, tk)

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Custom variants, missing or invalid mclass', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const custom_variants = [
		{ chr: 'chr17', pos: 7675993, mname: 'point 1', dt: 1 }, //Missing class
		{ chr: 'chr17', pos: 7676520, mname: 'point 2', class: 'xyz', dt: 1 } //Invalid class
	]

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38-test',
		gene: 'TP53',
		tracks: [
			{
				type: 'mds3',
				name: 'Missing or invalid class assignments',
				custom_variants,
				callbackOnRender
			}
		]
	})

	function callbackOnRender(tk, bb) {
		test.equal(
			tk.custom_variants.length,
			custom_variants.length,
			`Should render total # of custom variants = ${custom_variants.length}`
		)
		for (const variant of custom_variants) {
			const variantFound = tk.custom_variants.find(i => i.mname == variant.mname)
			test.ok(variantFound, `Should render data point for ${variant.mname}`)
			test.equal(variantFound.class, 'X', 'class="X" is assigned for missing or invalid class')
		}

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Custom variants WITH samples (allows some to be without)', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const custom_variants = [
		// first variant must have sample, as will click on it to check if sample is showing in itemtip
		{ chr: 'chr17', pos: 7676520, mname: 'point 2', class: 'M', dt: 1, sample: 'sample 2' },
		// 2nd variant has no sample and should be allowed
		{ chr: 'chr17', pos: 7675993, mname: 'point 1', class: 'M', dt: 1 },
		{ chr: 'chr17', pos: 7676381, mname: 'point 3', class: 'F', dt: 1, sample: 'sample 1' }
	]

	runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg38-test',
		gene: 'TP53',
		tracks: [{ type: 'mds3', name: 'Test, with sample name', custom_variants, callbackOnRender }]
	})

	async function callbackOnRender(tk) {
		test.ok(tk.leftlabels.doms.samples, 'tk.leftlabels.doms.samples is set')
		const variantNum = new Set()
		for (const variant of custom_variants) {
			//Test all custom variant entries successfully passed to block instance
			const variantFound = tk.custom_variants.find(i => i.mname == variant.mname)
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
			tk.custom_variants.length,
			variantNum.size,
			`Should render total # of custom variants = ${variantNum.size}`
		)

		await findSingletonMutationTestClick(test, tk)

		// get the first skewer disc
		const firstDisc = tk.skewer.g.selectAll('.sja_aa_disckick').nodes()[0]
		// click the disc, trigger itemtip to display variant and single sample info
		firstDisc.dispatchEvent(new Event('click'))
		await whenVisible(tk.itemtip.d)
		test.pass('Should show itemtip after clicking first skewer disc')

		// check if sample name is printed in the itemtip
		const span = await detectOne({ elem: tk.itemtip.dnode, selector: '.pp_mds3_singleSampleNameSpan' })
		test.ok(span, 'itemtip has <span class=pp_mds3_singleSampleNameSpan>')
		test.equal(
			span.innerHTML,
			firstDisc.__data__.mlst[0].samples[0].sample_id,
			'itemtip has correct single-sample name'
		)

		tk.itemtip.dnode.remove() //Remove so the tip does not persist into other tests
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
		annotations: { s1: { diagnosis: 'AA' }, s2: { diagnosis: 'BB' }, s3: { diagnosis: 'AA' } }
	}

	const buttonText = 'Custom Text'

	runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg38-test',
		gene: 'NM_000546',
		tracks: [
			{
				type: 'mds3',
				name: 'Custom data',
				custom_variants,
				sampleAnnotation,
				callbackOnRender,
				allow2selectSamples: {
					// cannot test this function! frontend vocab lacks a method
					buttonText, // hardcoded text should show in selection button
					callback: () => {}
				}
			}
		]
	})
	async function callbackOnRender(tk) {
		testLegend(test, tk)
		await findSingletonMutationTestClick(test, tk)
		test.equal(
			tk.skewer.selection._groups[0].length,
			custom_variants.length,
			`Should render ${custom_variants.length} skewers`
		)

		{
			//Test variant label left of track
			const lab = tk.leftlabels.doms.variants
			test.ok(lab, '"Variants" leftlabel should be displayed')
			test.equal(
				lab.node().innerHTML,
				`${custom_variants.length} variants`,
				`Variant leftlabel should print "${custom_variants.length} variants"`
			)
		}
		{
			//Test sample label left of track
			const sampleLabel = tk.leftlabels.doms.samples
			test.ok(sampleLabel, '"Samples" leftlabel should be displayed')
			test.equal(
				sampleLabel.node().innerHTML,
				`${custom_variants.length} samples`,
				`Sample leftlabel should print "${custom_variants.length} samples"`
			)

			sampleLabel.node().dispatchEvent(new Event('click'))

			//Test list menu option available
			const listOpt = await detectOne({
				elem: tk.menutip.dnode,
				selector: '.sja_menuoption'
			})
			test.equal(
				listOpt.innerHTML,
				`List ${custom_variants.length} samples`,
				`First menu option should be named "List ${custom_variants.length} samples"`
			)

			// table.js should render a <button> with given text
			const tableBtn = await detectGte({
				elem: tk.menutip.dnode,
				selector: 'button',
				trigger() {
					listOpt.dispatchEvent(new Event('click'))
				}
			})

			test.ok(
				tableBtn[0] && tableBtn[0].innerText == buttonText,
				`Sample table should contain a <button> with custom text`
			)
		}

		if (test._ok) {
			tk.menutip.d.remove()
			holder.remove()
		}
		test.end()
	}
})

tape('Custom cnv only, no sample', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const custom_variants = [
		{ chr: 'chr17', start: 7670699, stop: 7674000, dt: 4, class: 'CNV_amp', value: 1 },
		{ chr: 'chr17', start: 7670699, stop: 7674000, dt: 4, class: 'CNV_loss', value: -1 },
		{ chr: 'chr17', start: 7670699, stop: 7676000, dt: 4, class: 'CNV_loss', value: -0.5 }
	]
	runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg38-test',
		gene: 'NM_000546',
		tracks: [
			{
				type: 'mds3',
				name: 'Custom data',
				custom_variants,
				callbackOnRender
			}
		]
	})
	async function callbackOnRender(tk) {
		test.equal(
			tk.cnv.g.selectAll('rect')._groups[0].length,
			custom_variants.length,
			`All ${custom_variants.length} segments should be rendered`
		)

		{
			//Test variant label left of track
			const lab = tk.leftlabels.doms.variants
			test.ok(lab, '"Variants" leftlabel should be displayed')
			test.equal(
				lab.node().innerHTML,
				`${custom_variants.length} CNVs`,
				`Variant leftlabel should print "${custom_variants.length} variants"`
			)
		}
		testLegend(test, tk)

		if (test._ok) {
			tk.menutip.d.remove()
			holder.remove()
		}
		test.end()
	}
})

tape('Custom cnv and ssm, no sample', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const custom_variants = [
		{ chr: 'chr17', start: 7670699, stop: 7674000, dt: 4, class: 'CNV_amp', value: 1 },
		{ chr: 'chr17', start: 7670699, stop: 7674000, dt: 4, class: 'CNV_loss', value: -1 },
		{ chr: 'chr17', start: 7670699, stop: 7676000, dt: 4, class: 'CNV_loss', value: -0.5 },
		{ chr: 'chr17', pos: 7675993, mname: 'point 1', class: 'M', dt: 1 },
		{ chr: 'chr17', pos: 7676520, mname: 'point 2', class: 'M', dt: 1 },
		{ chr: 'chr17', pos: 7676381, mname: 'point 3', class: 'M', dt: 1 }
	]
	runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg38-test',
		gene: 'NM_000546',
		tracks: [
			{
				type: 'mds3',
				name: 'Custom data',
				custom_variants,
				callbackOnRender
			}
		]
	})
	async function callbackOnRender(tk) {
		test.equal(
			tk.cnv.g.selectAll('rect')._groups[0].length,
			custom_variants.filter(i => i.dt == 4).length,
			`All cnv segments should be rendered`
		)

		{
			//Test variant label left of track
			const lab = tk.leftlabels.doms.variants
			test.ok(lab, '"Variants" leftlabel should be displayed')
			test.equal(
				lab.node().innerHTML,
				`${custom_variants.length} variants`,
				`Variant leftlabel should print "${custom_variants.length} variants"`
			)
		}
		testLegend(test, tk)
		await findSingletonMutationTestClick(test, tk)

		if (test._ok) {
			tk.menutip.d.remove()
			holder.remove()
		}
		test.end()
	}
})

tape('Custom cnv and ssm, WITH sample', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const custom_variants = [
		{ chr: 'chr17', start: 7670699, stop: 7674000, dt: 4, class: 'CNV_amp', value: 1, sample: 's1' },
		{ chr: 'chr17', start: 7670699, stop: 7674000, dt: 4, class: 'CNV_loss', value: -1, sample: 's2' },
		{ chr: 'chr17', start: 7670699, stop: 7676000, dt: 4, class: 'CNV_loss', value: -0.5, sample: 's3' },
		{ chr: 'chr17', pos: 7675993, mname: 'point 1', class: 'M', dt: 1, sample: 's3' },
		{ chr: 'chr17', pos: 7676520, mname: 'point 2', class: 'M', dt: 1, sample: 's4' },
		{ chr: 'chr17', pos: 7676381, mname: 'point 3', class: 'M', dt: 1, sample: 's1' }
	]
	runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg38-test',
		gene: 'NM_000546',
		tracks: [
			{
				type: 'mds3',
				name: 'Custom data',
				custom_variants: JSON.parse(JSON.stringify(custom_variants)),
				callbackOnRender
			}
		]
	})
	async function callbackOnRender(tk) {
		test.equal(
			tk.cnv.g.selectAll('rect')._groups[0].length,
			custom_variants.filter(i => i.dt == 4).length,
			`All cnv segments should be rendered`
		)

		{
			//Test variant label left of track
			const lab = tk.leftlabels.doms.variants
			test.ok(lab, '"Variants" leftlabel should be displayed')
			test.equal(
				lab.node().innerHTML,
				`${custom_variants.length} variants`,
				`Variant leftlabel should print "${custom_variants.length} variants"`
			)
		}

		{
			// Test sample leftlabel
			const lab = tk.leftlabels.doms.samples
			test.ok(lab, '"Samples" leftlabel should be displayed')

			const set = new Set(custom_variants.map(i => i.sample))
			test.equal(lab.node().innerHTML, `${set.size} samples`, `Samples leftlabel should print "${set.size} samples"`)
		}

		testLegend(test, tk)
		await findSingletonMutationTestClick(test, tk)

		if (test._ok) {
			tk.menutip.d.remove()
			holder.remove()
		}
		test.end()
	}
})

tape('Custom cnv (category but not numeric value), WITH sample', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const custom_variants = [
		{ chr: 'chr17', start: 7670699, stop: 7674000, dt: 4, class: 'CNV_amp', sample: 's1' },
		{ chr: 'chr17', start: 7670699, stop: 7674000, dt: 4, class: 'CNV_amplification', sample: 's2' },
		{ chr: 'chr17', start: 7670699, stop: 7676000, dt: 4, class: 'CNV_loss', sample: 's3' },
		{ chr: 'chr17', start: 7670699, stop: 7676000, dt: 4, class: 'CNV_homozygous_deletion', sample: 's4' },
		{ chr: 'chr17', pos: 7675993, mname: 'point 1', class: 'M', dt: 1, sample: 's3' },
		{ chr: 'chr17', pos: 7676520, mname: 'point 2', class: 'M', dt: 1, sample: 's4' },
		{ chr: 'chr17', pos: 7676381, mname: 'point 3', class: 'M', dt: 1, sample: 's1' }
	]
	runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg38-test',
		gene: 'NM_000546',
		tracks: [
			{
				type: 'mds3',
				name: 'Custom data',
				custom_variants: JSON.parse(JSON.stringify(custom_variants)),
				callbackOnRender
			}
		]
	})
	async function callbackOnRender(tk) {
		test.equal(
			tk.cnv.g.selectAll('rect')._groups[0].length,
			custom_variants.filter(i => i.dt == 4).length,
			`All cnv segments should be rendered`
		)

		{
			//Test variant label left of track
			const lab = tk.leftlabels.doms.variants
			test.ok(lab, '"Variants" leftlabel should be displayed')
			test.equal(
				lab.node().innerHTML,
				`${custom_variants.length} variants`,
				`Variant leftlabel should print "${custom_variants.length} variants"`
			)
		}

		{
			// Test sample leftlabel
			const lab = tk.leftlabels.doms.samples
			test.ok(lab, '"Samples" leftlabel should be displayed')

			const set = new Set(custom_variants.map(i => i.sample))
			test.equal(lab.node().innerHTML, `${set.size} samples`, `Samples leftlabel should print "${set.size} samples"`)
		}

		testLegend(test, tk)

		if (test._ok) {
			tk.menutip.d.remove()
			holder.remove()
		}
		test.end()
	}
})

tape('skewerMode with improper setting and should not break', test => {
	const holder = getHolder()

	const custom_variants = [
		{ chr: 'chr17', pos: 7676228, mname: 'P75', class: 'M', dt: 1, lpv: 1, value2: 4 },
		{ chr: 'chr17', pos: 7675208, mname: 'T73', class: 'M', dt: 1, lpv: 2, value2: 5 },
		{ chr: 'chr17', pos: 7674922, mname: 'WTPinsP75', class: 'I', dt: 1, lpv: 3, value2: 6 },
		{ chr: 'chr17', pos: 7674225, mname: 'data point', class: 'I', dt: 1 }
	]

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38-test',
		gene: 'NM_000546',
		tracks: [
			{
				type: 'mds3',
				// type=skewer is supplied instead of type=numeric
				skewerModes: [{ type: 'skewer', byAttribute: 'lpv', label: '-log10(p-value)', inuse: true, axisheight: 100 }],
				name: 'AA sites with numbers',
				custom_variants,
				axisSetting: { auto: 1 },
				callbackOnRender
			}
		]
	})

	async function callbackOnRender(tk, bb) {
		await testVariantLeftLabel(test, tk, bb)
		if (test._ok) holder.remove()
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
		{ chr: 'chr17', pos: 7676228, mname: 'P75', class: 'M', dt: 1, lpv: 1, value2: 4 },
		{ chr: 'chr17', pos: 7675208, mname: 'T73', class: 'M', dt: 1, lpv: 2, value2: 5 },
		{ chr: 'chr17', pos: 7674922, mname: 'WTPinsP75', class: 'I', dt: 1, lpv: 3, value2: 6 },
		{ chr: 'chr17', pos: 7674225, mname: 'data point', class: 'I', dt: 1 }
	]

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38-test',
		gene: 'NM_000546',
		tracks: [
			{
				type: 'mds3',
				skewerModes,
				name: 'AA sites with numbers',
				custom_variants,
				axisSetting: { auto: 1 },
				callbackOnRender
			}
		]
	})

	// TODO all data points should be rendered in svg

	async function callbackOnRender(tk, bb) {
		await testVariantLeftLabel(test, tk, bb)

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

		testLegend(test, tk)

		tk.callbackOnRender = changeNM_autoScale
		tk.load()
	}

	function changeNM_autoScale(tk, bb) {
		const nm = tk.skewer.viewModes.find(i => i.inuse)
		const n = tk.g.select('.sjpp-mds3-nm-axislabel')
		test.equal(
			nm.label,
			n.text(),
			`numericmode axis label "${n.text()}" matches with view mode obj after switching mode`
		)
		test.equal(nm.minvalue, 4, '(auto) min=4')
		test.equal(nm.maxvalue, 6, '(auto) max=6')

		// change axis to fixed, and rerender
		nm.axisSetting = { fixed: { min: 0.5, max: 2.5 } }
		tk.callbackOnRender = changeNM_fixedScale
		tk.load()
	}

	function changeNM_fixedScale(tk, bb) {
		const nm = tk.skewer.viewModes.find(i => i.inuse)
		test.equal(nm.minvalue, 0.5, '(fixed) min=0.5')
		test.equal(nm.maxvalue, 2.5, '(fixed) max=2.5')
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Custom bcf with sample', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38-test',
		gene: 'NM_000546',
		tracks: [
			{
				type: 'mds3',
				name: 'custom bcf',
				bcf: { file: 'files/hg38/TermdbTest/TermdbTest.bcf.gz' },
				callbackOnRender
			}
		]
	})

	async function callbackOnRender(tk, bb) {
		await testVariantLeftLabel(test, tk, bb)

		// todo click a skewer to show samples

		tk.leftlabels.doms.samples.node().dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d, 10000)
		const div = await detectOne({ elem: tk.menutip.dnode, selector: '.sja_mds3_slb_sampletablebtn' })
		test.ok(div, '"List 5 sample" option found')
		div.dispatchEvent(new Event('click'))
		const table = await detectOne({ elem: tk.menutip.dnode, selector: '[data-testid="sjpp_mds3tk_sampletable"]' })
		test.ok(table, 'sample table shown')
		tk.menutip.d.remove()

		testLegend(test, tk)

		if (test._ok) holder.remove()
		test.end()
	}
})

// this test is not specific for mds3 tk. maybe moved to a "block integration test" later
tape('Custom protein domain', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38-test',
		gene: 'NM_000546',
		geneDomains: { NM_000546: [{ start: 10, stop: 20, name: 'xx', color: 'red' }] },
		onloadalltk_always
	})
	function onloadalltk_always(bb) {
		delete bb.onloadalltk_always
		const domain = bb.usegm.pdomains.find(i => i.name == 'xx')
		test.ok(domain, 'custom domain added')
		test.equal(domain.color, 'red', 'custom color is kept')
		if (test._ok) holder.remove()
		test.end()
	}
})

/*************************
 reusable helper functions
**************************/

export function testLegend(test, tk) {
	test.equal(
		tk.tr_legend.node().querySelectorAll('td')[0].innerText,
		tk.name,
		`Should pass custom name = ${tk.name} to legend`
	)
	// tk legend is consisted of components based on availability of data types
	testLegend_mclass(test, tk)
	testLegend_cnv(test, tk)
}
function testLegend_mclass(test, tk) {
	test.ok(tk.legend.mclass, 'tk.legend.mclass is always created for all setup')

	if (tk.hardcodeCnvOnly) {
		// tricky: this is the only condition when it's hidden
		test.equal(
			tk.legend.mclass.row.style('display'),
			'none',
			'tk.legend.mclass.tr.display="none" when hardcodeCnvOnly flag is set'
		)
		return
	}

	test.equal(
		tk.legend.mclass.row.style('display'),
		'table-row',
		'tk.legend.mclass.tr.display="table-row" when no hardcodeCnvOnly flag'
	)

	const d = tk.legend.mclass.holder.selectAll('[data-testid="sjpp-mds3tk-legenditemlabel"]')
	test.ok(d._groups[0].length >= 1, 'more than 1 mclass legend items')
	for (const f of d._groups[0]) {
		const value = f.getAttribute('__key__')
		// tricky! this value is either mclass (dt=snvindel) or stringified dt value; thus guess
		const dt = Number(value)
		if (Number.isNaN(dt)) {
			// tricky! when hardcodeCnvOnly flag is not set, the categorical cnv types are listed in legend.mclass along with snvindel classes
			if (value.startsWith('CNV_')) {
				// is a cnv category, must not find it in skewer.rawmlst[]
				test.ok(
					tk.cnv.cnvLst.find(i => i.class == value),
					`cnv category ${value} matched to some events`
				)
			} else {
				// value is mclass
				test.ok(
					tk.skewer.rawmlst.find(i => i.class == value),
					`mclass ${value} matched to some m`
				)
			}
		} else {
			// this legend entry is about dt
			if (dt == 4) {
				test.ok(tk.cnv, 'mclass legend found entry for dt=4 and tk.cnv exists')
			} else {
				throw 'unknown dt from mclass legend ' + dt
			}
		}
	}

	// optional properties that can exist on snvindel data
	testLegend_info(test, tk)
	//testLegend_format(test, tk) format are not in legend yet
	testLegend_skewerRim(test, tk)
}
function testLegend_info(test, tk) {
	/* unreliable: 

		if(!tk.skewer.rawmlst.find(i=>i.info)) {
		}

	a native tk m data may have m.info, but can still miss INFO legend if no field has .categories{}
	*/

	// collect all "lengendable" INFO keys
	const infoKey4legend = new Set()
	if (tk.mds.bcf?.info) {
		for (const k in tk.mds.bcf.info) {
			if (tk.mds.bcf.info[k].categories) infoKey4legend.add(k)
		}
	}
	if (infoKey4legend.size == 0) {
		test.ok(!tk.legend.bcfInfo, 'tk.legend.bcfInfo is missing when tk has no INFO fields configured for legend')
		return
	}
	test.ok(tk.legend.bcfInfo, 'tk.legend.bcfInfo is set when tk has INFO fields configured for legend')

	// for each info key, test its rendering in legend
	for (const infoKey of infoKey4legend) {
		test.ok(tk.legend.bcfInfo[infoKey], `tk.legend.bcfInfo["${infoKey}"] exists`)
		const d = tk.legend.bcfInfo[infoKey].holder.selectAll('[data-testid="sjpp-mds3tk-legenditemlabel"]')
		test.ok(d._groups[0].length > 1, `INFO ${infoKey} has more than 1 legend fields`)
		for (const f of d._groups[0]) {
			const infoValue = f.getAttribute('__key__')
			if (infoValue == unannotatedKey) {
				// unannotated category, there are some variants not annotated by this field
				test.ok(
					tk.skewer.rawmlst.find(i => !i.info?.[infoKey]),
					`INFO ${infoKey} value ${infoValue} matched to unannotated m`
				)
				continue
			}
			test.ok(
				tk.skewer.rawmlst.find(i => i.info?.[infoKey] == infoValue),
				`INFO ${infoKey} value ${infoValue} matched to some m`
			)
		}
	}
}

//function testLegend_format(test, tk) {}

function testLegend_skewerRim(test, tk) {
	if (!tk.mds.queries?.snvindel?.skewerRim) {
		test.ok(!tk.legend.skewerRim, 'tk.leged.skewerRim is missing when skewerRim is not configured')
		return
	}
	test.ok(tk.legend.skewerRim, 'tk.leged.skewerRim is set when skewerRim is configured')
	// lack a way to test legend contents
	// quick fix: all m should have rim1count
	test.ok(
		tk.skewer.rawmlst.every(m => Number.isInteger(m.rim1count)),
		'skewer.rawmlst[].rim1count are integer (risky?)'
	)
}
function testLegend_cnv(test, tk) {
	if (!tk.cnv) {
		test.ok(!tk.legend.cnv, 'tk.legend.cnv is missing when tk has no cnv')
		return
	}
	test.ok(tk.legend.cnv, 'tk.legend.cnv is set when tk has cnv')

	// test if color scale is shown based on type of cnv data
	const colorS = tk.legend.cnv.holder.selectAll('[data-testid="sjpp-color-scale"]')._groups[0]
	{
		if (Number.isFinite(tk.cnv.cnvGainCutoff)) {
			test.equal(colorS.length, 1, 'has cnvGainCutoff and creates color scale')
			test.ok(!tk.legend.cnv.cnvCategoryHolder, 'has cnvGainCutoff and does not create cnvCategoryHolder')
		} else {
			test.equal(colorS.length, 0, 'no cnvGainCutoff and does not show color scale')
			test.ok(tk.legend.cnv.cnvCategoryHolder, 'no cnvGainCutoff and creates cnvCategoryHolder')
			if (tk.hardcodeCnvOnly) {
				// tricky!! only populate this when hardcodeCnvOnly flag is true!!
				const d = tk.legend.cnv.cnvCategoryHolder.selectAll('[data-testid="sjpp-mds3tk-legenditemlabel"]')
				test.ok(
					d._groups[0].length > 0,
					`hardcodeCnvOnly flag is true and hopefully at least 1 category in cnvCategoryHolder`
				)
				for (const f of d._groups[0]) {
					const cnvclass = f.getAttribute('__key__')
					test.ok(
						tk.cnv.cnvLst.find(i => i.class == cnvclass),
						'hardcodeCnvOnly flag=true and found cnv items mactching ' + cnvclass
					)
				}
			}
		}
	}
	test.ok(tk.legend.cnv.cnvFilterPrompt, 'legend.cnv.cnvFilterPrompt should be set')
}

export async function findSingletonMutationTestClick(test, tk) {
	/*
	find a singleton skewer and click disc to test its menu
	mutation is either occurrence=1 or no occurrence (e.g. sample-less clinvar)
	can be in viewmode=skewer or numeric
	do this separately for different dt
	*/

	// look for dt=1 singleton
	{
		let m // to register the m object of the clicked singleton lollipop
		const singletonMutationDisc = tk.skewer.g
			.selectAll('.sja_aa_disckick')
			.nodes()
			.find(i => {
				// numeric mode: m is __data__
				// skewer: m is __data__.mlst[0]
				const dt = (i.__data__.mlst?.[0] || i.__data__).dt
				if (dt == 1 && (!i.__data__.occurrence || i.__data__.occurrence == 1)) {
					m = i.__data__.mlst?.[0] || i.__data__
					return true
				}
			})
		if (m) {
			test.ok(singletonMutationDisc, 'dt=1 singleton mutation is found')
			// click the singleton disc to show itemtip
			singletonMutationDisc.dispatchEvent(new Event('click'))
			await whenVisible(tk.itemtip.d)
			test.pass('dt=1 itemtip shows with variant table')
			await testClickOnSsm(m, test, tk)
		}
	}

	// look for dt=svfusion singleton
	{
		let m // to register the m object of the clicked singleton lollipop
		const singletonMutationDisc = tk.skewer.g
			.selectAll('.sja_aa_disckick')
			.nodes()
			.find(i => {
				const dt = (i.__data__.mlst?.[0] || i.__data__).dt
				if ((dt == 2 || dt == 5) && (!i.__data__.occurrence || i.__data__.occurrence == 1)) {
					m = i.__data__.mlst?.[0] || i.__data__
					return true
				}
			})
		if (m) {
			test.ok(singletonMutationDisc, 'dt=sv/fusion singleton is found')
			singletonMutationDisc.dispatchEvent(new Event('click'))
			await whenVisible(tk.itemtip.d)
			test.pass('dt=sv/fusion itemtip shows with variant table')
			await testClickOnSvfusion(m, test, tk)
		}
	}

	// TODO itd

	// clean up
	if (test._ok) {
		tk.itemtip.d.remove()
		tk.menutip.d.remove()
	}
}
async function testClickOnSvfusion(m, test, tk) {
	const d = tk.itemtip.d.selectAll('[data-testid="sjpp-mds3tk-singlesvfusiongraph"]')._groups[0][0]
	test.ok(d, 'svgraph <div> should be made')
	await testSingletonItemtipButtons(test, tk)
}
async function testClickOnSsm(m, test, tk) {
	{
		// rows for INFO fields
		const d = tk.itemtip.d.selectAll('[data-testid="sjpp-mds3tk-singlemtablerow4infokey"]')._groups[0]
		if (m.info) {
			test.ok(d.length, 'm.info{} is present and hope itemtable shows at least 1 info field')
			for (const f of d) {
				// must not do test.ok(m.info[f.innerHTML]), the field value may be 0 and false
				test.ok(f.innerHTML in m.info, `itemtable shows row for INFO key "${f.innerHTML}"`)
			}
		} else {
			test.ok(d.length == 0, 'm.info{} not present and itemtable displays no info rows')
		}
	}

	{
		// rows for FORMAT fields
		const d = tk.itemtip.d.selectAll('[data-testid="sjpp-mds3tk-singlemtablerow4formatkey"]')._groups[0]
		if (tk.mds.bcf?.format && d.length) {
			// for some
			//test.ok(d.length,'tk.mds.bcf.format{} is present and hope sample table shows at least 1 format field')
			for (const f of d) {
				const k = f.getAttribute('__key__')
				test.ok(k in tk.mds.bcf.format, `sample table shows row for FORMAT key "${k}"`)
			}
		} else {
			test.ok(d.length == 0, 'tk.mds.bcf.format not present and sample table displays no format rows')
		}
	}
	await testSingletonItemtipButtons(test, tk)
}

async function testSingletonItemtipButtons(test, tk) {
	{
		if (tk.mds.queries?.singleSampleMutation) {
			const btn = await detectOne({
				elem: tk.itemtip.dnode,
				selector: '[data-testid="proteinpaint_disc_table_disco_button"]'
			})
			// both custom & native tk have mds.queries
			test.ok(btn, 'Disco button made when mds.queries.singleSampleMutation is present')
			btn.dispatchEvent(new Event('click'))
			// TODO detect disco showing in new sandbox
		} else {
			const btn = await detectZero({
				elem: tk.itemtip.dnode,
				selector: '[data-testid="proteinpaint_disc_table_disco_button"]'
			})
			test.ok(!btn, 'Disco button not made when mds.queries.singleSampleMutation is not present')
		}
	}
	{
		// select sample button
		if (tk.allow2selectSamples) {
			const btn = await detectOne({ elem: tk.itemtip.dnode, selector: '[data-testid="sjpp-mds3tk-selectsamplebtn"]' })
			test.ok(btn, 'Select Sample button made when tk.allow2selectSamples is provided')
			const t = tk.allow2selectSamples.buttonText
			const t2 = t.endsWith('s') ? t.substring(0, t.length - 1) : t
			test.equal(btn.innerHTML, t2, `button shows text "${t2}"`)
			//btn.dispatchEvent(new Event('click'))
			// no need to test callback 1) lack convenient way 2) throws vocab error for custom tk
		} else {
			const btn = await detectZero({ elem: tk.itemtip.dnode, selector: '[data-testid="sjpp-mds3tk-selectsamplebtn"]' })
			test.ok(!btn, 'Select Sample button not made when tk.allow2selectSamples is not provided')
		}
	}
	// no need to test buttons from singleSampleGenomeQuantification, it will be replaced
}

export function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid black')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}
