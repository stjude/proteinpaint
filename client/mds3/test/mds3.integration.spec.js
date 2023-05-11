const tape = require('tape')
const d3s = require('d3-selection')
const { detectOne, detectGte } = require('../../test/test.helpers')
const { runproteinpaint } = require('../../test/front.helpers.js')

/*
Tests:  
    TP53 with hg38-test and custom data
    Custom variants, missing or invalid mclass
    Custom dataset with custom variants, WITH samples
	Custom data with samples and sample selection
*/

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
***************/

tape('\n', function(test) {
	test.pass('-***- mds3 -***-')
	test.end()
})

tape('TP53 with hg38-test and custom data', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const opts = {
		gene: 'TP53',
		name: 'TP53 hg38-test',
		custom_variants: [
			{ chr: 'chr17', pos: 7675993, mname: 'point 1', class: 'M', dt: 1 },
			{ chr: 'chr17', pos: 7676520, mname: 'point 2', class: 'M', dt: 1 },
			{ chr: 'chr17', pos: 7676381, mname: 'point 3', class: 'M', dt: 1 }
			// { chr: 'chr17', pos: 7675052, mname: 'point 4', class: 'E', dt: 1 },
			// { chr: 'chr17', pos: 7674858, mname: 'point 5', class: 'E', dt: 1 },
			// { chr: 'chr17', pos: 7674180, mname: 'point 6', class: 'F', dt: 1 },
			// { chr: 'chr17', pos: 7673700, mname: 'point 7', class: 'F', dt: 1 },
			// { chr: 'chr17', pos: 7673534, mname: 'point 8', class: 'I', dt: 1 }
		]
	}

	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38-test',
		gene: opts.gene,
		tracks: [
			{
				type: 'mds3',
				name: opts.name,
				custom_variants: opts.custom_variants,
				callbackOnRender
			}
		]
	})

	function callbackOnRender(tk, bb) {
		// Test mds3 is a track object and bb is block object
		test.equal(bb.usegm.name, opts.gene, `Should render block.usegm.name = ${opts.gene}`)
		test.equal(bb.tklst.length, 2, 'Should have two tracks')
		test.ok(tk.skewer.rawmlst.length > 0, 'Should load mds3 tk with at least 1 data point')

		//Confirm number of custom variants matches in block instance
		test.equal(
			tk.custom_variants.length,
			opts.custom_variants.length,
			`Should render total # of custom variants = ${opts.custom_variants.length}`
		)

		const classes2Check = new Set() //for legend testing below
		for (const variant of opts.custom_variants) {
			classes2Check.add(variant.class)
			//Test all custom variant entries successfully passed to block instance
			const variantFound = tk.custom_variants.find(i => i.mname == variant.mname)
			test.ok(variantFound, `Should render data point for ${variant.mname}`)
		}

		/*** Verify all ui parts are rendered ***/
		//Left labels
		test.ok(tk.leftlabels.doms.variants, 'Should render tk.leftlabels.doms.variants')
		test.notOk(tk.leftlabels.doms.filterObj, 'Should NOT render tk.leftlabels.doms.filterObj')
		test.notOk(tk.leftlabels.doms.close, 'Should NOT render tk.leftlabels.doms.close')

		//Legend
		test.equal(
			tk.tr_legend.node().querySelectorAll('td')[0].innerText,
			opts.name,
			`Should pass custom name = ${opts.name} to legend`
		)
		for (const mutClass of classes2Check) {
			const legendArray = tk.legend.mclass.currentData.find(d => d[0] == mutClass)
			const samples2check = opts.custom_variants.filter(d => d.class == mutClass)
			test.equal(
				legendArray[1],
				samples2check.length,
				`Should pass ${samples2check.length} data points to legend for ${mutClass} class`
			)
		}

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
				custom_variants: custom_variants,
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

tape('Custom dataset with custom variants, WITH samples', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	const custom_variants = [
		{ chr: 'chr17', pos: 7675993, mname: 'point 1', class: 'M', dt: 1, sample: 'sample 1' },
		{ chr: 'chr17', pos: 7676520, mname: 'point 2', class: 'M', dt: 1, sample: 'sample 2' },
		{ chr: 'chr17', pos: 7676381, mname: 'point 3', class: 'M', dt: 1, sample: 'sample 1' }
	]

	runproteinpaint({
		holder,
		parseurl: true,
		nobox: true,
		noheader: true,
		genome: 'hg38-test',
		gene: 'TP53',
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
				allow2selectSamples: {
					buttonText, // hardcoded text should show in selection button
					callback: () => {}
				}
			}
		],
		onloadalltk_always: checkTrack
	})
	async function checkTrack(bb) {
		const tk = bb.tklst.find(i => i.type == 'mds3')
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
