/*
IDC viewer
*/

const maxGdcCaseNumber = 1000 // use small number to speed up testing

export async function init({ filter0 }, holder) {
	const result = {
		allIdcCases: null,
		version: ''
	}
	try {
		await getIdcGdcData(result)
	} catch (e) {
		holder.append('div').text(`Error: ${e.message || e}`)
		if (e.stack) console.log(e.stack)
	}
	showTable(result, filter0, holder)

	// return api to be accessible by react wrapper; will call api.update() to auto refresh cohortmaf UI on GFF cohort change
	async function update({ filter0 }) {
		await showTable(result, filter0, holder)
	}

	const publicApi = { update }
	return publicApi
}

/* to enable
type IdcCase = {
	uuid: string
	images: {
		name: string
		url: string
	}[]
}
*/

/************************ work flow
 */

async function getIdcGdcData(result) {
	const xml = await readIdcXml()
	const { data, version, hash } = await getDataWithRetry(xml)
	await validateData(data, hash)
	result.allIdcCases = parseData(data)
	result.version = version
}

async function readIdcXml() {
	// fetch xml from https://storage.googleapis.com/idc-index-data-artifacts/
	// parse xml into this obj
	return {
		current: { url: '', version: '', hash: '' },
		releases: [
			// releases ranked in descending order of release version
			{ url: '', version: '', hash: '' },
			{ url: '', version: '', hash: '' }
		]
	}
}

// get current file. if failed, get latest released file with up to 10 tries
async function getDataWithRetry(xml) {
	if (xml.current) {
		const data = await readFile(xml.current.url)
		if (data) return { data, version: xml.current.version, hash: xml.current.hash }
	}
	// current file didn't work out
	for (let i = 0; i < 10; i++) {
		const r = xml.releases?.[i]
		if (!r) continue
		const data = await readFile(r.url)
		if (data) return { data, version: r.version, hash: r.hash }
	}
	throw 'No suitable IDC file identified'
}

async function readFile(url) {
	// read binary data from url. if broken url (e.g. idc team forgot to deposit that file), return null to retry with next version
}

async function validateData(data, hash) {
	/*
1. on successful download
   if hash validation is successful, return silently
   if hash validation failed, meaning the file might be problematic and idc team may need to investigate.
   in such case retry with next version (this is not fleshed out here)
2. on partial download
   hash validation should fail
   throw with message "Data download incomplete due to network error. Please refresh to retry."
   this terminates app and force user to refresh and retry downloading the same file
*/
}

// return the allIdcCases[]
async function parseData(data) {}

async function showTable(result, filter0, holder) {
	holder.append('div').text('just to test. delete this')
	if (!result.allIdcCases) return // prior step aborted. error has already been printed. do nothing
	holder.selectAll('*').remove()
	const caseUuidSet = await getCaseFromCurrentCohort(filter0)
	for (const idcCase of result.allIdcCases) {
		if (!caseUuidSet.has(idcCase.uuid)) continue
		// this idc case is from current cohort. display images from this case
	}
}
async function getCaseFromCurrentCohort(filter0) {
	const re = await fetch('https://api.gdc.cancer.gov/cases', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json', connection: 'close' },
		body: JSON.stringify({ fields: 'case_id', case_filters: filter0, size: maxGdcCaseNumber })
	}).then(r => r.json())
	// { data: { hits:[], pagination:{total} } }
	if (!Array.isArray(re?.data?.hits)) throw new Error('re.data.hits not array')
	if (!Number.isFinite(re.data.pagination?.total)) throw new Error('re.data.pagination.total not number')
	if (re.data.pagination.total > maxGdcCaseNumber) {
		// TODO display msg on ui "Up to xx number of GDC cases were retrieved and processed. yy number of cases are not represented."
	}
	const s = new Set()
	for (const h of re.data.hits) {
		if (!h.id) throw new Error('h.id missing')
		s.add(h.id)
	}
	return s
}
