function getMafBuild(basepath) {
	fetch(`${basepath}/gdc/mafBuild`, {
		headers: {
			accept: '*/*',
			'accept-language': 'en-US,en;q=0.9',
			'content-type': 'application/json',
			'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
			'sec-ch-ua-mobile': '?0',
			'sec-ch-ua-platform': '"macOS"',
			'sec-fetch-dest': 'empty',
			'sec-fetch-mode': 'cors',
			'sec-fetch-site': 'same-origin'
		},
		referrerPolicy: 'no-referrer',
		body: '{"fileIdLst":["57d30f74-fd72-4b18-8adc-d4031270c168"],"columns":["Hugo_Symbol","Entrez_Gene_Id","Center","NCBI_Build","Chromosome","Start_Position","End_Position","Strand","Variant_Classification","Variant_Type","Reference_Allele","Tumor_Seq_Allele1","Tumor_Seq_Allele2","dbSNP_RS","dbSNP_Val_Status","Tumor_Sample_Barcode","Matched_Norm_Sample_Barcode","Match_Norm_Seq_Allele1","Match_Norm_Seq_Allele2","Tumor_Validation_Allele1","Tumor_Validation_Allele2","Match_Norm_Validation_Allele1","Match_Norm_Validation_Allele2","Verification_Status","Validation_Status","Mutation_Status","Sequencing_Phase","Sequence_Source","Validation_Method","Score","BAM_File","Sequencer","Tumor_Sample_UUID","Matched_Norm_Sample_UUID","HGVSc","HGVSp","HGVSp_Short","Transcript_ID","Exon_Number","t_depth","t_ref_count","t_alt_count","n_depth","n_ref_count","n_alt_count","all_effects","Allele","Gene","Feature","Feature_type","One_Consequence","Consequence","cDNA_position","CDS_position","Protein_position","Amino_acids","Codons","Existing_variation","DISTANCE","TRANSCRIPT_STRAND","SYMBOL","SYMBOL_SOURCE","HGNC_ID","BIOTYPE","CANONICAL","CCDS","ENSP","SWISSPROT","TREMBL","UNIPARC","UNIPROT_ISOFORM","RefSeq","MANE","APPRIS","FLAGS","SIFT","PolyPhen","EXON","INTRON","DOMAINS","1000G_AF","1000G_AFR_AF","1000G_AMR_AF","1000G_EAS_AF","1000G_EUR_AF","1000G_SAS_AF","ESP_AA_AF","ESP_EA_AF","gnomAD_AF","gnomAD_AFR_AF","gnomAD_AMR_AF","gnomAD_ASJ_AF","gnomAD_EAS_AF","gnomAD_FIN_AF","gnomAD_NFE_AF","gnomAD_OTH_AF","gnomAD_SAS_AF","MAX_AF","MAX_AF_POPS","gnomAD_non_cancer_AF","gnomAD_non_cancer_AFR_AF","gnomAD_non_cancer_AMI_AF","gnomAD_non_cancer_AMR_AF","gnomAD_non_cancer_ASJ_AF","gnomAD_non_cancer_EAS_AF","gnomAD_non_cancer_FIN_AF","gnomAD_non_cancer_MID_AF","gnomAD_non_cancer_NFE_AF","gnomAD_non_cancer_OTH_AF","gnomAD_non_cancer_SAS_AF","gnomAD_non_cancer_MAX_AF_adj","gnomAD_non_cancer_MAX_AF_POPS_adj","CLIN_SIG","SOMATIC","PUBMED","TRANSCRIPTION_FACTORS","MOTIF_NAME","MOTIF_POS","HIGH_INF_POS","MOTIF_SCORE_CHANGE","miRNA","IMPACT","PICK","VARIANT_CLASS","TSL","HGVS_OFFSET","PHENO","GENE_PHENO","CONTEXT","case_id","GDC_FILTER","COSMIC","hotspot","tumor_bam_uuid","normal_bam_uuid","RNA_Support","RNA_depth","RNA_ref_count","RNA_alt_count","callers"]}',
		method: 'POST',
		mode: 'cors',
		credentials: 'include'
	})
		.then(processMultiPart)
		.then(console.log)
		.catch(console.log)
}

async function processMultiPart(res) {
	const boundary = `--GDC_MAF_MULTIPART_BOUNDARY`
	const parts = []
	const decoder = new TextDecoder()
	const bytes = []

	let chunks = [],
		headerStr
	for await (const chunk of res.body) {
		const text = decoder.decode(chunk).trimStart()
		console.log(text.slice(0, 16), '...', text.slice(-16))
		if (text.startsWith(boundary) && (text.endsWith('\n\n') || text.endsWith(boundary + '--'))) {
			if (headerStr && chunks.length) {
				parts.push(processPart(headerStr, chunks, text))
				chunks = []
			}
			headerStr = text.slice(boundary.length + 1)
			// assume that multiple text-only parts might be read as one chunk,
			// detect and handle such cases; this also assumes that non-text chunk
			// will NOT be streamed/read in the same chunk as text-only header segments
			const segments = headerStr.split(boundary)
			if (segments.length > 1) {
				for (const s of segments) {
					const j = s.indexOf('\n\n')
					if (j == -1) break
					const headers = s.slice(0, j)
					const subchunk = s.slice(j)
					if (!subchunk) {
						headerStr = headers
						break
					}
					parts.push(processPart(headers, [], subchunk.trim()))
				}
			}
			continue
		} else {
			chunks.push(chunk)
		}
	}
	return parts
}

function processPart(headerStr, chunks, text) {
	const headerLines = headerStr.split('\n')
	const headers = {}
	for (const line of headerLines) {
		if (line === '') continue
		const [key, val] = line.split(':')
		headers[key.trim().toLowerCase()] = val.trim().toLowerCase()
	}

	const type = headers['content-type']
	if (type === 'application/octet-stream') {
		return { headers, body: new Blob(chunks, { type }) }
	} else if (type.includes('/json')) {
		return { headers, body: JSON.parse(text) }
	} else if (type.includes('/text')) {
		return { headers, body: text }
	} else {
		// call blob() as catch-all
		// https://developer.mozilla.org/en-US/docs/Web/API/Response
		return { headers, body: new Blob(chunks, { type }) }
	}
}
