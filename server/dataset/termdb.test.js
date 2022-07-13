const serverconfig = require('../src/serverconfig.js')
const fs = require('fs')
const path = require('path')

/*
this will automatically create path under tp/ if missing,
and copy over the sqlite db file from repo to tp/ path

reason:
- db2 file is anonymized and unindentifiable
- allow continuous integration test (future todo)
- ensure TermdbTest/db2 to be fully static and recoverable, to ensure tests work as expected

to enable this dataset on your pp instance, have this entry in hg38 datasets array of your "serverconfig.json":

 { "name": "TermdbTest", "jsfile": "./dataset/termdb.test.js" }

test with survival plot:

http://localhost:3000/?noheader=1&mass={"dslabel":"TermdbTest","genome":"hg38","plots":[{"chartType":"survival","term2":{"id":"diaggrp"},"term":{"id":"efs"}}]}

(this ensures better-sqlite3 and R works on your pp instance)
*/

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

const datadir = path.join(serverconfig.tpmasterdir, 'files/hg38/TermdbTest')
if (!fs.existsSync(datadir)) fs.mkdirSync(datadir) // create missing path

const srcdb = path.join(serverconfig.binpath, 'test/testdata/db2')
const destdb = path.join(serverconfig.tpmasterdir, ds.cohort.db.file)
fs.copyFileSync(srcdb, destdb)

module.exports = ds
