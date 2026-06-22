import {
	type CasesResponse,
	type IDCParquetData,
	type IDCParquetIndexResult,
	type IDCParquetLoadResult,
	type IDCVersionedEntry,
	IDC_BUCKET_URL,
	IDC_CURRENT_VERSION_LABEL,
	IDC_DATA_VERSION_METADATA_KEY,
	IDC_PARQUET_COLUMNS,
	IDC_PARQUET_CURRENT_URL,
	IDC_PARQUET_KEY_SUFFIX
} from './types'
import type { Selection } from 'd3-selection'
import { compressors } from 'hyparquet-compressors'
import { parquetReadObjects, parquetMetadata } from 'hyparquet'
import semver from 'semver'
import { buildTableData, renderTable, verifyParquetUrlWithSidecar } from './utils'
const maxGdcCaseNumber = 400 // use small number to speed up testing
const MAXRETRY = 10
// TODO test retry logic
// TODO 1.4 seconds to grab cases, will need to cache results most likely if I have to call often
export async function init(
	{ filter0 },
	holder: Selection<HTMLDivElement, unknown, any, any>
): Promise<{ update: (arg: { filter0: any }) => Promise<void> }> {
	console.log('Initializing IDC app with filter0:', filter0)
	let load_result: IDCParquetLoadResult | undefined
	try {
		load_result = await loadIDCParquetWithFallback()
		if (!load_result) {
			throw new Error(
				'Failed to load IDC mapping data from all available sources. Please check your network connection and try refreshing the page.'
			)
		}
		// // return api to be accessible by react wrapper; will call api.update() to auto refresh cohortmaf UI on GFF cohort change
	} catch (e: any) {
		holder.append('div').text(`Error: ${e.message || e}`)
		if (e.stack) console.log(e.stack)
	}
	if (load_result === undefined) throw new Error('load_result is undefined after load attempt.')
	showTable(load_result!, filter0, holder)
	async function update({ filter0 }) {
		await showTable(load_result!, filter0, holder)
	}

	const publicApi = { update }
	return publicApi
}

export async function loadIDCParquetWithFallback(): Promise<IDCParquetLoadResult | undefined> {
	// 1. Try the current (latest published) artifact.
	const current = await tryLoadValidatedParquet(IDC_PARQUET_CURRENT_URL, IDC_CURRENT_VERSION_LABEL)
	if (current) return current

	// 2. Fall back through the archived versions, newest first.
	const versioned = await fetchVersionedParquetEntries()
	for (const entry of versioned) {
		const result = await tryLoadValidatedParquet(entry.url, entry.version)
		if (result) {
			// eslint-disable-next-line no-console
			console.warn(
				`[IDC] Using fallback IDC mapping version "${entry.version}" because the current artifact was unavailable or invalid.`
			)
			return result
		}
	}

	return undefined
}

export function isValidIDCParquetData(rows: unknown): rows is IDCParquetData[] {
	if (!Array.isArray(rows)) return false
	if (rows.length === 0) return false
	const sample = rows[0]
	if (!sample || typeof sample !== 'object') return false
	return IDC_PARQUET_COLUMNS.every(col => col in (sample as object))
}

// Read the IDC index data version from the parquet footer key/value metadata.
// Returns undefined when the file metadata cannot be read or the key is absent.
export function readIDCDataVersion(arrayBuffer: ArrayBuffer): string | undefined {
	try {
		const metadata = parquetMetadata(arrayBuffer)
		const entry = metadata?.key_value_metadata?.find(kv => kv.key === IDC_DATA_VERSION_METADATA_KEY)
		return entry?.value
	} catch {
		return undefined
	}
}

// Helper: read idc_data from a parquet file
export async function readParquetIndex(idc_index_file: any): Promise<IDCParquetIndexResult> {
	// need t
	const raw_rows = await parquetReadObjects({
		file: idc_index_file,
		columns: IDC_PARQUET_COLUMNS,
		compressors: compressors
	})

	const idc_data = raw_rows || []
	// Verify the file is in the expected format before using it. An unexpected
	// shape means the file is unreadable / corrupted for our purposes.
	if (!isValidIDCParquetData(idc_data)) {
		throw new Error('Parquet file is not in the expected IDC mapping format')
	}

	// Extract unique gdc case ids from the parquet data
	const gdcCaseIdSet = new Set<string>()
	idc_data.forEach((o: any) => {
		const cid = o?.gdc_case_id
		if (cid) gdcCaseIdSet.add(String(cid))
	})
	const gdcCaseIds = Array.from(gdcCaseIdSet) as readonly string[]

	// Read the embedded data version from the parquet footer metadata. Only
	// possible when we have the raw bytes (ArrayBuffer / Uint8Array).
	const dataVersion = idc_index_file instanceof ArrayBuffer ? readIDCDataVersion(idc_index_file) : undefined

	return {
		idc_data: idc_data as Array<IDCParquetData>,
		case_ids: gdcCaseIds,
		dataVersion
	}
}

// Fetch + parse a parquet URL; throws on any failure (network, CORS, HTTP
// error, or unreadable/invalid file format).
export async function loadParquetFromUrl(url: string = IDC_PARQUET_CURRENT_URL): Promise<IDCParquetIndexResult> {
	// A CORS failure or network error rejects fetch with a TypeError, which
	// propagates to the caller and is treated as "not accessible".
	const resp = await fetch(url)
	if (!resp.ok) {
		throw new Error(`Failed to fetch parquet: ${resp.status} ${resp.statusText}`)
	}
	const arrayBuffer = await resp.arrayBuffer()
	const hashValidated = await verifyParquetUrlWithSidecar(url)
	if (hashValidated) return readParquetIndex(arrayBuffer)
	throw new Error('File download failed validation. Please refresh to retry.')
}

// Compare dotted numeric versions (e.g. "23.6.0"). Returns sign of a - b.
export function compareVersions(a: string, b: string): number {
	const sa = semver.coerce(a) ?? '0.0.0'
	const sb = semver.coerce(b) ?? '0.0.0'
	return semver.compare(sa, sb)
}

// Fetch bucket XML listing and return every versioned parquet artifact,
// sorted from newest to oldest. The "current" alias is excluded since it is
// handled separately. Returns an empty array on any failure (e.g. CORS).
export async function fetchVersionedParquetEntries(): Promise<IDCVersionedEntry[]> {
	try {
		const resp = await fetch(IDC_BUCKET_URL)
		if (!resp.ok) return []

		const text = await resp.text()
		const doc = new DOMParser().parseFromString(text, 'application/xml')
		const versions = Array.from(doc.getElementsByTagName('Key'))
			.map(el => el.textContent || '')
			.filter(k => k.endsWith(IDC_PARQUET_KEY_SUFFIX))
			.map(k => k.slice(0, -IDC_PARQUET_KEY_SUFFIX.length))
			.filter(v => v !== IDC_CURRENT_VERSION_LABEL && /^\d+(\.\d+)*$/.test(v))

		// newest -> oldest
		const sorted = Array.from(new Set(versions)).sort((a, b) => compareVersions(b, a))

		return sorted
			.map(version => ({
				version,
				url: `${IDC_BUCKET_URL}${version}${IDC_PARQUET_KEY_SUFFIX}`
			}))
			.slice(0, MAXRETRY) // limit to 10 versions to avoid excessive fetch attempts
	} catch {
		// network / CORS failure or unparseable listing
		return []
	}
}

// Attempt to load + validate a single artifact. Resolves with the validated
// result, or `undefined` if the artifact is unavailable, inaccessible
// (CORS/network), or unreadable (unexpected format).
async function tryLoadValidatedParquet(url: string, version: string): Promise<IDCParquetLoadResult | undefined> {
	try {
		const data = await loadParquetFromUrl(url)
		return {
			...data,
			metadataVersion: data.dataVersion,
			urlVersion: version,
			url
		}
	} catch (err) {
		console.warn(
			`[IDC] Parquet artifact "${version}" is unavailable, inaccessible, or invalid and will be skipped:`,
			err instanceof Error ? err.message : err
		)
		return undefined
	}
}

async function showTable(result: IDCParquetLoadResult, filter0, holder) {
	if (!result.idc_data) return // prior step aborted. error has already been printed. do nothing
	const caseUuidSet = await getCaseFromCurrentCohort(filter0)
	const tableData = buildTableData(result.idc_data, caseUuidSet)
	renderTable(holder, tableData)
}
// {
//   "fields": "submitter_id,disease_type,primary_site,project.project_id,project",
//   "expand": "samples.portions.slides,project,project.program",
//   "sort": "submitter_id:asc",
//   "from": 0,
//   "size": 20,
//   "case_filters": {
//     "op": "and",
//     "content": [
//       {
//         "op": "in",
//         "content": {
//           "field": "case_id",
//           "value": ["<idc_case_id_1>", "<idc_case_id_2>", "..."]
//         }
//       }
//     ]
//   }
// }
async function getCaseFromCurrentCohort(filter0): Promise<CasesResponse['data']['hits']> {
	const re: CasesResponse = await fetch('https://api.gdc.cancer.gov/cases', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json', connection: 'close' },
		body: JSON.stringify({
			fields: 'case_id,submitter_id,disease_type,primary_site,project.project_id',
			case_filters: filter0,
			//TODO needs to be pagesize
			size: maxGdcCaseNumber,
			expand: 'samples.portions.slides,project.program,project.program.name'
		})
	}).then(r => r.json())
	console.log('GDC API response for case query:', re)
	// { data: { hits:[], pagination:{total} } }
	if (!Array.isArray(re?.data?.hits)) throw new Error('re.data.hits not array')
	if (!Number.isFinite(re.data.pagination?.total)) throw new Error('re.data.pagination.total not number')
	if (re.data.pagination.total > maxGdcCaseNumber) {
		// TODO display msg on ui "Up to xx number of GDC cases were retrieved and processed. yy number of cases are not represented."
	}
	const caseHits = re.data.hits.map(hit => {
		if (!hit.id) throw new Error('hit.id is missing')
		return hit
	})
	return caseHits
}
