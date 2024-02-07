import { UrlTemplateSsm } from '#shared/types/dataset.ts'

/*
Make html links from ssm (simple somatic mutation) urls

Arguments:
    - ssm_urls: ssm url(s) specified in dataset file, can be either array or object
    - m: m element from snp.mlst

Returns: array of html links (if ssm_urls is array) or html string (if ssm_urls is object)
*/
export function makeSsmLink(ssm_urls: UrlTemplateSsm | UrlTemplateSsm[], m: object, genome: string) {
	if (Array.isArray(ssm_urls)) {
		// ssm_urls is array
		const htmls = []
		for (const ssm_url of ssm_urls) {
			if (ssm_url.namekey == 'chr:pos') {
				const coord = `${m.chr}%3A${m.pos}-${m.pos + 1}`
				htmls.push(
					`<a href="${ssm_url.base}regions=${coord}&genome=${genome == 'hg38' ? 'GRCh38' : genome}" target="_blank">${
						ssm_url.linkText
					}</a>`
				)
			} else {
				if (ssm_url.namekey in m)
					htmls.push(`<a href="${ssm_url.base}${m[ssm_url.namekey]}" target="_blank">${ssm_url.linkText}</a>`)
			}
		}
		return htmls
	} else {
		// ssm_urls is object
		const ssm_url = ssm_urls
		if (ssm_url.namekey in m) return `<a href="${ssm_url.base}${m[ssm_url.namekey]}" target="_blank"></a>`
	}
}
