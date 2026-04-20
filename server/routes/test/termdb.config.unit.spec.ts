import tape from 'tape'
import { getDsAllowedTermTypes } from '../termdb.config.ts'
import {
	GENE_EXPRESSION,
	ISOFORM_EXPRESSION,
	METABOLITE_INTENSITY,
	PROTEOME_ABUNDANCE,
	SSGSEA,
	DNA_METHYLATION,
	SINGLECELL_CELLTYPE,
	SINGLECELL_GENE_EXPRESSION
} from '#shared/terms.js'

/**
 * Tests for getDsAllowedTermTypes()
 *
 * This function extracts the unique list of term types from a dataset configuration
 * by examining multiple sources:
 * - termtypeByCohort array
 * - allowedTermTypes array (optional)
 * - queries object (various data types)
 * - termCollections (optional)
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- #routes/termdb.config getDsAllowedTermTypes -***-')
	test.end()
})

tape('getDsAllowedTermTypes() - basic termtypeByCohort', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: [{ termType: 'categorical' }, { termType: 'float' }, { termType: 'integer' }]
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.deepEqual(result.sort(), ['categorical', 'float', 'integer'].sort(), 'Should extract term types from termtypeByCohort')
	test.end()
})

tape('getDsAllowedTermTypes() - with allowedTermTypes', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: [{ termType: 'categorical' }],
				allowedTermTypes: ['survival', 'condition']
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.deepEqual(
		result.sort(),
		['categorical', 'survival', 'condition'].sort(),
		'Should merge termtypeByCohort and allowedTermTypes'
	)
	test.end()
})

tape('getDsAllowedTermTypes() - with geneExpression query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: [{ termType: 'categorical' }]
			}
		},
		queries: {
			geneExpression: { unit: 'TPM' }
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(GENE_EXPRESSION), 'Should include GENE_EXPRESSION term type')
	test.ok(result.includes('categorical'), 'Should also include categorical from termtypeByCohort')
	test.end()
})

tape('getDsAllowedTermTypes() - with isoformExpression query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: []
			}
		},
		queries: {
			isoformExpression: { unit: 'TPM' }
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(ISOFORM_EXPRESSION), 'Should include ISOFORM_EXPRESSION term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with metaboliteIntensity query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: []
			}
		},
		queries: {
			metaboliteIntensity: {}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(METABOLITE_INTENSITY), 'Should include METABOLITE_INTENSITY term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with proteome query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: []
			}
		},
		queries: {
			proteome: {
				assays: {
					someAssay: {}
				}
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(PROTEOME_ABUNDANCE), 'Should include PROTEOME_ABUNDANCE term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with ssGSEA query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: []
			}
		},
		queries: {
			ssGSEA: {}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(SSGSEA), 'Should include SSGSEA term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with dnaMethylation query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: []
			}
		},
		queries: {
			dnaMethylation: { unit: 'beta' }
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(DNA_METHYLATION), 'Should include DNA_METHYLATION term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with singleCell query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: []
			}
		},
		queries: {
			singleCell: {
				samples: {},
				data: {}
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(SINGLECELL_CELLTYPE), 'Should include SINGLECELL_CELLTYPE term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with singleCell and geneExpression', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: []
			}
		},
		queries: {
			singleCell: {
				samples: {},
				data: {},
				geneExpression: { unit: 'CPM' }
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(SINGLECELL_CELLTYPE), 'Should include SINGLECELL_CELLTYPE term type')
	test.ok(result.includes(SINGLECELL_GENE_EXPRESSION), 'Should include SINGLECELL_GENE_EXPRESSION term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with termCollections', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: [],
				termCollections: [{ name: 'Collection1' }, { name: 'Collection2' }]
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes('termCollection'), 'Should include termCollection term type')
	test.end()
})

tape('getDsAllowedTermTypes() - empty termtypeByCohort with undefined termType', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: [{ termType: undefined }, { termType: null }]
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.equal(result.length, 0, 'Should return empty array when termTypes are undefined or null')
	test.end()
})

tape('getDsAllowedTermTypes() - mixed termTypes with duplicates', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: [{ termType: 'categorical' }, { termType: 'float' }, { termType: 'categorical' }],
				allowedTermTypes: ['categorical', 'survival']
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.deepEqual(
		result.sort(),
		['categorical', 'float', 'survival'].sort(),
		'Should return unique term types without duplicates'
	)
	test.end()
})

tape('getDsAllowedTermTypes() - comprehensive dataset', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: [{ termType: 'categorical' }, { termType: 'float' }],
				allowedTermTypes: ['survival'],
				termCollections: [{ name: 'Collection1' }]
			}
		},
		queries: {
			geneExpression: { unit: 'TPM' },
			isoformExpression: { unit: 'TPM' },
			proteome: { assays: { someAssay: {} } },
			dnaMethylation: { unit: 'beta' },
			ssGSEA: {},
			singleCell: {
				samples: {},
				data: {},
				geneExpression: { unit: 'CPM' }
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	const expectedTypes = [
		'categorical',
		'float',
		'survival',
		'termCollection',
		GENE_EXPRESSION,
		ISOFORM_EXPRESSION,
		PROTEOME_ABUNDANCE,
		DNA_METHYLATION,
		SSGSEA,
		SINGLECELL_CELLTYPE,
		SINGLECELL_GENE_EXPRESSION
	]
	test.equal(result.length, expectedTypes.length, 'Should have correct number of term types')
	for (const type of expectedTypes) {
		test.ok(result.includes(type), `Should include ${type}`)
	}
	test.end()
})

tape('getDsAllowedTermTypes() - no queries object', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: [{ termType: 'categorical' }]
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.deepEqual(result, ['categorical'], 'Should handle missing queries object')
	test.end()
})

tape('getDsAllowedTermTypes() - proteome without assays', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: []
			}
		},
		queries: {
			proteome: {}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.notOk(result.includes(PROTEOME_ABUNDANCE), 'Should not include PROTEOME_ABUNDANCE without assays')
	test.end()
})

tape('getDsAllowedTermTypes() - singleCell without geneExpression', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: []
			}
		},
		queries: {
			singleCell: {
				samples: {},
				data: {}
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(SINGLECELL_CELLTYPE), 'Should include SINGLECELL_CELLTYPE')
	test.notOk(result.includes(SINGLECELL_GENE_EXPRESSION), 'Should not include SINGLECELL_GENE_EXPRESSION without geneExpression')
	test.end()
})
