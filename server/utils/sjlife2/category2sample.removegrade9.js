/*
for each term (leaf and non-leaf), get list of samples with only a specified grade

Purpuse: at phewas of a condition term, if a patient has only grade 9 event, it should be excluded from the term's control set

get_rows() won't be able to retrieve it, as grade 9 is uncomputable according to dataset.js
also grade 9 cannot be made computable, as it will mask grade 0-5 in max grade computing

besides, this is to get samples with just grade 9 (but not maximum grade); so if the patient also has any other grade for the same symptom, he will not qualify

*/



if(process.argv.length!=5) {
	console.log('<category2vcfsample file> <termdb file> <annotation.outcome> output to stdout the updated "category2vcfsample"')
	process.exit()
}


const file_cat2sam = process.argv[2]
const file_termdb = process.argv[3]
const file_outcome = process.argv[4]


const only_grade = '9'
// for a term, look for samples with only events of this grade


const fs = require('fs')
const readline = require('readline')


main()



async function main () {

	const [id2term, parent2children] = load_terms( file_termdb )
	const term2sample = await load_annotation( file_outcome )

	for(const line of fs.readFileSync(file_cat2sam,{encoding:'utf8'}).trim().split('\n')) {
		const [groupname, termid, str1, str2, str3] = line.split('\t')
		if(!id2term.has(termid)) {
			console.log(line)
			continue
		}

		const onlyhasgrade = getsampleonlyhasgrade_one_term( termid, parent2children, term2sample )

		const j = JSON.parse(str3)

		for(const category of j) {
			const newlst = category.group2lst.filter( i=> !onlyhasgrade.has(i) )
			const minus = category.group2lst.length - newlst.length
			if( minus ) {
				console.error( 'Control size: '+category.group2lst.length+' -'+minus+'\t'+ termid+', '+category.group1label )
				category.group2lst = newlst
			}
		}

		console.log( groupname+'\t'+termid+'\t'+str1+'\t'+str2+'\t'+JSON.stringify(j) )
	}
}


function load_annotation (infile) {

	const term2sample = new Map()
	/*
	k: term
	v: {}
		.onlyhasgrade: Set of sample names
		.hasothergrade: Set of sample names
	*/

	return new Promise((resolve,reject)=>{
		const rl = readline.createInterface({input:fs.createReadStream( infile )})
		rl.on('line',line=>{
			const [sample,termid,grade] = line.split('\t')
			if( !term2sample.has( termid ) ) {
				term2sample.set( termid, { onlyhasgrade:new Set(), hasothergrade: new Set() } )
			}
			const o = term2sample.get( termid )

			if( grade == only_grade ) {
				if( o.hasothergrade.has( sample ) ) return
				o.onlyhasgrade.add( sample )
				return
			}
			
			o.onlyhasgrade.delete( sample )
			o.hasothergrade.add(sample)
		})
		rl.on('close',()=>{
			resolve( term2sample )
		})
	})
}





function load_terms (termdbfile) {
	const id2term = new Map()
	// k: id, v: json
	const parent2children = new Map()
	// k: term id
	// v: Set of child term id

	for(const line of fs.readFileSync(termdbfile, {encoding:'utf8'}).trim().split('\n')) {
		const [id, name, parent_id, jsontext] = line.split('\t')
		const j = JSON.parse(jsontext)
		if(!j.iscondition) continue
		j.id = id
		id2term.set( id, j )

		if(!parent2children.has(parent_id)) parent2children.set(parent_id,new Set())
		parent2children.get(parent_id).add( id )
	}

	return [id2term, parent2children]
}








function getsampleonlyhasgrade_one_term ( id, parent2children, term2sample ) {
	// for both leaf and non-leaf terms
	const onlyhasgrade = new Set()
	const hasothergrade = new Set()

	recursive_getsample( onlyhasgrade, hasothergrade, id, parent2children, term2sample )

	const newset = new Set()
	for(const s of onlyhasgrade) {
		if(!hasothergrade.has(s)) newset.add(s)
	}
	return newset
}


function recursive_getsample ( onlyhasgrade, hasothergrade, id, parent2children, term2sample ) {
	const o = term2sample.get(id)
	if(o) {
		for(const s of o.hasothergrade) hasothergrade.add(s)
		for(const s of o.onlyhasgrade) onlyhasgrade.add(s)
	}
	if( parent2children.has(id)) {
		for(const cid of parent2children.get(id)) {
			recursive_getsample( onlyhasgrade, hasothergrade, cid, parent2children, term2sample )
		}
	}
}
