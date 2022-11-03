/*
highly one-off script

following two files are required to be found in current directory:
1. termdb
2. raw/ctcae.grading.js

output:
1. updated termdb file with {.hashtmldetail } flag added
2. term2def text file

*/

if (process.argv.length != 2) {
	console.log('Load "termdb" and "raw/ctcae.grading.js" under current directory, also writes two new files to it')
	process.exit()
}

const dir = process.cwd()

const fs = require('fs')
const path = require('path')

// hardcoded fix, see below
const publication_parent_term = 'Publication'

const termdbfile = path.join(dir, 'termdb')
const ID2term = new Map()
for (const line of fs
	.readFileSync(termdbfile, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const id = l[0]
	ID2term.set(id, {
		id,
		name: l[1],
		parentid: l[2],
		json: JSON.parse(l[3]),
		child_order: l[4]
	})
}

const rawgrading = require(path.join(dir, 'raw/ctcae.grading.js'))

const name2id = new Map([
	['Musculoskeletal', 'Amputation'],
	['Prolonged QTcorrected (QTc) interval', 'Prolonged QT interval'],
	['Dysrhythmia', 'Cardiac dysrhythmia'],
	//Left ventricular systolic dysfunction
	//Gastrointestinal strictures
	['Chronic obstructive pulmonary disease (COPD)', 'Chronic obstructive pulmonary disease'],
	['Restrictive pulmonary deficits (Asthma?)', 'Restrictive pulmonary deficit'],
	['Hypertension (from resting blood pressure)', 'Hypertension'],
	['Incontinence', 'Urinary Incontinence'],
	['Temporomandibular joint disorder', 'Tempormandibular joint disorder'],
	//Coronary artery disease
	['Overweight/Obesity', 'Obesity'],
	['Malignant neoplasms', 'Secondary Neoplasms'],
	//Benign neoplasms
	['Headaches, chronic/ recurrent', 'Severe headaches']
])

const id2deflines = []

for (const k in rawgrading.chcs) {
	const section = rawgrading.chcs[k]

	let lst
	if (Array.isArray(section.grading)) {
		lst = section.grading
	} else {
		lst = [section.grading]
	}

	for (const g of lst) {
		const trimname = g.condition.trim()

		const ID = name2id.get(trimname) || trimname

		if (ID2term.has(ID)) {
			const d = ID2term.get(ID)
			d.json.hashtmldetail = true
			id2deflines.push(
				d.id +
					'\t' +
					JSON.stringify({
						src: g.src,
						rubric: g.rubric
					})
			)
		} else {
			console.error(g.condition)
		}
	}
}

/**********************************************************
***************        hardcoded fix       ****************
***********************************************************

to enable html detail for "paper" terms, under the "Publication" branch
*/
for (const [id, d] of ID2term) {
	if (d.parentid == publication_parent_term) {
		d.json.hashtmldetail = true
	}
}

{
	const lines = []
	for (const d of ID2term.values()) {
		lines.push(
			d.id +
				'\t' +
				d.name +
				'\t' +
				d.parentid +
				'\t' +
				JSON.stringify(d.json) +
				'\t' +
				d.child_order +
				'\t' +
				(d.json.type || '') +
				'\t' +
				(d.json.isleaf ? 1 : 0)
		)
	}
	fs.writeFileSync(path.join(dir, 'termdb.updated'), lines.join('\n') + '\n')
}

fs.writeFileSync(path.join(dir, 'termid2htmldef'), id2deflines.join('\n') + '\n')
