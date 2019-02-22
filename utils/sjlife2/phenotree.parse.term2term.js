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



if(process.argv.length!=3) abort('<phenotree txt file> (term2term to stdout; unique terms at L1-5 to stderr) | sort -u')


const fs=require('fs')









/////////////////// helpers


const str2level = str => {
	// parses column 1-5
	const v = str.trim()
	if(!v || v=='-') return null
	return v
}


const show_level_stats = ()=>{
	console.error('\n\nLevel 1: '+set1.size)
	console.error([...set1].sort().join('\n'))
	console.error('\n\nLevel 2: '+set2.size)
	console.error([...set2].sort().join('\n'))
	console.error('\n\nLevel 3: '+set3.size)
	console.error([...set3].sort().join('\n'))
	console.error('\n\nLevel 4: '+set4.size)
	console.error([...set4].sort().join('\n'))
	console.error('\n\nLevel 5: '+set5.size)
	console.error([...set5].sort().join('\n'))
}




// unique words from levels 1-5, to be printed out in alphabetic order for identifying suspicious duplicated words
const set1 = new Set()
const set2 = new Set()
const set3 = new Set()
const set4 = new Set()
const set5 = new Set()







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
	}

	if(level2) {
		set2.add(level2)
		console.log(level1+'\t'+level2)
	}

	if(level3) {
		set3.add(level3)
		console.log(level2+'\t'+level3)
	}

	if(level4) {
		set4.add(level4)
		console.log(level3+'\t'+level4)
	}

	if(level5) {
		set5.add(level5)
		console.log(level4+'\t'+level5)
	}
}




// done parsing file
show_level_stats()
