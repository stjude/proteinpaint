import tape from 'tape'
import Database from 'better-sqlite3'
import { mkdtemp, writeFile, unlink, rmdir, symlink } from 'node:fs/promises'
import path from 'node:path'
import serverconfig from '../serverconfig.js'
import { guardDb } from '../sql.ts'
import {
	validate_query_ssGSEA,
	validate_query_dnaMethylation,
	validate_query_metaboliteIntensity
} from '../mds3.init.js'
import { validateQueryIsoformExpression } from '../routes/termdb.cluster.ts'
import { validate_query_proteome } from '../routes/termdb.proteome.ts'
import { validatePseudobulk } from '../singleCell/validatePseudobulk.ts'
import { getJunctionData } from '../j2/validate.ts'

const fixture = 'files/hg38/TermdbTest'
const names = ['source-a', 'source-b', 'sister']

function makeDs(down) {
	const connection = guardDb(new Database(':memory:'), 'off')
	connection.exec(`
		CREATE TABLE sampleidmap (id INTEGER, name TEXT, sample_type INTEGER);
		CREATE TABLE sample_ancestry (sample_id INTEGER, ancestor_id INTEGER);
		CREATE TABLE anno_categorical (sample INTEGER, term_id TEXT, value TEXT);
		INSERT INTO sampleidmap VALUES (10,'p1',1),(11,'p2',1),(20,'c1',2),(40,'c2',2),(50,'c3',2),(30,'s',3);
		INSERT INTO sample_ancestry VALUES (20,10),(50,10),(40,11),(30,10);
		INSERT INTO anno_categorical VALUES (10,'status','keep'),(11,'status','drop'),
			(20,'status','keep'),(50,'status','drop'),(40,'status','drop');
	`)
	const name2id = new Map()
	const id2name = new Map()
	const ids = down ? [10, 11, 30] : [20, 40, 30]
	const ds = {
		label: 'NumericMapping',
		sampleId2Type: new Map([
			[10, 1],
			[11, 1],
			[20, 2],
			[40, 2],
			[50, 2],
			[30, 3]
		]),
		cohort: {
			db: { connection },
			termdb: {
				hasSampleAncestry: true,
				sampleTypes: { 1: { parent_id: null }, 2: { parent_id: 1 }, 3: { parent_id: 1 } },
				q: {
					sampleName2id: name => {
						if (!name2id.has(name)) {
							const id = ids[Math.min(name2id.size, 2)]
							name2id.set(name, id)
							if (!id2name.has(id)) id2name.set(id, name)
						}
						return name2id.get(name)
					},
					id2sampleName: id => id2name.get(Number(id)) || `sample-${id}`
				}
			}
		},
		queries: {}
	}
	return { ds, connection, ids }
}

for (const type of [
	'isoformExpression',
	'ssGSEA',
	'metaboliteIntensity',
	'proteomeAbundance',
	'dnaMethylation',
	'elements',
	'shards',
	'junction',
	'pseudobulk'
]) {
	tape(`numeric getter mapping: ${type} selects sources, maps, then filters`, async t => {
		for (const down of [false, true]) {
			const { ds, connection, ids } = makeDs(down)
			const dir = await mkdtemp(path.join(serverconfig.tpmasterdir, 'numeric-mapping-'))
			const files = []
			try {
				let getter
				const term = {
					type: type === 'elements' || type === 'shards' ? 'dnaMethylation' : type,
					sampleTypes: [down ? 1 : 2]
				}
				let details
				if (type === 'isoformExpression') {
					ds.queries.isoformExpression = { file: `${fixture}/rnaseq/TermdbTest.isoform.tpm.h5` }
					await validateQueryIsoformExpression(ds, {})
					term.isoform = 'ENST00000370314'
					getter = ds.queries.isoformExpression.get
				} else if (type === 'ssGSEA') {
					ds.queries.ssGSEA = { file: `${fixture}/rnaseq/TermdbTest.ssgsea.h5` }
					await validate_query_ssGSEA(ds, { termdbs: {} })
					term.id = 'ABBUD_LIF_SIGNALING_1_DN'
					getter = ds.queries.ssGSEA.get
				} else if (type === 'metaboliteIntensity') {
					const file = path.join(dir, 'values.tsv')
					files.push(file)
					await writeFile(file, `#Metabolites\t${names.join('\t')}\nM\t0\t7\t13\n`)
					ds.queries.metaboliteIntensity = { file }
					await validate_query_metaboliteIntensity(ds, {})
					term.name = 'M'
					getter = ds.queries.metaboliteIntensity.get
				} else if (type === 'proteomeAbundance') {
					for (const name of names) ds.cohort.termdb.q.sampleName2id(name)
					const file = path.join(dir, 'proteome.db')
					files.push(file)
					const db = new Database(file)
					db.exec(`CREATE TABLE proteome_abundance (
						organism TEXT, disease TEXT, identifier TEXT, protein_accession TEXT, isoform TEXT,
						modsite TEXT, gene TEXT, sample TEXT, value REAL, brain_region TEXT, tech1 TEXT
					)`)
					for (const [i, name] of names.entries()) {
						db.prepare('INSERT INTO proteome_abundance VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
							'human',
							i === 1 ? 'control' : 'case',
							'P',
							'P',
							'',
							'',
							'G',
							name,
							i * 7,
							'',
							'assay'
						)
					}
					db.close()
					ds.queries.proteome = {
						dbfile: file,
						organisms: {
							human: {
								columnIdx: 0,
								columnValue: 'human',
								assays: {
									assay: {
										columnIdx: 4,
										columnValue: 'assay',
										cohorts: {
											cohort: {
												caseFilter: [{ columnIdx: 1, columnValue: 'case' }],
												controlFilter: [{ columnIdx: 1, columnValue: 'control' }],
												DAPfile: 'unused'
											}
										}
									}
								}
							}
						}
					}
					await validate_query_proteome(ds)
					term.name = 'G: P'
					details = { organism: 'human', assay: 'assay', cohort: 'cohort' }
					getter = ds.queries.proteome.get
				} else if (term.type === 'dnaMethylation') {
					term.chr = 'chr17'
					term.start = 7669000
					term.stop = 7680000
					term.id = 'chr17:7669000-7680000'
					term.genomicFeatureType = 'region'
					if (type === 'dnaMethylation') ds.queries.dnaMethylation = { file: `${fixture}/dnaMeth.h5` }
					else {
						ds.queries.dnaMethylation = {
							elements: { promoter: { file: `${fixture}/dnaMethPromoterMvalue.h5`, unit: 'Average M-value' } }
						}
						if (type === 'shards') {
							const shard = path.join(dir, 'chr17.h5')
							files.push(shard)
							await symlink(path.join(serverconfig.tpmasterdir, fixture, 'dnaMeth.h5'), shard)
							ds.queries.dnaMethylation.cpgByChr = path.relative(serverconfig.tpmasterdir, path.join(dir, '{chr}.h5'))
						}
					}
					await validate_query_dnaMethylation(ds, {})
					getter = ds.queries.dnaMethylation.get
				} else if (type === 'junction') {
					term.chr = 'chr1'
					term.start = 100
					term.stop = 200
					term.strand = '+'
					for (const name of names) ds.cohort.termdb.q.sampleName2id(name)
					getter = param =>
						getJunctionData(
							param,
							async query => {
								t.equal(query.filter, param.filter, 'junction query forwards the request filter')
								return {
									junctions: [{ start: 100, stop: 200, strand: '+', sn2rc: new Map(ids.map((id, i) => [id, i * 7])) }]
								}
							},
							ds
						)
				} else {
					ds.queries.singleCell = {
						pseudobulk: {
							geneExpression: {
								cells: {
									folder: `${fixture}/rnaseq`,
									meanExt: '.fpkm.matrix.new.h5',
									categories: { TermdbTest: {} }
								}
							}
						}
					}
					await validatePseudobulk(ds)
					Object.assign(term, { assay: 'geneExpression', memberId: 'cells', category: 'TermdbTest', gene: 'DDX11L1' })
					details = { genes: ['DDX11L1', 'MIR1302-2HG'] }
					getter = ds.queries.singleCell.pseudobulk.get
				}
				const tw = { $id: 'value', term, q: {} }
				const target = down ? 2 : 1
				const param = {
					terms: [tw],
					sampleMapping: down ? 'parentToChildren' : 'childrenToParent',
					sampleTypes: [target],
					dataTypeDetails: details
				}
				const mapped = await getter(param)
				for (const values of mapped.term2sample2value.values()) {
					t.deepEqual(
						Object.keys(values).sort(),
						down ? ['20', '40', '50'] : ['10', '11'],
						'source types map to all related targets'
					)
				}
				t.ok(mapped.term2sample2value.size, 'getter returns numeric data')
				if (mapped.controlSampleIds)
					t.deepEqual(
						[...mapped.controlSampleIds],
						[down ? '40' : '11'],
						'control sample IDs use the same target space as values'
					)
				const aligned = await getter({ ...param, sampleMapping: undefined, sampleTypes: [down ? 1 : 2] })
				for (const values of aligned.term2sample2value.values()) {
					t.deepEqual(
						Object.keys(values).sort(),
						down ? ['10', '11'] : ['20', '40'],
						'without hierarchy mapping, only the term source types are read'
					)
				}
				const filter = {
					type: 'tvslst',
					in: true,
					join: '',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: { id: 'status', name: 'Status', type: 'categorical', sampleTypes: [2] },
								values: [{ key: 'keep' }]
							}
						}
					]
				}
				const filtered = await getter({ ...param, filter })
				for (const [id, values] of filtered.term2sample2value) {
					t.deepEqual(Object.keys(values), [down ? '20' : '10'], 'filter selects mapped targets, not source IDs')
					t.equal(
						values[down ? 20 : 10],
						mapped.term2sample2value.get(id)[down ? 20 : 10],
						'mapping and filtering preserve the value'
					)
				}
				t.ok(filtered.term2sample2value.size, 'target filter does not discard source data prematurely')
				if (filtered.bySampleId)
					t.deepEqual(
						Object.keys(filtered.bySampleId),
						[down ? '20' : '10'],
						'references describe retained target samples'
					)
				if (filtered.controlSampleIds)
					t.equal(filtered.controlSampleIds.size, 0, 'filtered-out controls are not returned')
				if (type === 'pseudobulk')
					t.deepEqual(
						[...filtered.term2sample2value.keys()],
						details.genes,
						'pseudobulk gene payload keys are preserved'
					)
				const excludedRequest = {
					...param,
					filter: {
						...filter,
						lst: [{ type: 'tvs', tvs: { ...filter.lst[0].tvs, values: [{ key: 'absent' }] } }]
					}
				}
				if (['elements', 'shards', 'junction'].includes(type)) {
					const excluded = await getter(excludedRequest)
					t.equal(
						excluded.term2sample2value.size,
						0,
						'a filter excluding all targets returns the empty result structure'
					)
					if (excluded.bySampleId)
						t.equal(Object.keys(excluded.bySampleId).length, 0, 'excluded targets leave no references')
				} else {
					await getter(excludedRequest).then(
						() => t.fail('empty filtered data should throw'),
						error =>
							t.ok(/no data available/i.test(String(error)), 'empty filtered data raises the original no-data error')
					)
				}
			} finally {
				ds.queries.proteome?.db?.close()
				connection.close()
				for (const file of files) await unlink(file)
				await rmdir(dir)
			}
		}
		t.end()
	})
}
