import tape from 'tape'
import { mayAddInfoField } from '../makeTk'

/***
test sections:

mayAddInfoField()
	- no info field on any variant: returns early, tk.mds.bcf not set
	- categorical only: sets Type=String with categories and colors
	- numeric only: sets Type=Float with no categories
	- mixed keys: categorical and numeric fields coexist
	- categorical then numeric on same key: throws
	- numeric then categorical on same key: throws
	- non-string non-number value (e.g. object): throws
	- variant with non-object info is skipped
	- multiple variants contribute to the same categorical field
*/

tape('\n', test => {
	test.comment('-***- mds3/makeTk unit -***-')
	test.end()
})

tape('mayAddInfoField() - no info field on any variant: returns early', test => {
	const tk: any = {
		custom_variants: [{ dt: 1 }, { dt: 1 }],
		mds: {}
	}
	mayAddInfoField(tk)
	test.false(tk.mds.bcf, 'tk.mds.bcf is not set when no variant has an info field')
	test.end()
})

tape('mayAddInfoField() - categorical only: sets Type=String with categories and colors', test => {
	const tk: any = {
		custom_variants: [
			{ dt: 1, info: { consequence: 'missense' } },
			{ dt: 1, info: { consequence: 'nonsense' } },
			{ dt: 1, info: { consequence: 'missense' } }
		],
		mds: {}
	}
	mayAddInfoField(tk)
	test.true(tk.mds.bcf, 'tk.mds.bcf is set')
	const field = tk.mds.bcf.info['consequence']
	test.equal(field.ID, 'consequence', 'field ID is correct')
	test.equal(field.Type, 'String', 'field Type is String')
	test.equal(field.Number, '.', 'field Number is .')
	test.true(field.categories, 'categories object exists')
	test.true('missense' in field.categories, 'missense category present')
	test.true('nonsense' in field.categories, 'nonsense category present')
	test.equal(Object.keys(field.categories).length, 2, 'exactly 2 unique categories')
	test.equal(typeof field.categories['missense'].color, 'string', 'missense category has a color string')
	test.equal(typeof field.categories['nonsense'].color, 'string', 'nonsense category has a color string')
	test.end()
})

tape('mayAddInfoField() - numeric only: sets Type=Float with no categories', test => {
	const tk: any = {
		custom_variants: [
			{ dt: 1, info: { score: 0.9 } },
			{ dt: 1, info: { score: 0.1 } }
		],
		mds: {}
	}
	mayAddInfoField(tk)
	test.true(tk.mds.bcf, 'tk.mds.bcf is set')
	const field = tk.mds.bcf.info['score']
	test.equal(field.ID, 'score', 'field ID is correct')
	test.equal(field.Type, 'Float', 'field Type is Float')
	test.equal(field.Number, '.', 'field Number is .')
	test.false(field.categories, 'no categories object for numeric field')
	test.end()
})

tape('mayAddInfoField() - mixed keys: categorical and numeric fields coexist', test => {
	const tk: any = {
		custom_variants: [
			{ dt: 1, info: { consequence: 'missense', af: 0.05 } },
			{ dt: 1, info: { consequence: 'nonsense', af: 0.12 } }
		],
		mds: {}
	}
	mayAddInfoField(tk)
	const info = tk.mds.bcf.info
	test.equal(info['consequence'].Type, 'String', 'consequence field is String (categorical)')
	test.equal(info['af'].Type, 'Float', 'af field is Float (numeric)')
	test.true(info['consequence'].categories, 'consequence has categories')
	test.false(info['af'].categories, 'af has no categories')
	test.end()
})

tape('mayAddInfoField() - categorical then numeric on same key: throws', test => {
	// first variant puts 'mixed' into ckeys; second sees a number → throws
	const tk: any = {
		custom_variants: [
			{ dt: 1, info: { mixed: 'pathogenic' } },
			{ dt: 1, info: { mixed: 0.99 } }
		],
		mds: {}
	}
	test.throws(
		() => mayAddInfoField(tk),
		/info field mixed cannot have both categorical and numerical values/,
		'throws when categorical value precedes numeric value for the same field'
	)
	test.end()
})

tape('mayAddInfoField() - numeric then categorical on same key: throws', test => {
	// first variant puts 'mixed' into nkeys; second sees a string → throws
	const tk: any = {
		custom_variants: [
			{ dt: 1, info: { mixed: 1.5 } },
			{ dt: 1, info: { mixed: 'low' } }
		],
		mds: {}
	}
	test.throws(
		() => mayAddInfoField(tk),
		/info field mixed cannot have both categorical and numerical values/,
		'throws when numeric value precedes categorical value for the same field'
	)
	test.end()
})

tape('mayAddInfoField() - non-string non-number value (e.g. object): throws', test => {
	const tk: any = {
		custom_variants: [{ dt: 1, info: { flag: { nested: true } } }],
		mds: {}
	}
	test.throws(
		() => mayAddInfoField(tk),
		/value for info field flag neither string or number/,
		'throws when info value is neither string nor finite number'
	)
	test.end()
})

tape('mayAddInfoField() - boolean info value: throws', test => {
	const tk: any = {
		custom_variants: [{ dt: 1, info: { flag: true } }],
		mds: {}
	}
	test.throws(
		() => mayAddInfoField(tk),
		/value for info field flag neither string or number/,
		'throws when info value is boolean (not string or finite number)'
	)
	test.end()
})

tape('mayAddInfoField() - variant with non-object info is skipped', test => {
	const tk: any = {
		custom_variants: [
			{ dt: 1, info: 'bad-info' }, // not an object, skipped
			{ dt: 1, info: { consequence: 'missense' } }
		],
		mds: {}
	}
	mayAddInfoField(tk)
	test.true(tk.mds.bcf, 'tk.mds.bcf is set despite malformed info on one variant')
	test.true(tk.mds.bcf.info['consequence'], 'valid info field is still collected')
	test.end()
})

tape('mayAddInfoField() - multiple variants contribute to the same categorical field', test => {
	const tk: any = {
		custom_variants: [
			{ dt: 1, info: { effect: 'benign' } },
			{ dt: 1, info: { effect: 'pathogenic' } },
			{ dt: 1, info: { effect: 'benign' } },
			{ dt: 1, info: { effect: 'VUS' } }
		],
		mds: {}
	}
	mayAddInfoField(tk)
	const cats = tk.mds.bcf.info['effect'].categories
	test.equal(Object.keys(cats).length, 3, 'three unique categories: benign, pathogenic, VUS')
	test.true('benign' in cats, 'benign present')
	test.true('pathogenic' in cats, 'pathogenic present')
	test.true('VUS' in cats, 'VUS present')
	test.end()
})
