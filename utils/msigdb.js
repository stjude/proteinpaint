/*
parse MSigDB XML file
(at download page https://www.gsea-msigdb.org/gsea/downloads.jsp, find this file
https://www.gsea-msigdb.org/gsea/msigdb/download_file.jsp?filePath=/msigdb/release/7.5.1/msigdb_v7.5.1.xml)


************* three examples

H > HALLMARK_ADIPOGENESIS

<GENESET STANDARD_NAME="HALLMARK_ADIPOGENESIS" SYSTEMATIC_NAME="M5905" HISTORICAL_NAME="" ORGANISM="Homo sapiens" PMID="26771021" AUTHORS="Liberzon A,Birger C,Thorvaldsdóttir H,Ghandi M,Mesirov JP,Tamayo P." GEOID="" EXACT_SOURCE="" GENESET_LISTING_URL="" EXTERNAL_DETAILS_URL="" CHIP="HUMAN_GENE_SYMBOL" CATEGORY_CODE="H" SUB_CATEGORY_CODE="" CONTRIBUTOR="Arthur Liberzon" CONTRIBUTOR_ORG="MSigDB Team" DESCRIPTION_BRIEF="Genes up-regulated during adipocyte differentiation (adipogenesis)." DESCRIPTION_FULL="" TAGS="" MEMBERS="FABP4,ADIPOQ,PPARG,LIPE,DGAT1,LPL,CPT2,CD36,GPAM,ADIPOR2,ACAA2,ETFB,ACOX1,ACADM,HADH,IDH1

C2 > CGP > ABBUD_LIF_SIGNALING_1_DN

<GENESET STANDARD_NAME="ABBUD_LIF_SIGNALING_1_DN" SYSTEMATIC_NAME="M1423" HISTORICAL_NAME="" ORGANISM="Mus musculus" PMID="14576184" AUTHORS="Abbud RA,Kelleher R,Melmed S" GEOID="" EXACT_SOURCE="Table 2" GENESET_LISTING_URL="" EXTERNAL_DETAILS_URL="" CHIP="MOUSE_SEQ_ACCESSION" CATEGORY_CODE="C2" SUB_CATEGORY_CODE="CGP"


C2 > CP > CP:BIOCARTA > BIOCARTA_41BB_PATHWAY

<GENESET STANDARD_NAME="BIOCARTA_41BB_PATHWAY" SYSTEMATIC_NAME="M2064" HISTORICAL_NAME="" ORGANISM="Homo sapiens" PMID="" AUTHORS="" GEOID="" EXACT_SOURCE="" GENESET_LISTING_URL="" EXTERNAL_DETAILS_URL="https://data.broadinstitute.org/gsea-msigdb/msigdb/biocarta/human/h_41BBPathway.gif" CHIP="Human_RefSeq" CATEGORY_CODE="C2" SUB_CATEGORY_CODE="CP:BIOCARTA" 


*************** parsing logic
only parse lines starting with "<GENESET"
fields of each line:
- STANDARD_NAME
	term id
- DESCRIPTION_BRIEF
- CATEGORY_CODE
	level 1
- SUB_CATEGORY_CODE
	level 2, or
	level 2:3
- MEMBERS
	list of gene symbols


create new table "termid2genes"
*/

if (process.argv.length != 3) {
	console.log('<XML file> creates "msigdb.db" in the current folder')
	process.exit()
}

const xmlFile = process.argv[2]

const fs = require('fs'),
	readline = require('readline')

// for now, skip these at L1
const L1skip = new Set(['ARCHIVED'])

const L1name = {
	C1: 'C1: positional gene sets',
	C2: 'C2: curated gene sets',
	C3: 'C3: regulatory target gene sets',
	C4: 'C4: computational gene sets',
	C5: 'C5: ontology gene sets',
	C6: 'C6: oncogenic signature gene sets',
	C7: 'C7: immunologic signature gene sets',
	C8: 'C8: cell type signature gene sets',
	H: 'H: hallmark gene sets'
}
const L2name = {
	C1_NONE: 'C1_NONE',
	C2_CGP: 'CGP: chemical and genetic perturbations',
	C2_CP: 'CP: Canonical pathways',
	C5_GO: 'GO: Gene Ontology gene sets',
	CGN: 'CGN: cancer gene neighborhoods',
	CGP: 'CGP: chemical and genetic perturbations',
	CM: 'CM: cancer modules',
	CP: 'CP: Canonical pathways',
	GO: 'GO: Gene Ontology gene sets',
	HPO: 'HPO: Human Phenotype Ontology',
	IMMUNESIGDB: 'ImmuneSigDB subset of C7',
	MIR: 'MIR: microRNA targets',
	TFT: 'TFT: transcription factor targets',
	VAX: 'VAX: vaccine reponse gene sets'
}
const L3name = {
	BIOCARTA: 'BIOCARTA subset of CP',
	BP: 'BP: subset of GO',
	CC: 'CC: subset of GO',
	GTRD: 'GTRD subset of TFT',
	KEGG: 'KEGG subset of CP',
	MF: 'MF: subset of GO',
	MIRDB: 'miRDB subset of MIR',
	MIR_Legacy: 'MIR_Legacy subset of MIR',
	PID: 'PID subset of CP',
	REACTOME: 'REACTOME subset of CP',
	TFT_Legacy: 'TFT_Legacy subset of TFT',
	WIKIPATHWAYS: 'WikiPathways subset of CP'
}

const id2term = new Map()
/*
key: term id
value: { type:str, L1:str, L2:str, L3:str, genes }
*/

const rl = readline.createInterface({ input: fs.createReadStream(xmlFile) })
rl.on('line', line => {
	if (!line.startsWith('<GENESET ')) {
		console.log('skipped line:', line)
		return
	}
	parseLine(line)
})
rl.on('close', () => {
	outputPhenotree()
})

/*
find two patterns
keyOnly(space)
key="word1(space)word2"
*/
function parseLine(line) {
	const k2v = new Map()

	let previousIndex = 0,
		doubleQuoteStarted = false,
		thisKey

	for (let i = 0; i < line.length; i++) {
		const c = line[i]
		if (doubleQuoteStarted) {
			if (c == '"') {
				// seeing 2nd "
				const thisValue = line.substring(previousIndex, i)
				k2v.set(thisKey, thisValue)
				doubleQuoteStarted = false
				thisKey = null
				previousIndex = i + 2
			}
			// ignore all else characters as they are all inside the quoted value for thisKey
			continue
		}

		// for the rest, hasn't seen first double quote

		if (c == '"') {
			// seeing 1st "
			doubleQuoteStarted = true
			previousIndex = i + 1
			continue
		}
		if (c == ' ') {
			previousIndex = i + 1
			continue
		}
		if (c == '=') {
			// end of key
			thisKey = line.substring(previousIndex, i)
		}
	}

	// an object {L1, L2, L3, genes}
	const term = {
		L1: null, // required
		L2: '-', // optional
		L3: '-', // optional
		genes: []
	}

	try {
		const id = k2v.get('STANDARD_NAME')
		if (!id) throw 'STANDARD_NAME missing or blank'

		const L1 = k2v.get('CATEGORY_CODE')
		if (!L1) throw 'CATEGORY_CODE missing or blank'
		if (L1skip.has(L1)) return

		term.L1 = L1name[L1]
		if (!term.L1) throw 'unknown L1: ' + L1

		const tmp = k2v.get('SUB_CATEGORY_CODE')
		if (tmp) {
			// if both L2+L3, that will be joined by :
			const [L2, L3] = tmp.split(':')
			if (!L2) throw 'SUB_CATEGORY_CODE begins with ":"'
			term.L2 = L2name[L2]
			if (!term.L2) throw 'unknown L2: ' + L2
			if (L3) {
				term.L3 = L3name[L3]
				if (!term.L3) throw 'unknown L3: ' + L3
			}
		}

		id2term.set(id, term)
	} catch (e) {
		throw 'Error: ' + e + '\nLINE ' + line
	}
}

function outputPhenotree() {
	const lines = ['Level_1\tLevel_2\tLevel_3\tLevel_4\tVariable\ttype']

	let maxIdLen = 0
	for (const [id, term] of id2term) {
		const { L1, L2, L3 } = term
		maxIdLen = Math.max(id.length, L1.length, L2.length, L3.length)
		if (L2 == '-') {
			lines.push(`${L1}\t${id}\t-\t-\t${id}\tcategorical`)
			continue
		}
		if (L3 == '-') {
			lines.push(`${L1}\t${L2}\t${id}\t-\t${id}\tcategorical`)
			continue
		}
		lines.push(`${L1}\t${L2}\t${L3}\t${id}\t${id}\tcategorical`)
	}
	fs.writeFileSync('phenotree', lines.join('\n'))

	console.log('max ID length: ' + maxIdLen)
}
