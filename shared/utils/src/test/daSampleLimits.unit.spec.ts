import tape from 'tape'
import { maxSampleCutoff, deSampleLimit, sampleLimitAlert } from '../daSampleLimits.ts'

/* Tests
	- deSampleLimit()
	- sampleLimitAlert()
*/

tape('\n', test => {
	test.comment('-***- daSampleLimits -***-')
	test.end()
})

tape('deSampleLimit()', test => {
	test.equal(deSampleLimit('edgeR'), 500, 'edgeR => 500')
	test.equal(deSampleLimit('limma'), 500, 'limma => 500')
	test.equal(deSampleLimit('wilcoxon'), 3000, 'wilcoxon => 3,000')
	test.equal(deSampleLimit(), 3000, 'no method => the most any method allows, 3,000')
	test.equal(deSampleLimit('unknown'), 500, 'an unknown method => the lowest limit')
	test.equal(deSampleLimit('wilcoxon', 1500), 1500, 'a lower dataset limit => the dataset limit')
	test.equal(deSampleLimit('edgeR', 1500), 500, 'a higher dataset limit => the method limit')
	test.equal(deSampleLimit(undefined, 20), 20, 'no method, a low dataset limit => the dataset limit')
	test.end()
})

tape('sampleLimitAlert()', test => {
	test.equal(sampleLimitAlert(maxSampleCutoff), '', 'at the limit => no alert')
	const over = maxSampleCutoff + 1
	test.equal(
		sampleLimitAlert(over),
		`${over} samples selected exceeds the limit of ${maxSampleCutoff} per run. Please narrow the cohort.`,
		'over the limit => alert'
	)
	test.equal(
		sampleLimitAlert(30, 'cases', 20),
		'30 cases selected exceeds the limit of 20 per run. Please narrow the cohort.',
		'a lower limit and the dataset noun'
	)
	test.end()
})
