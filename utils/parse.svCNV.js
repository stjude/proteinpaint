if(process.argv.length!=4) {
	console.log('<cnv file> <sv file> output the same amount of cnv data to stdout')
	process.exit()
}

const cnvfile = process.argv[2]
const svfile = process.argv[3]

const fs=require('fs')


const sample2sv = {}
/*
k: sample
   k: chr1
      v: [ { chr1/pos1/chr2/pos2/id } ]
*/

{
	const lines = fs.readFileSync(svfile,{encoding:'utf8'}).trim().split('\n')
/*
1	Sample	SJHGG011_D
2	Data From Project	PCGP
3	List In Project	PCGP
4	Sample List	HGG
5	Diagnosis	HGG
6	Subtype	HGG
7	Subgroup	Non-BS-HGG
8	Cohort	DISCOVERY
9	Seq Source	NEXT_GEN_WGS
10	Origin	SOMATIC
11	Chr A	15
12	Pos A	81768973
13	Ori A	+
14	Locus A Soft Clips	7
15	Chr B	15
16	Pos B	81772165
17	Ori B	+
18	Locus B Soft Clips	5
19	Translocation Type	DEL
20	Usage	INTERGENIC
21	Fusion Gene	
22	Chromosomes	
23	TX	
24	VC	
25	IFC	
26	MIFC	
27	Locus A Coverage	22
28	Locus B Coverage	32
29	TX Validation Status	VALID
30	Fusion Gene Validation Status	
31	Is Public	t
*/
	for(let i=1; i<lines.length; i++) {
		const l = lines[i].split('\t')
		const sample = l[0]
		if(!sample2sv[sample]) sample2sv[sample]={}

		if(!l[11-1] || !l[12-1] || !l[13-1] || !l[15-1] || !l[16-1] || !l[17-1]) continue
		const chrA = 'chr'+l[11-1]
		const chrB = 'chr'+l[15-1]
		let v = Number.parseInt(l[12-1])
		if(Number.isNaN(v)) continue
		const posA=v
		v = Number.parseInt(l[16-1])
		if(Number.isNaN(v)) continue
		const posB=v

		const sv = {
			chrA:chrA, posA:posA, strandA:l[13-1],
			chrB:chrB, posB:posB, strandB:l[17-1],
			type:l[19-1],
			id:i
			}

		if(!sample2sv[sample][chrA]) sample2sv[sample][chrA]=[]
		sample2sv[sample][chrA].push( sv )

		if(chrA!=chrB) {
			if(!sample2sv[sample][chrB]) sample2sv[sample][chrB]=[]
			sample2sv[sample][chrB].push( sv )
		}
	}
}




const lines=fs.readFileSync(cnvfile,{encoding:'utf8'}).trim().split('\n')

/*
1	Sample	SJOS001125_D1
2	Data From Project	PCGP
3	List In Project	PCGP
4	Sample List	OS
5	Diagnosis	OS
6	Subtype	OS
7	Subgroup	
8	Cohort	RECURRENCE
9	Seq Source	NEXT_GEN_WGS
10	Analysis Type	CONSERTING
11	Chr	19
12	Chr Start	20394641
13	Chr End	20844372
14	Log2Ratio	0.971
15	Genes Overlap Segment	2
16	Validation Status	MATCHED_SV
17	Is Public	t
*/

const samples = new Set()

for(let i=1; i<lines.length; i++) {
	const l = lines[i].split('\t')
	const v = Number.parseFloat(l[14-1])

	if(Number.isNaN(v)) {
		console.log('invalid logratio: '+lines[i])
		break
	}
	if(v==0) continue

	const sample = l[0]

	samples.add( sample )

	const j={
		sample:sample,
		value: v
		}
	const chr = 'chr'+l[11-1]
	const start = Number.parseInt(l[12-1])
	const stop  = Number.parseInt(l[13-1])
	if(Number.isNaN(start) || Number.isNaN(stop)) continue
	
	if(sample2sv[ sample ]) {
		if(sample2sv[sample][ chr ]) {

			let start_sv, // sv matching only to cnv.start
				stop_sv,  // sv matching only to cnv.stop
				match_sv  // sv entirely matching with cnv

			for(const sv of sample2sv[sample][chr]) {
				if(sv.chrA==sv.chrB) {
					// same chr
					if(sv.chrA==chr) {
						const p1 = Math.min(sv.posA, sv.posB)
						const p2 = Math.max(sv.posA, sv.posB)
						if(around(p1, start)) {
							if(around(p2, stop)) {
								match_sv = sv
							} else {
								start_sv = sv
							}
						} else if(around(p2, stop)) {
							stop_sv = sv
						}
					}
					continue
				}

				// A B different
				if(sv.chrA==chr) {
					if( around(sv.posA,start) ) {
						start_sv = sv

					} else if( around(sv.posA, stop) ) {
						stop_sv = sv
					}
				} else if(sv.chrB==chr) {
					if( around(sv.posB,start) ) {
						start_sv = sv
					} else if( around( sv.posB, stop ) ) {
						stop_sv = sv
					}
				}
			}

			if(match_sv) j.match_sv = match_sv
			if(start_sv) j.start_sv = start_sv
			if(stop_sv) j.stop_sv = stop_sv
		}
	}

	if(j.start_sv) {
		j.start_sv.posA--
		j.start_sv.posB--
	}
	if(j.stop_sv) {
		j.stop_sv.posA--
		j.stop_sv.posB--
	}
	if(j.match_sv) {
		j.match_sv.posA--
		j.match_sv.posB--
	}

	console.log(`${chr}\t${start-1}\t${stop-1}\t${JSON.stringify(j)}`)
}

console.log('#samples\t'+[...samples].join('\t'))



function around(x,y) {
	return Math.abs(x-y)<1000
}
