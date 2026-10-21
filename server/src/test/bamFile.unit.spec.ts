import tape from 'tape'
import fs from 'fs'
import http from 'http'
import path from 'path'
import zlib from 'zlib'
import { spawnSync } from 'child_process'
import type { AddressInfo } from 'net'
import serverconfig from '#src/serverconfig.js'
import {
	depthExcludedFlags,
	forEachDepth,
	isBamTruncated,
	listBamChrs,
	readBamRecords,
	RegionDepth,
	samLine,
	scanBamRecords,
	scanWindow
} from '#src/bamFile.ts'
import { urlRequest } from '#src/indexedFile.ts'
import { bam_ifnochr, cache_index } from '#src/utils.js'

/*
test sections:

readBamRecords() and samLine(): regions of a local file, as samtools view
forEachDepth(): as samtools depth
readBamRecords(): a whole file, and a truncated file
readBamRecords(): a region of a file without an index
scanBamRecords(): the windows and batches of a scan
RegionDepth: the blocks of the depth
isBamTruncated(), as samtools quickcheck
listBamChrs() and bam_ifnochr()
the index of a local file
rejected arguments
a url file
the same reads as samtools, when samtools is installed

files/hg38/bam/edge.bam has a read of each case that the reads must handle on chr17 from 7669950, such as a read of
each flag, of a deletion, skip, insertion, clips, =/X, no seq or qual, an unmapped read that is placed at its mate,
and a mate on chr1; then 600 reads from 7680001, so that the file has several bgzf blocks; and an unplaced read at
the end. edge.bam.samtools.json has what samtools 1.24 prints for regions of the file, the first 11 fields of view
and the depth -g DUP of each set of the -G flags. csi/edge.bam.csi is a csi index of edge.bam.
*/

const tp = path.resolve(serverconfig.tpmasterdir)
const cache = path.resolve(serverconfig.cachedir)
const edge = path.join(tp, 'files/hg38/bam/edge.bam')
const edgeCsi = path.join(tp, 'files/hg38/bam/csi/edge.bam.csi')
const trackLstBam = path.join(tp, 'files/hg38/TermdbTest/trackLst/bam.bam')
const expected = JSON.parse(fs.readFileSync(edge + '.samtools.json', 'utf8'))
const samtools = 'samtools'
const hasSamtools = spawnSync(samtools, ['--version']).status === 0

/** the region of readBamRecords(), which is 0-based and half-open, of chr:start-stop as samtools reads it */
function toRegion(r: string) {
	const [chr, se] = r.split(':')
	const [start, stop] = se.split('-').map(Number)
	return { chr, start: start - 1, end: stop }
}

async function view(
	file: string,
	region?: string | null,
	dir?: string | null,
	withoutIndex = false
): Promise<string[]> {
	const { records, refNames } = await readBamRecords({
		file,
		dir,
		region: region ? toRegion(region) : null,
		withoutIndex
	})
	return records.map(r => samLine(r, refNames))
}

/** the [position, depth] of each position of forEachDepth(), as samtools depth prints them, with a 0-based position */
async function depth(file: string, region: string, excludedFlags: number, withoutIndex = false): Promise<number[][]> {
	const reads = await readBamRecords({ file, region: toRegion(region), withoutIndex })
	const out: number[][] = []
	forEachDepth(reads, toRegion(region), excludedFlags, (p, d) => out.push([p, d]))
	return out
}

/** the excluded flags of forEachDepth() of each key of expected depth, the -G flags of samtools depth -g DUP */
const depthFlags = { none: 0, '0x400': 0x400, '0x800': 0x800, '0xC00': 0xc00 }

async function rejects(test, fn: () => Promise<unknown>, pattern: RegExp, msg: string) {
	try {
		await fn()
		test.fail(msg)
	} catch (e) {
		test.match(String(e), pattern, msg)
	}
}

/** a bgzf block of data, which is a gzip member with the BC extra field of its size */
function bgzfBlock(data: Buffer): Buffer {
	const gz = zlib.gzipSync(data)
	const header = Buffer.from([31, 139, 8, 4, 0, 0, 0, 0, 0, 255, 6, 0, 66, 67, 2, 0, 0, 0])
	header.writeUInt16LE(header.length + gz.length - 10 - 1, 16)
	return Buffer.concat([header, gz.subarray(10)])
}

const bgzfEof = Buffer.from('1f8b08040000000000ff0600424302001b0003000000000000000000', 'hex')

/** a temp dir under cachedir, which is a root of a local file */
function tempDir() {
	return fs.mkdtempSync(path.join(cache, 'pp-bam-'))
}

tape('\n', test => {
	test.comment('-***- bamFile specs -***-')
	test.end()
})

tape('readBamRecords() and samLine(): regions of a local file, as samtools view', async test => {
	for (const [region, e] of Object.entries<any>(expected.regions)) {
		test.deepEqual(await view(edge, region), e.view, `should read the sam lines of ${region}`)
	}
	test.deepEqual(
		await view('files/hg38/bam/edge.bam', 'chr17:7670001-7670500'),
		expected.regions['chr17:7670001-7670500'].view,
		'should read a relative path under tp'
	)
	test.deepEqual(
		await view(edge, 'chr17:7670001-7670500', ''),
		expected.regions['chr17:7670001-7670500'].view,
		'should read a local file with an empty dir'
	)
	const lines = await view(edge, 'chr17:7670001-7670500')
	const line = (name: string) => lines.find(l => l.startsWith(name + '\t'))?.split('\t')
	test.deepEqual(line('noseq')?.slice(9), ['*', '*'], 'should print * for no seq and qual')
	test.equal(line('noqual')?.[10], '*', 'should print * for no qual')
	test.equal(line('mq255')?.[4], '255', 'should print a mapping quality of 255')
	test.deepEqual(
		line('otherchr')?.slice(6, 8),
		['chr1', '1000'],
		'should print the chromosome of a mate on another one'
	)
	test.ok(
		lines.some(l => l.startsWith('mateunmapped\t133\tchr17\t7670301\t0\t*\t=')),
		'should read an unmapped read that is placed at its mate'
	)
	test.end()
})

tape('forEachDepth(): as samtools depth', async test => {
	test.equal(depthExcludedFlags, 0x4 | 0x100 | 0x200, 'should exclude the reads that samtools depth -g DUP excludes')
	for (const [region, e] of Object.entries<any>(expected.regions)) {
		for (const [key, flags] of Object.entries(depthFlags)) {
			test.deepEqual(
				await depth(edge, region, depthExcludedFlags | flags),
				e.depth[key],
				`should have the depth of ${region} with -G ${key}`
			)
		}
	}
	const reads = await readBamRecords({ file: edge, region: toRegion('chr17:7670101-7670160') })
	const none: number[] = []
	forEachDepth(reads, { chr: 'chrM', start: 0, end: 100 }, 0, p => none.push(p))
	forEachDepth(reads, { chr: 'chrX', start: 0, end: 100 }, 0, p => none.push(p))
	test.deepEqual(none, [], 'should have no position on a chromosome that the reads are not on')
	test.end()
})

tape('readBamRecords(): a whole file, and a truncated file', async test => {
	const whole = await readBamRecords({ file: edge })
	test.equal(whole.records.length, 622, 'should read all the reads of a whole file')
	test.deepEqual(whole.refNames, ['chr1', 'chr17', 'chrM'], 'should have the chromosome names of the file')
	test.equal(
		samLine(whole.records.at(-1)!, whole.refNames).split('\t').slice(1, 9).join('\t'),
		'4\t*\t0\t0\t*\t*\t0\t0',
		'should read an unplaced read'
	)
	const names = whole.records.map(r => r.name)
	const dir = tempDir()
	try {
		const data = fs.readFileSync(edge)
		const noEof = path.join(dir, 'noeof.bam')
		fs.writeFileSync(noEof, data.subarray(0, data.length - bgzfEof.length))
		test.deepEqual(
			(await readBamRecords({ file: noEof })).records.map(r => r.name),
			names,
			'should read all the reads of a file without the end-of-file marker'
		)
		const cut = path.join(dir, 'cut.bam')
		fs.writeFileSync(cut, data.subarray(0, 40000))
		const cutNames = (await readBamRecords({ file: cut })).records.map(r => r.name)
		test.ok(cutNames.length > 0 && cutNames.length < names.length, 'should read the reads of a cut file')
		test.deepEqual(cutNames, names.slice(0, cutNames.length), 'should read the reads up to the cut')
		const notBam = path.join(dir, 'x.bam')
		fs.writeFileSync(notBam, bgzfBlock(Buffer.from('not a bam file')))
		await rejects(
			test,
			() => readBamRecords({ file: notBam }),
			/not a BAM file/,
			'should reject a file that is not bam'
		)
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
	test.end()
})

tape('readBamRecords(): a region of a file without an index', async test => {
	const dir = tempDir()
	try {
		// a copy that has no index next to it, such as a gdc slice
		const noIndex = path.join(dir, 'noindex.bam')
		fs.copyFileSync(edge, noIndex)
		for (const [region, e] of Object.entries<any>(expected.regions)) {
			test.deepEqual(await view(noIndex, region, null, true), e.view, `should read the sam lines of ${region}`)
			test.deepEqual(
				await depth(noIndex, region, depthExcludedFlags, true),
				e.depth.none,
				`should have the depth of ${region}`
			)
		}
		test.deepEqual(
			await view(edge, 'chr17:7670001-7670500', null, true),
			await view(edge, 'chr17:7670001-7670500'),
			'should read the same reads as the index of the file'
		)
		test.deepEqual(
			await view(noIndex, 'chr17:7670301-7670301', null, true),
			await view(edge, 'chr17:7670301-7670301'),
			'should read an unmapped read that is placed at its mate, at its position'
		)
		test.deepEqual(await view(noIndex, 'chrM:1-100', null, true), [], 'should read no read of a region without reads')

		// the regions that end at the start of a read, or start at its end, which the read does not overlap
		const whole = await readBamRecords({ file: edge })
		const edges = whole.records.filter(r => r.ref_id == 1).slice(0, 40)
		const regions = edges.flatMap(r => [
			{ chr: 'chr17', start: r.start - 10, end: r.start },
			{ chr: 'chr17', start: r.start, end: r.start + 1 },
			{ chr: 'chr17', start: r.end - 1, end: r.end },
			{ chr: 'chr17', start: r.end, end: r.end + 10 }
		])
		const names = async (region, withoutIndex) =>
			(await readBamRecords({ file: withoutIndex ? noIndex : edge, region, withoutIndex })).records.map(r => r.name)
		let same = 0
		for (const region of regions) {
			if (JSON.stringify(await names(region, true)) == JSON.stringify(await names(region, false))) same++
		}
		test.equal(same, regions.length, 'should read the same reads as the index at the ends of the reads')

		const data = fs.readFileSync(edge)
		const cut = path.join(dir, 'cut.bam')
		fs.writeFileSync(cut, data.subarray(0, 40000))
		const cutLines = await view(cut, 'chr17:7680001-7700000', null, true)
		const lines = await view(edge, 'chr17:7680001-7700000')
		test.ok(cutLines.length > 0 && cutLines.length < lines.length, 'should read the reads of a region of a cut file')
		test.deepEqual(cutLines, lines.slice(0, cutLines.length), 'should read the reads of the region up to the cut')

		await rejects(
			test,
			() => view(noIndex, 'chr2:1-100', null, true),
			/the chromosome of the region is not in the bam file/,
			'should reject a chromosome that is not in the file'
		)
		await rejects(
			test,
			() => readBamRecords({ file: noIndex, region: { chr: 'chr17', start: 10, end: 5 }, withoutIndex: true }),
			/invalid region/,
			'should reject an invalid region'
		)
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
	test.end()
})

tape('scanBamRecords(): the windows and batches of a scan', async test => {
	const { firstBytes, bytes } = scanWindow
	// a window for each base, or for each chunk of the index
	scanWindow.firstBytes = scanWindow.bytes = 1
	try {
		for (const [region, e] of Object.entries<any>(expected.regions)) {
			test.deepEqual(await view(edge, region), e.view, `should read the sam lines of ${region} in windows`)
			for (const [key, flags] of Object.entries(depthFlags)) {
				test.deepEqual(
					await depth(edge, region, depthExcludedFlags | flags),
					e.depth[key],
					`should have the depth of ${region} with -G ${key} in windows`
				)
			}
		}
		let batches = 0
		await scanBamRecords({ file: edge, region: toRegion('chr17:7670001-7670500') }, () => {
			batches++
		})
		test.ok(batches > 1, 'should read a region in several windows')
	} finally {
		Object.assign(scanWindow, { firstBytes, bytes })
	}

	const region = toRegion('chr17:7680001-7700000')
	const all = (await readBamRecords({ file: edge, region })).records.length
	// windows that start at one byte and double, up to more than the region
	Object.assign(scanWindow, { firstBytes: 1, bytes: 2 ** 30 })
	try {
		const names: string[] = []
		let batches = 0
		await scanBamRecords({ file: edge, region }, records => {
			batches++
			for (const r of records) names.push(r.name)
		})
		test.equal(names.length, all, 'should read the reads of a region in windows that double')
		test.equal(new Set(names).size, all, 'should read each read of the region once in windows that double')
		test.ok(batches > 2 && batches < 40, 'should read a region in windows that double')
	} finally {
		Object.assign(scanWindow, { firstBytes, bytes })
	}
	for (const withoutIndex of [false, true]) {
		let batches = 0
		const refNames = await scanBamRecords({ file: edge, region, withoutIndex }, records => {
			batches++
			return records.length > 0
		})
		test.equal(batches, 1, `should end the scan when the callback returns true, withoutIndex=${withoutIndex}`)
		test.deepEqual(refNames, ['chr1', 'chr17', 'chrM'], 'should return the chromosome names of the file')
	}
	test.ok(all > 1, 'should have several reads in the region of the ended scans')
	test.end()
})

tape('RegionDepth: the blocks of the depth', test => {
	// a read with 100M from 65530, across the first two blocks, and a read with 10M 5D 10N 10M from 131070, across the
	// second and third, which ends after the region; an unmapped read is excluded
	// the cigar is unsigned, as in a bam record
	const read = (start: number, cigar: [number, number][], flags = 0) =>
		({ start, flags, NUMERIC_CIGAR: Uint32Array.from(cigar.map(([len, op]) => len * 16 + op)) } as any)
	const depth = new RegionDepth({ chr: 'chr1', start: 65500, end: 131100 }, depthExcludedFlags)
	depth.add(read(65530, [[100, 0]]))
	depth.add(
		read(131070, [
			[10, 0],
			[5, 2],
			[10, 3],
			[10, 0]
		])
	)
	depth.add(read(65540, [[10, 0]], 0x4))
	const out: number[][] = []
	depth.forEach((p, d) => out.push([p, d]))
	const expected: number[][] = []
	for (let p = 65530; p < 65630; p++) expected.push([p, 1])
	for (let p = 131070; p < 131080; p++) expected.push([p, 1])
	// the deletion and the skip are printed with no depth, and the last match is up to the end of the region
	for (let p = 131080; p < 131095; p++) expected.push([p, 0])
	for (let p = 131095; p < 131100; p++) expected.push([p, 1])
	test.deepEqual(out, expected, 'should have the depth of each position across blocks, in order')

	// 1M 134217728N 1M, a length of 2^27 or more, which has the top bit of the cigar
	const longSkip = new RegionDepth({ chr: 'chr1', start: 134217727, end: 134217731 }, depthExcludedFlags)
	longSkip.add(
		read(0, [
			[1, 0],
			[134217728, 3],
			[1, 0]
		])
	)
	const longOut: number[][] = []
	longSkip.forEach((p, d) => longOut.push([p, d]))
	test.deepEqual(
		longOut,
		[
			[134217727, 0],
			[134217728, 0],
			[134217729, 1]
		],
		'should have the match after a skip with a length of 2^27'
	)
	test.end()
})

tape('isBamTruncated(), as samtools quickcheck', async test => {
	test.equal(await isBamTruncated(edge), false, 'should not find a whole file truncated')
	test.equal(
		await isBamTruncated('files/hg38/bam/edge.bam', ''),
		false,
		'should check a relative path with an empty dir'
	)
	const dir = tempDir()
	try {
		const data = fs.readFileSync(edge)
		const write = (name: string, d: Buffer) => {
			const f = path.join(dir, name)
			fs.writeFileSync(f, d)
			return f
		}
		test.equal(
			await isBamTruncated(write('noeof.bam', data.subarray(0, data.length - bgzfEof.length))),
			true,
			'should find a file without the end-of-file marker truncated'
		)
		test.equal(
			await isBamTruncated(write('cut.bam', data.subarray(0, 40000))),
			true,
			'should find a cut file truncated'
		)
		// the magic, the text length, and the number of references
		const noRef = Buffer.concat([Buffer.from('BAM\x01', 'latin1'), Buffer.alloc(8)])
		await rejects(
			test,
			() => isBamTruncated(write('noref.bam', Buffer.concat([bgzfBlock(noRef), bgzfEof]))),
			/no reference/,
			'should reject a file without a reference, as samtools quickcheck'
		)
		await rejects(
			test,
			() => isBamTruncated(write('header.bam', data.subarray(0, 30))),
			/not a BGZF stream/,
			'should reject a file that is cut in its header'
		)
		await rejects(
			test,
			() => isBamTruncated(write('text.bam', Buffer.from('hello\n'))),
			/not a BGZF stream/,
			'should reject a file that is not bgzf'
		)
		await rejects(
			test,
			() =>
				isBamTruncated(write('notbam.bam', Buffer.concat([bgzfBlock(Buffer.from('##fileformat=VCFv4.2')), bgzfEof]))),
			/not a BAM file/,
			'should reject a bgzf file that is not bam'
		)
		await rejects(
			test,
			() => isBamTruncated(path.join(dir, 'none.bam')),
			/cannot open the bam file/,
			'should reject a missing file'
		)
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
	test.end()
})

tape('listBamChrs() and bam_ifnochr()', async test => {
	test.deepEqual(await listBamChrs(edge, null, false), ['chr1', 'chr17', 'chrM'], 'should list the chromosomes')
	test.deepEqual(
		await listBamChrs(edge, null, true),
		['chr1', 'chr17', 'chrM'],
		'should list the chromosomes without the index'
	)
	const genome = { majorchr: { chr1: 248956422, chr17: 83257441 } }
	test.equal(await bam_ifnochr(edge, genome, null, false), false, 'should find the chromosome names with "chr"')
	const dir = tempDir()
	try {
		const data = fs.readFileSync(edge)
		const noEof = path.join(dir, 'noeof.bam')
		fs.writeFileSync(noEof, data.subarray(0, data.length - bgzfEof.length))
		test.deepEqual(
			await listBamChrs(noEof, null, true),
			['chr1', 'chr17', 'chrM'],
			'should list the chromosomes of a truncated file'
		)
		const header = Buffer.alloc(4)
		const refs: Buffer[] = []
		for (const [name, len] of [
			['1', 248956422],
			['17', 83257441]
		] as const) {
			const n = Buffer.alloc(4)
			n.writeInt32LE(name.length + 1)
			const l = Buffer.alloc(4)
			l.writeInt32LE(len)
			refs.push(n, Buffer.from(name + '\0'), l)
		}
		header.writeInt32LE(2)
		// a file of chromosomes without "chr", which has a header and no reads
		const nochr = path.join(dir, 'nochr.bam')
		fs.writeFileSync(
			nochr,
			Buffer.concat([bgzfBlock(Buffer.concat([Buffer.from('BAM\x01\0\0\0\0', 'latin1'), header, ...refs])), bgzfEof])
		)
		test.equal(await bam_ifnochr(nochr, genome, null, true), true, 'should find the chromosome names without "chr"')
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
	test.end()
})

tape('the index of a local file', async test => {
	const region = 'chr17:7670001-7670500'
	const lines = expected.regions[region].view
	const dir = tempDir()
	try {
		const x = path.join(dir, 'x.bam')
		fs.copyFileSync(edge, x)
		await rejects(
			test,
			() => view(x, region),
			/cannot find the index of the bam file/,
			'should reject a file without an index'
		)
		fs.copyFileSync(edge + '.bai', path.join(dir, 'x.bai'))
		test.deepEqual(await view(x, region), lines, 'should read with x.bai, as htslib finds it')
		fs.copyFileSync(edgeCsi, x + '.csi')
		test.deepEqual(await view(x, region), lines, 'should read with x.bam.csi')
		test.deepEqual(
			await view(x, 'chr17:7680001-7680050'),
			expected.regions['chr17:7680001-7680050'].view,
			'should read another region with x.bam.csi'
		)
		fs.rmSync(x + '.csi')
		// htslib looks for x.csi before x.bam.bai, and rejects a file with such an index that it cannot load
		fs.copyFileSync(edge + '.bai', x + '.bai')
		fs.writeFileSync(path.join(dir, 'x.csi'), 'not an index')
		await rejects(test, () => view(x, region), /./, 'should use x.csi before x.bam.bai')
		fs.rmSync(path.join(dir, 'x.csi'))
		test.deepEqual(await view(x, region), lines, 'should read with x.bam.bai')

		// a changed file is opened again
		const later = new Date(Date.now() + 5000)
		fs.copyFileSync(trackLstBam, x)
		fs.copyFileSync(trackLstBam + '.bai', x + '.bai')
		fs.utimesSync(x, later, later)
		fs.utimesSync(x + '.bai', later, later)
		test.equal((await view(x, 'chr17:7500000-7700000')).length, 203, 'should read a file again after it changes')
		// an index that is older than its file, by the second, as htslib warns about
		const earlier = new Date(later.getTime() - 2000)
		fs.utimesSync(x + '.bai', earlier, earlier)
		await rejects(
			test,
			() => view(x, region),
			/the index file is older than the data file/,
			'should reject an index older than its file'
		)
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
	test.end()
})

tape('rejected arguments', async test => {
	const region = { chr: 'chr17', start: 0, end: 100 }
	for (const file of ['../x.bam', '/etc/hosts', '', 'files/../../x.bam', 'a\nb.bam']) {
		await rejects(
			test,
			() => readBamRecords({ file, region }),
			/invalid file/,
			`should reject file=${JSON.stringify(file)}`
		)
		await rejects(test, () => isBamTruncated(file), /invalid file/, `should not check file=${JSON.stringify(file)}`)
	}
	await rejects(
		test,
		() => readBamRecords({ file: edge, dir: '/tmp', region }),
		/invalid dir/,
		'should reject a dir outside the cache dir'
	)
	await rejects(
		test,
		() => readBamRecords({ file: edge, region: { chr: 'chr7', start: 0, end: 100 } }),
		/the chromosome of the region is not in the bam file/,
		'should reject a chromosome that is not in the file, as samtools view'
	)
	for (const r of [
		{ chr: 'chr17', start: -1, end: 100 },
		{ chr: 'chr17', start: 100, end: 10 },
		{ chr: 'chr17', start: 1.5, end: 100 },
		{ chr: '', start: 0, end: 100 },
		{ chr: 'constructor', start: 0, end: 100 }
	]) {
		await rejects(
			test,
			() => readBamRecords({ file: edge, region: r }),
			/invalid region|not in the bam file/,
			`should reject the region ${JSON.stringify(r)}`
		)
	}
	await rejects(
		test,
		() => readBamRecords({ file: path.join(cache, 'none.bam'), region }),
		/cannot open the bam file/,
		'should reject a missing file'
	)
	test.end()
})

/*
A local http server, which serves the files under tp/files with range requests, and redirects: /redirect/x to /x, and
/away/x to a host that is not allowed. /stall/x sends the first bytes of x and then nothing.
*/
let server: http.Server
let host = ''
const requests: string[] = []

async function startServer() {
	server = http.createServer((req, res) => {
		const url = new URL(req.url!, 'http://x')
		requests.push(url.pathname)
		if (url.pathname.startsWith('/redirect/')) {
			res.writeHead(302, { location: url.pathname.slice('/redirect'.length) })
			return res.end()
		}
		if (url.pathname.startsWith('/away/')) {
			res.writeHead(302, { location: `http://localhost:${(server.address() as AddressInfo).port}/files/x` })
			return res.end()
		}
		if (url.pathname.startsWith('/stall/')) {
			res.writeHead(206, { 'content-length': 2 ** 20 })
			return res.write(Buffer.alloc(10))
		}
		const file = path.join(tp, decodeURIComponent(url.pathname))
		if (!file.startsWith(tp + path.sep) || !fs.existsSync(file)) {
			res.writeHead(404)
			return res.end()
		}
		const data = fs.readFileSync(file)
		const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '')
		if (!m) {
			res.writeHead(200, { 'content-length': data.length })
			return res.end(data)
		}
		const start = Number(m[1])
		const end = Math.min(m[2] ? Number(m[2]) : data.length - 1, data.length - 1)
		res.writeHead(206, {
			'content-range': `bytes ${start}-${end}/${data.length}`,
			'content-length': end - start + 1
		})
		res.end(data.subarray(start, end + 1))
	})
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
	host = `127.0.0.1:${(server.address() as AddressInfo).port}`
}

tape('a url file', async test => {
	await startServer()
	const features = serverconfig.features
	const allow = features.ALLOW_remotefilefromurl
	const urlHosts = serverconfig.urlHosts
	features.ALLOW_remotefilefromurl = true
	// the local server is a loopback address, which is not allowed unless listed
	serverconfig.urlHosts = ['127.0.0.1']
	const dirs: string[] = []
	const region = 'chr17:7670001-7670500'
	const lines = expected.regions[region].view
	try {
		const url = `http://${host}/files/hg38/bam/edge.bam`
		// as getFilefullpathOrUrl() of bam.js
		const dir = await cache_index(url, url + '.bai')
		dirs.push(dir)
		test.deepEqual(await view(url, region, dir), lines, 'should read a region of a url file')
		test.ok(fs.existsSync(path.join(dir, 'edge.bam.bai')), 'should have the index in the cache dir')
		requests.length = 0
		test.deepEqual(await view(url, region, dir), lines, 'should read a region again')
		test.notOk(
			requests.some(r => r.endsWith('.bai') || r.endsWith('.csi')),
			'should not download the index again'
		)
		test.equal(await isBamTruncated(url, dir), false, 'should check a url file')
		test.deepEqual(
			await listBamChrs(url, dir, false),
			['chr1', 'chr17', 'chrM'],
			'should list the chromosomes of a url file'
		)
		test.deepEqual(await listBamChrs(url, dir, true), ['chr1', 'chr17', 'chrM'], 'should list them without the index')
		test.equal((await readBamRecords({ file: url, dir })).records.length, 622, 'should read a whole url file')

		// without a cache dir, the index is url.csi, or else url.bai, in the cache dir of the url
		const other = `http://${host}/files/hg38/TermdbTest/trackLst/bam.bam`
		requests.length = 0
		test.equal((await view(other, 'chr17:7500000-7700000')).length, 203, 'should read a url file without a cache dir')
		test.deepEqual(
			requests.filter(r => r.endsWith('.bai') || r.endsWith('.csi')),
			['/files/hg38/TermdbTest/trackLst/bam.bam.csi', '/files/hg38/TermdbTest/trackLst/bam.bam.bai'],
			'should download url.csi, or else url.bai'
		)
		dirs.push(await cache_index(other, undefined))

		const redirected = `http://${host}/redirect/files/hg38/bam/edge.bam`
		const redirectedDir = await cache_index(redirected, url + '.bai')
		dirs.push(redirectedDir)
		test.deepEqual(await view(redirected, region, redirectedDir), lines, 'should follow a redirect to an allowed host')
		const away = `http://${host}/away/files/hg38/bam/edge.bam`
		const awayDir = await cache_index(away, url + '.bai')
		dirs.push(awayDir)
		await rejects(
			test,
			() => view(away, region, awayDir),
			/url redirect error: url host is not allowed/,
			'should not follow a redirect to a host that is not allowed'
		)
		await rejects(
			test,
			() => isBamTruncated(away),
			/url redirect error/,
			'should not check a url that redirects to a host that is not allowed'
		)
		await rejects(
			test,
			() => view(`http://${host}/files/none.bam`, region),
			/cannot download the index/,
			'should reject a url without an index'
		)
		dirs.push(await cache_index(`http://${host}/files/none.bam`, undefined))
		await rejects(test, () => view('ftp://a.org/x.bam', region), /ftp url is not supported/, 'should reject an ftp url')
		await rejects(
			test,
			() => view('http://169.254.169.254/x.bam', region),
			/invalid file/,
			'should reject a host that is not allowed'
		)
		await rejects(
			test,
			() => isBamTruncated('http://169.254.169.254/x.bam'),
			/invalid file/,
			'should not check a host that is not allowed'
		)
		await rejects(test, () => view('file:///etc/x.bam', region), /invalid file/, 'should reject a file url')

		// a url that stops sending, with the index in the cache dir so that the read of the url file is what stalls
		const stall = `http://${host}/stall/files/hg38/bam/edge.bam`
		const stallDir = await cache_index(stall, url + '.bai')
		dirs.push(stallDir)
		const timeoutMs = urlRequest.timeoutMs
		urlRequest.timeoutMs = 300
		const t = Date.now()
		try {
			await rejects(
				test,
				() => view(stall, region, stallDir),
				/timeout|abort/i,
				'should reject a url that stops sending'
			)
		} finally {
			urlRequest.timeoutMs = timeoutMs
		}
		test.ok(Date.now() - t < 5000, 'should reject it by the time limit of a request')
	} finally {
		if (allow === undefined) delete features.ALLOW_remotefilefromurl
		else features.ALLOW_remotefilefromurl = allow
		if (urlHosts === undefined) delete serverconfig.urlHosts
		else serverconfig.urlHosts = urlHosts
		for (const d of dirs) fs.rmSync(d, { recursive: true, force: true })
		server.closeAllConnections()
		server.close()
	}
	test.end()
})

tape('the same reads as samtools, when samtools is installed', async test => {
	if (!hasSamtools) {
		test.comment('samtools not found, the reads are compared with edge.bam.samtools.json only')
		return test.end()
	}
	const run = (args: string[]) => {
		const p = spawnSync(samtools, args, { maxBuffer: 2 ** 30 })
		return { out: p.stdout.toString(), err: p.stderr.toString(), status: p.status }
	}
	const lines = (s: string) => s.split('\n').filter(Boolean)
	const samView = (args: string[]) => lines(run(['view', ...args]).out).map(l => l.split('\t').slice(0, 11).join('\t'))
	const samDepth = (file: string, region: string, g: string[]) =>
		lines(run(['depth', '-r', region, '-g', 'DUP', file, ...g.flatMap(f => ['-G', f])]).out).map(l => {
			const t = l.split('\t')
			return [Number(t[1]) - 1, Number(t[2])]
		})
	const gFlags = { none: [], '0x400': ['0x400'], '0x800': ['0x800'], '0xC00': ['0x400', '0x800'] }

	for (const [region, e] of Object.entries<any>(expected.regions)) {
		test.deepEqual(samView([edge, region]), e.view, `samtools view of ${region} should be as edge.bam.samtools.json`)
		for (const [key, g] of Object.entries(gFlags)) {
			test.deepEqual(
				samDepth(edge, region, g),
				e.depth[key],
				`samtools depth of ${region} with -G ${key} should be as edge.bam.samtools.json`
			)
		}
	}
	for (const region of ['chr17:7500000-7700000', 'chr17:7673700-7674300', 'chr17:1-83257441']) {
		test.deepEqual(
			await view(trackLstBam, region),
			samView([trackLstBam, region]),
			`should read ${region} of bam.bam as samtools view`
		)
		for (const [key, g] of Object.entries(gFlags)) {
			// a region of a whole chromosome has about 700000 positions, which are compared as text
			const text = (d: number[][]) => d.map(p => p.join('\t')).join('\n')
			test.ok(
				text(await depth(trackLstBam, region, depthExcludedFlags | depthFlags[key])) ==
					text(samDepth(trackLstBam, region, g)),
				`should have the depth of ${region} of bam.bam with -G ${key} as samtools depth`
			)
		}
	}
	test.deepEqual(await view(edge), samView([edge]), 'should read a whole file as samtools view')
	const header = lines(run(['view', '-H', edge]).out)
	test.deepEqual(
		await listBamChrs(edge, null, false),
		header.filter(l => l.startsWith('@SQ')).map(l => l.split('\t')[1].slice(3)),
		'should list the chromosomes as samtools view -H'
	)
	const dir = tempDir()
	try {
		const data = fs.readFileSync(edge)
		for (const [name, d] of [
			['cut.bam', data.subarray(0, 40000)],
			['noeof.bam', data.subarray(0, data.length - bgzfEof.length)]
		] as const) {
			const f = path.join(dir, name)
			fs.writeFileSync(f, d)
			test.deepEqual(await view(f), samView([f]), `should read ${name} as samtools view`)
			const q = run(['quickcheck', f])
			test.ok(
				q.status != 0 && q.err.trim().endsWith('was missing EOF block when one should be present.'),
				`samtools quickcheck should find ${name} truncated`
			)
			test.equal(await isBamTruncated(f), true, `should find ${name} truncated as samtools quickcheck`)
		}
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
	test.end()
})
