import path from 'path'
import run_R from '#src/run_R.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import fs from 'fs'
import type {
	TermdbClusterRequestGeneExpression,
	TermdbClusterRequest,
	TermdbClusterResponse,
	Clustering,
	ValidResponse,
	SingletermResponse,
	GeneExpressionQuery,
	GeneExpressionQueryNative,
	GeneExpressionQueryGdc,
	RouteApi
} from '#types'
import { termdbClusterPayload } from '#types/checkers'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'
import { gdc_validate_query_geneExpression } from '#src/mds3.gdc.js'
import { mayLimitSamples } from '#src/mds3.filter.js'
import { clusterMethodLst, distanceMethodLst } from '#shared/clustering.js'
import { getResult as getResultGene } from '#src/gene.js'
import { TermTypes, NUMERIC_DICTIONARY_TERM } from '#shared/terms.js'
import { getData } from '#src/termdb.matrix.js'
import { termType2label } from '#shared/terms.js'
import { mayLog } from '#src/helpers.ts'

export const api: RouteApi = {
	endpoint: 'termdb/cluster',
	methods: {
		get: {
			...termdbClusterPayload,
			init
		},
		post: {
			...termdbClusterPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: TermdbClusterRequest = req.query
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (ds.__gdc && !ds.__gdc.doneCaching)
				throw 'The server has not finished caching the case IDs: try again in about 2 minutes.'
			if ([TermTypes.GENE_EXPRESSION, TermTypes.METABOLITE_INTENSITY, NUMERIC_DICTIONARY_TERM].includes(q.dataType)) {
				if (!ds.queries?.[q.dataType] && q.dataType !== NUMERIC_DICTIONARY_TERM)
					throw `no ${q.dataType} data on this dataset`
				if (!q.terms) throw `missing gene list`
				if (!Array.isArray(q.terms)) throw `gene list is not an array`
				// TODO: there should be a fix on the client-side to handle this error more gracefully,
				// instead of emitting the client-side instructions from the server response and forcing a reload
				if (q.terms.length < 3)
					throw `A minimum of three genes is required for clustering. Please refresh this page to clear this error.`
				result = (await getResult(q, ds, g)) as TermdbClusterResponse
			} else {
				throw 'unknown q.dataType ' + q.dataType
			}
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = {
				status: e.status || 400,
				error: e.message || e
			} as TermdbClusterResponse
		}
		res.send(result satisfies TermdbClusterRequest)
	}
}

async function getResult(q: TermdbClusterRequest, ds: any, genome) {
	let _q: any = q // may assign adhoc flag, use "any" to avoid tsc err and no need to include the flag in the type doc

	if (q.dataType == TermTypes.GENE_EXPRESSION) {
		// gdc gene exp clustering analysis is restricted to max 1000 cases, this is done at ds.queries.geneExpression.get() in mds3.gdc.js. the same getter also serves non-clustering requests and that should not limit cases. add this flag to be able to conditionally limit cases in get()
		_q = JSON.parse(JSON.stringify(q))
		_q.forClusteringAnalysis = true
	}

	let term2sample2value, byTermId, bySampleId, skippedSexChrGenes

	if (q.dataType == NUMERIC_DICTIONARY_TERM) {
		;({ term2sample2value, byTermId, bySampleId } = await getNumericDictTermAnnotation(q, ds, genome))
	} else {
		;({ term2sample2value, byTermId, bySampleId, skippedSexChrGenes } = await ds.queries[q.dataType].get(_q))
	}

	/* remove term with a sample2value map of size 0 from term2sample2value
	such term will cause all samples to be dropped from clustering plot
	this has two practical applications with gdc:
	1. local testing with gdc using inconsistent gencode versions (gdc:36). for some genes local will use a geneid not found in gdc and cause issue for clustering
	2. somehow in v36 genedb there can still be geneid not in gdc. this helps avoid app crashing in gdc environment
	*/
	const noValueTerms: string[] = []
	for (const [term, obj] of term2sample2value) {
		if (Object.keys(obj).length === 0) {
			noValueTerms.push(term)
			term2sample2value.delete(term)
			delete byTermId[term]
		}
	}

	const removedHierClusterTerms: { text: string; lst: string[] }[] = [] // allow to collect multiple sets of skipped items, each based on different reasons
	if (noValueTerms.length) {
		removedHierClusterTerms.push({
			text: `Skipped ${q.dataType == TermTypes.GENE_EXPRESSION ? 'genes' : 'items'} with no data`,
			lst: noValueTerms
		})
	}
	if (skippedSexChrGenes?.length) {
		// this is gdc-specific
		removedHierClusterTerms.push({ text: 'Skipped sex chromosome genes', lst: skippedSexChrGenes })
	}

	if (term2sample2value.size == 0) throw 'no data'
	if (term2sample2value.size == 1) {
		// get data for only 1 gene; still return data, may create violin plot later
		const g = Array.from(term2sample2value.keys())[0]
		return { term: { gene: g, type: TermTypes.GENE_EXPRESSION }, data: term2sample2value.get(g) } as SingletermResponse
	}

	// have data for multiple genes, run clustering
	const t = Date.now() // use "t=new Date()" will lead to tsc error
	const clustering: Clustering = await doClustering(term2sample2value, q, Object.keys(bySampleId).length)
	mayLog('clustering done:', Date.now() - t, 'ms')
	const result = { clustering, byTermId, bySampleId } as ValidResponse
	if (removedHierClusterTerms.length) result.removedHierClusterTerms = removedHierClusterTerms
	return result
}

async function getNumericDictTermAnnotation(q, ds, genome) {
	const getDataArgs = {
		filter: q.filter,
		terms: q.terms.map(term => ({ term, q: { mode: 'continuous' } }))
	}
	const data = await getData(getDataArgs, ds, genome)

	const term2sample2value = new Map()
	for (const [key, sampleData] of Object.entries(data.samples)) {
		for (const [term, value] of Object.entries(sampleData as { [key: string]: unknown })) {
			if (term !== 'sample') {
				// Skip the sample number
				if (!term2sample2value.has(term)) {
					term2sample2value.set(term, {})
				}
				term2sample2value.get(term)[key] = (value as { value: any }).value
			}
		}
	}
	return { term2sample2value, byTermId: data.refs.byTermId, bySampleId: data.refs.bySampleId }
}

// default numCases should be matched to maxCase4geneExpCluster in mds3.gdc.js
async function doClustering(data: any, q: TermdbClusterRequest, numCases = 1000) {
	// get set of unique sample names, to generate col_names dimension
	const sampleSet: Set<string> = new Set()
	// make one pass of whole matrix to collect samples that have values for all terms
	let firstTerm = true
	for (const o of data.values()) {
		// o: {sampleId: value}
		const currentSampleIds = new Set(Object.keys(o)) // Extract sample IDs from current term
		if (firstTerm) {
			// Initialize sampleSet with the first term's sample IDs
			currentSampleIds.forEach(id => sampleSet.add(id))
			firstTerm = false
		} else {
			// Intersect sampleSet with the current term's sample IDs
			for (const id of sampleSet) {
				if (!currentSampleIds.has(id)) {
					sampleSet.delete(id)
				}
			}
		}
	}

	if (sampleSet.size == 0)
		throw `termdb.cluster: There are no overlapping tested samples shared across the selected ${termType2label(
			q.dataType
		)}`

	// Checking if cluster and distance method for hierarchial clustering is valid
	if (!clusterMethodLst.find(i => i.value == q.clusterMethod)) throw 'Invalid cluster method'
	if (!distanceMethodLst.find(i => i.value == q.distanceMethod)) throw 'Invalid distance method'

	const inputData = {
		matrix: [] as number[][],
		row_names: [] as string[], // genes
		col_names: [...sampleSet].slice(0, numCases) as string[], // samples
		cluster_method: q.clusterMethod as string,
		distance_method: q.distanceMethod as string,
		plot_image: false // When true causes cluster.rs to plot the image into a png file (EXPERIMENTAL)
	}

	// compose "data{}" into a matrix
	for (const [gene, o] of data) {
		inputData.row_names.push(gene)
		const row: number[] = []
		for (const s of inputData.col_names) {
			row.push(o[s])
		}
		inputData.matrix.push(q.zScoreTransformation ? getZscore(row) : row)
	}

	if (inputData.matrix.length == 0) throw 'Clustering matrix is empty'
	const Routput = JSON.parse(
		await run_R(path.join(serverconfig.binpath, 'utils', 'hclust.R'), JSON.stringify(inputData))
	)

	const row_names_index: number[] = Routput.RowOrder.map(row => inputData.row_names.indexOf(row.name)) // sorted rows. value is array index in input data
	const col_names_index: number[] = Routput.ColOrder.map(col => inputData.col_names.indexOf(col.name)) // sorted columns, value is array index from input array

	// generated sorted matrix based on row/col clustering order
	const output_matrix: number[][] = []
	for (const rowI of row_names_index) {
		const newRow: number[] = []
		for (const colI of col_names_index) {
			newRow.push(inputData.matrix[rowI][colI])
		}
		output_matrix.push(newRow)
	}

	return {
		row: {
			merge: Routput.RowMerge,
			height: Routput.RowHeight,
			order: Routput.RowOrder,
			inputOrder: inputData.row_names
		},
		col: {
			merge: Routput.ColumnMerge,
			height: Routput.ColumnHeight,
			order: Routput.ColOrder,
			inputOrder: inputData.col_names
		},
		matrix: output_matrix
	}
}
function getZscore(l: number[]) {
	const mean: number = l.reduce((sum, v) => sum + v, 0) / l.length
	const sd: number = Math.sqrt(l.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / l.length)

	if (sd == 0) {
		return l
	}
	return l.map(v => (v - mean) / sd)
}

export async function validate_query_geneExpression(ds: any, genome: any) {
	const q: GeneExpressionQuery = ds.queries.geneExpression
	if (!q) return
	q.geneExpression2bins = {} //this dict is used to store the default bin config for each gene searched, so it doesn't have to be recalculated each time

	if (q.src == 'gdcapi') {
		gdc_validate_query_geneExpression(ds as GeneExpressionQueryGdc, genome)
		// q.get() added
		return
	}
	if (q.src == 'native') {
		await validateNative(q as GeneExpressionQueryNative, ds, genome)
		return
	}
	throw 'unknown queries.geneExpression.src'
}


/**
 * Validates an HDF5 file using the Rust validator
 * @param {string} filePath - Path to the HDF5 file
 * @returns {Promise<Object>} - Validation results
 */
async function validateHDF5File(filePath) {
	try {
	  // Prepare JSON input for the Rust validator
	  const jsonInput = JSON.stringify({
		hdf5_file: filePath
	  });
	  
	  console.log(`Validating HDF5 file: ${filePath}`);
	  
	  // Call the Rust validator
	  const result = await run_rust('validateHDF5', jsonInput);
	  
	  // Parse the output
	  const lines = result.split('\n');
	  for (const line of lines) {
		if (line.startsWith('output_string:')) {
		  // Extract the JSON part
		  const jsonStr = line.substring('output_string:'.length);
		  const validationData = JSON.parse(jsonStr);
		  
		  console.log(`File format: ${validationData.format}, Genes: ${validationData.geneNames?.length || 0}, Samples: ${validationData.sampleNames?.length || 0}`);
		  
		  return validationData;
		}
	  }
	  
	  // If no output_string line was found
	  return { 
		status: "error", 
		message: "No validation data found in output" 
	  };
	} catch (error) {
	  console.error(`Error validating file: ${error}`);
	  return { 
		status: "error", 
		message: `Validation error` 
	  };
	}
  }

  

  /**
   * Query expression values for a specific gene from a dense HDF5 file
   * 
   * @param {string} filePath - Path to the HDF5 file
   * @param {string} geneName - Name of the gene to query
   * @returns {Promise<Object>} Promise resolving to gene expression data
   */
  async function queryGeneExpression(filePath, geneName) {
	console.log(`Querying gene expression for ${geneName} from ${filePath}`);
	// Create the input params as a JSON object
	const jsonInput = JSON.stringify({
		file_path: filePath,
		gene: geneName
	  });
	
	try {
	  // Call the Rust script with input parameters
	  console.log('Calling readDenseHDF5 Rust script...');
	  console.log('Params:', JSON.stringify(jsonInput));
	  const result = await run_rust('readDenseHDF5', jsonInput);
	  
	  // Debug output to understand what we're getting back
	  // console.log('Result structure:', JSON.stringify(result, null, 2).substring(0, 5000) + '...');

	  // Check if the result exists and contains sample data
	  if (!result || Object.keys(result).length === 0) {
		throw new Error("Failed to retrieve expression data: Empty or missing response");
	}
	  
	  return result;
	} catch (error) {
	  console.error(`Error querying gene expression for ${geneName}`);
	  throw error;
	}
  }
  
 
  
  /**
   * Validate and prepare a gene expression query
   * This function handles both HDF5 and tabix file formats
   * 
   * @param q - The gene expression query
   * @param ds - Dataset information
   * @param genome - Genome information
   */
  async function validateNative(q: GeneExpressionQueryNative, ds: any, genome: any) {
	// Determine whether we're handling an HDF5 file or a tabix file
	if (q.hdf5File === true) {
	  // HDF5 file handling branch
	  const h5FilePath = q.file;
	  
	  // Join with master directory if needed
	  if (!h5FilePath.startsWith(serverconfig.tpmasterdir)) {
		q.file = path.join(serverconfig.tpmasterdir, h5FilePath);
	  }
	  
	  if (!q.samples) q.samples = [];
	  
	  // Validate that the HDF5 file exists
	  if (!(await fs.promises.access(q.file).then(() => true).catch(() => false))) {
		throw `HDF5 file not found: ${q.file}`;
	  }
	  
	  // Validate the HDF5 file
	  try {
		const validationResult = await validateHDF5File(q.file);
		
		if (validationResult.status !== 'success') {
		  throw validationResult.message;
		}
		
		console.log(`HDF5 file validated: ${q.file} (Format: ${validationResult.format})`);
		
		
		try {
			// Query expression values for a specific gene
			const geneQuery = await queryGeneExpression(q.file, "TP53");
			
			// Parse the JSON
			const jsonMatch = geneQuery.match(/output_string:(.*)/);
			if (!jsonMatch || !jsonMatch[1]) {
				throw new Error("Failed to extract JSON from Rust output");
			  }

			const jsonString = jsonMatch[1];
			// console.log('Extracted JSON string:', jsonString, "...");
			// console.log('Extracted JSON string length:', jsonString.length);
			// Extract just the JSON part by removing the prefix
			// console.log('Original string length:', jsonString.length);
            // console.log('First 30 characters (exact):', JSON.stringify(jsonString.substring(0, 30)));

			console.log('Extracted JSON string start:', jsonString.substring(0, 100));
			console.log('Extracted JSON string end:', jsonString.substring(jsonString.length - 100));
			
			// Write the JSON to a file for further analysis
			const jsonFilePath = path.join(serverconfig.tpmasterdir, 'geneData2.json');
			await fs.promises.writeFile(jsonFilePath, jsonString);
			console.log('Wrote JSON to file:', jsonFilePath);
			const geneData = JSON.parse(jsonString);
            console.log('Gene data:', geneData);

		} catch (sampleError) {
		  throw `Failed to get samples from HDF5 file: ${sampleError}`;
		}
	  } catch (error) {
		throw `Failed to validate HDF5 file: ${error}`;
	  }

	  // Add this inside the HDF5 file handling branch (before the closing brace)
q.get = async (param: TermdbClusterRequestGeneExpression) => {
	const limitSamples = await mayLimitSamples(param, q.samples, ds);
	if (limitSamples?.size == 0) {
	  // Got 0 sample after filtering, must still return expected structure with no data
	  return { term2sample2value: new Map(), byTermId: {}, bySampleId: {} };
	}
	
	// Set up sample IDs and labels
	const bySampleId = {};
	const samples = q.samples || [];
	if (limitSamples) {
	  for (const sid of limitSamples) {
		bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) };
	  }
	} else {
	  // Use all samples with exp data
	  for (const sid of samples) {
		bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) };
	  }
	}
	
	// Initialize data structure
	const term2sample2value = new Map();
	const byTermId = {};
	
	// Process each gene term
	for (const geneTerm of param.terms) {
	  if (!geneTerm.gene) continue;
	  
	  try {
		// Query expression values for the specific gene
		const geneQuery = await queryGeneExpression(q.file, geneTerm.gene);
		
		// Parse the JSON output
		const jsonMatch = geneQuery.match(/output_string:(.*)/);
		if (!jsonMatch || !jsonMatch[1]) {
		  console.warn(`No data found for gene: ${geneTerm.gene}`);
		  continue;
		}
		
		const jsonString = jsonMatch[1];
		const geneData = JSON.parse(jsonString);
		
		// Convert the gene data to the expected format
		const s2v = {};
		
		// Assuming geneData contains sample-to-value mappings
		// Adjust this part based on your actual data structure
		for (const [sampleName, value] of Object.entries(geneData)) {
		  console.log('Sample:', sampleName, 'Value:', value);
		  const sampleId = ds.cohort.termdb.q.sampleName2id(sampleName);
		  // console.log('Sample:', sampleName, 'ID:', sampleId, 'Value:', value);
		  if (!sampleId) continue;
		  if (limitSamples && !limitSamples.has(sampleId)) continue;
		  
		  s2v[sampleId] = Number(value);
		}
		
		if (Object.keys(s2v).length) {
		  term2sample2value.set(geneTerm.gene, s2v);
		}
	  } catch (error) {
		console.warn(`Error processing gene ${geneTerm.gene}:`, error);
		continue;
	  }
	}
	
	if (term2sample2value.size == 0) {
	  throw 'No data available for the input ' + param.terms?.map(g => g.gene).join(', ');
	}
	
	return { term2sample2value, byTermId, bySampleId };
  };

	} else {
	  // Existing tabix (.gz) file handling branch - LEFT UNCHANGED
	  if (!q.file.startsWith(serverconfig.tpmasterdir)) {
		q.file = path.join(serverconfig.tpmasterdir, q.file);
	  }
	  
	  if (!q.samples) q.samples = [];
	  await utils.validate_tabixfile(q.file);
	  q.nochr = await utils.tabix_is_nochr(q.file, null, genome);
	  q.samples = [] as number[];
	  
	  {
		// Is a gene-by-sample matrix file
		const lines = await utils.get_header_tabix(q.file);
		if (!lines[0]) throw 'Header line missing from ' + q.file;
		const l = lines[0].split('\t');
		if (l.slice(0, 4).join('\t') != '#chr\tstart\tstop\tgene') {
		  throw 'Header line has wrong content for columns 1-4';
		}
		
		for (let i = 4; i < l.length; i++) {
		  const id = ds.cohort.termdb.q.sampleName2id(l[i]);
		  if (id == undefined) {
			throw 'queries.geneExpression: unknown sample from header: ' + l[i];
		  }
		  q.samples.push(id);
		}
	  }
	  
	  q.get = async (param: TermdbClusterRequestGeneExpression) => {
		const limitSamples = await mayLimitSamples(param, q.samples, ds);
		if (limitSamples?.size == 0) {
		  // Got 0 sample after filtering, must still return expected structure with no data
		  return { term2sample2value: new Map(), byTermId: {}, bySampleId: {} };
		}
		
		// Has at least 1 sample passing filter and with exp data
		const bySampleId = {};
		const samples = q.samples || [];
		if (limitSamples) {
		  for (const sid of limitSamples) {
			bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) };
		  }
		} else {
		  // Use all samples with exp data
		  for (const sid of samples) {
			bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) };
		  }
		}
		
		// Only valid genes with data are added
		const term2sample2value = new Map();
		
		for (const geneTerm of param.terms) {
		  if (!geneTerm.gene) continue;
		  if (!geneTerm.chr || !Number.isInteger(geneTerm.start) || !Number.isInteger(geneTerm.stop)) {
			const re = getResultGene(genome, { input: geneTerm.gene, deep: 1 });
			if (!re.gmlst || re.gmlst.length == 0) {
			  console.warn('Unknown gene:' + geneTerm.gene);
			  continue;
			}
			const i = re.gmlst.find(i => i.isdefault) || re.gmlst[0];
			geneTerm.start = i.start;
			geneTerm.stop = i.stop;
			geneTerm.chr = i.chr;
		  }
		  
		  const s2v = {};
		  if (!geneTerm.chr || !Number.isInteger(geneTerm.start) || !Number.isInteger(geneTerm.stop)) {
			throw 'Missing chr/start/stop';
		  }
		  
		  await utils.get_lines_bigfile({
			args: [
			  q.file,
			  (q.nochr ? geneTerm.chr.replace('chr', '') : geneTerm.chr) + ':' + geneTerm.start + '-' + geneTerm.stop
			],
			callback: line => {
			  const l = line.split('\t');
			  // Case-insensitive match
			  if (l[3].toLowerCase() != geneTerm.gene.toLowerCase()) return;
			  for (let i = 4; i < l.length; i++) {
				const sampleId = samples[i - 4];
				if (limitSamples && !limitSamples.has(sampleId)) continue;
				if (!l[i]) continue; // Blank string
				const v = Number(l[i]);
				if (Number.isNaN(v)) throw 'Expression value not number';
				s2v[sampleId] = v;
			  }
			}
		  });
		  
		  if (Object.keys(s2v).length) {
			term2sample2value.set(geneTerm.gene, s2v); // Only add gene if it has data
		  }
		}
		
		// Pass blank byTermId to match with expected output structure
		const byTermId = {};
		if (term2sample2value.size == 0) {
		  throw 'No data available for the input ' + param.terms?.map(g => g.gene).join(', ');
		}
		
		return { term2sample2value, byTermId, bySampleId };
	  };
	}
  }