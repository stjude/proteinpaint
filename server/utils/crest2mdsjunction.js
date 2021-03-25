if(process.argv.length!=4) {
	console.log('<crest result file> <sample name> output to stdout')
	process.exit()
}

/*
0   review tag
1	Sample(s)	SJNBL046418_C1
2	ChrA	1
3	PosA	243265129
4	OrientA	+
5	NumReadsA	0
6	ChrB	1
7	PosB	714060
8	OrientB	+
9	NumReadsB	3
10	Type	INS
11	Reciprocal	
12	Usage	GENE_PROX
13	Fusion Gene	LOC100288069_LINC01347
14	Chromosomes	
15	Tx	0
16	CDS	0
17	In-Frame CDS	0
18	Modified In-Frame CDS	0
19	rating	bad

*/


/*
const idchr1  = 2,
	idpos1    = 3,
	idstrand1 = 4,
	idread1   = 5,
	idchr2    = 6,
	idpos2    = 7,
	idstrand2 = 8,
	idread2   = 9
	*/

const idreviewtag = 1,  idchr1  = 3,
	idpos1    = 4,
	idstrand1 = 5,
	idread1   = 6,
	idchr2    = 7,
	idpos2    = 8,
	idstrand2 = 9,
	idread2   = 10



const infile = process.argv[2]
const sample = process.argv[3]

const fs=require('fs')

const lines = fs.readFileSync(infile,{encoding:'utf8'}).trim().split('\n')

console.log('#chr\tstart\tstop\tstrand\ttype\t'+sample)

for(let i=1; i<lines.length; i++) {
	const line = lines[i]
	const l = line.split('\t')

	if(l[ idreviewtag -1 ]=='bad') {
		continue
	}


	// dust_length is not used
	//if(l[21-1]!='-') continue

	const chr1 = l[ idchr1 -1]
	const pos1 = Number.parseInt(l[ idpos1 -1])
	const strand1 = l[ idstrand1 -1]
	const read1 = Number.parseInt(l[ idread1 -1])
	const chr2 = l[ idchr2 -1]
	const pos2 = Number.parseInt(l[ idpos2 -1])
	const strand2 = l[ idstrand2 -1]
	const read2 = Number.parseInt(l[ idread2 -1])

	if(Number.isNaN(pos1) || Number.isNaN(pos2) || Number.isNaN(read1) || Number.isNaN(read2)) {
		// error
		continue
	}
	/*
	if(read1+read2<=3) {
		// poor
		continue
	}
	*/

	const attrvalue = chr1==chr2 ? 'intra' : 'inter'

	const p1 = {
		samples:[ {i:0, readcount:(read1+read2)/2,  readsA:read1, readsB:read2} ],
		events:{ 0:{ attrValue: attrvalue }},
		sv:{
			mate: {chr:'chr'+chr2, start:pos2, stop:pos2, strand:strand2}
		}
	}
	console.log('chr'+chr1+'\t'+pos1+'\t'+pos1+'\t'+strand1+'\t.\t'+JSON.stringify(p1))

	const p2 = {
		samples:[ {i:0, readcount:(read1+read2)/2,  readsA:read2, readsB:read1} ],
		events:{ 0:{ attrValue: attrvalue }},
		sv:{
			mate: {chr:'chr'+chr1, start:pos1, stop:pos1, strand:strand1}
		}
	}
	console.log('chr'+chr2+'\t'+pos2+'\t'+pos2+'\t'+strand2+'\t.\t'+JSON.stringify(p2))
}
