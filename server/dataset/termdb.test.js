const serverconfig = require('../src/serverconfig.js')
const fs = require('fs')
const path = require('path')

const ds = {
	isMds: true,
	cohort: {
		db: {
			file: 'files/hg38/TermdbTest/db2'
		},
		termdb: {
			survivalplot: {
				term_ids: ['efs', 'os'],
				xUnit: 'years',
				codes: [{ value: 0, name: '' }, { value: 1, name: 'censored' }]
			}
		}
	}
}

/* reason of copying db2 to server/test/testdata/:
- allow continuous integration test
- ensure TermdbTest/db2 to be fully static and recoverable, to ensure tests work as expected
*/
const srcdb = path.join(serverconfig.binpath, 'test/testdata/db2')
const destdb = path.join(serverconfig.tpmasterdir, ds.cohort.db.file)
fs.copyFileSync(srcdb, destdb)

module.exports = ds
