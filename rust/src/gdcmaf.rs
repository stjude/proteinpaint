use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use serde_json::Value;
use std::fs::File;
use std::path::Path;
use futures::StreamExt;
use std::io;
use std::io::{Read,Write};
use std::sync::mpsc;
use std::collections::HashMap;


fn gen_map(d:String) -> HashMap<String,Vec<String>> {
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    let mut header: Vec<String> = Vec::new();
    let lines = d.trim_end().split("\n");
    for line in lines {
        if line.starts_with("#") {
            continue
        } else if line.contains("Hugo_Symbol") {
            header = line.split("\t").map(|s| s.to_string()).collect();
            for k in &header {
                map.insert(k.to_string(),Vec::new());
            }
        } else {
            let maf_cont_lst: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
            for (i,x) in maf_cont_lst.iter().enumerate() {
                map.get_mut(&header[i]).map(|val| val.push(x.to_string()));
            }
        }
    }
    map
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
    // out_file: save maf to out_file under cachedir
    // url: urls to download single maf files
    let mut buffer = String::new();
    io::stdin().read_line(&mut buffer)?;
    let file_id_lst_js = serde_json::from_str::<Value>(&buffer).expect("Error reading input and serializing to JSON");
    let host = &file_id_lst_js["host"].as_str().unwrap();
    let out_file = &file_id_lst_js["outFile"].as_str().unwrap();
    let mut url: Vec<String> = Vec::new();
    for v in file_id_lst_js["fileIdLst"].as_array().unwrap() {
        url.push(Path::new(&host).join(&v.as_str().unwrap()).display().to_string());
    };

    //downloading maf files parallelly and merge them into single maf file
    let (tx, rx) = mpsc::channel();
    let fetches = futures::stream::iter(
        url.into_iter().map(|url|{
            let txt = tx.clone();
            async move {
                match reqwest::get(&url).await{
                    Ok(resp) => {
                        let content = resp.bytes().await.unwrap();
                        let mut decoder = GzDecoder::new(&content[..]);
                        let mut decompressed_content = Vec::new();
                        decoder.read_to_end(&mut decompressed_content).unwrap();
                        let text = String::from_utf8_lossy(&decompressed_content);
                        txt.send(text.to_string()).unwrap();
                    }
                    Err(_) => println!("ERROR downloading {}", url),
                }
            }
        })
    ).buffer_unordered(20).collect::<Vec<()>>();
    fetches.await;
    drop(tx);

    // write downloaded maf into variable received_values
    let mut received_values: Vec<String> = Vec::new();
    for value in rx {
        received_values.push(value);
    }

    // store downloaed mafs into one HashMap data sturcture based on the common column names
    let mut maf = HashMap::new();
    for maf_data in received_values {
        if maf.is_empty() {
            maf = gen_map(maf_data);
            // remove columns if column name is found from MAF_COL
            let mut keys_to_remove_in_maf: Vec<String> = Vec::new();
            for key in maf.keys() {
                if !(MAF_COL.contains(&key.as_str())) {
                    keys_to_remove_in_maf.push(key.to_string());
                }
            };
            for key in keys_to_remove_in_maf {
                maf.remove(&key);
            }
        } else {
            let maf1 = gen_map(maf_data);
            let keys_in_maf1: Vec<String> = maf1.keys().cloned().collect();
            for key in keys_in_maf1 {
                if maf.contains_key(&key) {
                    let key_value = maf1[&key].clone();
                    maf.get_mut(&key).map(|val| val.extend(key_value));
                }
            }
        }
    };


    // generate a Vec with "chrom\tpos" for sorting
    // generated indices after sorting 
    let mut lst_chrom_pos: Vec<String> = Vec::new();
    for (i,v) in maf["Chromosome"].iter().enumerate() {
         lst_chrom_pos.push(v.to_owned()+"\t"+&maf["Start_Position"][i]);
    };
    let idx_sorted = get_sorted_indices(&lst_chrom_pos);

    // write to file
    let file = File::create(out_file).expect("could not create file");
    let mut encoder = GzEncoder::new(file, Default::default());
    encoder.write_all(MAF_COL.join("\t").as_bytes())?;
    encoder.write_all("\n".as_bytes())?;
    for i in idx_sorted.iter() {
        let mut val_lst: Vec<String> = Vec::new();
        for k in MAF_COL {
            val_lst.push(maf[k][*i].to_owned());
        };
        let val_out = val_lst.join("\t")+"\n";
        encoder.write_all(val_out.as_bytes())?;
    };
    encoder.finish()?;
    Ok(())
}
