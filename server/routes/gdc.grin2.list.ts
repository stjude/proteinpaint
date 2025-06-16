import type { GdcGRIN2listRequest, GdcGRIN2listResponse, GdcGRIN2File, RouteApi } from '#types'
import { gdcGRIN2listPayload } from '#types/checkers'
import ky from 'ky'
import { joinUrl } from '#shared/joinUrl.js'
import serverconfig from '#src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'

/*
This route lists available gdc MAF files based on user's cohort filter
and return them to client to be shown in a table for selection
*/

const mafMaxFileNumber = 1000, // max number of maf files for api to return
	cnvMaxFileNumber = 1000 // max number of cnv files for api to return

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
			const ds = g.datasets?.GDC
			if (!ds) throw 'hg38 GDC missing'

			// Initialize the response according to the new structure
			const result: GdcGRIN2listResponse = {}

			// Handle MAF files if mafOptions is present in the request
			if (req.query.mafOptions) {
				result.mafFiles = {
					files: [],
					filesTotal: 0,
					maxTotalSizeCompressed: 0,
					fileCounts: { maf: 0 }
				}
				await mayListMafFiles(req.query as GdcGRIN2listRequest, result, ds)
			}

			// Handle CNV files if cnvOptions is present in the request
			if (req.query.cnvOptions) {
				result.cnvFiles = {
					files: []
					// Add other CNV-specific properties as needed
				}
				await mayListCnvFiles(req.query as GdcGRIN2listRequest, result, ds)
			}

			res.send(result)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function mayListMafFiles(q: GdcGRIN2listRequest, result: GdcGRIN2listResponse, ds: any) {
	if (!q.mafOptions) return

	// Ensure mafFiles is always initialized
	if (!result.mafFiles) {
		result.mafFiles = {
			files: [],
			filesTotal: 0,
			maxTotalSizeCompressed: 0,
			fileCounts: { maf: 0 }
		}
	}

	// Only build and use MAF filters if we need to retrieve MAF files
	const filters = {
		op: 'and',
		content: [
			{ op: '=', content: { field: 'data_format', value: 'MAF' } },
			{ op: '=', content: { field: 'experimental_strategy', value: q.mafOptions.experimentalStrategy } },
			{ op: '=', content: { field: 'analysis.workflow_type', value: allowedWorkflowType } },
			{ op: '=', content: { field: 'access', value: 'open' } }
		]
	}

	const case_filters: any = { op: 'and', content: [] }
	if (q.filter0) {
		case_filters.content.push(q.filter0)
	}

	const { host, headers } = ds.getHostHeaders(q)

	const body: any = {
		filters,
		size: mafMaxFileNumber,
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

	const response = await ky.post(joinUrl(host.rest, 'files'), { timeout: false, headers, json: body })
	if (!response.ok) throw `HTTP Error: ${response.status} ${response.statusText}`
	const re: any = await response.json() // type any to avoid tsc err

	if (!Number.isInteger(re.data?.pagination?.total)) throw 're.data.pagination.total is not int'
	if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'

	/* list of maf files returned by api
	a case may have multiple maf files, either duplicates or multiple samples of a case
	for now dedup to only one maf file a case *randomly*
	future may restrict to maf files from one type of samples e.g. diagnosis or relapse
	*/
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
			// ???
			// Collect filtered file info
			filteredFiles.push({
				fileId: h.id,
				fileSize: h.file_size,
				reason: `File size (${h.file_size} bytes) exceeds maximum allowed size (${maxFileSizeAllowed} bytes)`
			})
			mayLog(
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

	// TODO make dedup function and add unit test
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

			mayLog(`Case ${caseId}: Found ${caseFiles.length} MAF files, keeping largest (${caseFiles[0].file_size} bytes)`)
		} else {
			// Only one file for this case
			deduplicatedFiles.push(caseFiles[0])
		}
	}

	// Log deduplication results
	if (duplicatesRemoved > 0) {
		mayLog(
			`GRIN2 MAF deduplication: Removed ${duplicatesRemoved} duplicate files, kept ${deduplicatedFiles.length} unique cases`
		)
	}

	// sort final files in descending order of file size and show on table as default
	deduplicatedFiles.sort((a, b) => b.file_size - a.file_size)

	// CRITICAL SAFETY CHECK: Verify structure before pushing
	console.log('About to push files - Safety check:', {
		mafFilesExists: !!result.mafFiles,
		filesExists: !!result.mafFiles?.files,
		filesIsArray: Array.isArray(result.mafFiles?.files),
		filesCurrentLength: result.mafFiles?.files?.length || 0,
		deduplicatedFilesLength: deduplicatedFiles.length,
		deduplicatedFilesIsArray: Array.isArray(deduplicatedFiles)
	})

	result.mafFiles.files.push(...deduplicatedFiles)
	result.mafFiles.filesTotal = re.data.pagination.total
	if (result.mafFiles.fileCounts) {
		result.mafFiles.fileCounts.maf = files.length
	}
	result.mafFiles.deduplicationStats = {
		originalFileCount: files.length,
		deduplicatedFileCount: deduplicatedFiles.length,
		duplicatesRemoved: duplicatesRemoved,
		caseDetails: caseDetails,
		filteredFiles: filteredFiles
	}
}

async function mayListCnvFiles(q: GdcGRIN2listRequest, result: GdcGRIN2listResponse, ds: any) {
	// Always initialize cnvFiles
	result.cnvFiles = { files: [] }

	// Early return if no CNV options requested
	if (!q.cnvOptions) {
		console.log('No cnvOptions provided, returning empty cnvFiles')
		return
	}

	const case_filters: any = { op: 'and', content: [] }
	if (q.filter0) {
		case_filters.content.push(q.filter0)
	}

	const body: any = {
		size: cnvMaxFileNumber,
		fields: [
			'cases.samples.tissue_type',
			'cases.project.project_id',
			'cases.submitter_id',
			'cases.case_id',
			'data_type',
			'file_id',
			'file_size',
			'data_format',
			'experimental_strategy',
			'analysis.workflow_type'
		].join(','),
		filters: {
			op: 'in',
			content: {
				field: 'data_type',
				value: ['Copy Number Segment', 'Masked Copy Number Segment', 'Allele-specific Copy Number Segment']
			}
		}
	}
	if (case_filters.content.length) body.case_filters = case_filters

	const { host, headers } = ds.getHostHeaders(q)

	try {
		const re: any = await ky.post(joinUrl(host.rest, 'files'), { timeout: false, headers, json: body }).json()

		console.log('API Response:', {
			hits: re.data?.hits?.length || 0,
			firstHit: re.data?.hits?.[0]
		})

		if (!Array.isArray(re.data.hits)) {
			throw new Error('API response data.hits is not an array')
		}

		const cnvFiles: GdcGRIN2File[] = []

		for (const h of re.data.hits) {
			if (h.data_format != 'TXT') {
				// must be txt file
				continue
			}
			if (!h.analysis?.workflow_type) throw 'h.analysis.workflow_type missing'
			const c = h.cases?.[0]
			if (!c) throw 'h.cases[0] missing'

			// method to tell numeric value type of a cnv file: Zhenyu 6/6/2025
			if (h.data_type == 'Allele-specific Copy Number Segment') {
				// cnv values are integer
				// TODO determine file usage by q.cnvOptions{}
			} else if (
				h.data_type == 'Masked Copy Number Segment' ||
				(h.data_type == 'Copy Number Segment' && h.analysis.workflow_type != 'DNACopy')
			) {
				// cnv values are segmean
				// hardcoded to use segmean for now FIXME
				// TODO determine file usage by q.cnvOptions{}

				const file: GdcGRIN2File = {
					id: h.file_id || h.id, // Handle both field names
					project_id: c.project?.project_id || 'unknown', // Safe access with fallback
					file_size: h.file_size,
					case_submitter_id: c.submitter_id,
					case_uuid: c.case_id,
					sample_types: c.samples?.map((s: any) => s.tissue_type).filter(Boolean) || []
				}

				cnvFiles.push(file)
			}
		}

		result.cnvFiles = { files: cnvFiles }
		console.log(`Successfully processed ${cnvFiles.length} CNV files`)
	} catch (error) {
		console.error('Error fetching CNV files:', error)
		result.cnvFiles = { files: [] }
		// Don't re-throw - let the request continue
	}
}
