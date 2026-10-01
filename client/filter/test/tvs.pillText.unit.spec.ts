import tape from 'tape'
import { handler as categorical } from '../tvs.categorical.js'
import { handler as condition } from '../tvs.condition.js'
import { handler as dt } from '../tvs.dt.js'
import { handler as numeric } from '../tvs.numeric.js'
import { handler as samplelst } from '../tvs.samplelst.js'
import { handler as survival } from '../tvs.survival.js'

/*
Term names and value labels come from datasets and user input (custom group names),
and tvs.js renders the pill's term name and value text with .html(). These tests check
that markup characters in them show as literal text.

test sections:
	- term_name_gen: short and truncated names
	- get_pill_label: categorical
	- get_pill_label: condition
	- get_pill_label: geneVariant (dt)
	- get_pill_label: numeric categories
	- get_pill_label: survival
	- get_pill_label: samplelst
*/

const text = `<img src="x"> Tom & 'Jerry'`
const longText = `${text} plus enough extra words to be truncated`

tape('\n', test => {
	test.comment('-***- filter/tvs pill text -***-')
	test.end()
})

/*********
Helpers
*********/

function render(html: string) {
	const div = document.createElement('div')
	div.innerHTML = html
	return div
}

function assertLiteral(test, html: string, expected: string, msg: string) {
	const div = render(html)
	test.equal(div.querySelector('img'), null, `${msg}: should not create an element`)
	test.equal(div.textContent, expected, `${msg}: should show the literal text`)
}

/*********
Tests
*********/

tape('term_name_gen: short and truncated names', test => {
	for (const [name, handler] of Object.entries({ categorical, condition, dt, numeric, survival })) {
		const short = `<b>'&"`
		assertLiteral(test, handler.term_name_gen({ term: { name: short } }), short, `${name} short name`)

		const div = render(handler.term_name_gen({ term: { name: longText } }))
		test.equal(div.querySelector('img'), null, `${name} long name: should not create an element`)
		test.equal(
			div.querySelector('label')?.title,
			longText,
			`${name} long name: title should hold the full literal name`
		)
		const shown = div.textContent || ''
		test.ok(
			shown.endsWith('...') && longText.startsWith(shown.slice(0, -3)),
			`${name} long name: should show the literal truncated name`
		)
	}
	test.end()
})

tape('get_pill_label: categorical', test => {
	const term = { type: 'categorical', values: { a: { label: text } } }
	assertLiteral(
		test,
		categorical.get_pill_label({ term, values: [{ key: 'x', label: text }] }).txt,
		text,
		'value label'
	)
	assertLiteral(test, categorical.get_pill_label({ term, values: [{ key: 'a' }] }).txt, text, 'term value label')
	assertLiteral(test, categorical.get_pill_label({ term, values: [{ key: text }] }).txt, text, 'unlisted key')
	assertLiteral(
		test,
		categorical.get_pill_label({ term, values: [{ key: 'a' }, { key: 'b' }], groupset_label: text }).txt,
		text,
		'groupset label'
	)
	test.end()
})

tape('get_pill_label: condition', test => {
	assertLiteral(
		test,
		condition.get_pill_label({ bar_by_grade: true, values: [{ label: text }] }).txt,
		text,
		'value label'
	)
	assertLiteral(
		test,
		condition.get_pill_label({ bar_by_children: true, values: [{ label: 'a' }, { label: 'b' }], groupset_label: text })
			.txt,
		text,
		'groupset label'
	)
	test.end()
})

tape('get_pill_label: geneVariant (dt)', test => {
	const term = { dt: 1, type: 'dtsnvindel' }
	assertLiteral(
		test,
		dt.get_pill_label({ term, genotype: 'variant', values: [{ label: text }] }).txt,
		text,
		'value label'
	)
	const chr = `<i>chr1</i>`
	assertLiteral(
		test,
		dt.get_pill_label({
			term,
			genotype: 'variant',
			values: [{ label: 'Fusion' }],
			selfBreakpointRange: { chr, start: 1, stop: 2 }
		}).txt,
		`Fusion @ ${chr}:1-2`,
		'breakpoint range'
	)
	test.end()
})

tape('get_pill_label: numeric categories', test => {
	const term = { name: 'age', values: { 1: { label: text } } }
	assertLiteral(test, numeric.get_pill_label({ term, ranges: [{ value: 2, label: text }] }).txt, text, 'range label')
	assertLiteral(test, numeric.get_pill_label({ term, ranges: [{ value: 1 }] }).txt, text, 'term value label')
	assertLiteral(test, numeric.get_pill_label({ term, ranges: [{ value: text }] }).txt, text, 'unlisted value')
	test.end()
})

tape('get_pill_label: survival', test => {
	const term = { values: { a: { label: text } } }
	assertLiteral(test, survival.get_pill_label({ term, values: [{ key: 'x', label: text }] }).txt, text, 'value label')
	assertLiteral(
		test,
		survival.get_pill_label({ term, values: [{ key: 'a' }, { key: 'b' }], groupset_label: text }).txt,
		text,
		'groupset label'
	)
	test.end()
})

tape('get_pill_label: samplelst', test => {
	// a user-defined group name becomes the samplelst term name
	const tvs = { term: { name: text, values: { a: { list: [{ sampleId: 1 }, { sampleId: 2 }] } } } }
	assertLiteral(test, samplelst.get_pill_label(tvs).txt, `${text} n=2`, 'group name')
	test.end()
})
