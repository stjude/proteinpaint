/*
Make html links from ssm (simple somatic mutation) urls

Arguments:
    - ssm_urls: ssm url(s) specified in dataset file, can be either array or object
    - m: m element from snp.mlst

Returns: array of html links (if ssm_urls is array) or html string (if ssm_urls is object)
*/
export function makeSsmLink(ssm_urls: object | object[], m: object, genome: string) {
	if (Array.isArray(ssm_urls)) {
		// ssm_urls is array
		const htmls = []
		if (m.vcf_id) {
			const dbsnp_url = ssm_urls.find(url => url.namekey == 'vcf_id')
			if (dbsnp_url) htmls.push(`<a href="${dbsnp_url.base}${m.vcf_id}" target="_blank">${dbsnp_url.linkText}</a>`)
		}
		const regulome_url = ssm_urls.find(url => url.namekey == 'chr:pos')
		if (regulome_url) {
			const coord = `${m.chr}%3A${m.pos}-${m.pos + 1}`
			htmls.push(
				`<a href="${regulome_url.base}regions=${coord}&genome=${
					genome == 'hg38' ? 'GRCh38' : genome
				}" target="_blank">${regulome_url.linkText}</a>`
			)
		}
		return htmls
	} else {
		// ssm_urls is object
		const ssm_url = ssm_urls
		if (ssm_url.namekey in m) return `<a href="${ssm_url.base}${m[ssm_url.namekey]}" target="_blank"></a>`
	}
}
