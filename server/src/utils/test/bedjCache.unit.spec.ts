import tape from 'tape'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFileSync } from 'child_process'
import serverconfig from '#src/serverconfig.js'
import { writeBedjFile } from '#src/utils/bedjCache.ts'
import { dmrBedjLines } from '#src/utils/dmrScanRows.ts'

/*
test sections:

writes a tabix-queryable file; reuse touches both files and stays readable; takes a text file; rejects a bad name
dmrBedjLines
*/

const payload: any = {
	regions: [
		{
			chr: 'chr1',
			dmrs: [
				{ chr: 'chr1', start: 2000, stop: 2500, meandiff: 0.21, no_cpgs: 8, direction: 'hyper', genes: ['AAA'] },
				// out of order on purpose: the lines must come back coordinate-sorted for tabix
				{ chr: 'chr1', start: 900, stop: 1000, meandiff: -0.3, no_cpgs: 6, direction: 'hypo' },
				// under the floor
				{ chr: 'chr1', start: 3000, stop: 3100, meandiff: 0.5, no_cpgs: 2, direction: 'hyper' }
			]
		},
		{ chr: 'chr2', dmrs: [{ chr: 'chr2', start: 10, stop: 99, meandiff: 0.1, no_cpgs: 5, direction: 'hyper' }] }
	]
}

// a 32-hex cacheId, as cacheOrRecompute generates
const cacheId = 'a'.repeat(32)
const fileName = `dmr-${cacheId}-5.gz`

tape('writeBedjFile', async test => {
	const text = dmrBedjLines(payload, 5)
	const name = await writeBedjFile(fileName, { text })
	const gz = path.join(serverconfig.cachedir, 'bedj', name)
	test.equal(name, fileName, 'returns the cache file name it was given')
	test.ok(fs.existsSync(gz) && fs.existsSync(gz + '.tbi'), 'both the file and its index are in the bedj cache dir')

	const q = (region: string) =>
		execFileSync(serverconfig.tabix, [gz, region], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)

	test.equal(q('chr1:1-10000').length, 2, 'the file is queryable by region')
	test.equal(q('chr2:1-1000').length, 1, 'other chromosomes are in the same file')

	const before = fs.statSync(gz)
	test.equal(await writeBedjFile(fileName, { text }), name, 'a second call returns the same file')
	const after = fs.statSync(gz)
	// a rebuild renames a fresh temp file into place, which would change the inode; a touch does not
	test.equal(after.ino, before.ino, 'and does not rebuild it')
	test.ok(after.mtimeMs >= before.mtimeMs, 'but touches mtime, so the sweep TTL means last-used')
	// the touch must include the index: tabix refuses one older than the data file
	test.equal(q('chr1:1-10000').length, 2, 'and the file is still queryable after the touch')

	/* The publish does not clear the destination first, so a competing writer for the same name
	replaces a file the other may already have handed to a client. That is safe only because the
	name keys the content, so the replacement is byte-identical. */
	const bytes = fs.readFileSync(gz)
	const idxBytes = fs.readFileSync(gz + '.tbi')
	for (const f of [gz, gz + '.tbi']) fs.rmSync(f, { force: true })
	await writeBedjFile(fileName, { text })
	test.equal(Buffer.compare(fs.readFileSync(gz), bytes), 0, 'an independent rewrite is byte-identical')
	test.equal(Buffer.compare(fs.readFileSync(gz + '.tbi'), idxBytes), 0, 'and so is its index')

	// same content from a plain text file rather than a string
	for (const f of [gz, gz + '.tbi']) fs.rmSync(f, { force: true })
	const src = path.join(os.tmpdir(), `bedjCacheSpec-${process.pid}.bed`)
	fs.writeFileSync(src, text)
	await writeBedjFile(fileName, { file: src })
	test.equal(Buffer.compare(fs.readFileSync(gz), bytes), 0, 'a text file input yields the same file')
	test.ok(fs.existsSync(src), 'and the source file is left in place, not consumed by bgzip')
	fs.rmSync(src, { force: true })

	for (const badName of ['dmr.bed', '../escape.gz', 'sub/dir.gz']) {
		try {
			await writeBedjFile(badName, { text })
			test.fail(`${badName} should be rejected`)
		} catch (e: any) {
			test.ok(e.message.includes('invalid bedj cache file name'), `${badName} is rejected`)
		}
	}

	for (const f of [gz, gz + '.tbi']) fs.rmSync(f, { force: true })
	test.end()
})

tape('dmrBedjLines', test => {
	const lines = dmrBedjLines(payload, 5).trim().split('\n')
	test.equal(lines.length, 3, 'the 2-CpG call is dropped by the floor of 5')
	test.deepEqual(
		lines.filter(l => l.startsWith('chr1\t')).map(l => Number(l.split('\t')[1])),
		[900, 2000],
		'lines are sorted by start, not lexically'
	)
	test.deepEqual(
		JSON.parse(lines[1].split('\t')[3]),
		{ name: 'Δβ +0.210, 8 CpGs, AAA', category: 'hyper' },
		'column 4 is the bedj item: hover label and the category the legend counts'
	)
	test.equal(
		dmrBedjLines({ regions: [] } as any, 5),
		'',
		'a scan with no calls makes an empty file, not a stray newline'
	)
	test.end()
})
