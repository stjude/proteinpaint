import tape from 'tape'
import { dominantType } from '../visium.direct'

tape('\n', function (test) {
	test.comment('-***- plots/w2/visium.direct -***-')
	test.end()
})

tape('dominantType picks the largest proportion among the given types', test => {
	const props = { A: [0.2, null, 0.1], B: [0.7, null, 0.1], C: [0.1, null, 0.8] }
	test.equal(dominantType(props, 0, ['A', 'B', 'C']), 1, 'B dominates spot 0')
	test.equal(dominantType(props, 0, ['A', 'C']), 0, 'restricted to A,C: A dominates')
	test.equal(dominantType(props, 1, ['A', 'B', 'C']), -1, 'spot without proportions has no type')
	test.equal(dominantType(props, 2, ['A', 'B', 'C']), 2, 'C dominates spot 2')
	test.end()
})
