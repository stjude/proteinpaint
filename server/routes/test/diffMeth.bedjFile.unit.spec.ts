import tape from 'tape'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { writeDmrBedjFile } from '../termdb.diffMeth.ts'

/*
test sections:

writeDmrBedjFile: writes the file in the bedj cache dir; reuse touches it; no temp file is left
*/

// a 32-hex cacheId, as cacheOrRecompute generates
const name = `dmr-${'a'.repeat(32)}-5.txt`
const text = 'chr1\t900\t1000\t{"name":"a","category":"hypo"}\nchr1\t2000\t2500\t{"name":"b","category":"hyper"}\n'

tape('\n', test => {
	test.comment('-***- routes/termdb.diffMeth bedj file specs -***-')
	test.end()
})

tape('writeDmrBedjFile', async test => {
	const dir = path.join(serverconfig.cachedir, 'bedj')
	const file = path.join(dir, name)
	// made by CacheManager on server startup, which a unit test does not run
	fs.mkdirSync(dir, { recursive: true })
	fs.rmSync(file, { force: true })

	test.equal(await writeDmrBedjFile(name, text), name, 'returns the cache file name it was given')
	test.equal(fs.readFileSync(file, 'utf8'), text, 'writes the text as is in the bedj cache dir')

	const before = fs.statSync(file)
	// a past mtime, so that the touch is seen even when the two calls are within the same millisecond
	const past = new Date(before.mtimeMs - 60000)
	fs.utimesSync(file, past, past)
	test.equal(await writeDmrBedjFile(name, 'other text'), name, 'a second call returns the same file')
	const after = fs.statSync(file)
	// a rewrite renames a fresh temp file into place, which would change the inode; a touch does not
	test.equal(after.ino, before.ino, 'and does not rewrite it')
	test.ok(after.mtimeMs > past.getTime(), 'but touches mtime, so the sweep TTL means last-used')
	test.equal(fs.readFileSync(file, 'utf8'), text, 'and keeps the content')

	test.deepEqual(
		fs.readdirSync(dir).filter(f => f.startsWith('.tmp-')),
		[],
		'no temp file is left in the bedj cache dir'
	)

	fs.rmSync(file, { force: true })
	test.end()
})
