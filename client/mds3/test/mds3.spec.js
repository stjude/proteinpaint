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

tape('Run GDC dataset, KRAS', t => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		gene: 'kras',
		tracks: [{ type: 'mds3', dslabel: 'GDC' }],
		onloadalltk_always: test
	})
	function test(bb) {
		// bb is the block instance

		t.equal(bb.tklst.length, 2, 'should have two tracks')

		const mtk = bb.tklst.find(i => i.type == 'mds3')
		t.ok(mtk, 'type=mds3 track should be found')

		// test number of dots

		// ... more tests

		t.end()
		holder.remove()
	}
})

tape('Run GDC dataset via gene symbol, ensembl ID and RefSeq ID', async test => {
	test.timeoutAfter(8000)
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
			// onloadalltk_always: checkGeneTrack ****This does not work
		})

		// function checkGeneTrack() {
		// 	No tests pass because test.end() is called outside the for..of loop
		// }

		await sleep(2300)
		const geneFound = [...holder.querySelectorAll('span')].some(elem =>
			elem.innerText == g.isoform ? `${g.gene} ${g.isoform}` : `${g.gene}`
		)
		test.true(geneFound, `Should render ${g.isoform || g.gene} track`)

		if (test._ok) holder.remove()
	}

	test.end()
})

tape('Launch GDC dataset by SSM ID, KRAS', test => {
	test.timeoutAfter(10000)
	const holder = getHolder()

	runproteinpaint({
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
		],
		onloadalltk_always: checkTrack
	})

	function checkTrack(bb) {
		test.equal(bb.tklst.length, 2, 'should have two tracks')

		const GDCtrack = bb.tklst.find(i => i.dslabel == 'GDC')
		test.ok(GDCtrack, 'Should render KRAS track from GDC dataset')

		const mds3Track = bb.tklst.find(i => i.type == 'mds3')
		test.ok(mds3Track, 'Should render mds3 KRAS track with focused G12V mutation')

		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Render gene track from search box, KRAS', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()

	await runproteinpaint({
		holder,
		noheader: 1,
		geneSearch4GDCmds3: true
		// onloadalltk_always: checkSearchBox ****This does not work
	})

	// function checkSearchBox() {
	// 	console.log('This callback works without tracks')
	// }

	await sleep(1000)

	//Enter KRAS into search box
	const searchBox = d3s.select('input')._groups[0][0]
	searchBox.value = 'KRAS'
	searchBox.dispatchEvent(new Event('keyup'))

	//Click on first menu option -> 'KRAS'
	await sleep(1000)
	const geneFoundInMenu = d3.select('div.sja_menuoption')._groups[0][0]
	geneFoundInMenu.dispatchEvent(new Event('click'))

	//Verify track renders
	await sleep(3000)
	const geneTrackFound = [...holder.querySelectorAll('span.sja_clbtext')].some(
		elem => elem.innerText == 'KRAS ENST00000256078'
	)
	test.true(geneTrackFound, `Should render default KRAS ENST00000256078 track`)

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
		test.equal(bb.tklst.length, 2, 'should have two tracks')

		test.ok(bb.usegm.name == 'BCR', 'Should render BCR track')

		const GDCtrack = bb.tklst.find(i => i.dslabel == 'ASH')
		test.ok(GDCtrack, 'Should render BCR track from ASH dataset')

		const mds3Track = bb.tklst.find(i => i.type == 'mds3')
		test.ok(mds3Track, 'Should render mds3 BCR track with focused G12V mutation')

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
		//Confirm mds3 track
		const mds3Track = bb.tklst.find(i => i.type == 'mds3')
		test.ok(mds3Track, 'Should render custom dataset mds3 track')

		//Confirm number of custom variants matches in block instance
		test.equal(
			bb.tklst[0].custom_variants.length,
			custom_variants.length,
			`Should render ${custom_variants.length} custom variants`
		)

		for (const variant of custom_variants) {
			//Test all custom variant entries successfully passed to block instance
			const variantFound = bb.tklst[0].custom_variants.find(i => i.mname == variant.mname)
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
		//Confirm mds3 track
		const mds3Track = bb.tklst.find(i => i.type == 'mds3')
		test.ok(mds3Track, 'Should render custom dataset')

		const variantNum = new Set()
		for (const variant of custom_variants) {
			//Test all custom variant entries successfully passed to block instance
			const variantFound = bb.tklst[0].custom_variants.find(i => i.mname == variant.mname)
			test.ok(variantFound, `Should render data point for ${variant.mname}`)

			variantNum.add(variant.mname)

			//Test number of samples passed to block
			if (variant.samples) {
				test.equal(
					variantFound.samples.length,
					variant.samples.length,
					`Should render ${variant.samples.length} sample(s) for ${variant.mname}`
				)
			}
		}

		//Confirm number of custom variants matches in block instance
		test.equal(bb.tklst[0].custom_variants.length, variantNum.size, `Should render ${variantNum.size} custom variants`)

		if (test._ok) holder.remove()
		test.end()
	}
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
		test.ok(mds3Track, 'Should render custom dataset')

		//Confirm number of custom variants matches in block instance
		test.equal(
			bb.tklst[0].custom_variants.length,
			custom_variants.length,
			`Should render ${custom_variants.length} custom variants`
		)

		for (const variant of custom_variants) {
			//Test all custom variant entries successfully passed to block instance
			const variantFound = bb.tklst[0].custom_variants.find(i => i.mname == variant.mname)
			test.ok(variantFound, `Should render data point for ${variant.mname}`)
		}

		for (const skewer of skewerModes) {
			//Test numeric skewers successfully passed to block instance
			if (skewer.type == 'numeric') {
				const skewerFound = bb.tklst[0].skewer.viewModes.find(i => i.byAttribute == skewer.byAttribute)
				test.ok(skewerFound, `Should provide numeric option for ${skewer.label}`)
			}
		}
		test.end()
	}
})
