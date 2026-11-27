import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import serverconfig from '#src/serverconfig.js'
import { KB_FORMAT, parseKbText } from './kbFormat.ts'
import type { KbRow } from './kbFormat.ts'
import type { DriverKbMatch, DriverKbOverlay, DriverKbSource, GenomeDriverKb } from '#types'

/*
Loads the driver knowledge base (kb) of a genome, from the index.json that genome.driverKb points to, and the kb
of a dataset, which is the genome kb as changed by ds.driverKb. compileKb() indexes the rows for the classifiers
in rank.ts; the coordinates of the rules that match by position (exon, itd, cnv and sv rules, and the genes at
the breakpoints of an sv) come from the genome's gene db, so that the kb files stay free of genome builds. The
exception is the locus of an enhancer rule, which is not a gene: its row gives the coordinates in each build, and
the genome names its build in genome.driverKb.

	loadGenomeDriverKb()  at genome launch, from initGenomesDs.js
	initDsDriverKb()      at dataset launch, from mds3.init.js
	getDriverKb()         the kb of a request
*/

/** an isoform of a gene, with its exons in transcript order */
export type GeneLoc = {
	name: string
	isoform: string
	chr: string
	start: number
	stop: number
	exons: [number, number][]
}

/** the gene db lookups of compileKb(); from the genome's gene db (getGeneLookup()), or fakes in tests */
export type GeneLookup = {
	/** whether the symbol is a gene name of the gene db */
	isName: (name: string) => boolean
	/** the gene name of an alias, or null */
	aliasToName: (alias: string) => string | null
	/** the default RefSeq isoform of a gene, else its default isoform */
	gene: (name: string) => GeneLoc | null
	isoform: (isoform: string) => GeneLoc | null
	/** the default isoforms of the genes whose names match */
	genesMatching: (pattern: RegExp) => GeneLoc[]
}

export type MatchParams = DriverKbMatch
export type CnvCalls = MatchParams['cnv']['calls'][string]
export type KbSource = DriverKbSource

/** a locus of index.json: the genes of a name pattern, e.g. IGH; a rule may name it as a gene */
export type LocusDef = {
	genePattern: string
	/** the chromosome of the genes of the locus; a gene elsewhere that fits the pattern, e.g. an orphon of an IGH
	segment, is not in its region */
	chr?: string
}
export type Locus = {
	pattern: RegExp
	chr?: string
	/** the uppercased names of the genes of the gene db that are of the locus: fit its pattern, on its chr */
	members: Set<string>
	/** one region per chromosome, spanning the member genes there */
	regions: Region[]
}

/** a named region of genes, e.g. IGH, or of a locus with coordinates, e.g. an enhancer */
export type Region = { name: string; chr: string; start: number; stop: number }

export type ExonRule = KbRow & { chr: string; intervals: [number, number][] }
export type ItdRule = KbRow & { chr: string; intervals: [number, number][] }
export type CnvRule = KbRow & { loc: GeneLoc }
export type SvRule = KbRow & { geneRegions: Region[]; partnerRegions: Region[] }
export type EnhancerRule = KbRow & { region: Region }

export type DriverKb = {
	/** a hash of the kb files and the dataset changes, for caches and responses */
	version: string
	sources: KbSource[]
	match: MatchParams
	/** the rows that the kb is compiled from, for compiling the kb of a dataset that changes them */
	rows: KbRow[]
	/** the genome build, whose coordinates of enhancer rules the kb uses */
	build: string
	lociDefs: { [name: string]: LocusDef }
	loci: Map<string, Locus>
	/** every gene name that a rule names, to tell quickly whether an event gene has rules */
	genes: Set<string>
	snv: Map<string, Map<number, KbRow[]>>
	fs: Map<string, KbRow[]>
	inframe: Map<string, KbRow[]>
	exon: Map<string, ExonRule[]>
	gene: Map<string, KbRow[]>
	/** fusion rules by '5'::3'' */
	fusionPair: Map<string, KbRow[]>
	/** gene::* rules by the 5' gene */
	fusion5: Map<string, KbRow[]>
	/** *::gene rules by the 3' gene */
	fusion3: Map<string, KbRow[]>
	/** the genes of fusion rules by chr, to find the genes at the breakpoints of an sv that names none */
	fusionGenesByChr: Map<string, Region[]>
	sv: SvRule[]
	itdByChr: Map<string, ItdRule[]>
	cnvByChr: Map<string, CnvRule[]>
	enhancerByChr: Map<string, EnhancerRule[]>
	/** the gene name of an alias, to match an event that names a gene by an alias */
	aliasToName: (alias: string) => string | null
	/** whether a symbol is a gene name of the gene db, which an alias lookup must not change, e.g. FLG of
	filaggrin, an old alias of FGFR1 */
	isGeneName: (name: string) => boolean
	/** the rules left out of the compiled kb, e.g. a cnv rule of a gene that the gene db lacks */
	skipped: string[]
}

/** what compileKb() compiles: the rows of the kb files, with the index.json settings */
export type KbInput = {
	version: string
	sources: KbSource[]
	rows: KbRow[]
	build: string
	lociDefs: { [name: string]: LocusDef }
	match: MatchParams
}

export type DsDriverKb = DriverKbOverlay

const SOURCE_ID = /^[A-Za-z0-9_-]+$/
/** the farthest that the locus of an enhancer rule may be from its gene; a locus farther away has coordinates of
another build, or of another gene */
const MAX_ENHANCER_DISTANCE = 5000000

/** loads the kb that genome.driverKb points to; null when the file is missing, and throws when a file is invalid */
export function loadGenomeDriverKb(genome: any): DriverKb | null {
	const cfg: GenomeDriverKb = genome.driverKb
	if (typeof cfg?.file != 'string' || typeof cfg.build != 'string' || !cfg.build)
		throw `${genome.label}: genome.driverKb must be {file, build}`
	const indexFile = resolveKbFile(cfg.file)
	if (!indexFile) {
		console.log(`!!! ${genome.label}: driverKb file ${cfg.file} not found, driver ranking is off !!!`)
		return null
	}
	const kb = compileKb(readKbFiles(indexFile, cfg.build), getGeneLookup(genome.genedb))
	console.log(
		`${genome.label}: driverKb ${kb.version} has ${kb.rows.length} rules from ${kb.sources.map(s => s.id).join(', ')}` +
			(kb.skipped.length ? `; ${kb.skipped.length} rules left out, e.g. ${kb.skipped.slice(0, 3).join('; ')}` : '')
	)
	return kb
}

/** sets ds.__driverKb, the kb of the dataset: the genome kb, as changed by ds.driverKb; null for no ranking */
export function initDsDriverKb(ds: any, genome: any) {
	const genomeKb: DriverKb | null = genome.__driverKb || null
	if (ds.driverKb === false || !genomeKb) {
		if (ds.driverKb && !genomeKb) console.log(`${ds.label}: ds.driverKb is not used, as the genome has no driverKb`)
		ds.__driverKb = null
		return
	}
	if (!ds.driverKb) {
		ds.__driverKb = genomeKb
		return
	}
	ds.__driverKb = compileDsDriverKb(genomeKb, ds.driverKb, getGeneLookup(genome.genedb), serverconfig.tpmasterdir)
	console.log(`${ds.label}: driverKb ${ds.__driverKb.version} has ${ds.__driverKb.rows.length} rules`)
}

/** the kb of a request to a dataset, or null when the dataset has no driver ranking */
export function getDriverKb(ds: any, genome: any): DriverKb | null {
	if (ds.__driverKb !== undefined) return ds.__driverKb
	return ds.driverKb === false ? null : genome?.__driverKb || null
}

/** reads index.json and the source files that it lists, which must be in the same dir; enhancer rules get the
coordinates of the build */
export function readKbFiles(indexFile: string, build: string): KbInput {
	const indexText = fs.readFileSync(indexFile, 'utf8')
	let json: any
	try {
		json = JSON.parse(indexText)
	} catch (e: any) {
		throw `${indexFile}: invalid JSON: ${e.message || e}`
	}
	const index = parseIndex(json, indexFile)
	const hash = crypto.createHash('sha1').update(indexText)
	const dir = path.dirname(indexFile)
	const sources: KbSource[] = []
	const rows: KbRow[] = []
	for (const s of index.sources) {
		const text = fs.readFileSync(path.join(dir, s.file), 'utf8')
		hash.update(text)
		const f = parseKbText(text, s.file, s.id)
		sources.push(toSource(s.id, f.meta))
		rows.push(...f.rows)
	}
	return {
		version: hash.digest('hex').slice(0, 12),
		sources,
		rows,
		build,
		lociDefs: index.loci,
		match: index.match
	}
}

/** compiles the kb of a dataset from the genome kb and ds.driverKb */
export function compileDsDriverKb(
	genomeKb: DriverKb,
	cfg: DsDriverKb,
	lookup: GeneLookup,
	tpmasterdir: string,
	readText: (file: string) => string = file => fs.readFileSync(file, 'utf8')
): DriverKb {
	if (typeof cfg != 'object') throw 'ds.driverKb must be false or an object'
	const disable = new Set(cfg.disable || [])
	const isOff = (r: KbRow) => disable.has(r.id) || disable.has(r.source)
	const rows = genomeKb.rows.filter(r => !isOff(r))
	const sources = genomeKb.sources.filter(s => !disable.has(s.id))
	const hash = crypto
		.createHash('sha1')
		.update(genomeKb.version)
		.update(JSON.stringify(cfg.disable || []))
	if (cfg.file) {
		if (typeof cfg.file != 'string' || cfg.file.split('/').includes('..')) throw 'invalid ds.driverKb.file'
		const text = readText(path.join(tpmasterdir, cfg.file))
		hash.update(text)
		const f = parseKbText(text, cfg.file, 'ds')
		// disable applies to the rules of the dataset too, by their ids or by the source id ds
		if (!disable.has('ds')) sources.push(toSource('ds', f.meta))
		rows.push(...f.rows.filter(r => !isOff(r)))
	}
	const match = mergeMatch(genomeKb.match, cfg.match)
	hash.update(JSON.stringify(match))
	return compileKb(
		{
			version: hash.digest('hex').slice(0, 12),
			sources,
			rows,
			build: genomeKb.build,
			lociDefs: genomeKb.lociDefs,
			match
		},
		lookup
	)
}

/** indexes the rows of a kb for the classifiers; a rule whose genes are not in the gene db, and so has no
coordinates, is left out of the coordinate-based matches and listed in kb.skipped, as is an enhancer rule without
coordinates in the build, or whose locus is not near its gene */
export function compileKb(input: KbInput, lookup: GeneLookup): DriverKb {
	const kb: DriverKb = {
		version: input.version,
		sources: input.sources,
		match: input.match,
		rows: input.rows,
		build: input.build,
		lociDefs: input.lociDefs,
		loci: new Map(Object.entries(input.lociDefs).map(([name, d]) => [name, compileLocus(name, d, lookup)])),
		genes: new Set(),
		snv: new Map(),
		fs: new Map(),
		inframe: new Map(),
		exon: new Map(),
		gene: new Map(),
		fusionPair: new Map(),
		fusion5: new Map(),
		fusion3: new Map(),
		fusionGenesByChr: new Map(),
		sv: [],
		itdByChr: new Map(),
		cnvByChr: new Map(),
		enhancerByChr: new Map(),
		aliasToName: lookup.aliasToName,
		isGeneName: lookup.isName,
		skipped: []
	}
	const names = new Map<string, string>()
	const name = (g: string) => {
		if (g == '*' || kb.loci.has(g)) return g
		if (!names.has(g)) names.set(g, officialName(g, lookup))
		return names.get(g)!
	}
	const fusionGenes = new Set<string>()
	const regionsCache = new Map<string, Region[]>()
	const regionsOf = (g: string) => {
		if (!regionsCache.has(g)) regionsCache.set(g, getRegions(g, kb.loci, lookup))
		return regionsCache.get(g)!
	}

	for (const r0 of input.rows) {
		// the partner of an enhancer rule names its locus, not a gene
		const partnerIsGene = !!r0.partner && r0.kind != 'enhancer'
		const row: KbRow = { ...r0, gene: name(r0.gene), partner: partnerIsGene ? name(r0.partner) : r0.partner }
		for (const g of partnerIsGene ? [row.gene, row.partner] : [row.gene]) {
			if (g && g != '*' && !kb.loci.has(g)) kb.genes.add(g)
		}
		switch (row.kind) {
			case 'snv': {
				const byPos = getOrSet(kb.snv, row.gene, () => new Map<number, KbRow[]>())
				getOrSet(byPos, row.start!, () => []).push(row)
				break
			}
			case 'fs':
			case 'inframe':
			case 'gene':
				getOrSet(kb[row.kind], row.gene, () => []).push(row)
				break
			case 'exon': {
				const loc = row.isoform ? lookup.isoform(row.isoform) : lookup.gene(row.gene)
				const intervals = loc && exonIntervals(loc, row.exon!)
				if (!loc || !intervals) {
					kb.skipped.push(`${row.id}: no ${loc ? 'such exon' : 'isoform'} of ${row.gene}`)
					break
				}
				getOrSet(kb.exon, row.gene, () => []).push({ ...row, chr: loc.chr, intervals })
				break
			}
			case 'fusion': {
				if (row.gene != '*' && row.partner != '*')
					getOrSet(kb.fusionPair, `${row.gene}::${row.partner}`, () => []).push(row)
				else if (row.gene != '*') getOrSet(kb.fusion5, row.gene, () => []).push(row)
				else getOrSet(kb.fusion3, row.partner, () => []).push(row)
				for (const g of [row.gene, row.partner]) if (g != '*') fusionGenes.add(g)
				break
			}
			case 'sv': {
				const geneRegions = regionsOf(row.gene)
				const partnerRegions = row.partner == '*' ? [] : regionsOf(row.partner)
				if (!geneRegions.length || (row.partner != '*' && !partnerRegions.length)) {
					// still matched by the gene names of fusion events
					kb.skipped.push(`${row.id}: sv breakpoints not matched, no coordinates of ${row.gene} or ${row.partner}`)
				}
				kb.sv.push({ ...row, geneRegions, partnerRegions })
				break
			}
			case 'itd': {
				const loc = row.isoform ? lookup.isoform(row.isoform) : lookup.gene(row.gene)
				const intervals = loc && (row.exon ? exonIntervals(loc, row.exon) : [[loc.start, loc.stop] as [number, number]])
				if (!loc || !intervals) {
					kb.skipped.push(`${row.id}: no coordinates of ${row.gene}`)
					break
				}
				getOrSet(kb.itdByChr, loc.chr, () => []).push({ ...row, chr: loc.chr, intervals })
				break
			}
			case 'amp':
			case 'del':
			case 'deepDel': {
				const loc = lookup.gene(row.gene)
				if (!loc) {
					kb.skipped.push(`${row.id}: no coordinates of ${row.gene}`)
					break
				}
				getOrSet(kb.cnvByChr, loc.chr, () => []).push({ ...row, loc })
				break
			}
			case 'enhancer': {
				const r = row.regions?.[input.build]
				const region: Region | null = r ? { name: row.partner, ...r } : null
				const problem = enhancerProblem(row, region, lookup.gene(row.gene), input.build)
				if (problem) {
					kb.skipped.push(`${row.id}: ${problem}`)
					break
				}
				getOrSet(kb.enhancerByChr, region!.chr, () => []).push({ ...row, region: region! })
				break
			}
		}
	}
	for (const g of fusionGenes) {
		for (const r of regionsOf(g)) getOrSet(kb.fusionGenesByChr, r.chr, () => []).push(r)
	}
	return kb
}

/** the gene db lookups of a genome */
export function getGeneLookup(genedb: any): GeneLookup {
	if (!genedb?.getjsonbyname) {
		return {
			isName: () => false,
			aliasToName: () => null,
			gene: () => null,
			isoform: () => null,
			genesMatching: () => []
		}
	}
	const geneCache = new Map<string, GeneLoc | null>()
	let names: string[] | undefined
	const lookup: GeneLookup = {
		// in memory, from genedbLookups.ts, as a ranking checks every event gene that has no rules; case-insensitive,
		// as is the sql of the gene db
		isName: name => (genedb.mapByName ? genedb.mapByName.has(name.toUpperCase()) : !!genedb.getjsonbyname.get(name)),
		aliasToName: alias => genedb.getNameByAlias?.get(alias)?.name || null,
		gene: name => {
			if (!geneCache.has(name)) geneCache.set(name, pickDefaultIsoform(genedb.getjsonbyname.all(name)))
			return geneCache.get(name)!
		},
		isoform: isoform => {
			// a versioned accession, e.g. ENST00000241453.7, is in the gene db without its version
			const row = genedb.getjsonbyisoform.get(isoform.replace(/\.\d+$/, ''))
			return row ? toGeneLoc(row.genemodel) : null
		},
		genesMatching: pattern => {
			names ??= genedb.db
				.prepare('select distinct name from genes')
				.all()
				.map((r: any) => r.name)
			return names!.filter(n => pattern.test(n)).flatMap(n => lookup.gene(n) || [])
		}
	}
	return lookup
}

function resolveKbFile(file: unknown): string | null {
	if (typeof file != 'string' || !file) return null
	if (path.isAbsolute(file)) return fs.existsSync(file) ? file : null
	// a mounted app dir may override the packaged files, as with the genome file, see initGenomesDs.js
	for (const dir of [process.cwd(), serverconfig.binpath]) {
		const f = path.join(dir, file)
		if (fs.existsSync(f)) return f
	}
	return null
}

/** the parsed index.json */
export type KbIndex = {
	sources: { id: string; file: string }[]
	loci: { [name: string]: LocusDef }
	match: MatchParams
}

/** checks index.json; throws '<file>: <reason>' */
export function parseIndex(json: any, file: string): KbIndex {
	if (json?.format != KB_FORMAT) throw `${file}: format is not ${KB_FORMAT}`
	if (!Array.isArray(json.sources) || !json.sources.length) throw `${file}: sources[] missing`
	const ids = new Set<string>()
	for (const s of json.sources) {
		if (typeof s?.id != 'string' || !SOURCE_ID.test(s.id) || s.id == 'ds') throw `${file}: invalid source id ${s?.id}`
		if (ids.has(s.id)) throw `${file}: duplicate source id ${s.id}`
		ids.add(s.id)
		// a source file must be in the dir of index.json
		if (typeof s.file != 'string' || !s.file || s.file.includes('/') || s.file.startsWith('.'))
			throw `${file}: invalid file of source ${s.id}`
	}
	// a locus of gene names, e.g. IGH; the locus of an enhancer is not a gene, and its rule gives its coordinates
	const loci: KbIndex['loci'] = {}
	for (const [name, l] of Object.entries<any>(json.loci || {})) {
		if (typeof l?.genePattern != 'string') throw `${file}: loci.${name}.genePattern missing`
		try {
			new RegExp(l.genePattern)
		} catch (_) {
			throw `${file}: loci.${name}.genePattern is not a regular expression`
		}
		if (l.chr !== undefined && (typeof l.chr != 'string' || !l.chr)) throw `${file}: loci.${name}.chr must be a string`
		loci[name] = l.chr ? { genePattern: l.genePattern, chr: l.chr } : { genePattern: l.genePattern }
	}
	checkMatch(json.match, file)
	return { sources: json.sources, loci, match: json.match }
}

/** why an enhancer rule cannot match in this genome, or '' */
function enhancerProblem(row: KbRow, region: Region | null, gene: GeneLoc | null, build: string): string {
	if (!region) return `no coordinates of ${row.partner} in ${build}`
	if (!gene) return `no coordinates of ${row.gene}`
	const distance = Math.max(0, region.start - gene.stop, gene.start - region.stop)
	if (gene.chr != region.chr || distance > MAX_ENHANCER_DISTANCE)
		return `${row.partner} is not within ${MAX_ENHANCER_DISTANCE} bp of ${row.gene}, are its coordinates of another build?`
	return ''
}

function checkMatch(m: any, file: string) {
	const num = (v: any, key: string) => {
		if (typeof v != 'number' || !Number.isFinite(v)) throw `${file}: match.${key} must be a number`
	}
	if (typeof m?.fusion?.geneAIs5prime != 'boolean') throw `${file}: match.fusion.geneAIs5prime must be true or false`
	if (m.sv?.wildcardTier !== 1 && m.sv?.wildcardTier !== 2) throw `${file}: match.sv.wildcardTier must be 1 or 2`
	num(m.cnv?.focalMaxLength, 'cnv.focalMaxLength')
	if (typeof m.cnv.calls != 'object') throw `${file}: match.cnv.calls missing`
	for (const [type, c] of Object.entries<any>(m.cnv.calls)) {
		for (const k of ['amp', 'del', 'deepDel']) num(c?.[k], `cnv.calls.${type}.${k}`)
		if (!(c.deepDel <= c.del && c.del < c.amp)) throw `${file}: match.cnv.calls.${type} needs deepDel <= del < amp`
		if (c.gain !== undefined) {
			num(c.gain, `cnv.calls.${type}.gain`)
			if (!(c.del < c.gain && c.gain <= c.amp)) throw `${file}: match.cnv.calls.${type} needs del < gain <= amp`
		}
	}
	num(m.hypermutated?.minSnvindel, 'hypermutated.minSnvindel')
}

function mergeMatch(base: MatchParams, over: DsDriverKb['match']): MatchParams {
	if (!over) return base
	const calls = { ...base.cnv.calls }
	for (const [type, c] of Object.entries(over.cnv?.calls || {})) calls[type] = { ...calls[type], ...c } as CnvCalls
	const match = {
		fusion: { ...base.fusion, ...over.fusion },
		sv: { ...base.sv, ...over.sv },
		cnv: { focalMaxLength: over.cnv?.focalMaxLength ?? base.cnv.focalMaxLength, calls },
		hypermutated: { ...base.hypermutated, ...over.hypermutated }
	}
	checkMatch(match, 'ds.driverKb')
	return match
}

function toSource(id: string, meta: { [key: string]: string }): KbSource {
	return {
		id,
		label: meta.source,
		license: meta.license,
		licenseUrl: meta.licenseUrl,
		url: meta.url,
		attribution: meta.attribution
	}
}

function officialName(name: string, lookup: GeneLookup): string {
	if (lookup.isName(name)) return name
	return lookup.aliasToName(name) || name
}

/** the regions of a locus, else of a gene */
function getRegions(name: string, loci: Map<string, Locus>, lookup: GeneLookup): Region[] {
	const locus = loci.get(name)
	if (locus) return locus.regions
	const loc = lookup.gene(name)
	return loc ? [{ name, chr: loc.chr, start: loc.start, stop: loc.stop }] : []
}

/** the member genes and the regions of a locus: the genes of the gene db that fit its pattern, on its chr */
function compileLocus(name: string, d: LocusDef, lookup: GeneLookup): Locus {
	const pattern = new RegExp(d.genePattern)
	const genes = lookup.genesMatching(pattern).filter(g => !d.chr || g.chr == d.chr)
	// one region per chromosome, spanning the genes of the locus there
	const byChr = new Map<string, Region>()
	for (const g of genes) {
		const r = byChr.get(g.chr)
		if (!r) byChr.set(g.chr, { name, chr: g.chr, start: g.start, stop: g.stop })
		else {
			r.start = Math.min(r.start, g.start)
			r.stop = Math.max(r.stop, g.stop)
		}
	}
	return { pattern, chr: d.chr, members: new Set(genes.map(g => g.name.toUpperCase())), regions: [...byChr.values()] }
}

function exonIntervals(loc: GeneLoc, exon: [number, number]): [number, number][] | null {
	if (exon[1] > loc.exons.length) return null
	return loc.exons.slice(exon[0] - 1, exon[1])
}

function pickDefaultIsoform(rows: { isdefault: number; genemodel: string }[]): GeneLoc | null {
	const locs = rows.filter(r => r.isdefault).map(r => toGeneLoc(r.genemodel))
	const ok = locs.filter((l): l is GeneLoc => !!l)
	const refseq = ok.find(l => /^N[MR]_/.test(l.isoform))
	if (refseq || ok[0]) return refseq || ok[0]
	// no default isoform: the first one
	for (const r of rows) {
		const l = toGeneLoc(r.genemodel)
		if (l) return l
	}
	return null
}

function toGeneLoc(genemodel: string): GeneLoc | null {
	let gm: any
	try {
		gm = JSON.parse(genemodel)
	} catch (_) {
		return null
	}
	if (typeof gm?.chr != 'string' || !Number.isFinite(gm.start) || !Number.isFinite(gm.stop)) return null
	return {
		name: gm.name,
		isoform: gm.isoform,
		chr: gm.chr,
		start: gm.start,
		stop: gm.stop,
		exons: Array.isArray(gm.exon) ? gm.exon : []
	}
}

function getOrSet<K, V>(map: Map<K, V>, key: K, make: () => V): V {
	let v = map.get(key)
	if (v === undefined) {
		v = make()
		map.set(key, v)
	}
	return v
}
