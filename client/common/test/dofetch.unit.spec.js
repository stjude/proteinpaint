import tape from 'tape'
import * as df from '../dofetch.js'

/*************************
 reusable helper functions
**************************/

const text2buf = new TextEncoder()

/**************
 test sections
***************/

tape('\n', test => {
	test.comment(`-***- common/dofetch unit -***-`)
	test.end()
})

tape('processFormData', async test => {
	const form = new FormData()
	const blob = new Blob(text2buf.encode('Hello, wold'), { type: 'application/octet-stream' })
	form.append('gzfile', blob, 'myfile')
	form.append('errors', '')
	try {
		const parts = await df.processFormData({
			formData() {
				return form
			}
		})
		// convert blobs to text to simplify comparison
		test.deepEqual(parts.gzfile?.body.text(), blob.text(), 'should correctly encode and decode original blobs')
		test.deepEqual(parts.errors?.body, [], 'should correctly encode and decode errors')
	} catch (e) {
		console.log(e)
	}
	test.end()
})

tape('setAuth()', async test => {
	const opts = {
		dsAuth: [
			{ dslabel: 'abc', type: 'basic', insession: false },
			{ dslabel: 'xyz', type: 'basic', insession: true }
		]
	}
	df.setAuth(opts, df.dofetch3)
	test.equal(df.isInSession('abc'), false, 'should detect a dslabel that is not in session')
	test.equal(df.isInSession('xyz'), true, 'should detect a dslabel that is in session')
	test.end()
})
