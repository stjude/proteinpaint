/*
	This script download cohort maf files from GDC, concatenate them into a single file that includes user specified columns.

	Input JSON:
		host: GDC host
		fileIdLst: An array of uuid
	Output gzip compressed maf file to stdout.

	Example of usage:
		echo '{"host": "https://api.gdc.cancer.gov/data/","columns": ["Hugo_Symbol", "Entrez_Gene_Id", "Center", "NCBI_Build", "Chromosome", "Start_Position"], "fileIdLst": ["8b31d6d1-56f7-4aa8-b026-c64bafd531e7", "b429fcc1-2b59-4b4c-a472-fb27758f6249"]}'|./target/release/gdcmaf
*/

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde_json::Value;
use std::path::Path;
use futures::StreamExt;
use std::io::{self,Read,Write};



fn select_maf_col(d:String,columns:&Vec<String>) -> Vec<u8> {
    let mut maf_str: String = String::new();
    let mut header_indices: Vec<usize> = Vec::new();
    let lines = d.trim_end().split("\n");
    for line in lines {
        if line.starts_with("#") {
            continue
        } else if line.contains("Hugo_Symbol") {
            let header: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
            for col in columns {
                if let Some(index) = header.iter().position(|x| x == col) {
                    header_indices.push(index);
                } else {
                    panic!("{} was not found!",col);
                }
            }
        } else {
            let maf_cont_lst: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
            let mut maf_out_lst: Vec<String> = Vec::new();
            for x in header_indices.iter() {
                maf_out_lst.push(maf_cont_lst[*x].to_string());
            };
            maf_str.push_str(maf_out_lst.join("\t").as_str());
            maf_str.push_str("\n");
        }
    };
    maf_str.as_bytes().to_vec()
}


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

    // read columns as array from input json and convert data type from Vec<Value> to Vec<String>
    let maf_col:Vec<String>;
    if let Some(maf_col_value) = file_id_lst_js.get("columns") {
        //convert Vec<Value> to Vec<String>
        if let Some(maf_col_array) = maf_col_value.as_array() {
            maf_col = maf_col_array
                .iter()
                .map(|v| v.to_string().replace("\"",""))
                .collect::<Vec<String>>();
        } else {
            panic!("Columns is not an array");
        }
    } else {
        panic!("Columns was not selected");
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
    let _ = encoder.write_all(&maf_col.join("\t").as_bytes().to_vec()).expect("Failed to write header");
    let _ = encoder.write_all(b"\n").expect("Failed to write newline");
    download_futures.buffer_unordered(20).for_each(|item| {
        if item.starts_with("Failed") {
            eprintln!("{}",item);
        } else {
            let maf_bit = select_maf_col(item,&maf_col);
            let _ = encoder.write_all(&maf_bit).expect("Failed to write file");
        };
        async {}
    }).await;
    Ok(())
}
