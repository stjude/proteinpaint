import tape from 'tape'
import { formatElapsedTime } from '../time'

tape('\n', function (test) {
	test.comment('-***- formatElapsedTime specs -***-')
	test.end()
})

tape('formatElapsedTime - less than 1 second', t => {
	t.equal(formatElapsedTime(0), '0ms', 'should format 0 milliseconds')
	t.equal(formatElapsedTime(1), '1ms', 'should format 1 millisecond')
	t.equal(formatElapsedTime(500), '500ms', 'should format 500 milliseconds')
	t.equal(formatElapsedTime(999), '999ms', 'should format 999 milliseconds')
	t.end()
})

tape('formatElapsedTime - between 1 second and 1 minute', t => {
	t.equal(formatElapsedTime(1000), '1.00s', 'should format 1 second')
	t.equal(formatElapsedTime(1500), '1.50s', 'should format 1.5 seconds')
	t.equal(formatElapsedTime(10250), '10.25s', 'should format 10.25 seconds')
	t.equal(formatElapsedTime(59999), '60.00s', 'should format 60 seconds')
	t.end()
})

tape('formatElapsedTime - greater than or equal to 1 minute', t => {
	t.equal(formatElapsedTime(60000), '1m 0.00s', 'should format 1 minute')
	t.equal(formatElapsedTime(90000), '1m 30.00s', 'should format 1 minute 30 seconds')
	t.equal(formatElapsedTime(120500), '2m 0.50s', 'should format 2 minutes 0.5 seconds')
	t.equal(formatElapsedTime(3723000), '62m 3.00s', 'should format 62 minutes 3 seconds')
	t.end()
})

tape('formatElapsedTime - edge cases', t => {
	t.equal(formatElapsedTime(-1), '-1ms', 'should handle negative time')
	t.equal(formatElapsedTime(NaN), 'Invalid time: NaN', 'should handle NaN')
	t.end()
})

tape('formatElapsedTime - type handling', t => {
	t.equal(formatElapsedTime('1000' as unknown as number), 'Invalid time: not a number', 'should reject string inputs')
	t.equal(formatElapsedTime(null as unknown as number), 'Invalid time: not a number', 'should reject null')
	t.equal(formatElapsedTime(undefined as unknown as number), 'Invalid time: not a number', 'should reject undefined')
	t.equal(formatElapsedTime({} as unknown as number), 'Invalid time: not a number', 'should reject objects')
	t.equal(formatElapsedTime(Infinity), 'Infinite time', 'should handle positive infinity')
	t.equal(formatElapsedTime(-Infinity), '-Infinite time', 'should handle negative infinity')
	t.end()
})
