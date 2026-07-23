import * as helpers from '../../test/front.helpers.js'
import tape from 'tape'
// import { sleep, detectOne, detectGte, detectLst } from '../../test/test.helpers.js'
// import { runproteinpaint } from '#src/app'
// import { select } from 'd3-selection'

/**
 Tests:
    - No .samples[]
    - Multiple samples
    - Single .sample{}
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test',
		nav: { header_mode: 'hidden' }
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sampleView -***-')
	test.end()
})

tape('No .samples[]', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleView'
				}
			]
		},
		sampleView: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(sampleView) {
		const sv = sampleView.Inner

		const findDownloadButton = sv.dom.downloadbt.node()
		test.true(
			findDownloadButton.disabled == false && findDownloadButton.type == 'submit',
			`Should render download button.`
		)

		const labels = [
			{
				id: 'showDictionary',
				shown: true
			},
			{
				id: 'showWsi',
				shown: true
			},
			{
				id: 'showDisco',
				shown: false
			},
			{
				id: 'MethylationArray',
				shown: false
			}
		]
		const plotLabels = sv.dom.showPlotsDiv.selectAll('label').nodes()
		for (const l of plotLabels) {
			const label = labels.find(c => c.id === l.attributes.for.value)
			if (label?.shown == true) test.true(l.style.display != 'none', `Should render ${l.attributes.for.value} label.`)
			else test.true(l.style.display == 'none', `Should not render ${l.attributes.for.value} label.`)
		}

		// NOTE: disabling this test since first sample id may not have a corresponding data file?
		// const plotsDiv = sv.dom.plotsDiv
		// const firstSample = Object.keys(sv.samplesData)[0]
		// const findFirstSample = plotsDiv
		// 	.selectAll('th')
		// 	.nodes()
		// 	.some(n => n.textContent === firstSample)
		// test.ok(findFirstSample, 'Should render first sample when no samples are provided.')

		if (test['_ok']) sv.app.destroy()
		test.end()
	}
})

tape('Multiple samples', function (test) {
	test.timeoutAfter(3000)

	const samples = [
		{ sampleId: 96, sampleName: '3416' },
		{ sampleId: 41, sampleName: '2646' }
	]

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleView',
					samples
				}
			]
		},
		sampleView: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(sampleView) {
		const sv = sampleView.Inner

		const findMultiSelect = sv.dom.sampleDiv.select('select').node()
		for (const o of findMultiSelect.options) {
			const sample = samples.find(s => s.sampleName === o.text)
			test.ok(sample, `Should render ${o.text} in the multi-select.`)
		}

		const discoPlots = sv.dom.plotsDiv.selectAll('[data-testid="sjpp-disco-svgDiv"]').nodes()
		test.equal(discoPlots.length, 1, 'Should render disco plot for sample id 3416 but not 2646.')

		if (test['_ok']) sv.app.destroy()
		test.end()
	}
})

tape('Single .sample{}', function (test) {
	test.timeoutAfter(5000)

	// A single pre-chosen sample, as dispatched by the mass omnisearch's "Sample View" button and by a
	// scatter point click. Its data renders without any typing; the search box shows the sample name so
	// it does not read as "type a sample name to see details".
	const sample = { sampleId: 41, sampleName: '2646' }

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleView',
					sample
				}
			]
		},
		sampleView: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(sampleView) {
		const sv = sampleView.Inner

		const input = sv.dom.sampleDiv.select('input').node()
		test.equal(input?.value, sample.sampleName, `Should prefill the search box with ${sample.sampleName}.`)

		const findSample = sv.dom.plotsDiv
			.selectAll('th')
			.nodes()
			.some(n => n.textContent === sample.sampleName)
		test.ok(findSample, `Should render ${sample.sampleName} data without typing in the search box.`)

		if (test['_ok']) sv.app.destroy()
		test.end()
	}
})

// TODO: create a test to not allow admin session recovery by public or user
tape.skip('', function (test) {
	// const runpp = helpers.getRunPp('mass', {
	// 	state: {
	// 		dslabel: 'ProtectedTest',
	// 		genome: 'hg38-test',
	// 		nav: { header_mode: 'hidden' }
	// 	},
	// 	debug: 1
	// })
	test.end()
})
