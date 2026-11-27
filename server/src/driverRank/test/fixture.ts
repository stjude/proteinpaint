import { compileKb } from '../kb.ts'
import { KB_COLUMNS, KB_FORMAT, parseKbText } from '../kbFormat.ts'
import type { DriverKb, GeneLoc, GeneLookup, MatchParams } from '../kb.ts'

/*
a small kb for the driverRank specs: rules of three sources, written as kb file text and parsed, and a fake gene
db with the coordinates of their genes (hg38-like, not exact)
*/

const exons = (list: [number, number][]) => list

export const genes: { [name: string]: GeneLoc } = {
	KRAS: { name: 'KRAS', isoform: 'NM_004985', chr: 'chr12', start: 25205246, stop: 25250929, exons: [] },
	TP53: { name: 'TP53', isoform: 'NM_000546', chr: 'chr17', start: 7661779, stop: 7687538, exons: [] },
	NPM1: {
		name: 'NPM1',
		isoform: 'NM_002520',
		chr: 'chr5',
		start: 171387116,
		stop: 171411137,
		// 11 exons, the last one at the end of the gene
		exons: exons([
			...Array.from({ length: 10 }, (_, i) => [171387116 + i * 2000, 171387116 + i * 2000 + 100] as [number, number]),
			[171410526, 171410900]
		])
	},
	FLT3: { name: 'FLT3', isoform: 'NM_004119', chr: 'chr13', start: 28003274, stop: 28100592, exons: [] },
	UBTF: {
		name: 'UBTF',
		isoform: 'NM_014233',
		chr: 'chr17',
		start: 44200000,
		stop: 44221000,
		// minus strand: in transcript order, exon 13 is at [44208000,44208200] and exon 11 at [44210000,44210200]
		exons: exons(Array.from({ length: 21 }, (_, i) => [44220000 - i * 1000, 44220200 - i * 1000] as [number, number]))
	},
	MYC: { name: 'MYC', isoform: 'NM_002467', chr: 'chr8', start: 127736230, stop: 127742951, exons: [] },
	MYCN: { name: 'MYCN', isoform: 'NM_005378', chr: 'chr2', start: 15940550, stop: 15947004, exons: [] },
	CDKN2A: { name: 'CDKN2A', isoform: 'NM_000077', chr: 'chr9', start: 21967752, stop: 21995301, exons: [] },
	KMT2A: { name: 'KMT2A', isoform: 'NM_001197104', chr: 'chr11', start: 118436490, stop: 118526832, exons: [] },
	MLLT3: { name: 'MLLT3', isoform: 'NM_004529', chr: 'chr9', start: 20341669, stop: 20622499, exons: [] },
	BCR: { name: 'BCR', isoform: 'NM_004327', chr: 'chr22', start: 23180365, stop: 23318037, exons: [] },
	ABL1: { name: 'ABL1', isoform: 'NM_005157', chr: 'chr9', start: 130713946, stop: 130887675, exons: [] },
	IGHM: { name: 'IGHM', isoform: 'IGHM', chr: 'chr14', start: 105851705, stop: 105856218, exons: [] },
	'IGHV1-2': { name: 'IGHV1-2', isoform: 'IGHV1-2', chr: 'chr14', start: 105986000, stop: 105987000, exons: [] },
	TERT: { name: 'TERT', isoform: 'NM_198253', chr: 'chr5', start: 1253167, stop: 1295068, exons: [] },
	CRLF2: { name: 'CRLF2', isoform: 'NM_022148', chr: 'chrX', start: 1190449, stop: 1212815, exons: [] },
	// genes that fit a loose IGH pattern but are not of the IGH locus: an unrelated gene, and an orphon; and a
	// pseudogene that fits the IGH pattern, but is on chr9
	IGHEP2: { name: 'IGHEP2', isoform: 'IGHEP2', chr: 'chr9', start: 5113548, stop: 5114804, exons: [] },
	// the first and last genes of IGK and IGL, an IGK orphon on chr2, and genes that start with IGL but are not of it
	IGKC: { name: 'IGKC', isoform: 'IGKC', chr: 'chr2', start: 88857161, stop: 88857683, exons: [] },
	'IGKV1D-8': { name: 'IGKV1D-8', isoform: 'IGKV1D-8', chr: 'chr2', start: 90234800, stop: 90235370, exons: [] },
	'IGKV1OR2-108': {
		name: 'IGKV1OR2-108',
		isoform: 'IGKV1OR2-108',
		chr: 'chr2',
		start: 110000000,
		stop: 110000500,
		exons: []
	},
	'IGLV4-69': { name: 'IGLV4-69', isoform: 'IGLV4-69', chr: 'chr22', start: 22026075, stop: 22026600, exons: [] },
	IGLC7: { name: 'IGLC7', isoform: 'IGLC7', chr: 'chr22', start: 22922600, stop: 22923034, exons: [] },
	IGLL1: { name: 'IGLL1', isoform: 'NM_020070', chr: 'chr22', start: 23573124, stop: 23580290, exons: [] },
	FGFR1: { name: 'FGFR1', isoform: 'NM_023110', chr: 'chr8', start: 38411138, stop: 38468834, exons: [] },
	// filaggrin, whose symbol is an old alias of FGFR1
	FLG: { name: 'FLG', isoform: 'NM_002016', chr: 'chr1', start: 152302165, stop: 152325239, exons: [] },
	IGLON5: { name: 'IGLON5', isoform: 'NM_001101372', chr: 'chr19', start: 51311643, stop: 51330891, exons: [] },
	IGHMBP2: { name: 'IGHMBP2', isoform: 'NM_002180', chr: 'chr11', start: 68903890, stop: 68940601, exons: [] },
	'IGHV1OR15-1': {
		name: 'IGHV1OR15-1',
		isoform: 'IGHV1OR15-1',
		chr: 'chr15',
		start: 21000000,
		stop: 21001000,
		exons: []
	}
}

/** the loci of index.json */
export const lociDefs = {
	IGH: { genePattern: '^IGH(@|[VDJAEG](?!.*OR)|M$)', chr: 'chr14' },
	IGK: { genePattern: '^IGK(@|[VJ](?!.*OR)|C$)', chr: 'chr2' },
	IGL: { genePattern: '^IGL(@|[VJ](?!.*OR)|C\\d$)', chr: 'chr22' }
}

export const lookup: GeneLookup = {
	isName: name => name in genes,
	aliasToName: alias => ({ OLDKRAS: 'KRAS', FLG: 'FGFR1' }[alias] || null),
	gene: name => genes[name] || null,
	isoform: isoform => Object.values(genes).find(g => g.isoform == isoform.replace(/\.\d+$/, '')) || null,
	genesMatching: pattern => Object.values(genes).filter(g => pattern.test(g.name))
}

export const match: MatchParams = {
	fusion: { geneAIs5prime: true },
	sv: { wildcardTier: 2 },
	cnv: {
		focalMaxLength: 3000000,
		calls: {
			log2ratio: { amp: 1, gain: 0.2, del: -0.3, deepDel: -1.3 },
			copyNumber: { amp: 6, gain: 3, del: 1, deepDel: 0 }
		}
	},
	hypermutated: { minSnvindel: 500 }
}

type Rule = { [col: string]: string | number }

export const rules: { [source: string]: Rule[] } = {
	hotspots: [
		{ id: 'hotspots:KRAS:G12', kind: 'snv', gene: 'KRAS', start: 12, ref: 'G', alt: 'D,V', tier: 1 },
		{ id: 'hotspots:TP53:X126', kind: 'snv', gene: 'TP53', start: 126, ref: 'X', alt: 'sp', tier: 1 },
		{ id: 'hotspots:FLT3:578-613', kind: 'inframe', gene: 'FLT3', start: 578, end: 613, tier: 1 }
	],
	civic: [
		{ id: 'civic:1', kind: 'fusion', gene: 'BCR', partner: 'ABL1', tier: 1 },
		{ id: 'civic:2', kind: 'fusion', gene: 'KMT2A', partner: '*', tier: 1 },
		{ id: 'civic:3', kind: 'fs', gene: 'NPM1', start: 288, ref: 'W', tier: 1 },
		{ id: 'civic:4', kind: 'exon', gene: 'NPM1', exon: '11', alt: 'any', tier: 1 },
		{ id: 'civic:5', kind: 'gene', gene: 'NPM1', alt: 'any', tier: 2 },
		{ id: 'civic:6', kind: 'gene', gene: 'KRAS', alt: 'any', tier: 2 },
		{ id: 'civic:7', kind: 'itd', gene: 'FLT3', tier: 1 },
		{ id: 'civic:8', kind: 'amp', gene: 'MYCN', tier: 1 },
		{ id: 'civic:9', kind: 'del', gene: 'CDKN2A', tier: 1 },
		{ id: 'civic:10', kind: 'fusion', gene: 'IGH', partner: 'CRLF2', tier: 1 },
		{ id: 'civic:11', kind: 'fusion', gene: '*', partner: 'FGFR1', tier: 1 }
	],
	curated: [
		{ id: 'curated:1', kind: 'itd', gene: 'UBTF', exon: '13', isoform: 'NM_014233', tier: 1 },
		{ id: 'curated:2', kind: 'deepDel', gene: 'CDKN2A', tier: 1 },
		{ id: 'curated:3', kind: 'sv', gene: 'IGH', partner: 'MYC', window: 1000000, tier: 1 },
		{ id: 'curated:4', kind: 'sv', gene: 'TERT', partner: '*', window: 50000, tier: 1 },
		{ id: 'curated:5', kind: 'amp', gene: 'MYC', tier: 1 },
		{ id: 'curated:7', kind: 'sv', gene: 'IGK', partner: 'MYC', window: 1000000, tier: 1 },
		{ id: 'curated:8', kind: 'sv', gene: 'IGL', partner: 'MYC', window: 1000000, tier: 1 },
		// N-Me, 1.43 Mb 3' of MYC; hg38 is the build of the fake gene db
		{
			id: 'curated:6',
			kind: 'enhancer',
			gene: 'MYC',
			partner: 'N-Me',
			alt: 'gain',
			region: 'hg19=chr8:130180065-130180972,hg38=chr8:129167819-129168726',
			tier: 2
		}
	]
}

/** the text of a kb file with the rules */
export function kbText(rows: Rule[], meta: { [key: string]: string } = {}): string {
	const m = { format: KB_FORMAT, source: 'test source', license: 'test license', ...meta }
	return [
		...Object.entries(m).map(([k, v]) => `#${k}=${v}`),
		KB_COLUMNS.join('\t'),
		...rows.map(r => KB_COLUMNS.map(c => r[c] ?? '').join('\t'))
	].join('\n')
}

/** the kb of the rules, parsed from kb file text, in a genome build */
export function getKb(matchParams: MatchParams = match, build = 'hg38', ruleList = rules): DriverKb {
	const sources = Object.keys(ruleList).map(id => ({ id, label: id, license: 'test license' }))
	const rows = Object.entries(ruleList).flatMap(([id, list]) => parseKbText(kbText(list), id + '.txt', id).rows)
	return compileKb({ version: 'test', sources, rows, build, lociDefs, match: matchParams }, lookup)
}
