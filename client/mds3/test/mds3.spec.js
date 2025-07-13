import tape from 'tape'
import * as d3s from 'd3-selection'
import { detectLst, detectOne, detectZero, whenHidden, whenVisible, detectGte } from '../../test/test.helpers'
import {
	findSingletonMutationTestDiscoCnvPlots,
	testMclassFiltering,
	testSampleSummary2subtrack,
	testVariantLeftLabel,
	testAllow2selectSamples,
	testSubtkSampleSummaryIsSmaller
} from './mds3.integration.spec'

/**************
 tests both GDC and clinvar
 GDC is mission critical, clinvar is sample-less. both are not covered by CI

GDC - gene symbol KRAS
GDC - GENCODE transcript ENST00000407796
GDC - GENCODE gene ENSG00000133703
GDC - RefSeq NM_005163
GDC - KRAS SSM ID
GDC - ssm by range
GDC - cnv only
GDC - allow2selectSamples
geneSearch4GDCmds3
geneSearch4GDCmds3 hardcodeCnvOnly
GDC - gene hoxa1 - Disco button
Clinvar - gene kras
GDC - sample summaries table, create subtrack (tk.filterObj)
GDC - tk.filter0 and ssm/sample reduction

GDC - mclass filtering
Clinvar - mclass filtering

Collapse and expand mutations from variant link
GDC - sunburst

***************/

tape('\n', function (test) {
	test.comment('-***- mds3 -***-')
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
	async function callbackOnRender(tk, bb) {
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
		await findSingletonMutationTestDiscoCnvPlots(test, tk, bb)
		await testVariantLeftLabel(test, tk, bb)
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

	async function callbackOnRender(tk, bb) {
		test.ok(tk.skewer.rawmlst.length > 0, 'mds3 tk should have loaded many data points')
		await testVariantLeftLabel(test, tk, bb)
		// FIXME click sample left label breaks
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('GDC - cnv only', test => {
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
			{ type: 'mds3', dslabel: 'GDC', hardcodeCnvOnly: 1, callbackOnRender }
			//{type:'bedj',file:'anno/refGene.hg38.gz',name:'RefGene',__isgene:true}
		]
	})

	async function callbackOnRender(tk, bb) {
		test.ok(tk.cnv.cnvLst.length > 0, 'cnv only mode has loaded cnv segments')
		await testVariantLeftLabel(test, tk, bb)
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('GDC - allow2selectSamples', test => {
	testAllow2selectSamples('hg38', 'IDH1', 'GDC', test)
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

tape('geneSearch4GDCmds3 hardcodeCnvOnly', async test => {
	// enter a gene name into search box, find the gene match in tooltip, select matched gene to launch block with gdc track
	const holder = getHolder()
	await runproteinpaint({
		holder,
		noheader: 1,
		geneSearch4GDCmds3: { hardcodeCnvOnly: 1, postRender }
	})
	async function postRender(arg) {
		// arg={tip}; convenient method to provide the tooltip used by gene search <input> (remove some hassle of finding this tooltip)_
		const searchBox = await detectOne({ elem: holder, selector: '.sja_genesearchinput' })
		test.ok(searchBox, 'Gene search box is made')

		const blockHolder = await detectOne({ elem: holder, selector: '.sja_geneSearch4GDCmds3_blockdiv' })
		test.ok(blockHolder, 'Block holder is made')

		// enter gene name and trigger search
		searchBox.value = 'akt1'
		searchBox.dispatchEvent(
			//
			// must do below; `new Event('keyup')` doesn't work
			new KeyboardEvent('keyup', {
				key: 'Enter',
				code: 'Enter',
				keyCode: 13, // deprecated but still widely used
				which: 13, // deprecated but still widely used
				bubbles: true, // important to allow the event to bubble up
				cancelable: true
			})
		)

		const blockDiv = await detectOne({ elem: blockHolder, selector: '.sja_Block_div' })
		test.ok(blockDiv, 'A block is rendered')
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
	async function callbackOnRender(tk, bb) {
		test.equal(bb.tklst.length, 2, 'should have two tracks')
		test.ok(tk.skewer.rawmlst.length > 0, 'mds3 tk should have loaded many data points')
		test.ok(tk.leftlabels.doms.variants, 'tk.leftlabels.doms.variants is set')
		test.notOk(tk.leftlabels.doms.samples, 'tk.leftlabels.doms.samples is absent')
		await testVariantLeftLabel(test, tk, bb)
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('GDC - sample summaries table, create subtrack (tk.filterObj)', test => {
	testSampleSummary2subtrack('hg38', 'IDH1', 'GDC', test)
})

// above test covers tk.filterObj that's auto-generated by launching mds3 subtk; this does not cover tk.filter0, thus need separate test
// run tape() first to collect track stat without filter0. then run tape() again with filter0 to compare
let sampleNoFilter
let ssmcountNoFilter
tape('GDC - tk.filter0 and ssm/sample reduction', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		genome: 'hg38',
		gene: 'ENST00000407796',
		tracks: [{ type: 'mds3', dslabel: 'GDC', callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		tk.leftlabels.doms.samples.node().dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d)
		await detectOne({ elem: tk.menutip.d.node(), selector: '.sja_mds3samplesummarydiv' })
		sampleNoFilter = tk.leftlabels.__samples_data
		test.ok(sampleNoFilter, 'collected leftlabels.__samples_data without filter0')
		ssmcountNoFilter = tk.skewer.rawmlst.length
		if (test._ok) {
			holder.remove()
			tk.menutip.d.remove()
		}
		test.end()
	}
})
tape('GDC - tk.filter0 and ssm/sample reduction (FILTER)', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		genome: 'hg38',
		gene: 'ENST00000407796',
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC',
				callbackOnRender,
				filter0: {
					op: 'and',
					content: [{ op: 'in', content: { field: 'cases.project.project_id', value: ['TCGA-BRCA'] } }]
				}
			}
		]
	})
	async function callbackOnRender(tk, bb) {
		test.ok(tk.skewer.rawmlst.length < ssmcountNoFilter, 'Number of ssm is reduced')
		tk.leftlabels.doms.samples.node().dispatchEvent(new Event('click'))
		await whenVisible(tk.menutip.d)
		await detectOne({ elem: tk.menutip.d.node(), selector: '.sja_mds3samplesummarydiv' })
		testSubtkSampleSummaryIsSmaller(test, { leftlabels: { __samples_data: sampleNoFilter } }, tk)
		if (test._ok) {
			holder.remove()
			tk.menutip.d.remove()
		}
		test.end()
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
		await testMclassFiltering(test, tk, bb, holder)
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
		await testMclassFiltering(test, tk, bb, holder)
	}
})

tape('GDC - sunburst', test => {
	const holder = getHolder()

	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		gene: 'ENST00000407796',
		tracks: [{ type: 'mds3', dslabel: 'GDC', callbackOnRender }]
	})
	async function callbackOnRender(tk, bb) {
		// Click on track variant link to open menu
		const discFound = tk.skewer.g
			.selectAll('.sja_aa_disckick')
			.nodes()
			.find(e => e.__data__.occurrence >= 10)
		test.ok(discFound, 'Found a mutation with occurrence >= 10, click on it to show sunburst')
		discFound.dispatchEvent(new Event('click'))

		const clickInfo = await detectOne({
			elem: tk.skewer.g.node(),
			selector: 'rect.sja_info_click',
			maxTime: 10000 // prod api is slow to generate sunburst data
		})
		test.ok(clickInfo, 'Info button from sunburst is found')
		clickInfo.dispatchEvent(new Event('click'))

		// Confirm sample table launched
		await whenVisible(tk.itemtip.d)
		test.pass('tk.itemtip displayed showing the sample table after clicking "Info" from sunburst')

		const table = await detectOne({ elem: tk.itemtip.dnode, selector: 'table' })
		test.ok(table, '<table> shown in itemtip after sunburst')

		/*
		such table is mutation table but not sample table
		lacks a way to test if sample table is actually shown

		TODO !!!
		find a sunburst slice >1 click to show table of multiple samples
		find a sunburst slice =1 click to show table of just 1 sample
		run sunburst with tk filter to check slice sizes are smaller than without filter
		click slice under filter to make sure it still shows sample table
		add recurrent mutation to termdbtest to reuse sunburst test
		*/

		if (test._ok) {
			holder.remove()
			tk.itemtip.d.remove()
		}
		test.end()
	}
})

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}
