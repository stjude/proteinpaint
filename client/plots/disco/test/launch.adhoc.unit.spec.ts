import tape from 'tape'
import * as d3s from 'd3-selection'
import { launch } from '../launch.adhoc'
import { hg38 } from '../../../test/testdata/genomes'
import { detectOne } from '../../../test/test.helpers'

/*
Tests:
	- launch() renders a disco plot from custom data
*/

tape('\n', test => {
	test.comment('-***- plots/disco/launch.adhoc -***-')
	test.end()
})

tape('launch() renders a disco plot from custom data', async test => {
	const holder: any = d3s.select('body').append('div')
	const arg = {
		snvText: 'chr1\t1000000\tGENE1\tp.A1T\tMISSENSE',
		cnvText: 'chr2\t1000000\t5000000\t0.5'
	}

	try {
		await launch(arg, hg38 as any, holder)
		const svg = await detectOne({
			target: holder.node(),
			maxTime: 5000,
			selector: '[data-testid="sjpp-disco-svgDiv"] svg'
		})
		test.ok(svg, 'should render the disco plot svg')
	} catch (e: any) {
		test.fail('should not throw: ' + (e?.message || e))
	}

	const errorText = holder
		.selectAll('.sja_errorbar')
		.nodes()
		.map((n: any) => n.textContent)
		.join(' ')
		.trim()
	test.equal(errorText, '', 'should not show an error')

	if (test['_ok']) holder.remove()
	test.end()
})
