import tape from 'tape'
import { svmrparseraw } from '../svmr.js'
import { type2lst, findType2, ratingGrades } from '../svmr.c.js'
import card from '../../../front/public/cards/fusioneditor.json'

/****************
Tests for parsing Fusion Editor input (svmr.js) and the accepted "functional effect" terms (svmr.c.js)

Uses the example input of the Fusion Editor card in the app drawer, front/public/cards/fusioneditor.json:
hg38, one sample, 47 products. Editing the rows of that example may require updating the expected counts below.
Rendering is not covered here, as it requests gene models from the server.

- type2lst holds the accepted functional effect terms
- findType2() matches case-insensitively
- svmrparseraw() parses the example input
- every accepted term is accepted in lower case
- unknown functional effect rejects the row
- empty functional effect is accepted
- missing functional effect column is a header error
- ratingGrades lists the accepted ratings by rank
- rating "Major" is read as HQ, and an invalid rating rejects the row
- empty rating and NA in any case are read as NA
- position outside of the chromosome rejects the row
- unknown chromosome rejects the row
*****************/

// only chrlookup is used by svmrparseraw(), with the same shape as a genome object made by the client
const hg38chrlen = {
	chr1: 248956422,
	chr2: 242193529,
	chr3: 198295559,
	chr4: 190214555,
	chr5: 181538259,
	chr6: 170805979,
	chr7: 159345973,
	chr8: 145138636,
	chr9: 138394717,
	chr10: 133797422,
	chr11: 135086622,
	chr12: 133275309,
	chr13: 114364328,
	chr14: 107043718,
	chr15: 101991189,
	chr16: 90338345,
	chr17: 83257441,
	chr18: 80373285,
	chr19: 58617616,
	chr20: 64444167,
	chr21: 46709983,
	chr22: 50818468,
	chrX: 156040895,
	chrY: 57227415,
	chrM: 16569
}
const genome = { name: 'hg38', chrlookup: {} }
for (const [name, len] of Object.entries(hg38chrlen)) {
	genome.chrlookup[name.toUpperCase()] = { name, len, major: true }
}

// the card runs one ppcall with the input, the other ppcall shows the upload UI
const fusionInput = card.ppcalls.find(c => c.runargs?.fusioneditor?.input)?.runargs.fusioneditor.input || ''
const [headerLine, ...dataLines] = fusionInput.split('\n')
const columns = headerLine.split('\t')

function getField(line, column) {
	return line.split('\t')[columns.indexOf(column)]
}

function setField(line, column, value) {
	const fields = line.split('\t')
	fields[columns.indexOf(column)] = value
	return fields.join('\t')
}

// first example row of a functional effect without special handling, for making test rows
const fusionLine = dataLines.find(l => getField(l, 'functional effect') == 'Fusion')

// rejected rows are reported in a floating pane, suppress it while a test expects rejected rows
function parseWithoutBadLinePane(raw) {
	const key = 'suppressErrors'
	const previous = window.sessionStorage.getItem(key)
	window.sessionStorage.setItem(key, JSON.stringify(['bulk-bad-lines']))
	try {
		return svmrparseraw(raw, genome)
	} finally {
		if (previous === null) window.sessionStorage.removeItem(key)
		else window.sessionStorage.setItem(key, previous)
	}
}

function parseLines(lines, header = headerLine) {
	return parseWithoutBadLinePane([header, ...lines].join('\n'))
}

const flags = type2lst.filter(t => t.flag).map(t => t.flag)

tape('\n', function (test) {
	test.comment('-***- svmr.js Fusion Editor input parsing -***-')
	test.end()
})

tape('type2lst holds the accepted functional effect terms', function (test) {
	test.timeoutAfter(100)
	test.deepEqual(
		type2lst.map(t => t.label),
		[
			'CLoss',
			'ENHANCER_PROX',
			'Fusion',
			'GENE_PROX',
			'GENIC',
			'HALF_INTERGENIC',
			'INTERGENIC',
			'INTRONIC',
			'INVERTED_REPEAT',
			'ITD',
			'NLoss',
			'other',
			'TRUNCATING',
			'upTSS'
		],
		'should list the accepted terms in menu order'
	)
	test.deepEqual(
		Object.fromEntries(type2lst.filter(t => t.flag).map(t => [t.label, t.flag])),
		{
			CLoss: 'iscloss',
			Fusion: 'isfusion',
			ITD: 'isitd',
			NLoss: 'isnloss',
			other: 'isother',
			upTSS: 'isuptss'
		},
		'should set a flag only for the existing terms'
	)
	test.end()
})

tape('findType2() matches case-insensitively', function (test) {
	test.timeoutAfter(100)
	for (const t of type2lst) {
		test.equal(findType2(t.label), t, `should find ${t.label}`)
		test.equal(findType2(t.label.toLowerCase()), t, `should find ${t.label} in lower case`)
		test.equal(findType2(t.label.toUpperCase()), t, `should find ${t.label} in upper case`)
	}
	test.equal(findType2('bogus'), undefined, 'should not find an unknown term')
	test.equal(findType2(''), undefined, 'should not find an empty string')
	test.equal(findType2(undefined), undefined, 'should not find undefined')
	test.end()
})

tape('svmrparseraw() parses the example input', function (test) {
	test.timeoutAfter(1000)
	test.ok(fusionInput, 'should find the example input in the Fusion Editor card')
	const [err, header, items] = parseWithoutBadLinePane(fusionInput)
	test.equal(err, null, 'should not return an error')
	test.equal(items.length, 47, 'should parse all 47 rows')
	test.equal(
		header.find(h => h.label == 'functional effect').key,
		'type2',
		'should read the functional effect column as type2'
	)

	const counts = {}
	for (const m of items) {
		const t = findType2(m.type2)
		const label = t ? t.label : m.type2
		counts[label] = (counts[label] || 0) + 1
	}
	test.deepEqual(
		counts,
		{
			CLoss: 8,
			ENHANCER_PROX: 1,
			Fusion: 12,
			GENE_PROX: 1,
			GENIC: 1,
			HALF_INTERGENIC: 1,
			INTERGENIC: 1,
			INTRONIC: 1,
			INVERTED_REPEAT: 1,
			ITD: 4,
			NLoss: 7,
			other: 1,
			TRUNCATING: 1,
			upTSS: 7
		},
		'should count the products of each functional effect'
	)

	for (const m of items) {
		const t = findType2(m.type2)
		const setFlags = flags.filter(f => m[f])
		test.deepEqual(setFlags, t.flag ? [t.flag] : [], `should set the expected flag for ${m.type2}`)
	}

	const intronic = items.find(m => m.type2.toLowerCase() == 'intronic')
	test.equal(intronic.type2, 'Intronic', 'should keep the functional effect as written in the input')

	const uptss = items.filter(m => m.isuptss)
	test.ok(
		uptss.every(m => m.pairs.length > 0 && m.pairs.every(p => p.inframe)),
		'should treat every isoform pair of upTSS products as in frame'
	)

	const ratingCounts = {}
	for (const m of items) ratingCounts[m.rating] = (ratingCounts[m.rating] || 0) + 1
	test.deepEqual(ratingCounts, { HQ: 27, LQ: 18, NA: 2 }, 'should count the products of each rating')

	const intergenicB = items.find(m => m.geneA == 'PAX5' && m.featureB == 'intergenic')
	test.equal(intergenicB.geneB, null, 'should clear the gene name given as NA')
	const intergenicA = items.find(m => m.geneB == 'ZCCHC7' && m.featureA == 'intergenic')
	test.equal(intergenicA.geneA, null, 'should clear the gene name of an intergenic breakpoint')
	test.end()
})

tape('every accepted term is accepted in lower case', function (test) {
	test.timeoutAfter(1000)
	for (const t of type2lst) {
		const value = t.label.toLowerCase()
		const [err, , items] = parseLines([setField(fusionLine, 'functional effect', value)])
		test.equal(err, null, `should not return an error for ${value}`)
		test.equal(items?.length, 1, `should accept ${value}`)
		if (t.flag) test.equal(items?.[0][t.flag], true, `should set ${t.flag} for ${value}`)
	}
	test.end()
})

tape('unknown functional effect rejects the row', function (test) {
	test.timeoutAfter(100)
	const [err, , items] = parseLines([setField(fusionLine, 'functional effect', 'bogus'), fusionLine])
	test.equal(err, null, 'should not return an error when another row is valid')
	test.equal(items.length, 1, 'should reject the row with an unknown term')
	test.equal(items[0].type2, 'Fusion', 'should keep the valid row')

	const [err2] = parseLines([setField(fusionLine, 'functional effect', 'bogus')])
	test.equal(err2, 'No data loaded', 'should return an error when no row is valid')
	test.end()
})

tape('empty functional effect is accepted', function (test) {
	test.timeoutAfter(100)
	const [err, , items] = parseLines([setField(fusionLine, 'functional effect', '')])
	test.equal(err, null, 'should not return an error')
	test.equal(items.length, 1, 'should accept the row')
	test.deepEqual(
		flags.filter(f => items[0][f]),
		[],
		'should not set a flag'
	)
	test.end()
})

tape('missing functional effect column is a header error', function (test) {
	test.timeoutAfter(100)
	const header = headerLine.replace('\tfunctional effect\t', '\tfunctional_effect\t')
	const [err] = parseLines([fusionLine], header)
	test.equal(err, 'File header error: functional effect missing', 'should return a header error')
	test.end()
})

tape('ratingGrades lists the accepted ratings by rank', function (test) {
	test.timeoutAfter(100)
	test.deepEqual(
		ratingGrades.map(g => g.rating),
		['HQ', 'LQ', 'RT', 'bad', 'NA'],
		'should list the ratings from the highest to the lowest grade'
	)
	test.end()
})

tape('rating "Major" is read as HQ, and an invalid rating rejects the row', function (test) {
	test.timeoutAfter(100)
	const [err, , items] = parseLines([setField(fusionLine, 'rating', 'Major'), setField(fusionLine, 'rating', 'XX')])
	test.equal(err, null, 'should not return an error')
	test.equal(items.length, 1, 'should reject the row with an invalid rating')
	test.equal(items[0].rating, 'HQ', 'should read Major as HQ')
	test.end()
})

tape('empty rating and NA in any case are read as NA', function (test) {
	test.timeoutAfter(100)
	for (const value of ['', 'NA', 'na', 'Na']) {
		const [err, , items] = parseLines([setField(fusionLine, 'rating', value)])
		test.equal(err, null, `should not return an error for "${value}"`)
		test.equal(items?.[0].rating, 'NA', `should read "${value}" as NA`)
	}
	test.end()
})

tape('position outside of the chromosome rejects the row', function (test) {
	test.timeoutAfter(100)
	for (const side of ['A', 'B']) {
		const len = genome.chrlookup[getField(fusionLine, 'chr' + side).toUpperCase()].len
		const cases = [
			[len, false, 'the chromosome length'],
			[len + 1000, false, 'beyond the chromosome length'],
			[-1, false, 'a negative position'],
			[len - 1, true, 'the last position below the chromosome length']
		]
		for (const [pos, accepted, desc] of cases) {
			const [, , items] = parseLines([setField(fusionLine, 'pos' + side, String(pos)), fusionLine])
			test.equal(items.length, accepted ? 2 : 1, `should ${accepted ? 'accept' : 'reject'} pos${side} at ${desc}`)
		}
	}
	test.end()
})

tape('unknown chromosome rejects the row', function (test) {
	test.timeoutAfter(100)
	const [err, , items] = parseLines([setField(fusionLine, 'chrB', 'chr99'), fusionLine])
	test.equal(err, null, 'should not return an error')
	test.equal(items.length, 1, 'should reject the row with an unknown chromosome')
	test.end()
})
