import tape from 'tape'
import serverconfig from '../serverconfig.js'

// Note: these integration tests are dependant on clinical datasets that are subject to change.

tape('\n', test => {
	test.comment('-***- R scripts integration specs -***-')
	test.end()
})

// Test the integration of km.R
tape('km.R integration', test => {
	fetch(`http://localhost:${serverconfig.port}/mdssurvivalplot`, {
		method: 'POST',
		body: JSON.stringify({
			genome: 'hg19',
			dslabel: 'Pediatric2',
			type: 'efs',
			samplerule: {
				full: { byattr: 1, key: 'diagnosis_short', value: 'AML' },
				set: {
					geneexpression: 1,
					byquartile: 1,
					against1st: 1,
					gene: 'MDM2',
					chr: 'chr12',
					start: 69201951,
					stop: 69244466
				}
			}
		})
	})
		.then(res => res.json())
		.then(obj => {
			test.deepEqual(
				obj.samplesets.slice(1).map(i => i.pvalue),
				[0.5, 0.007, 0.2],
				'should match expected output'
			)
			test.end()
		})
})
