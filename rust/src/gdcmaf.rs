/*
	This script download cohort maf files from GDC, combine them into a single file, and output the sorted file based on chromsome and Start_Position.

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
use std::sync::mpsc;



fn gen_vec(d:String) -> (Vec<String>,Vec<Vec<u8>>) {
    let mut maf_bit: Vec<Vec<u8>> = Vec::new();
    let mut lst_chrom_pos: Vec<String> = Vec::new();
    let mut header_indices: Vec<usize> = Vec::new();
    let mut chrom_index: usize = 9999;
    let mut pos_index: usize = 9999;
    let lines = d.trim_end().split("\n");
    for line in lines {
        if line.starts_with("#") {
            continue
        } else if line.contains("Hugo_Symbol") {
            let header: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
            for col in MAF_COL {
                let col_index: usize = header.iter().position(|x| x == col).unwrap();
                header_indices.push(col_index);
                if col == "Chromosome" {
                    chrom_index = col_index;
                } else if col == "Start_Position" {
                    pos_index = col_index;
                }
            }
        } else {
            let maf_cont_lst: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
            let mut maf_out_lst: Vec<String> = Vec::new();
            let mut chrom = String::new();
            let mut pos = String::new();
            for (i,x) in header_indices.iter().enumerate() {
                maf_out_lst.push(maf_cont_lst[*x].to_string());
                if chrom_index != 9999 && i == chrom_index {
                    chrom = maf_cont_lst[*x].to_string();
                } else if pos_index != 9999 && i == pos_index {
                    pos = maf_cont_lst[*x].to_string();
                }
            };
            maf_out_lst.push("\n".to_string());
            maf_bit.push(maf_out_lst.join("\t").as_bytes().to_vec());
            lst_chrom_pos.push(chrom+"\t"+&pos);
        }
    };
    (lst_chrom_pos,maf_bit)
}

fn get_sorted_indices(lst: &Vec<String>) -> Vec<usize>{
    let mut indices = (0..lst.len()).collect::<Vec<usize>>();
    indices.sort_by(|a,b| {
        lst[*a].split('\t').collect::<Vec<&str>>()[0].cmp(lst[*b].split('\t').collect::<Vec<&str>>()[0])
            .then(lst[*a].split('\t').collect::<Vec<&str>>()[1].parse::<u32>().unwrap().cmp(&lst[*b].split('\t').collect::<Vec<&str>>()[1].parse::<u32>().unwrap()))
        });
    indices
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
    let (tx, rx) = mpsc::channel();
    let fetches = futures::stream::iter(
        url.into_iter().map(|url|{
            let txt = tx.clone();
            async move {
                if let Ok(resp) = reqwest::get(&url).await {
                    let content = resp.bytes().await.unwrap();
                    let mut decoder = GzDecoder::new(&content[..]);
                    let mut decompressed_content = Vec::new();
                    if let Ok(_) = decoder.read_to_end(&mut decompressed_content) {
                        let text = String::from_utf8_lossy(&decompressed_content);
                        let (lst_chrom_pos,maf_bit) = gen_vec(text.to_string());
                        txt.send((lst_chrom_pos,maf_bit)).unwrap();
                    }
                }
            }
        })
    ).buffer_unordered(20).collect::<Vec<()>>();
    fetches.await;
    drop(tx);

    // write downloaded maf (GZIP format) into a Vector
    // lst_chrom_pos: a vector including chromsome&position info for sorting maf
    // idx_sorted: indices after sorting basedon chromsome&position
    let mut maf_bit: Vec<Vec<u8>> = Vec::new();
    let mut lst_chrom_pos: Vec<String> = Vec::new();
    for (chr_pos_lst,maf_bit_lst) in rx {
        maf_bit.extend_from_slice(&maf_bit_lst);
        lst_chrom_pos.extend_from_slice(&chr_pos_lst);
    };
    let idx_sorted = get_sorted_indices(&lst_chrom_pos);

    // output
    // maf_out_bit: A vector of GZIPPED maf
    // compress_header: output header
    let mut encoder = GzEncoder::new(io::stdout(), Compression::default());
    let _ = encoder.write_all(&MAF_COL.join("\t").as_bytes().to_vec()).expect("Failed to write header");
    let _ = encoder.write_all(b"\n").expect("Failed to write newline");
    for i in idx_sorted.iter() {
        let _ = encoder.write_all(&maf_bit[*i]).expect("Failed to write file");
    };
    Ok(())
}
