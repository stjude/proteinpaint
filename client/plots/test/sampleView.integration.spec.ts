import * as helpers from '../../test/front.helpers.js'
import tape from 'tape'
// import { sleep, detectOne, detectGte, detectLst } from '../../test/test.helpers.js'
// import { runproteinpaint } from '#src/app'
// import { select } from 'd3-selection'

/**
 Tests:
    - No .samples[]
    - Multiple samples
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
		{ sampleId: 3416, sampleName: '3416' },
		{ sampleId: 2646, sampleName: '2646' }
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

		const discoPlots = sv.dom.plotsDiv.selectAll('#sjpp_disco_plot_holder_div').nodes()
		test.equal(discoPlots.length, 1, 'Should render disco plot for sample id 3416 but not 2646.')

		if (test['_ok']) sv.app.destroy()
		test.end()
	}
})
