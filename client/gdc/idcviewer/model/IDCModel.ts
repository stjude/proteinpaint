import { compressors } from 'hyparquet-compressors'
import { parquetReadObjects, parquetMetadata } from 'hyparquet'
import semver from 'semver'
import type {
	CasesResponse,
	IDCParquetData,
	IDCParquetIndexResult,
	IDCParquetLoadResult,
	IDCVersionedEntry,
	ResponseHit
} from '../IDCTypes'
import {
	IDC_BUCKET_URL,
	IDC_CURRENT_VERSION_LABEL,
	IDC_DATA_VERSION_METADATA_KEY,
	IDC_PARQUET_COLUMNS,
	IDC_PARQUET_CURRENT_URL,
	IDC_PARQUET_KEY_SUFFIX,
	MAX_CASES_LIMIT
} from '../settings/defaults'

// ---------------------------------------------------------------------------
// SHA-256 helpers (used to verify downloaded parquet integrity)
// ---------------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')
}

async function sha256FromArrayBuffer(buffer: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', buffer)
	return bytesToHex(new Uint8Array(digest))
}

function parseSha256Sidecar(text: string): string {
	const firstLine = text.trim().split(/\r?\n/)[0]?.trim() || ''
	return firstLine.split(/\s+/)[0].toLowerCase()
}

async function verifyParquetUrlWithSidecar(parquetBuffer: ArrayBuffer, sidecarResp: Response): Promise<boolean> {
	const sidecarText = await sidecarResp.text()
	const actual = (await sha256FromArrayBuffer(parquetBuffer)).toLowerCase()
	const expected = parseSha256Sidecar(sidecarText)
	return expected.length > 0 && actual === expected
}

// ---------------------------------------------------------------------------
// IDCModel — server-interaction layer
// ---------------------------------------------------------------------------

/** Handles all data fetching for the IDC viewer: parquet loading and GDC API calls. */
export class IDCModel {
	/** Load the IDC parquet mapping, falling back through versioned archives if needed. */
	async loadParquetWithFallback(retries: number): Promise<IDCParquetLoadResult | undefined> {
		const current = await this.tryLoadValidatedParquet(IDC_PARQUET_CURRENT_URL, IDC_CURRENT_VERSION_LABEL)
		if (current) return current

		const versioned = await this.fetchVersionedParquetEntries(retries)
		for (const entry of versioned) {
			const result = await this.tryLoadValidatedParquet(entry.url, entry.version)
			if (result) {
				console.warn(
					`[IDC] Using fallback IDC mapping version "${entry.version}" because the current artifact was unavailable or invalid.`
				)
				return result
			}
		}
		return undefined
	}

	/** Fetch all cases (up to MAX_CASES_LIMIT) from the GDC API for the given cohort filter. */
	async fetchAllCasesForCohort(filter0: any): Promise<{ hits: ResponseHit[]; total: number }> {
		const body = {
			fields: 'case_id,submitter_id,disease_type,primary_site,project.project_id',
			case_filters: filter0,
			from: 0,
			size: MAX_CASES_LIMIT,
			expand: 'samples.portions.slides,project.program'
		}
		const re: CasesResponse = await fetch('https://api.gdc.cancer.gov/cases', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json', connection: 'close' },
			body: JSON.stringify(body)
		}).then(r => r.json())
		if (!Array.isArray(re?.data?.hits)) throw new Error('re.data.hits not array')
		if (!Number.isFinite(re.data.pagination?.total)) throw new Error('re.data.pagination.total not number')
		const hits = re.data.hits.map(hit => {
			if (!hit.id) throw new Error('hit.id is missing')
			return hit
		})
		return { hits, total: re.data.pagination.total }
	}

	isValidIDCParquetData(rows: unknown): rows is IDCParquetData[] {
		if (!Array.isArray(rows) || rows.length === 0) return false
		const sample = rows[0]
		if (!sample || typeof sample !== 'object') return false
		return IDC_PARQUET_COLUMNS.every(col => col in (sample as object))
	}

	readIDCDataVersion(arrayBuffer: ArrayBuffer): string | undefined {
		try {
			const metadata = parquetMetadata(arrayBuffer)
			const entry = metadata?.key_value_metadata?.find(kv => kv.key === IDC_DATA_VERSION_METADATA_KEY)
			return entry?.value
		} catch {
			return undefined
		}
	}

	async readParquetIndex(idc_index_file: any): Promise<IDCParquetIndexResult> {
		const raw_rows = await parquetReadObjects({
			file: idc_index_file,
			columns: IDC_PARQUET_COLUMNS,
			compressors
		})
		const idc_data = raw_rows || []
		if (!this.isValidIDCParquetData(idc_data)) {
			throw new Error('Parquet file is not in the expected IDC mapping format')
		}
		const gdcCaseIdSet = new Set<string>()
		idc_data.forEach((o: any) => {
			const cid = o?.gdc_case_id
			if (cid) gdcCaseIdSet.add(String(cid))
		})
		const gdcCaseIds = Array.from(gdcCaseIdSet) as readonly string[]
		const dataVersion = idc_index_file instanceof ArrayBuffer ? this.readIDCDataVersion(idc_index_file) : undefined
		return { idc_data: idc_data as IDCParquetData[], case_ids: gdcCaseIds, dataVersion }
	}

	async loadParquetFromUrl(url: string = IDC_PARQUET_CURRENT_URL): Promise<IDCParquetIndexResult> {
		const [parquetResp, sidecarResp] = await Promise.all([fetch(url), fetch(`${url}.sha256`)])
		if (!parquetResp.ok) throw new Error(`Failed to fetch parquet: ${parquetResp.status} ${parquetResp.statusText}`)
		if (!sidecarResp.ok) throw new Error(`Failed to fetch sidecar: ${sidecarResp.status} ${sidecarResp.statusText}`)
		const arrayBuffer = await parquetResp.arrayBuffer()
		const hashValidated = await verifyParquetUrlWithSidecar(arrayBuffer, sidecarResp)
		if (hashValidated) return this.readParquetIndex(arrayBuffer)
		throw new Error('File download failed validation. Please refresh to retry.')
	}

	compareVersions(a: string, b: string): number {
		const sa = semver.coerce(a) ?? '0.0.0'
		const sb = semver.coerce(b) ?? '0.0.0'
		return semver.compare(sa, sb)
	}

	async fetchVersionedParquetEntries(retries: number): Promise<IDCVersionedEntry[]> {
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
			const sorted = Array.from(new Set(versions)).sort((a, b) => this.compareVersions(b, a))
			return sorted
				.map(version => ({ version, url: `${IDC_BUCKET_URL}${version}${IDC_PARQUET_KEY_SUFFIX}` }))
				.slice(0, retries)
		} catch {
			return []
		}
	}

	private async tryLoadValidatedParquet(url: string, version: string): Promise<IDCParquetLoadResult | undefined> {
		try {
			const data = await this.loadParquetFromUrl(url)
			return { ...data, metadataVersion: data.dataVersion, urlVersion: version, url }
		} catch (err) {
			console.warn(
				`[IDC] Parquet artifact "${version}" is unavailable, inaccessible, or invalid and will be skipped:`,
				err instanceof Error ? err.message : err
			)
			return undefined
		}
	}
}
