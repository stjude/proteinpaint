import tape from 'tape'
import { maxSampleCutoff, sampleLimitAlert } from '../daSampleLimits.ts'

/* Tests
	- sampleLimitAlert()
*/

tape('\n', test => {
	test.comment('-***- daSampleLimits -***-')
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
