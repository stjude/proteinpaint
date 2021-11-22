/*
input is the "Phenotree Data Map" file:
names are case-sensitive


1	Root note	Cancer-related Variables
2	First Branch	Diagnosis 
3	Second Branch	Diagnosis Group
4	Third Branch	-
5	Fourth Branch	-
6	SJLIFE Variable Names	diaggrpb


for columns 1-5:
- blank cell or '-' means no value




column 6:
	if given, is the term id and will match with the column header at file 'test/matrix'
	if not given, use the term name as term id



special handling of chronic condition terms (3: organ system, 4: grouped condition, 5: condition):
- all under "CTCAE Graded Events"
- type:"condition"
- chart configs




second optional input is keep/*:
key: term id
value: term json obj


to override automatically generated contents in termjson file


outputs these files:
1. termdb    - load to "terms" table
2. ancestry  - load to "ancestry" table
*/

console.log('\nRUNNING phenotree.parse.term2term.js ...')

const level2_ctcaegraded = 'Graded Adverse Events'
const groupsetting_old = {
	// old definition
	useIndex: -1,
	lst: [
		{
			name: 'Any condition vs normal',
			is_grade: true,
			groups: [
				{
					name: 'No condition',
					// CAREFUL!! grades are integers, not strings. so that max grade computing can happen
					values: [{ key: 0, label: 'No condition' }]
				},
				{
					name: 'Has condition',
					values: [
						{ key: 1, label: '1: Mild' },
						{ key: 2, label: '2: Moderate' },
						{ key: 3, label: '3: Severe' },
						{ key: 4, label: '4: Life-threatening' },
						{ key: 5, label: '5: Death' }
					]
				}
			]
		}
	]
}
const tvs_ctcaeGraded = () => {
	return {
		type: 'tvs',
		tvs: {
			term: {
				id: 'ctcae_graded',
				type: 'categorical'
			},
			values: [{ key: '1', label: 'Yes' }]
		}
	}
}
const tvs_grade1_9 = t => {
	return {
		type: 'tvs',
		isnot: true,
		tvs: {
			term: {
				id: t.id,
				name: t.name,
				type: 'condition'
			},
			values: [
				{ key: 1, label: '1: Mild' },
				{ key: 2, label: '2: Moderate' },
				{ key: 3, label: '3: Severe' },
				{ key: 4, label: '4: Life-threatening' },
				{ key: 5, label: '5: Death' },
				{ key: 9, label: '9: Unknown' }
			]
		}
	}
}
const tvs_subcohort = cohort => {
	return {
		type: 'tvs',
		tvs: {
			term: {
				id: 'subcohort',
				type: 'categorical'
			},
			values: [{ key: cohort, label: cohort }]
		}
	}
}

const make_groupsetting = t => {
	// new def
	return {
		useIndex: -1,
		lst: [
			{
				name: 'Any condition vs normal',
				is_grade: true,
				groups: [
					{
						name: 'No condition / not tested',
						type: 'filter',
						filter4activeCohort: [
							// shares array index with termdb.selectCohort.values[]
							// 0 - sjlife
							{
								type: 'tvslst',
								in: true,
								join: 'and',
								lst: [tvs_ctcaeGraded(), tvs_grade1_9(t)]
							},
							// 1 - ccss
							{
								type: 'tvslst',
								in: true,
								join: '',
								lst: [tvs_grade1_9(t)]
							},
							// 2 - sjlife+ccss
							{
								type: 'tvslst',
								in: true,
								join: 'or',
								lst: [
									{
										type: 'tvslst',
										in: true,
										join: 'and',
										lst: [tvs_subcohort('SJLIFE'), tvs_ctcaeGraded(), tvs_grade1_9(t)]
									},
									{
										type: 'tvslst',
										in: true,
										join: 'and',
										lst: [tvs_subcohort('CCSS'), tvs_grade1_9(t)]
									}
								]
							}
						]
					},
					{
						name: 'Has condition',
						type: 'values',
						values: [
							{ key: 1, label: '1: Mild' },
							{ key: 2, label: '2: Moderate' },
							{ key: 3, label: '3: Severe' },
							{ key: 4, label: '4: Life-threatening' },
							{ key: 5, label: '5: Death' }
						]
					}
				]
			}
		]
	}
}

const abort = m => {
	console.error('ERROR: ' + m)
	process.exit()
}

if (process.argv.length < 3) abort('<phenotree txt file> <keep/termjson> outputs to: termdb, ancestry')
const infile_phenotree = process.argv[2]
const keep_file = process.argv[3] // optional

const fs = require('fs')
const path = require('path')

/* unique words from levels 1-5, to be printed out in alphabetic order for identifying suspicious duplicated words
key: id
	if column 6 is given, use as key, else, use term name as key
value: term name
*/
const map1 = new Map()
const map2 = new Map()
const map3 = new Map()
const map4 = new Map()
const map5 = new Map()

/* keep a list of terms, by their order of appearance in the phenotree file
to be printed out and loaded to a small table
for ordering terms in phewas
*/
const allterms_byorder = new Set()

/* for recalling id from a non-leaf level name
k: name
v: id
*/
const name2id = new Map()

const t2t = new Map()
// k: parent id
// v: set of children id
const p2childorder = new Map()
// k: parent id
// v: array of unique list of children, in the order appeared in phenotree
const root_id = '__root' // placeholder
p2childorder.set(root_id, [])

const c2p = new Map() // ancestry
// k: child id
// v: map { k: parent id, v: level } parents from the entire ancestry
const c2immediatep = new Map()
// k: child id
// v: immediate parent id

const patientcondition_terms = new Set()
// the set of terms under CTCAE branch, to make its json differently

parse_phenotree()
validate_levels()
const keep_termjson = build_termjson()

output_termdb()
output_ancestry()
output_alltermlst()

/////////////////////////////// helpers

function validate_levels() {
	// clean t2t by removing leaf terms with no children; leaf should not appear in t2t
	for (const [n, s] of t2t) {
		if (s.size == 0) {
			t2t.delete(n)
		}
	}

	// check if terms from different levels overlap
	for (const n of map1.keys()) {
		if (map2.has(n)) abort(n + ': L1 and L2')
		if (map3.has(n)) abort(n + ': L1 and L3')
		if (map4.has(n)) abort(n + ': L1 and L4')
		if (map5.has(n)) abort(n + ': L1 and L5')
	}
	for (const n of map2.keys()) {
		if (map3.has(n)) abort(n + ': L2 and L3')
		if (map4.has(n)) abort(n + ': L2 and L4')
		if (map5.has(n)) abort(n + ': L2 and L5')
	}
	for (const n of map3.keys()) {
		if (map4.has(n)) abort(n + ': L3 and L4')
		if (map5.has(n)) abort(n + ': L3 and L5')
	}
	for (const n of map4.keys()) {
		if (map5.has(n)) abort(n + ': L4 and L5')
	}
}

function build_termjson() {
	const keep_termjson = new Map()

	if (keep_file) {
		/* keep file is one single object, of key:value pairs
		key: term id
		value: term json definition
		*/
		const j = JSON.parse(fs.readFileSync(keep_file, { encoding: 'utf8' }))
		for (const id in j) {
			keep_termjson.set(id, j[id])
		}
	}
	return keep_termjson
}

function parse_phenotree() {
	const lines = fs
		.readFileSync(infile_phenotree, { encoding: 'utf8' })
		.trim()
		.split('\n')

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]
		if (!line.trim()) {
			// blank new lines are now introduced by the sjlife/ccss phenotree merging step
			continue
		}

		if (line.startsWith('\t')) abort('line ' + (i + 1) + ' starts with tab')

		const l = line.split('\t')
		if (!l[3]) throw 'missing column 4 at line ' + i + ': ' + line
		if (!l[2]) throw 'missing column 3 at line ' + i + ': ' + line

		// names of each level, may be empty; if id is provided, levelX will be term name, otherwise will be term ID
		let level1 = str2level(l[0]),
			level2 = str2level(l[1]),
			level3 = str2level(l[2]),
			level4 = str2level(l[3]),
			level5 = str2level(l[4] || '-') // level 5 is missing from certain terms e.g. ccss ctcae events

		// if a level is non empty, will record its id, for use with its sub-levels
		let id1, id2, id3, id4, id5

		let leaflevel = 5 // which level is leaf: 1,2,3,4,5
		let level2isctcae // if level 2 is ctcae

		/* trim leaf
		if a leaf level is identical as its direct parent, trim this leaf
		*/
		if (!level2) {
			leaflevel = 1
			// no need to trim level1
		} else if (!level3) {
			// level2 is leaf
			leaflevel = 2
			if (level2 == level1) {
				// trim level2
				level2 = null
				leaflevel = 1
			}
		} else if (!level4) {
			// level3 is leaf
			leaflevel = 3
			if (level3 == level2) {
				level3 = null
				leaflevel = 2
			}
		} else if (!level5) {
			// level4 is leaf
			leaflevel = 4
			if (level4 == level3) {
				level4 = null
				leaflevel = 3
			}
		} else if (level5 == level4) {
			// trim level5
			level5 = null
			leaflevel = 4
		}

		/* this only applies to the leaf level of this line
		somehow a ctcae line at the end of file may not have 6 fields
		*/
		const tempid = l[5] ? str2level(l[5]) : null

		if (level1) {
			if (leaflevel == 1) {
				if (tempid) {
					id1 = tempid
					name2id.set(level1, id1)
				} else {
					id1 = level1
				}
			} else {
				// not a leaf, so tempid doesn't apply to it, has to recall id
				id1 = name2id.get(level1) || level1
			}

			map1.set(id1, level1)

			if (!t2t.has(id1)) {
				t2t.set(id1, new Set())
			}
			allterms_byorder.add(id1)

			if (p2childorder.get(root_id).indexOf(id1) == -1) p2childorder.get(root_id).push(id1)
		}

		if (level2) {
			if (leaflevel == 2) {
				if (tempid) {
					id2 = tempid
					name2id.set(level2, id2)
				} else {
					id2 = level2
				}
			} else {
				// recall id
				id2 = name2id.get(level2) || level2
			}

			map2.set(id2, level2)

			// child of level1
			t2t.get(id1).add(id2)

			if (!t2t.has(id2)) {
				t2t.set(id2, new Set())
			}
			if (!c2p.has(id2)) c2p.set(id2, new Map())
			c2p.get(id2).set(id1, 0)
			c2immediatep.set(id2, id1)
			allterms_byorder.add(id2)

			/*
			phenotree file now contains ctcae data from both sjlife and ccss
			where the level2 all use same name but with different case to differentiate
			so must do case insensitive match here
			the flag will be used by later terms
			*/
			level2isctcae = level2.toLowerCase() == level2_ctcaegraded.toLowerCase()

			if (!p2childorder.has(id1)) p2childorder.set(id1, [])
			if (p2childorder.get(id1).indexOf(id2) == -1) p2childorder.get(id1).push(id2)
		}

		if (level3) {
			if (leaflevel == 3) {
				if (tempid) {
					id3 = tempid
					name2id.set(level3, id3)
				} else {
					id3 = level3
				}
			} else {
				id3 = name2id.get(level3) || level3
			}

			map3.set(id3, level3)

			// child of level2
			t2t.get(id2).add(id3)

			if (!t2t.has(id3)) {
				t2t.set(id3, new Set())
			}
			if (!c2p.has(id3)) c2p.set(id3, new Map())
			c2p.get(id3).set(id1, 0)
			c2p.get(id3).set(id2, 1)
			c2immediatep.set(id3, id2)

			allterms_byorder.add(id3)
			if (level2isctcae) patientcondition_terms.add(id3)

			if (!p2childorder.has(id2)) p2childorder.set(id2, [])
			if (p2childorder.get(id2).indexOf(id3) == -1) p2childorder.get(id2).push(id3)
		}

		if (level4) {
			if (leaflevel == 4) {
				if (tempid) {
					id4 = tempid
					name2id.set(level4, id4)
				} else {
					id4 = level4
				}
			} else {
				id4 = name2id.get(level4) || level4
			}

			map4.set(id4, level4)

			// child of level3
			t2t.get(id3).add(id4)

			if (!t2t.has(id4)) t2t.set(id4, new Set())

			if (!c2p.has(id4)) c2p.set(id4, new Map())
			c2p.get(id4).set(id1, 0)
			c2p.get(id4).set(id2, 1)
			c2p.get(id4).set(id3, 2)
			c2immediatep.set(id4, id3)

			allterms_byorder.add(id4)
			if (level2isctcae) patientcondition_terms.add(id4)

			if (!p2childorder.has(id3)) p2childorder.set(id3, [])
			if (p2childorder.get(id3).indexOf(id4) == -1) p2childorder.get(id3).push(id4)
		}

		if (level5) {
			if (leaflevel == 5) {
				if (tempid) {
					id5 = tempid
					name2id.set(level5, id5)
				} else {
					id5 = level5
				}
			} else {
				id5 = name2id.get(level5) || level5
			}

			map5.set(id5, level5)

			// child of level4
			t2t.get(id4).add(id5)
			if (!c2p.has(id5)) c2p.set(id5, new Map())
			c2p.get(id5).set(id1, 0)
			c2p.get(id5).set(id2, 1)
			c2p.get(id5).set(id3, 2)
			c2p.get(id5).set(id4, 3)
			c2immediatep.set(id5, id4)

			allterms_byorder.add(id5)
			if (level2isctcae) patientcondition_terms.add(id5)

			if (!p2childorder.has(id4)) p2childorder.set(id4, [])
			if (p2childorder.get(id4).indexOf(id5) == -1) p2childorder.get(id4).push(id5)
		}
	}
	console.log(allterms_byorder.size + ' terms in total')
	console.log(patientcondition_terms.size + ' terms for patient condition')
}

function termjson_outputoneset(map, lines) {
	/*
arg is set of words from root or a level, e.g. set1
each word is a term
*/
	let leafcount = 0
	for (const id of [...map.keys()].sort()) {
		let j = keep_termjson.get(id)
		if (!j) {
			// this term not found in keep
			j = {
				name: map.get(id)
			}
		}
		j.id = id

		// test if it is leaf
		if (!t2t.has(id)) {
			j.isleaf = true
			leafcount++
		}

		if (patientcondition_terms.has(id)) {
			// belongs to patient conditions
			j.type = 'condition'
			addattributes_conditionterm(j)
		}

		lines.push(
			id +
				'\t' +
				j.name +
				'\t' +
				(c2immediatep.get(id) || '') +
				'\t' +
				JSON.stringify(j) +
				'\t' +
				p2childorder.get(c2immediatep.get(id) || root_id).indexOf(id) +
				'\t' +
				(j.type || '') +
				'\t' +
				(j.isleaf ? 1 : 0)
		)
	}
	return map.size + ' terms, ' + leafcount + ' leaf terms'
}

function addattributes_conditionterm(t) {
	/* make graph config for a condition term
   options a bit different for leaf and non-leaf terms
*/

	t.values = {
		'0': { label: '0: No condition' },
		'1': { label: '1: Mild' },
		'2': { label: '2: Moderate' },
		'3': { label: '3: Severe' },
		'4': { label: '4: Life-threatening' },
		'5': { label: '5: Death' },
		'9': { label: 'Unknown status', uncomputable: true }
	}

	if (!t.isleaf) {
		// a non-leaf CHC term
		// collect sub-conditions, so that termsetting UI can generate list of subconditions for grouping
		t.subconditions = {}
		for (const c of t2t.get(t.id)) {
			// id and label is the same based on current data file
			// if not the case, must need id2name mapping
			t.subconditions[c] = { label: c }
		}
	}

	t.groupsetting = make_groupsetting(t)
}

function output_termdb() {
	/* output "termdb" file

each term is one row

col1: term id
col2: {}
lines beginning with # are ignored

manual inspection:
	- terms are sorted alphabetically for inspecting suspicious similar names;
	- this is just a lookup table
	- the order of terms in this table does not impact the order of display
	- #### are level dividers also to assist inspection
*/
	const lines = []

	{
		const str = termjson_outputoneset(map1, lines)
		//console.log('ROOT: ' + str)
	}

	{
		const str = termjson_outputoneset(map2, lines)
		//console.log('Level 1: ' + str)
	}

	{
		const str = termjson_outputoneset(map3, lines)
		//console.log('Level 2: ' + str)
	}

	{
		const str = termjson_outputoneset(map4, lines)
		//console.log('Level 3: ' + str)
	}

	{
		const str = termjson_outputoneset(map5, lines)
		//console.log('Level 4: ' + str)
	}

	fs.writeFileSync('termdb', lines.join('\n') + '\n')
}

function output_ancestry() {
	const out = []
	for (const [c, m] of c2p) {
		for (const p of m.keys()) {
			out.push(c + '\t' + p)
		}
	}
	fs.writeFileSync('ancestry', out.join('\n') + '\n')
}
function output_alltermlst() {
	// may add term group and color etc
	fs.writeFileSync('alltermsbyorder', [...allterms_byorder].join('\n'))
}

function str2level(str) {
	// parses column 1-5
	const v = str.trim()
	if (!v || v == '-') return null
	if (v.indexOf('"') != -1) abort('Level name should not have double quote: ' + str)
	return v
}
