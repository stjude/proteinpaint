import tape from 'tape'
import { mayGetTkobj } from '../app.parseurl'

/* list of tests

mayGetTkobj: non-track parameters
mayGetTkobj: mds3

*/

tape('\n', function (test) {
	test.comment('-***- app.parseurl.js mayGetTkobj() -***-')
	test.end()
})

/*
const client:any = {
  tkt: {
    mds3: 'mds3',
    mdssvcnv: 'mdssvcnv',
    hicstraw: 'hicstraw',
    bam: 'bam',
    bedj: 'bedj',
    ld: 'ld',
    bigwig: 'bigwig',
    junction: 'junction'
  },
  dofetch: async (type: string, { file }: { file: string }) => {
    if (file === 'badfile') return { error: 'File not found' }
    return { text: '[{"name":"foo","type":"bam"}]' }
  }
}
  */

tape('mayGetTkobj: non-track parameters', async test => {
	test.equal(await mayGetTkobj('xxx', 'yyy'), undefined, 'returns undefined')
	test.end()
})

tape('mayGetTkobj: mds3', async test => {
	{
		const result = await mayGetTkobj('mds3', 'xxx,yyy', new Map(), null)
		test.deepEqual(
			result,
			[
				{ type: 'mds3', dslabel: 'xxx' },
				{ type: 'mds3', dslabel: 'yyy' }
			],
			'parsed two tracks'
		)
	}
	{
		const urlp = new Map([
			['filterobj', 'yy'],
			['cnvonly', '1'] // must use '1' but not 1: all array elements must have consistent type to avoid tsc error
		])
		const result = await mayGetTkobj('mds3', 'xxx', urlp, null)
		test.deepEqual(
			result,
			[{ type: 'mds3', dslabel: 'xxx', filterObj: 'yy', hardcodeCnvOnly: true }],
			'parsed 1 tk with filterObj & cnvonly'
		)
	}
	test.end()
})
