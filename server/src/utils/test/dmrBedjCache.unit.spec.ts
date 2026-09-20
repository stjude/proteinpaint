import tape from 'tape'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import serverconfig from '#src/serverconfig.js'
import { writeDmrBedjFile, assertDmrBedjAccess } from '#src/utils/dmrBedjCache.ts'

/*
test sections:

writes a tabix-queryable file; the CpG floor drops calls; a reuse touches both files and stays readable
a cached file is refused under a dataset it was not computed for
*/

const payload: any = {
	regions: [
		{
			chr: 'chr1',
			dmrs: [
				{ chr: 'chr1', start: 2000, stop: 2500, meandiff: 0.21, no_cpgs: 8, direction: 'hyper', genes: ['AAA'] },
				// out of order on purpose: the file must come back coordinate-sorted for tabix
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

tape('writeDmrBedjFile', async test => {
	const name = await writeDmrBedjFile(payload, 'hg38', 'MMRF', cacheId, 5)
	const gz = path.join(serverconfig.cachedir, 'bedj', name)
	test.ok(name.endsWith(`-${cacheId}-5.gz`), 'file is named for the scan and its CpG floor')
	test.ok(fs.existsSync(gz) && fs.existsSync(gz + '.tbi'), 'both the file and its index are in the bedj cache dir')

	const q = (region: string) =>
		execFileSync(serverconfig.tabix, [gz, region], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)

	const chr1 = q('chr1:1-10000')
	test.equal(chr1.length, 2, 'the 2-CpG call is dropped by the floor of 5')
	test.deepEqual(
		chr1.map(l => Number(l.split('\t')[1])),
		[900, 2000],
		'lines are sorted by start, not lexically'
	)
	test.deepEqual(
		JSON.parse(chr1[1].split('\t')[3]),
		{ name: 'Δβ +0.210, 8 CpGs, AAA', category: 'hyper' },
		'column 4 is the bedj item: hover label and the category the legend counts'
	)
	test.equal(q('chr2:1-1000').length, 1, 'other chromosomes are in the same file')

	const before = fs.statSync(gz)
	test.equal(await writeDmrBedjFile(payload, 'hg38', 'MMRF', cacheId, 5), name, 'a second call returns the same file')
	const after = fs.statSync(gz)
	// a rebuild renames a fresh temp file into place, which would change the inode; a touch does not
	test.equal(after.ino, before.ino, 'and does not rebuild it')
	test.ok(after.mtimeMs >= before.mtimeMs, 'but touches mtime, so the sweep TTL means last-used')
	// the touch must include the index: tabix refuses one older than the data file
	test.equal(q('chr1:1-10000').length, 2, 'and the file is still queryable after the touch')

	/* The publish does not clear the destination first, so a competing writer for the same scan
	replaces a file the other may already have handed to a client. That is safe only because the
	content is a pure function of what names the file, so the replacement is byte-identical. */
	const bytes = fs.readFileSync(gz)
	const idxBytes = fs.readFileSync(gz + '.tbi')
	for (const f of [gz, gz + '.tbi']) fs.rmSync(f, { force: true })
	await writeDmrBedjFile(payload, 'hg38', 'MMRF', cacheId, 5)
	test.equal(Buffer.compare(fs.readFileSync(gz), bytes), 0, 'an independent rewrite is byte-identical')
	test.equal(Buffer.compare(fs.readFileSync(gz + '.tbi'), idxBytes), 0, 'and so is its index')

	for (const f of [gz, gz + '.tbi']) fs.rmSync(f, { force: true })
	test.end()
})

tape('assertDmrBedjAccess', async test => {
	const name = `dmr-${'a'.repeat(8)}-${cacheId}-5.gz`
	const owner = await writeDmrBedjFile(payload, 'hg38', 'MMRF', cacheId, 5)
	fs.rmSync(path.join(serverconfig.cachedir, 'bedj', owner), { force: true })
	fs.rmSync(path.join(serverconfig.cachedir, 'bedj', owner + '.tbi'), { force: true })

	test.doesNotThrow(
		() => assertDmrBedjAccess(owner, { genome: 'hg38', dslabel: 'MMRF' }),
		'the dataset it was computed for is served'
	)
	test.throws(
		() => assertDmrBedjAccess(owner, { genome: 'hg38', dslabel: 'SomeOtherDs' }),
		/does not belong/,
		'the same name replayed under another dataset is refused'
	)
	test.throws(
		() => assertDmrBedjAccess(owner, { genome: 'hg38' }),
		/required/,
		'a request naming no dataset is refused'
	)
	test.doesNotThrow(
		() => assertDmrBedjAccess('someothertrack.gz', {}),
		'a cached file that is not a DMR scan is left alone'
	)
	test.notEqual(name, owner, 'the dataset token is part of the name')
	test.end()
})
