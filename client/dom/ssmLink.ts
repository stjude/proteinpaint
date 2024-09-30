import type { UrlTemplateSsm } from '#types'

/*
Make html links from one m object (m is ssm-simple somatic mutation, snvindel, or nonmutation)
extendable to support multiple link formats

Arguments:

ssm_urls:
	see type def
m:
	variant object
variantNameDom:
	dom (<span>) that's already rendered with the variant name. 
	if ssm url config.shownSeparately=false , <a> tag is rendered into this <span>, so the link appears over the variant name
	otherwise the new link html is added to separateUrls[] and returned
genome:
	only used for regulomedb for now

Returns:

separateUrls[]: array of html links (if ssm_urls is array) or html string (if ssm_urls is object)
*/
export function makeSsmLink(
	ssm_urls: UrlTemplateSsm | UrlTemplateSsm[],
	m: {
		chr?: string
		pos?: number
	},
	variantNameDom: any,
	genome: string
) {
	// urls shown separately
	const separateUrls: string[] = []

	if (Array.isArray(ssm_urls)) {
		// ssm_urls is array
		for (const ssm_url of ssm_urls) {
			if (ssm_url.namekey == 'regulomedb') {
				// this key corresponds to hardcoded logic to build regulomedb link with special requirements that also include genome
				if (typeof m.chr == 'string' && m.pos !== undefined && Number.isInteger(m.pos)) {
					const coord = `${m.chr}%3A${m.pos}-${m.pos + 1}`
					separateUrls.push(
						`<a href="${ssm_url.base}regions=${coord}&genome=${genome == 'hg38' ? 'GRCh38' : genome}" target="_blank">${
							ssm_url.linkText
						}</a>`
					)
				}
				continue
			}
			makeGeneralLink(ssm_url, m, variantNameDom, separateUrls)
		}
	} else {
		makeGeneralLink(ssm_urls, m, variantNameDom, separateUrls)
	}
	return separateUrls
}

function makeGeneralLink(ssm_url: UrlTemplateSsm, m: object, variantNameDom: any, separateUrls: string[]) {
	const mValue = m[ssm_url.namekey]
	if (mValue == undefined) return // m{} does not have valid value which is required to compose a url. do not make

	const url = ssm_url.base + mValue

	if (ssm_url.shownSeparately) {
		// to generate a link separate from variantNameDom
		separateUrls.push(`<a href="${url}" target="_blank">${ssm_url.linkText || mValue}</a>`)
		return
	}
	// not showing separately
	variantNameDom.html(`<a href="${url}" target="_blank">${variantNameDom.html()}</a>`)
}
