/*
input is the "Phenotree Data Map" file:
names are case-sensitive


1	Root note	Cancer-related Variables
2	First Branch	Diagnosis
3	Second Branch	Diagnosis Group
4	Third Branch
5	Fourth Branch
6	SJLIFE Variable Name
7	Include Now	Y
8	Presentation Structure	Slide 8
9	Notes	From Lancet dataset


for columns 1-5:
- blank cell or '-' means no value


output is the term2term table

*/


const abort = (m)=>{
	console.error('ERROR: '+m)
	process.exit()
}



if(process.argv.length!=3) abort('<phenotree txt file> outputs to files "term2term" and "termjson"')


const fs=require('fs')









/////////////////// helpers


const str2level = str => {
	// parses column 1-5
	const v = str.trim()
	if(!v || v=='-') return null
	return v
}






// unique words from levels 1-5, to be printed out in alphabetic order for identifying suspicious duplicated words
const set1 = new Set()
const set2 = new Set()
const set3 = new Set()
const set4 = new Set()
const set5 = new Set()


const t2t = new Map()
// k: parent
// v: set of children


const check_terms_overlap = () => {
	// check if terms from different levels overlap
	for(const n of set1) {
		if(set2.has(n)) abort(n+': L1 and L2')
		if(set3.has(n)) abort(n+': L1 and L3')
		if(set4.has(n)) abort(n+': L1 and L4')
		if(set5.has(n)) abort(n+': L1 and L5')
	}
	for(const n of set2) {
		if(set3.has(n)) abort(n+': L2 and L3')
		if(set4.has(n)) abort(n+': L2 and L4')
		if(set5.has(n)) abort(n+': L2 and L5')
	}
	for(const n of set3) {
		if(set4.has(n)) abort(n+': L3 and L4')
		if(set5.has(n)) abort(n+': L3 and L5')
	}
	for(const n of set4) {
		if(set5.has(n)) abort(n+': L4 and L5')
	}
}




const output_termjson = () => {
	// output "termjson" file
	// col1: term id
	// col2: {}
	// lines beginning with # are ignored
	const out = [ '#root: '+set1.size ]
	for(const n of [...set1].sort() ) {
		const j = {
			name: n
		}
		out.push( n+'\t'+JSON.stringify(j) )
	}

	out.push('#level 1: '+set2.size)
	for(const n of [...set2].sort() ) {
		const j = {
			name: n
		}
		out.push( n+'\t'+JSON.stringify(j) )
	}

	out.push('#level 2: '+set3.size)
	for(const n of [...set3].sort() ) {
		const j = {
			name: n
		}
		out.push( n+'\t'+JSON.stringify(j) )
	}

	out.push('#level 3: '+set4.size)
	for(const n of [...set4].sort() ) {
		const j = {
			name: n
		}
		out.push( n+'\t'+JSON.stringify(j) )
	}

	out.push('#level 4: '+set5.size)
	for(const n of [...set5].sort() ) {
		const j = {
			name: n
		}
		out.push( n+'\t'+JSON.stringify(j) )
	}

	fs.writeFileSync('termjson', out.join('\n')+'\n' )
}




const output_t2t = () => {
	//
	const out = []
	for(const [parentterm, children] of t2t) {

		if( children.size ) {
			for(const childterm of children) {
				out.push( parentterm+'\t'+childterm )
			}
		}
	}

	fs.writeFileSync('term2term', out.join('\n')+'\n' )
}






//////////////// process file


const lines = fs.readFileSync(process.argv[2],{encoding:'utf8'}).trim().split('\n')



for(let i=1; i<lines.length; i++) {
	const l = lines[i].split('\t')
	
	const level1 = str2level( l[0] )
	const level2 = str2level( l[1] )
	const level3 = str2level( l[2] )
	const level4 = str2level( l[3] )
	const level5 = str2level( l[4] )

	if(level1) {
		set1.add(level1)
		if(!t2t.has( level1 )) t2t.set( level1, new Set() )
	}

	if(level2) {
		set2.add(level2)

		t2t.get( level1 ).add( level2 )

		if(!t2t.has( level2 )) t2t.set( level2, new Set() )
	}

	if(level3) {
		set3.add(level3)

		t2t.get( level2 ).add( level3 )
		
		if(!t2t.has( level3 )) t2t.set( level3, new Set() )
	}

	if(level4) {
		set4.add(level4)

		t2t.get( level3 ).add( level4 )

		if(!t2t.has( level4 )) t2t.set( level4, new Set() )
	}

	if(level5) {
		set5.add(level5)

		t2t.get( level4 ).add( level5 )
	}
}




// done parsing file

check_terms_overlap()


output_termjson()

output_t2t()
