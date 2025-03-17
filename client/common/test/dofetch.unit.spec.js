import tape from 'tape'
import { processFormData } from '../dofetch.js'

/*************************
 reusable helper functions
**************************/

const text2buf = new TextEncoder()

/**************
 test sections
***************/

tape('processFormData', async test => {
	const form = new FormData()
	const blob = new Blob(text2buf.encode('Hello, wold'), { type: 'application/octet-stream' })
	form.append('gzfile', blob, 'myfile')
	form.append('errors', '')
	try {
		const parts = await processFormData({
			formData() {
				return form
			}
		})
		// console.log(115, parts, bin0.orig)
		test.deepEqual(parts.gzfile?.body.text(), blob.text(), 'should correctly encode and decode original blobs')
		test.deepEqual(parts.errors?.body, [], 'should correctly encode and decode errors')
	} catch (e) {
		console.log(e)
	}
	test.end()
})
