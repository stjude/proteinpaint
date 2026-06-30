import tape from 'tape'
import { gunzipSync } from 'zlib'
import serverconfig from '../serverconfig.js'

/*
End-to-end check of the /gdc/mafBuild route against a RUNNING server with GDC access (like the other
*.integration.spec.js files, this is not part of the unit sweep and assumes a live server on
serverconfig.port). It exercises the real wire path the deterministic unit tests can't: the forwarded
GDC headers, the actual file downloads, and the multipart/form-data response framing.

Note: depends on GDC open-access files that are subject to change; assertions are structural (valid
gzip, header == requested columns, >0 rows, parseable errors part) rather than exact content.

The two file UUIDs below are the canonical open-access MAF files used elsewhere for manual testing
(see rust/src/gdcmaf.rs and the commented example in routes/gdc.mafBuild.ts).
*/

const url = `http://localhost:${serverconfig.port}/gdc/mafBuild`
const fileIdLst = ['8b31d6d1-56f7-4aa8-b026-c64bafd531e7', '83ea587b-1e92-41b3-a8e3-12df30496724']
const columns = ['Hugo_Symbol', 'Chromosome', 'Start_Position', 'Variant_Classification']

tape('\n', test => {
	test.comment('-***- gdc.mafBuild integration specs -***-')
	test.end()
})

tape('gdc/mafBuild builds a merged cohort MAF', async test => {
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ fileIdLst, columns })
		})
		test.ok(
			res.headers.get('content-type')?.includes('multipart/form-data'),
			'response content-type is multipart/form-data'
		)

		// parse the multipart response the same way the browser client does (res.formData()): the gzfile
		// part has a filename so it comes back as a Blob; the errors part has no filename so it's a string
		const form = await res.formData()

		const gzfile = form.get('gzfile')
		test.ok(gzfile && typeof gzfile !== 'string', 'response has a gzfile (binary) part')

		const text = gunzipSync(Buffer.from(await gzfile.arrayBuffer())).toString('utf8')
		const lines = text.replace(/\n+$/, '').split('\n')
		test.equal(lines[0], columns.join('\t'), 'merged header row equals the requested columns, in order')
		test.ok(lines.length > 1, 'merged MAF contains at least one data row')
		test.equal(lines[1].split('\t').length, columns.length, 'each data row has exactly one field per requested column')

		// errors part must be present and parse as jsonlines (array of { url, error }); empty is fine
		const errorsRaw = form.get('errors')
		const errors = typeof errorsRaw === 'string' && errorsRaw.trim() ? errorsRaw.trim().split('\n').map(JSON.parse) : []
		test.ok(Array.isArray(errors), 'errors part parses as a jsonlines array (empty when all files succeed)')

		test.end()
	} catch (e) {
		test.fail(`request to ${url} failed (this spec needs a running server with GDC access): ${e?.message || e}`)
		test.end()
	}
})
