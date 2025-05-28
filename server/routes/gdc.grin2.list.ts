import type { GdcGRIN2listRequest, GdcGRIN2listResponse, GdcGRIN2File, RouteApi } from '#types'
import { gdcGRIN2listPayload } from '#types/checkers'
import ky from 'ky'
import { joinUrl } from '#shared/joinUrl.js'
import serverconfig from '#src/serverconfig.js'

/*
This route lists available gdc MAF files based on user's cohort filter
and return them to client to be shown in a table for selection
*/

const maxFileNumber = 1000 // determines max number of files to return to client

const allowedWorkflowType = 'Aliquot Ensemble Somatic Variant Merging and Masking'
const maxFileSizeAllowed = 1000000 // 1Mb; this is to avoid sending large files to client; if file size is larger than this, it will be ignored and not shown on client

// change to 400 so it won't limit number of files; should keep this setting as a safeguard; also it's fast to check file size (.5s in gdc.mafBuild.ts)
export const maxTotalSizeCompressed = serverconfig.features.gdcMafMaxFileSize || 400000000 // 400Mb

export const api: RouteApi = {
	endpoint: 'gdc/GRIN2list',
	methods: {
		get: {
			...gdcGRIN2listPayload,
			init
		},
		post: {
			...gdcGRIN2listPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'

			const payload = await listMafFiles(req.query as GdcGRIN2listRequest, ds)
			res.send(payload)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

/*
req.query {
	filter0 // optional gdc GFF cohort filter, invisible and read only
	experimentalStrategy: WXS/Targeted Sequencing
}

ds {
	__gdc {
		gdcOpenProjects
	}
}
*/
async function listMafFiles(q: GdcGRIN2listRequest, ds: any) {
	// Determine if we should retrieve MAF files (based on presence of mafOptions)
	const shouldRetrieveMaf = !!q.mafOptions

	// Extract experimentalStrategy from mafOptions
	const experimentalStrategy = q.mafOptions?.experimentalStrategy

	if (shouldRetrieveMaf && !experimentalStrategy) {
		throw 'Missing experimentalStrategy parameter for MAF file retrieval'
	}

	const dataFormatFilter = {
		op: 'and',
		content: [{ op: '=', content: { field: 'data_format', value: 'MAF' } }]
	}

	// Only build and use MAF filters if we need to retrieve MAF files
	let filters: any
	if (shouldRetrieveMaf) {
		filters = {
			op: 'and',
			content: [
				dataFormatFilter,
				{ op: '=', content: { field: 'experimental_strategy', value: experimentalStrategy } },
				{ op: '=', content: { field: 'analysis.workflow_type', value: allowedWorkflowType } },
				{ op: '=', content: { field: 'access', value: 'open' } }
			]
		}
	} else {
		// TODO: Add handling for CNV or fusion file types when those options are present
		throw 'At least one file type option must be specified (mafOptions, cnvOptions, or fusionOptions)'
	}

	const case_filters: any = { op: 'and', content: [] }
	if (q.filter0) {
		case_filters.content.push(q.filter0)
	}

	// Continue with the rest of your existing code
	const { host } = ds.getHostHeaders(q)

	const body: any = {
		filters,
		size: maxFileNumber,
		fields: [
			'id',
			'file_size',
			'cases.project.project_id',
			'cases.case_id',
			'cases.submitter_id',
			'cases.samples.tissue_type',
			'cases.samples.tumor_descriptor'
		].join(',')
	}
	if (case_filters.content.length) body.case_filters = case_filters

	const response = await ky.post(joinUrl(host.rest, 'files'), { timeout: false, json: body })
	if (!response.ok) throw `HTTP Error: ${response.status} ${response.statusText}`
	const re: any = await response.json() // type any to avoid tsc err

	if (!Number.isInteger(re.data?.pagination?.total)) throw 're.data.pagination.total is not int'
	if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'

	// flatten api return to table row objects
	// it is possible to set a max size limit to limit the number of files passed to client
	const files: GdcGRIN2File[] = []
	const filteredFiles: Array<{ fileId: string; fileSize: number; reason: string }> = []

	for (const h of re.data.hits) {
		/*
		{
		  "id": "39768777-fec5-4a79-9515-65712c002b19",
		  "cases": [
			{
			  "submitter_id": "HTMCP-03-06-02104",
			  "project": {
			  	"project_id":"xx"
			  },
			  "samples": [
			    { tumor_descriptor: 'Recurrence', tissue_type: 'Tumor' },
  				{ tumor_descriptor: 'Not Applicable', tissue_type: 'Normal' }
			  ]
			}
		  ],
		  "analysis": {
			"workflow_type": "MuSE Annotation"
		  },
		  "experimental_strategy": "Targeted Sequencing",
		  "file_size": 146038
		}
		*/

		const c = h.cases?.[0]
		if (!c) throw 'h.cases[0] missing'
		if (h.file_size >= maxFileSizeAllowed) {
			// Collect filtered file info
			filteredFiles.push({
				fileId: h.id,
				fileSize: h.file_size,
				reason: `File size (${h.file_size} bytes) exceeds maximum allowed size (${maxFileSizeAllowed} bytes)`
			})
			console.log(
				`File ${h.id} with a size of ${h.file_size} bytes is larger then the allowed file size. It is excluded from the list.\nIf you want to include it, please increase the maxFileSizeAllowed in the code.`
			)
			continue
		}

		const file: GdcGRIN2File = {
			id: h.id,
			project_id: c.project.project_id,
			file_size: h.file_size,
			case_submitter_id: c.submitter_id,
			case_uuid: c.case_id,
			sample_types: []
		}

		if (c.samples) {
			let normalTypeName // if found Normal in c.samples[], do not insert to sample_types[]; when completed the iteration, insert normalTypeName to sample_types[], as a way to keep it always at last; just sample_types.sort() won't work due to presence of "Primary" and "Metastatic" tumor descriptors that will cause Normal to appear 1st and last...
			for (const { tumor_descriptor, tissue_type } of c.samples) {
				// concatenate the two properties into 'sample_type' to show on client.
				if (tissue_type == 'Normal') {
					// ignore Not Applicable
					normalTypeName = (tumor_descriptor == 'Not Applicable' ? '' : tumor_descriptor + ' ') + tissue_type
					continue
				}
				// always include tissue descriptor for non-normal
				file.sample_types.push(tumor_descriptor + ' ' + tissue_type)
			}
			if (normalTypeName) file.sample_types.push(normalTypeName)
		}

		// dedup sample type. helps with such maf file https://portal.gdc.cancer.gov/files/efb54683-2d2c-44c2-9bc7-911588d5cc64 which will show repeating Tumor and hard to resolve
		file.sample_types = [...new Set(file.sample_types)]
		files.push(file)
	}

	// DEDUPLICATION LOGIC: Keep only one MAF file per case
	// Group files by case_submitter_id and keep the largest file for each case
	const filesByCase = new Map<string, GdcGRIN2File[]>()

	// Group all files by case
	for (const file of files) {
		const caseId = file.case_submitter_id
		if (!filesByCase.has(caseId)) {
			filesByCase.set(caseId, [])
		}
		filesByCase.get(caseId)!.push(file)
	}

	// Select the best file for each case (largest file size)
	const deduplicatedFiles: GdcGRIN2File[] = []
	let duplicatesRemoved = 0
	const caseDetails: Array<{ caseName: string; fileCount: number; keptFileSize: number }> = []

	for (const [caseId, caseFiles] of filesByCase) {
		if (caseFiles.length > 1) {
			// Multiple files for this case - keep the largest one
			// Sort by file size descending and take the first one
			caseFiles.sort((a, b) => b.file_size - a.file_size)
			deduplicatedFiles.push(caseFiles[0])
			duplicatesRemoved += caseFiles.length - 1

			caseDetails.push({
				caseName: caseId,
				fileCount: caseFiles.length,
				keptFileSize: caseFiles[0].file_size
			})

			console.log(
				`Case ${caseId}: Found ${caseFiles.length} MAF files, keeping largest (${caseFiles[0].file_size} bytes)`
			)
		} else {
			// Only one file for this case
			deduplicatedFiles.push(caseFiles[0])
		}
	}

	// Log deduplication results
	if (duplicatesRemoved > 0) {
		console.log(
			`GRIN2 MAF deduplication: Removed ${duplicatesRemoved} duplicate files, kept ${deduplicatedFiles.length} unique cases`
		)
	}

	// sort final files in descending order of file size and show on table as default
	deduplicatedFiles.sort((a, b) => b.file_size - a.file_size)

	// Add file type information to the response
	const result = {
		files: deduplicatedFiles,
		filesTotal: re.data.pagination.total,
		maxTotalSizeCompressed,
		fileCounts: {
			maf: files.length
		},
		appliedFilters: {
			fileTypes: shouldRetrieveMaf ? ['MAF'] : [],
			experimentalStrategy: experimentalStrategy
		},
		deduplicationStats: {
			originalFileCount: files.length,
			deduplicatedFileCount: deduplicatedFiles.length,
			duplicatesRemoved: duplicatesRemoved,
			caseDetails: caseDetails,
			filteredFiles: filteredFiles
		}
	} as GdcGRIN2listResponse

	return result
}
