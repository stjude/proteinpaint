/*
	This script download cohort maf files from GDC, concatenate them into a single file that includes user specified columns.

	Input JSON:
		host: GDC host
		fileIdLst: An array of uuid
	Output gzip compressed maf file to stdout.

	Example of usage:
		echo '{"host": "https://api.gdc.cancer.gov/data/", "fileIdLst": ["8b31d6d1-56f7-4aa8-b026-c64bafd531e7", "b429fcc1-2b59-4b4c-a472-fb27758f6249"]}'|./target/release/gdcmaf
*/

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde_json::Value;
use std::path::Path;
use futures::StreamExt;
use std::io::{self,Read,Write};



fn select_maf_col(d:String) -> Vec<u8> {
    let mut maf_str: String = String::new();
    let mut header_indices: Vec<usize> = Vec::new();
    let lines = d.trim_end().split("\n");
    for line in lines {
        if line.starts_with("#") {
            continue
        } else if line.contains("Hugo_Symbol") {
            let header: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
            for col in MAF_COL {
                let col_index: usize = header.iter().position(|x| x == col).unwrap();
                header_indices.push(col_index);
            }
        } else {
            let maf_cont_lst: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
            let mut maf_out_lst: Vec<String> = Vec::new();
            for x in header_indices.iter() {
                maf_out_lst.push(maf_cont_lst[*x].to_string());
            };
            maf_out_lst.push("\n".to_string());
            maf_str.push_str(maf_out_lst.join("\t").as_str());
        }
    };
    maf_str.as_bytes().to_vec()
}


// GDC MAF columns (96)
const MAF_COL: [&str;96] = ["Hugo_Symbol", "Entrez_Gene_Id", "Center", "NCBI_Build", "Chromosome", 
                            "Start_Position", "End_Position", "Strand", "Variant_Classification", 
                            "Variant_Type", "Reference_Allele", "Tumor_Seq_Allele1", "Tumor_Seq_Allele2", 
                            "dbSNP_RS", "dbSNP_Val_Status", "Tumor_Sample_Barcode", "Matched_Norm_Sample_Barcode", 
                            "Match_Norm_Seq_Allele1", "Match_Norm_Seq_Allele2", "Tumor_Validation_Allele1", 
                            "Tumor_Validation_Allele2", "Match_Norm_Validation_Allele1", "Match_Norm_Validation_Allele2", 
                            "Verification_Status", "Validation_Status", "Mutation_Status", "Sequencing_Phase", 
                            "Sequence_Source", "Validation_Method", "Score", "BAM_File", "Sequencer", 
                            "Tumor_Sample_UUID", "Matched_Norm_Sample_UUID", "HGVSc", "HGVSp", "HGVSp_Short", 
                            "Transcript_ID", "Exon_Number", "t_depth", "t_ref_count", "t_alt_count", "n_depth", 
                            "n_ref_count", "n_alt_count", "all_effects", "Allele", "Gene", "Feature", "Feature_type", 
                            "One_Consequence", "Consequence", "cDNA_position", "CDS_position", "Protein_position", 
                            "Amino_acids", "Codons", "Existing_variation", "DISTANCE", "TRANSCRIPT_STRAND", "SYMBOL", 
                            "SYMBOL_SOURCE", "HGNC_ID", "BIOTYPE", "CANONICAL", "CCDS", "ENSP", "SWISSPROT", "TREMBL", 
                            "UNIPARC", "RefSeq", "SIFT", "PolyPhen", "EXON", "INTRON", "DOMAINS", "CLIN_SIG", "SOMATIC", 
                            "PUBMED", "MOTIF_NAME", "MOTIF_POS", "HIGH_INF_POS", "MOTIF_SCORE_CHANGE", "IMPACT", "PICK", 
                            "VARIANT_CLASS", "TSL", "HGVS_OFFSET", "PHENO", "GENE_PHENO", "CONTEXT", "tumor_bam_uuid", 
                            "normal_bam_uuid", "case_id", "GDC_FILTER", "COSMIC"];


#[tokio::main]
async fn main() -> Result<(),Box<dyn std::error::Error>> {
    // Accepting the piped input json from jodejs and assign to the variable
    // host: GDC host
    // url: urls to download single maf files
    let mut buffer = String::new();
    io::stdin().read_line(&mut buffer)?;
    let file_id_lst_js = serde_json::from_str::<Value>(&buffer).expect("Error reading input and serializing to JSON");
    let host = file_id_lst_js.get("host").expect("Host was not provided").as_str().expect("Host is not a string");
    let mut url: Vec<String> = Vec::new();
    let file_id_lst = file_id_lst_js.get("fileIdLst").expect("File ID list is missed!").as_array().expect("File ID list is not an array");
    for v in file_id_lst {
        url.push(Path::new(&host).join(&v.as_str().unwrap()).display().to_string());
    };

    //downloading maf files parallelly and merge them into single maf file
    let download_futures = futures::stream::iter(
        url.into_iter().map(|url|{
            async move {
                let result = reqwest::get(&url).await;
                if let Ok(resp) = result {
                    let content = resp.bytes().await.unwrap();
                    let mut decoder = GzDecoder::new(&content[..]);
                    let mut decompressed_content = Vec::new();
                    let read_content = decoder.read_to_end(&mut decompressed_content);
                    if let Ok(_) = read_content {
                        let text = String::from_utf8_lossy(&decompressed_content).to_string();
                        text
                    } else {
                        let error_msg = "Failed to read content downloaded from: ".to_string() + &url;
                        error_msg
                    }
                } else {
                    let error_msg = "Failed to download: ".to_string() + &url;
                    error_msg
                }
            }
        })
    );

    // output
    let mut encoder = GzEncoder::new(io::stdout(), Compression::default());
    let _ = encoder.write_all(&MAF_COL.join("\t").as_bytes().to_vec()).expect("Failed to write header");
    let _ = encoder.write_all(b"\n").expect("Failed to write newline");
    download_futures.buffer_unordered(20).for_each(|item| {
        if item.starts_with("Failed") {
            eprintln!("{}",item);
        } else {
            let maf_bit = select_maf_col(item);
            let _ = encoder.write_all(&maf_bit).expect("Failed to write file");
        };
        async {}
    }).await;
    Ok(())
}
