import tape from 'tape'
import { getStrawArgs, validHicPos, validChrlst, MAX_CHRLST } from '#src/utils/hicStraw.ts'

/*
test sections:

getStrawArgs(): matrixType, nmeth, resolution
validHicPos(): chr or chr:start:stop
validChrlst(): array of chromosome names, length cap
*/

tape('\n', test => {
	test.comment('-***- utils/hicStraw specs -***-')
	test.end()
})

tape('getStrawArgs()', test => {
	test.deepEqual(
		getStrawArgs({ resolution: 1000000 }),
		{ strawMatrixType: 'observed', nmeth: 'NONE', resolution: '1000000' },
		'should default to observed and NONE'
	)
	test.deepEqual(
		getStrawArgs({ matrixType: 'log(oe)', nmeth: 'VC_SQRT', resolution: '5000' }),
		{ strawMatrixType: 'oe', nmeth: 'VC_SQRT', resolution: '5000' },
		'should convert log(oe) to oe and accept a string resolution from a GET request'
	)
	for (const matrixType of ['norm', '-o', ['observed']])
		test.throws(
			() => getStrawArgs({ matrixType, resolution: 5000 }),
			/invalid matrixType/,
			`should reject matrixType=${matrixType}`
		)
	for (const nmeth of ['-h', 'kr', 'KR X', ['KR'], 'A'.repeat(33)])
		test.throws(() => getStrawArgs({ nmeth, resolution: 5000 }), /invalid nmeth/, `should reject nmeth=${nmeth}`)
	for (const resolution of [undefined, 0, -5000, 1.5, '5000x', '-5'])
		test.throws(() => getStrawArgs({ resolution }), /invalid resolution/, `should reject resolution=${resolution}`)
	test.end()
})

tape('validHicPos()', test => {
	for (const pos of ['chr1', '1', 'chrX:100:200', 'chr1:0:1000.5', 'chrUn_KI270302v1'])
		test.equal(validHicPos(pos), pos, `should accept pos=${pos}`)
	for (const pos of ['', '-chr1', 'chr1:200:100', 'chr1:100', 'chr1:-1:100', 'chr1:1:2:3', 'chr 1', 'chr1:a:b', 5])
		test.throws(() => validHicPos(pos), /invalid/, `should reject pos=${pos}`)
	test.end()
})

tape('validChrlst()', test => {
	test.deepEqual(validChrlst(['chr1', 'chr2', 'chrX']), ['chr1', 'chr2', 'chrX'], 'should accept chromosome names')
	for (const chrlst of [undefined, 'chr1', [], ['chr1', '-o'], ['chr1', 'chr1'], ['chr1', 2]])
		test.throws(() => validChrlst(chrlst), `should reject chrlst=${JSON.stringify(chrlst)}`)
	const tooMany = Array.from({ length: MAX_CHRLST + 1 }, (_, i) => 'chr' + i)
	test.throws(() => validChrlst(tooMany), /more than/, `should reject more than ${MAX_CHRLST} chromosomes`)
	test.end()
})
