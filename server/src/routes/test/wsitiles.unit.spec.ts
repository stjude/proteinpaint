import tape from 'tape'
import serverconfig from '#src/serverconfig.js'
import { api, fileWritingActions } from '../wsitiles.ts'

/**
 * Tests
 * 		the actions that write a file, with features.disableFileCache
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- routes/wsitiles specs -***-')
	test.end()
})

tape('features.disableFileCache', async function (test) {
	const features = serverconfig.features
	serverconfig.features = { ...features, disableFileCache: true, wsi: { allowDirectSlidePath: true } }
	try {
		const handler = (api.methods.get as any).init({ genomes: {} })
		for (const action of fileWritingActions) {
			const res = fakeRes()
			await handler({ params: { action }, query: {} }, res)
			test.deepEqual(
				[res.statusCode, res.body],
				[400, { status: 'error', error: 'This server does not support this request.' }],
				`should reject the ${action} action before python runs`
			)
		}
		const res = fakeRes()
		await handler({ params: { action: 'meta' }, query: {} }, res)
		test.notEqual(res.statusCode, 400, 'should not reject an action that writes no file')
	} finally {
		serverconfig.features = features
	}
	test.end()
})

function fakeRes() {
	const res: any = {
		status(code) {
			res.statusCode = code
			return res
		},
		send(body) {
			res.body = body
			return res
		}
	}
	return res
}
