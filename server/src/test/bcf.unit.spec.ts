import tape from 'tape'
import fs from 'fs'
import http from 'http'
import path from 'path'
import crypto from 'crypto'
import type { AddressInfo } from 'net'
import serverconfig from '#src/serverconfig.js'
import { readBcfRecords, readWindow, formatFloat } from '#src/bcf.ts'
import type { BcfRecord, BcfRegion, InfoCondition } from '#src/bcf.ts'
import { cache_index } from '#src/utils.js'

/*
The expected text of the records is what bcftools 1.24 query prints for them, see the format of each section.

files/hg38/bcf/test.bcf.gz is test.vcf of the same dir, written by bcftools view -Ob and indexed by bcftools index.
files/hg38/bcf/blocks.bcf.gz has 400 records on chr1 at 1000, 1050, ..., of 600 samples with random genotypes, made
the same way, so that its records span 18 bgzf blocks.

test sections:

the fields of the records of a bcf file
the samples of a read
a file whose records span bgzf blocks and reads
the regions of a read, as bcftools reads them
the INFO conditions of a read, as bcftools tests them
formatFloat(), as htslib prints a float
rejected arguments, and the end of a read
a url file
*/

const tp = path.resolve(serverconfig.tpmasterdir)
const test_bcf = path.join(tp, 'files/hg38/bcf/test.bcf.gz')
const blocks_bcf = path.join(tp, 'files/hg38/bcf/blocks.bcf.gz')
// a bcf file that has FORMAT fields but no GT
const termdbtest_bcf = path.join(tp, 'files/hg38/TermdbTest/TermdbTest.bcf.gz')
const all: BcfRegion[] = [
	{ chr: 'chr1', start: 1, stop: 100000 },
	{ chr: 'chr2', start: 1, stop: 100000 }
]

/** %ID\t%CHROM\t%POS\t%REF\t%ALT\t%INFO\t%FORMAT */
const formatLine = (r: BcfRecord) => [r.id, r.chr, r.pos, r.ref, r.alts.join(','), r.info(), ...r.format()].join('\t')
/** %POS\t%ID\t%REF\t%ALT\t%INFO[\t%TGT] */
const tgtLine = (r: BcfRecord) => [r.pos, r.id, r.ref, r.alts.join(','), r.info(), ...r.tgt()].join('\t')

async function read(
	file: string,
	regions: BcfRegion[],
	line: (r: BcfRecord) => string | number,
	opts: { samples?: string[]; infoFilter?: InfoCondition[]; dir?: string } = {}
): Promise<(string | number)[]> {
	const lines: (string | number)[] = []
	await readBcfRecords({ file, regions, ...opts, callback: r => lines.push(line(r)) })
	return lines
}

/** the sha1 of lines, as of bcftools query output | shasum */
function sha1(lines: (string | number)[]): string {
	return crypto
		.createHash('sha1')
		.update(lines.map(l => l + '\n').join(''))
		.digest('hex')
}

async function rejects(test, fn: () => Promise<unknown>, pattern: RegExp, msg: string) {
	try {
		await fn()
		test.fail(msg)
	} catch (e) {
		test.match(String(e), pattern, msg)
	}
}

const ref20 = 'GATCCCAGCACTTTGGGAGG'
const rep = <T>(v: T, n: number): T[] => Array(n).fill(v)

tape('the fields of the records of a bcf file', async test => {
	test.deepEqual(
		await read(test_bcf, all, formatLine),
		[
			[
				'rs1\tchr1\t100\tA\tG\tAF=0.5;CR=1;AC=8;AN=34;QC=Good;FLAG\tGT:DP:AD',
				'0/0:10:10,0\t0/1:12:6,6\t1/1:9:0,9\t./.:.:.\t0|1:7:3,4\t1:5:0,5',
				...rep('0/0:10:10,0', 8),
				'0/0:300:150,150\t0/0:70000:35000,35000\t1|0:8:4,4'
			].join('\t'),
			[
				'.\tchr1\t150\tAT\tA,ATT\tAF=0.0001234,6.97e-05;CR=0.98;AC=1,.;AN=34;QC=Bad,.;NOTE=a note longer than fifteen chars',
				'GT\t0/1\t0/2\t1/2\t./.',
				...rep('0/0', 11),
				'2|2\t.|1'
			].join('\t'),
			['.\tchr1\t200', ref20, 'G\tAF=0.104617;AC=1;QC=Good\tGT\t0/1', ...rep('0/0', 16)].join('\t'),
			['rs2\tchr1\t210\tC\tT\tAF=.;CR=.;AC=.;AN=.;QC=.\tGT', ...rep('0/0', 17)].join('\t'),
			[
				'.\tchr1\t300\tT\tC\tAF=0.01;AC=300;AN=70000;X=0.104617,6.6072e-06,999999,1e+06,1.23456e+06,1.23458e+06,100000,' +
					'1e-05,123.457,0.1,2.5,-0.5,-0,3e+38,1.5e-10,0.00015,0.0001\tGT\t0/1',
				...rep('0/0', 16)
			].join('\t'),
			['.\tchr2\t50\tG\tA\t.\tGT\t0/0', ...rep('./.', 16)].join('\t'),
			['rs3\tchr2\t60\tG\t.\tNOTE=ref only\tGT', ...rep('0/0', 17)].join('\t')
		],
		'should give the fields of each record as %ID %CHROM %POS %REF %ALT %INFO %FORMAT'
	)
	const tgt = await read(test_bcf, all, r => [r.pos, ...r.tgt()].join('\t'))
	test.deepEqual(
		tgt.slice(0, 2),
		[
			['100\tA/A\tA/G\tG/G\t./.\tA|G\tG', ...rep('A/A', 10), 'G|A'].join('\t'),
			['150\tAT/A\tAT/ATT\tA/ATT\t./.', ...rep('AT/AT', 11), 'ATT|ATT\t.|A'].join('\t')
		],
		'should give the genotypes by the alleles, as [\\t%TGT], of phased, haploid, and missing genotypes'
	)
	test.equal(tgt[2], ['200', ref20 + '/G', ...rep(ref20 + '/' + ref20, 16)].join('\t'), 'should give a long allele')
	test.equal(tgt[6], ['60', ...rep('G/G', 17)].join('\t'), 'should give the genotypes of a record without ALT')
	test.deepEqual(
		await read(termdbtest_bcf, [{ chr: '17', start: 7673802, stop: 7673802 }], r => r.format().join('\t')),
		['tumor_DNA_WGS:dna_assay:origin\t.:.:.\t.:.:.\t9,7:wgs:somatic\t.:.:.\t.:.:.\t.:.:.\t.:.:.'],
		'should give the FORMAT fields of a file without GT'
	)
	await rejects(
		test,
		() =>
			read(
				termdbtest_bcf,
				[
					{ chr: '17', start: 1, stop: 0 },
					{ chr: '17', start: 1, stop: 9e7 }
				],
				r => r.tgt().join()
			),
		/no GT field in the bcf header/,
		'should reject the genotypes of a file without GT, as bcftools does'
	)
	test.end()
})

tape('the samples of a read', async test => {
	test.deepEqual(
		await read(test_bcf, [all[0]], r => [r.pos, ...r.format()].join('\t'), { samples: ['s17', 's2', 's16', 's2'] }),
		[
			'100\tGT:DP:AD\t1|0:8:4,4\t0/1:12:6,6\t0/0:70000:35000,35000\t0/1:12:6,6',
			'150\tGT\t.|1\t0/2\t2|2\t0/2',
			'200\tGT\t0/0\t0/0\t0/0\t0/0',
			'210\tGT\t0/0\t0/0\t0/0\t0/0',
			'300\tGT\t0/0\t0/0\t0/0\t0/0'
		],
		'should give the samples in the order of samples[], as bcftools query -s'
	)
	test.deepEqual(
		await read(test_bcf, [all[0]], r => r.tgt().join('\t'), { samples: ['s17', 's1'] }),
		['G|A\tA/A', '.|A\tAT/A', ref20 + '/' + ref20 + '\t' + ref20 + '/G', 'C/C\tC/C', 'T/T\tT/C'],
		'should give the genotypes of the samples'
	)
	await rejects(
		test,
		() => read(test_bcf, all, r => r.pos, { samples: ['s1', 'nosuch'] }),
		/sample not found in the bcf file/,
		'should reject a sample that is not in the file'
	)
	test.end()
})

tape('a file whose records span bgzf blocks and reads', async test => {
	const bytes = readWindow.bytes
	try {
		for (const windowBytes of [bytes, 1]) {
			readWindow.bytes = windowBytes
			const label = windowBytes == 1 ? ', with a read of one block at a time' : ''
			const lines = await read(blocks_bcf, [{ chr: 'chr1', start: 1, stop: 1000000 }], tgtLine)
			test.equal(lines.length, 400, 'should read all records' + label)
			test.equal(sha1(lines), '2700ecced85f18e50a9be7e870742d83547342a4', 'should read the records as bcftools' + label) // pragma: allowlist secret
			const regions = [
				{ chr: 'chr1', start: 12345, stop: 12345 },
				{ chr: 'chr1', start: 1000, stop: 1100 },
				{ chr: 'chr1', start: 12000, stop: 15000 }
			]
			const some = await read(blocks_bcf, regions, tgtLine)
			test.equal(some.length, 64, 'should read the records of regions' + label)
			test.equal(sha1(some), 'e9d90e748d66a95303ba7d4bf22cf51b00bce4c5', 'should read the regions as bcftools' + label) // pragma: allowlist secret
			test.equal(
				sha1(await read(blocks_bcf, [{ chr: 'chr1', start: 5000, stop: 6000 }], tgtLine)),
				'0dd24301076e10e70f1b2bcea3b24a65ddc140c6', // pragma: allowlist secret
				'should read a region inside the file' + label
			)
		}
	} finally {
		readWindow.bytes = bytes
	}
	const region = [{ chr: 'chr1', start: 1, stop: 1000000 }]
	test.equal(
		sha1(await read(blocks_bcf, region, formatLine)),
		'eac8dd821d2412c94b75c76ac1bf990129e19abf', // pragma: allowlist secret
		'should give the FORMAT fields of 600 samples, of a GT of int8 and a DP of int16'
	)
	test.equal(
		sha1(await read(blocks_bcf, region, formatLine, { samples: ['S599', 'S0', 'S300'] })),
		'af2828790ef51355e427c2c108a704384dcaa127', // pragma: allowlist secret
		'should give the FORMAT fields of samples'
	)
	test.end()
})

tape('the regions of a read, as bcftools reads them', async test => {
	const at = (regions: BcfRegion[]) => read(test_bcf, regions, r => r.chr + ':' + r.pos)
	test.deepEqual(
		await at([{ chr: 'chr1', start: 201, stop: 201 }]),
		['chr1:200'],
		'should read a record that overlaps a region by its REF'
	)
	test.deepEqual(
		await at([{ chr: 'chr1', start: 219, stop: 219 }]),
		['chr1:200'],
		'should read a record by the end of its REF'
	)
	test.deepEqual(await at([{ chr: 'chr1', start: 220, stop: 299 }]), [], 'should read no record after the end of a REF')
	test.deepEqual(
		await at([
			{ chr: 'chr1', start: 300, stop: 300 },
			{ chr: 'chr1', start: 100, stop: 150 },
			{ chr: 'chr1', start: 120, stop: 160 }
		]),
		['chr1:100', 'chr1:150', 'chr1:300'],
		'should read each record once, in the order of the file, of regions that overlap and are not sorted'
	)
	test.deepEqual(
		await at([
			{ chr: 'chr2', start: 1, stop: 100 },
			{ chr: 'chr1', start: 290, stop: 1000 }
		]),
		['chr2:50', 'chr2:60', 'chr1:300'],
		'should read the chromosomes in the order that they are first given'
	)
	test.deepEqual(
		await at([
			{ chr: 'chrZ', start: 1, stop: 100 },
			{ chr: 'chr2', start: 55, stop: 100000 }
		]),
		['chr2:60'],
		'should read no record of a chromosome that is not in the file'
	)
	test.deepEqual(await at([{ chr: 'chr1', start: 0, stop: 100 }]), ['chr1:100'], 'should read a start of 0 as 1')
	test.deepEqual(
		await at([{ chr: 'chr1', start: 151.9, stop: 152.9 }]),
		['chr1:150'],
		'should truncate a fractional coordinate'
	)
	test.deepEqual(
		await at([{ chr: 'chr1', start: 301, stop: 300 }]),
		[],
		'should read no record of a stop before the start'
	)
	test.end()
})

tape('the INFO conditions of a read, as bcftools tests them', async test => {
	const cases: [InfoCondition[], number[], string][] = [
		[[{ key: 'QC', op: '=', value: 'Good' }], [100, 200], 'any comma-separated value of a string field'],
		[[{ key: 'QC', op: '!=', value: 'Bad' }], [100, 150, 200, 210, 300, 50, 60], 'any value or a missing value'],
		[[{ key: 'QC', op: '=', value: '.' }], [150, 210, 300, 50, 60], 'a missing value or field, by "."'],
		[[{ key: 'QC', op: '!=', value: '.' }], [100, 150, 200], 'a value that is not missing'],
		[[{ key: 'NOTE', op: '!=', value: 'ref only' }], [100, 150, 200, 210, 300, 50], 'a string field of one value'],
		[[{ key: 'AF', op: '<', value: 0.001 }], [150], 'any value of a float field'],
		[[{ key: 'AF', op: '!=', value: 0.5 }], [150, 200, 210, 300, 50, 60], 'a missing value or field with "!="'],
		[[{ key: 'AF', op: '=', value: 0.0001234 }], [150], 'a float as a 32-bit float'],
		[[{ key: 'CR', op: '<', value: 0.99 }], [150], 'a float field of one value'],
		[[{ key: 'CR', op: '!=', value: 1 }], [150, 200, 210, 300, 50, 60], 'a missing value of a field of one value'],
		[
			[{ key: 'AC', op: '<=', value: -2147483648 }],
			[150, 210],
			'a missing integer of a field of more values as -2147483648'
		],
		[[{ key: 'AC', op: '<', value: -2147483647 }], [], 'numbers as 32-bit floats'],
		[[{ key: 'AN', op: '<', value: 1 }], [], 'a missing integer of a field of one value as missing'],
		[[{ key: 'AN', op: '>=', value: 70000 }], [300], 'an int32 value'],
		[[{ key: 'FLAG', op: '=', value: 1 }], [100], 'a flag that is set'],
		[[{ key: 'FLAG', op: '=', value: 0 }], [150, 200, 210, 300, 50, 60], 'a flag that is not set'],
		[[{ key: 'X', op: '>', value: 1e38 }], [300], 'a field of more than 15 values'],
		[
			[
				{ key: 'AF', op: '>', value: 0.0001 },
				{ key: 'QC', op: '!=', value: 'Bad' }
			],
			[100, 150, 200, 300],
			'all conditions'
		]
	]
	for (const [infoFilter, positions, label] of cases) {
		test.deepEqual(await read(test_bcf, all, r => r.pos, { infoFilter }), positions, 'should test ' + label)
	}
	const value = 'x" || ID=@' + test_bcf + ' || INFO/QC="x'
	test.deepEqual(
		await read(test_bcf, all, r => r.pos, { infoFilter: [{ key: 'QC', op: '=', value }] }),
		[],
		'should compare a string value with quotes as a string'
	)
	await rejects(
		test,
		() => read(test_bcf, all, r => r.pos, { infoFilter: [{ key: 'NOPE', op: '=', value: 'x' }] }),
		/the tag "NOPE" is not defined in the bcf header/,
		'should reject a field that is not in the header'
	)
	await rejects(
		test,
		() => read(test_bcf, all, r => r.pos, { infoFilter: [{ key: 'QC', op: '=', value: 1 }] }),
		/cannot use arithmetic operators to compare strings and numbers/,
		'should reject a number for a string field'
	)
	await rejects(
		test,
		() => read(test_bcf, all, r => r.pos, { infoFilter: [{ key: 'AF', op: '=', value: 'x' }] }),
		/cannot use arithmetic operators to compare strings and numbers/,
		'should reject a string for a float field'
	)
	await rejects(
		test,
		() => read(test_bcf, all, r => r.pos, { infoFilter: [{ key: 'QC', op: '<', value: 'x' }] }),
		/invalid info filter operator for a string/,
		'should reject "<" for a string field'
	)
	await rejects(
		test,
		() => read(test_bcf, all, r => r.pos, { infoFilter: [{ key: 'AF', op: '~' as any, value: 1 }] }),
		/invalid info filter operator/,
		'should reject an unknown operator'
	)
	await rejects(
		test,
		() => read(test_bcf, all, r => r.pos, { infoFilter: [{ key: 'AF', op: '<', value: NaN }] }),
		/invalid info filter value/,
		'should reject a value that is not a number'
	)
	test.end()
})

tape('formatFloat(), as htslib prints a float', test => {
	const cases: [number, string][] = [
		[0, '0'],
		[-0, '-0'],
		[1, '1'],
		[0.5, '0.5'],
		[-0.5, '-0.5'],
		[0.104617, '0.104617'],
		[Math.fround(0.0029297), '0.0029297'],
		[0.0001, '0.0001'],
		[0.00009999999, '0.0001'],
		[0.0099999999, '0.01'],
		[6.97e-5, '6.97e-05'],
		[6.6072e-6, '6.6072e-06'],
		[123.456789, '123.457'],
		[999999.4, '999999'],
		[999999.6, '1e+06'],
		[100000.5, '100000'],
		[100001.5, '100002'],
		[1234565, '1.23456e+06'],
		[1234575, '1.23458e+06'],
		[3e38, '3e+38'],
		[Infinity, 'inf'],
		[NaN, 'nan']
	]
	for (const [d, s] of cases) test.equal(formatFloat(d), s, `should format ${d} as ${s}`)
	test.end()
})

tape('rejected arguments, and the end of a read', async test => {
	await rejects(test, () => read(test_bcf, [], r => r.pos), /regions\[\] missing/, 'should reject no regions')
	await rejects(
		test,
		() => read(test_bcf, rep(all[0], 1001), r => r.pos),
		/too many regions/,
		'should reject more regions than a request has'
	)
	await rejects(
		test,
		() => read(test_bcf, [{ chr: '', start: 1, stop: 2 }], r => r.pos),
		/invalid region chr/,
		'should reject an empty chr'
	)
	await rejects(
		test,
		() => read(test_bcf, [{ chr: 'chr1', start: NaN, stop: 2 }], r => r.pos),
		/invalid region coordinate/,
		'should reject a coordinate that is not a number'
	)
	await rejects(
		test,
		() => read(path.join(tp, 'files/hg38/TermdbTest/TermdbTest_ITD.gz'), all, r => r.pos),
		/cannot find the index of the bcf file/,
		'should reject a file without a .csi index'
	)
	await rejects(test, () => read('../x.bcf.gz', all, r => r.pos), /invalid file/, 'should reject a file outside tp')
	const dir = fs.mkdtempSync(path.join(serverconfig.cachedir, 'bcf-'))
	try {
		// the index is written after the data, as an index older than its file is rejected
		const truncated = path.join(dir, 'truncated.bcf.gz')
		fs.writeFileSync(truncated, fs.readFileSync(blocks_bcf).subarray(0, 50000))
		fs.copyFileSync(blocks_bcf + '.csi', truncated + '.csi')
		await rejects(
			test,
			() => read(truncated, [{ chr: 'chr1', start: 1, stop: 1000000 }], r => r.pos),
			/the bcf file is truncated/,
			'should reject a truncated file'
		)
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}

	const positions: number[] = []
	await readBcfRecords({
		file: test_bcf,
		regions: all,
		callback: (r, stop) => {
			positions.push(r.pos)
			if (positions.length == 2) stop()
		}
	})
	test.deepEqual(positions, [100, 150], 'should end a read by stop()')
	await rejects(
		test,
		() =>
			readBcfRecords({
				file: test_bcf,
				regions: all,
				callback: () => {
					throw 'callback error'
				}
			}),
		/callback error/,
		'should reject the error of a callback'
	)
	test.end()
})

let server: http.Server
let host = ''

tape('a url file', async test => {
	server = http.createServer((req, res) => {
		const file = path.join(tp, decodeURIComponent(new URL(req.url!, 'http://x').pathname))
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
		res.writeHead(206, { 'content-range': `bytes ${start}-${end}/${data.length}`, 'content-length': end - start + 1 })
		res.end(data.subarray(start, end + 1))
	})
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
	host = `127.0.0.1:${(server.address() as AddressInfo).port}`
	const features = serverconfig.features
	const allow = features.ALLOW_remotefilefromurl
	const urlHosts = serverconfig.urlHosts
	features.ALLOW_remotefilefromurl = true
	// the local server is a loopback address, which is not allowed unless listed
	serverconfig.urlHosts = ['127.0.0.1']
	let dir = ''
	try {
		const url = `http://${host}/files/hg38/bcf/blocks.bcf.gz`
		dir = await cache_index(url, undefined)
		const region = [{ chr: 'chr1', start: 5000, stop: 6000 }]
		test.deepEqual(
			await read(url, region, tgtLine, { dir }),
			await read(blocks_bcf, region, tgtLine),
			'should read the records of a url file'
		)
		test.ok(fs.existsSync(path.join(dir, 'blocks.bcf.gz.csi')), 'should download the index into the cache dir')
	} finally {
		if (allow === undefined) delete features.ALLOW_remotefilefromurl
		else features.ALLOW_remotefilefromurl = allow
		if (urlHosts === undefined) delete serverconfig.urlHosts
		else serverconfig.urlHosts = urlHosts
		if (dir) fs.rmSync(dir, { recursive: true, force: true })
		server.closeAllConnections()
		server.close()
	}
	test.end()
})
