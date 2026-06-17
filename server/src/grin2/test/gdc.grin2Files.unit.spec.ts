import tape from 'tape'
import { detectCnvValueType, pickLargestFilePerCase, selectCnvFilePerCase } from '../gdcFiles.ts'
import type { GdcGRIN2File } from '#types'

/* test sections

detectCnvValueType
pickLargestFilePerCase
selectCnvFilePerCase
*/

const mkFile = (case_submitter_id: string, id: string, file_size: number): GdcGRIN2File => ({
	id,
	case_submitter_id,
	case_uuid: id + '-uuid',
	file_size,
	sample_types: [],
	project_id: 'TCGA-X'
})

tape('\n', function (test) {
	test.comment('-***- server/grin2 gdcFiles specs -***-')
	test.end()
})

tape('detectCnvValueType', test => {
	test.equal(
		detectCnvValueType('Allele-specific Copy Number Segment'),
		'copyNumber',
		'allele-specific => copyNumber (absolute integer copy number)'
	)
	test.equal(detectCnvValueType('Masked Copy Number Segment'), 'segmean', 'masked => segmean')
	test.equal(
		detectCnvValueType('Copy Number Segment', 'AscatNGS'),
		'segmean',
		'Copy Number Segment from a non-DNACopy workflow => segmean'
	)
	test.equal(
		detectCnvValueType('Copy Number Segment', 'DNACopy'),
		null,
		'Copy Number Segment from the DNACopy workflow => not used (null)'
	)
	test.equal(detectCnvValueType('Gene Level Copy Number'), null, 'unrelated data_type => null')
	test.end()
})

tape('pickLargestFilePerCase', test => {
	const files = [
		mkFile('CASE-A', 'a1', 100),
		mkFile('CASE-A', 'a2', 300), // largest for CASE-A
		mkFile('CASE-A', 'a3', 200),
		mkFile('CASE-B', 'b1', 50) // sole file for CASE-B
	]
	const { kept, duplicatesRemoved, caseDetails } = pickLargestFilePerCase(files)

	test.deepEqual(kept.map(f => f.id).sort(), ['a2', 'b1'], 'keeps exactly one file per case — the largest')
	test.equal(duplicatesRemoved, 2, 'counts the 2 dropped CASE-A duplicates')
	test.deepEqual(
		caseDetails,
		[{ caseName: 'CASE-A', fileCount: 3, keptFileSize: 300 }],
		'reports per-case details only for cases that had duplicates'
	)

	// no duplicates: every file kept, nothing reported
	const singles = [mkFile('C1', 'x', 10), mkFile('C2', 'y', 20)]
	const r2 = pickLargestFilePerCase(singles)
	test.equal(r2.kept.length, 2, 'all single-file cases are kept')
	test.equal(r2.duplicatesRemoved, 0, 'no duplicates removed')
	test.deepEqual(r2.caseDetails, [], 'no case details when there were no duplicates')
	test.end()
})

tape('selectCnvFilePerCase', test => {
	const seg = (cid: string, id: string, size: number): GdcGRIN2File => ({
		...mkFile(cid, id, size),
		value_type: 'segmean'
	})
	const cn = (cid: string, id: string, size: number): GdcGRIN2File => ({
		...mkFile(cid, id, size),
		value_type: 'copyNumber'
	})

	// CASE-A has both a segmean and a copyNumber file; CASE-B has only copyNumber
	const files = [seg('CASE-A', 'a-seg', 100), cn('CASE-A', 'a-cn', 500), cn('CASE-B', 'b-cn', 50)]

	const def = selectCnvFilePerCase(files) // default prefers segmean
	test.equal(def.get('CASE-A')!.id, 'a-seg', 'default prefers the segmean file for CASE-A')
	test.equal(def.get('CASE-B')!.id, 'b-cn', 'falls back to copyNumber when no segmean exists (CASE-B)')

	const cnPref = selectCnvFilePerCase(files, 'copyNumber')
	test.equal(cnPref.get('CASE-A')!.id, 'a-cn', 'preferredType=copyNumber selects the copyNumber file for CASE-A')

	// within the chosen type, the largest file wins
	const two = [seg('C', 's1', 10), seg('C', 's2', 99)]
	test.equal(selectCnvFilePerCase(two).get('C')!.id, 's2', 'largest file of the chosen type is selected')
	test.end()
})
