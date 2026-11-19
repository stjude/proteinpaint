import tape from 'tape'
import {
	parseChemicalSensitivityFile,
	parseDoseResponse,
	indexDoseResponseFiles,
	validRequest,
	getResult
} from '../termdb.chemicalSensitivity.ts'

/**
 * Table of contents — chemicalSensitivity unit tests
 *
 * parseChemicalSensitivityFile()
 *   • samples and drugs in the order they first appear, results in the drugs order
 *   • reads the columns after the log10 IC50 as sample attributes labeled by their header
 *   • trims fields, treats blank and NA as unset
 *   • removes bytes that are not valid utf-8, with a warning
 *   • drops bad and repeated rows, keeps the first values of a sample or drug, with warnings
 *   • computes the max AOC and the IC50 range over all samples
 *   • reads the image file column
 *
 * parseDoseResponse()
 *   • matches the metrics to the curves by order, raw points are optional
 *   • throws on mismatched metrics, points or missing fields
 *
 * validRequest()
 *   • a sample name as a string, also from a number; drugs only with a sample, distinct names; throws otherwise
 *
 * getResult()
 *   • the samples and drugs; the results of a sample; the dose responses and the image of one drug
 *   • throws on an unknown sample, skips an unknown drug
 *
 * indexDoseResponseFiles()
 *   • indexes by the Compound and Model fields, warns of invalid, unknown, duplicate and missing files
 */

/** the data file text of rows of fields, with these sample attribute columns */
function getFile(rows: string[][], attributes = ['Type', 'Subtype']): string {
	const header = ['sample', 'drug', 'drugClass', 'moleculeImage', 'AOC', 'log10IC50', ...attributes]
	return [header, ...rows].map(r => r.join('\t')).join('\n') + '\n'
}

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.chemicalSensitivity -***-')
	test.end()
})

tape('parseChemicalSensitivityFile() samples and drugs in first-appearance order', function (test) {
	const { data: d, warnings } = parseChemicalSensitivityFile(
		getFile([
			['S2', 'B', 'ClassB', '', '0.5', '-1', 'T-ALL', 'Y'],
			['S2', 'A', 'ClassA', 'a.svg', '1.5', '2', 'T-ALL', 'Y'],
			['S1', 'A', 'ClassA', 'a.svg', '2', '1', 'B-ALL', 'X'],
			['S1', 'B', 'ClassB', '', '0.8', '3', 'B-ALL', 'X']
		])
	)
	test.deepEqual(
		d.drugs,
		[
			{ name: 'B', class: 'ClassB' },
			{ name: 'A', class: 'ClassA' }
		],
		'drugs with their class, in first-appearance order'
	)
	test.deepEqual(
		d.samples,
		[
			{ name: 'S2', attributes: { Type: 'T-ALL', Subtype: 'Y' } },
			{ name: 'S1', attributes: { Type: 'B-ALL', Subtype: 'X' } }
		],
		'samples with their attributes, in first-appearance order'
	)
	test.deepEqual(
		d.sample2results.get('S1'),
		[
			{ drug: 'B', aoc: 0.8, ic50: 3 },
			{ drug: 'A', aoc: 2, ic50: 1 }
		],
		'results in the drugs order, whatever the row order'
	)
	test.deepEqual(warnings, [], 'no warnings')
	test.end()
})

tape('parseChemicalSensitivityFile() reads the attributes labeled by their header', function (test) {
	const { data: d } = parseChemicalSensitivityFile(
		getFile(
			[
				['S1', 'A', 'c', '', '1', '1', 'PDX', 'Brain', 'Medulloblastoma'],
				['S2', 'A', 'c', '', '1', '1']
			],
			['Sample type', 'Tissue', 'Diagnosis']
		)
	)
	test.deepEqual(
		d.samples,
		[
			{ name: 'S1', attributes: { 'Sample type': 'PDX', Tissue: 'Brain', Diagnosis: 'Medulloblastoma' } },
			{ name: 'S2' }
		],
		'any attribute columns, none for a row without them'
	)
	const { data: none } = parseChemicalSensitivityFile(getFile([['S1', 'A', 'c', '', '1', '1']], []))
	test.deepEqual(none.samples, [{ name: 'S1' }], 'no attribute columns')
	test.end()
})

tape('parseChemicalSensitivityFile() trims fields, treats blank and NA as unset', function (test) {
	const { data: d } = parseChemicalSensitivityFile(
		getFile([
			['N6', 'A', ' ClassA ', 'NA', '1', '1', 'B-ALL ', 'DUX4/ERG\u00a0'],
			['R', 'A', ' ClassA ', 'NA', '1', '1', '', 'NA']
		])
	)
	test.deepEqual(
		d.samples,
		[{ name: 'N6', attributes: { Type: 'B-ALL', Subtype: 'DUX4/ERG' } }, { name: 'R' }],
		'trimmed, NA and blank attributes left out'
	)
	test.deepEqual(d.drugs, [{ name: 'A', class: 'ClassA' }], 'drug class trimmed')
	test.end()
})

tape('parseChemicalSensitivityFile() removes bytes that are not valid utf-8, with a warning', function (test) {
	// a latin-1 non-breaking space read as utf-8
	const text = Buffer.from(getFile([['R', 'A', 'c', '', '1', '1', 'B-ALL', 'ETV6-RUNX1\xa0\xa0']]), 'latin1').toString(
		'utf8'
	)
	const { data: d, warnings } = parseChemicalSensitivityFile(text)
	test.equal(d.samples[0].attributes?.Subtype, 'ETV6-RUNX1', 'invalid bytes removed')
	test.ok(
		warnings.some(w => w.startsWith('1 fields have bytes')),
		'warns of the invalid bytes'
	)
	test.end()
})

tape('parseChemicalSensitivityFile() drops bad and repeated rows, keeps first values, with warnings', function (test) {
	const { data: d, warnings } = parseChemicalSensitivityFile(
		getFile([
			['S1', 'A', 'c1', '', '4.5', '-4', 'B-ALL'],
			['S1', 'B', 'c1', '', 'x', '1', 'B-ALL'],
			['S1', '', 'c1', '', '1', '1', 'B-ALL'],
			['S1', 'A', 'c1', '', '9', '9', 'B-ALL'],
			['S2', 'B', 'c2', '', '0.2', '4.4', 'T-ALL'],
			['S2', 'A', 'other', '', '1', '1', 'Other type']
		])
	)
	test.deepEqual(
		d.sample2results.get('S1'),
		[{ drug: 'A', aoc: 4.5, ic50: -4 }],
		'only the first valid row of S1 and A'
	)
	test.deepEqual(
		d.drugs.map(x => [x.name, x.class]),
		[
			['A', 'c1'],
			['B', 'c2']
		],
		'a drug keeps the class of its first row'
	)
	test.equal(d.samples[1].attributes?.Type, 'T-ALL', 'a sample keeps the attributes of its first row')
	for (const [text, label] of [
		['2 rows with a blank sample or drug, or a non-numeric AOC or log10 IC50, dropped', 'bad rows'],
		['1 rows of a sample and drug already seen, dropped', 'repeated row'],
		['drug A', 'a drug with different classes'],
		['sample S2', 'a sample with different attributes']
	])
		test.ok(
			warnings.some(w => w.includes(text)),
			`warns of ${label}`
		)
	test.equal(d.aocMax, 4.5, 'max AOC over all samples')
	test.deepEqual(d.ic50Range, [-4, 4.4], 'IC50 range over all samples')
	test.end()
})

tape('parseChemicalSensitivityFile() reads the image file column', function (test) {
	const { drug2imageFile } = parseChemicalSensitivityFile(
		getFile([
			['S1', 'A', 'c', 'a.svg', '1', '1'],
			['S1', 'B', 'c', '', '1', '1']
		])
	)
	test.deepEqual([...drug2imageFile], [['A', 'a.svg']], 'image file of A, none of B')
	test.end()
})

function getDoseResponseJson(compound = 'A', sample = 'S1') {
	return {
		Compound: compound,
		Model: sample,
		ConcLow: 1,
		ConcHigh: 3,
		Metrics: { IC50: [10, 20, 15], AOC: [1, 2, 1.5] },
		Curves: {
			Rep1: { Raw: { Conc: [1, 3], Act: [0.9, 0.2] }, DR: { Conc: [1, 2, 3], Act: [0.9, 0.5, 0.2] } },
			Rep2: { Raw: { Conc: [1, 3], Act: [0.8, 0.1] }, DR: { Conc: [1, 2, 3], Act: [0.8, 0.4, 0.1] } },
			Average: { DR: { Conc: [1, 2, 3], Act: [0.85, 0.45, 0.15] } }
		}
	}
}

tape('parseDoseResponse() matches the metrics to the curves by order, raw points are optional', function (test) {
	const dr = parseDoseResponse(getDoseResponseJson())
	test.equal(dr.drug, 'A', 'drug from Compound')
	test.equal(dr.sample, 'S1', 'sample from Model')
	test.deepEqual(dr.concRange, [1, 3], 'tested range')
	test.deepEqual(
		dr.curves.map(c => [c.name, c.ic50, c.aoc, !!c.raw]),
		[
			['Rep1', 10, 1, true],
			['Rep2', 20, 2, true],
			['Average', 15, 1.5, false]
		],
		'metrics by curve order, no raw points of the average'
	)
	test.end()
})

tape('parseDoseResponse() throws on mismatched metrics, points or missing fields', function (test) {
	const cases: [string, (j: any) => void][] = [
		['missing Compound', j => delete j.Compound],
		['one metric short', j => j.Metrics.IC50.pop()],
		['Conc and Act of different lengths', j => j.Curves.Rep1.DR.Act.pop()],
		['non-numeric point', j => (j.Curves.Rep2.Raw.Conc[0] = 'x')],
		['missing fitted curve', j => delete j.Curves.Average.DR]
	]
	for (const [label, change] of cases) {
		const j = getDoseResponseJson()
		change(j)
		test.throws(() => parseDoseResponse(j), label)
	}
	test.end()
})

tape('indexDoseResponseFiles() indexes by Compound and Model, warns of skipped and missing files', function (test) {
	const { data: d } = parseChemicalSensitivityFile(
		getFile([
			['S1', 'A', 'c', '', '1', '1'],
			['S1', 'B', 'c', '', '1', '1'],
			['S2', 'A', 'c', '', '1', '1']
		])
	)
	const warnings: string[] = []
	const files = new Map<string, unknown>([
		// named unlike its content: indexed by content
		['x/whatever.json', getDoseResponseJson('A', 'S1')],
		['b_s1.json', getDoseResponseJson('B', 'S1')],
		['dup.json', getDoseResponseJson('A', 'S1')],
		['unknown.json', getDoseResponseJson('A', 'S9')],
		['bad.json', undefined]
	])
	indexDoseResponseFiles(files, d, warnings)
	test.deepEqual([...d.doseResponse.get('S1')!.keys()], ['A', 'B'], 'S1 indexed by content')
	test.notOk(d.doseResponse.has('S2'), 'no file of S2')
	for (const [text, label] of [
		['invalid dose-response files, skipped: bad.json', 'invalid file'],
		['unknown drug or sample, skipped: unknown.json', 'unknown sample'],
		['already loaded, skipped: dup.json', 'duplicate'],
		['1 sample and drug pairs have results but no dose-response file', 'missing file']
	])
		test.ok(
			warnings.some(w => w.includes(text)),
			`warns of ${label}`
		)
	test.end()
})

tape('validRequest() checks the sample and drugs', function (test) {
	const base = { genome: 'hg38', dslabel: 'ds' }
	test.deepEqual(validRequest({ ...base }), base, 'genome and dslabel only')
	test.deepEqual(
		validRequest({ ...base, sample: 380, drugs: ['A', 'B'] }),
		{ ...base, sample: '380', drugs: ['A', 'B'] },
		'a numeric sample name as a string, with drugs'
	)
	for (const [input, error, label] of [
		[{ ...base, sample: '' }, /blank/, 'blank sample'],
		[{ ...base, sample: { a: 1 } }, /string or number/, 'sample not a string'],
		[{ ...base, drugs: ['A'] }, /requires sample/, 'drugs without a sample'],
		[{ ...base, sample: 'S1', drugs: 'A' }, /array/, 'drugs not an array'],
		[{ ...base, sample: 'S1', drugs: ['A', 1] }, /array/, 'a drug not a name'],
		[{ ...base, sample: 'S1', drugs: ['A', 'A'] }, /distinct/, 'repeated drug'],
		[{ genome: 'hg38', dslabel: 'a/b' }, /dslabel/, 'invalid dslabel']
	] as [any, RegExp, string][])
		test.throws(() => validRequest(input), error, `throws on ${label}`)
	test.end()
})

tape('getResult() responds to a checked request', function (test) {
	const { data } = parseChemicalSensitivityFile(
		getFile([
			['S1', 'A', 'c', 'a.svg', '1', '1'],
			['S1', 'B', 'c', '', '2', '2']
		])
	)
	indexDoseResponseFiles(new Map([['a.json', getDoseResponseJson('A', 'S1')]]), data, [])
	data.moleculeImages.set('A', '<svg></svg>')
	const base = { genome: 'hg38', dslabel: 'ds' }
	const all = getResult(base, data)
	test.deepEqual(
		[all.samples.length, all.drugs.length, all.results],
		[1, 2, undefined],
		'samples and drugs, without a sample'
	)
	test.equal(getResult({ ...base, sample: 'S1' }, data).results?.length, 2, 'the results of a sample')
	const one = getResult({ ...base, sample: 'S1', drugs: ['A'] }, data)
	test.deepEqual(
		[one.doseResponses?.map(dr => dr.drug), one.moleculeImage],
		[['A'], '<svg></svg>'],
		'the dose response and the image of one drug'
	)
	const two = getResult({ ...base, sample: 'S1', drugs: ['B', 'A'] }, data)
	test.deepEqual(
		[two.doseResponses?.map(dr => dr.drug), two.moleculeImage],
		[['A'], undefined],
		'the dose responses that exist, no image with two drugs'
	)
	test.throws(() => getResult({ ...base, sample: 'S9' }, data), /unknown sample/, 'throws on an unknown sample')
	const unknown = getResult({ ...base, sample: 'S1', drugs: ['C', 'A'] }, data)
	test.deepEqual(
		unknown.doseResponses?.map(dr => dr.drug),
		['A'],
		'a drug not in the data, e.g. of a saved session, is skipped'
	)
	test.end()
})
