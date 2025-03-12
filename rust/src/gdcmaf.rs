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
use serde_json::{Value};
use std::path::Path;
use futures::StreamExt;
use std::io::{self,Read,Write};

// Struct to hold error information
#[derive(serde::Serialize)]
struct ErrorEntry {
    url: String,
    error: String,
}

fn select_maf_col(d:String,columns:&Vec<String>,url:&str) -> Result<(Vec<u8>,i32), (String, String)> {
    let mut maf_str: String = String::new();
    let mut header_indices: Vec<usize> = Vec::new();
    let lines = d.trim_end().split("\n");
    let mut mafrows = 0;
    for line in lines {
        if line.starts_with("#") {
            continue
        } else if line.contains("Hugo_Symbol") {
            let header: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
            for col in columns {
                match header.iter().position(|x| x == col) {
                    Some(index) => {
                        header_indices.push(index);
                    }
                    None => {
                        let error_msg = format!("Column {} was not found", col);
                        return Err((url.to_string(), error_msg));
                    }
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
            mafrows += 1;
        }
    };
    Ok((maf_str.as_bytes().to_vec(),mafrows))
}



#[tokio::main]
async fn main() -> Result<(),Box<dyn std::error::Error>> {
    // Accepting the piped input json from jodejs and assign to the variable
    // host: GDC host
    // url: urls to download single maf files
    let mut buffer = String::new();
    io::stdin().read_line(&mut buffer)?;

    // reading the input from PP
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
            let column_error = ErrorEntry {
                url: String::new(),
                error: "The columns in arg is not an array".to_string(),
            };
            let column_error_js = serde_json::to_string(&column_error).unwrap();
            writeln!(io::stderr(), "{}", column_error_js).expect("Failed to output stderr!");
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "The columns in arg is not an array",
            )) as Box<dyn std::error::Error>);
        }
    } else {
        let column_error = ErrorEntry {
            url: String::new(),
            error: "Columns was not selected".to_string(),
        };
        let column_error_js = serde_json::to_string(&column_error).unwrap();
        writeln!(io::stderr(), "{}", column_error_js).expect("Failed to output stderr!");
        return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Columns was not selected",
        )) as Box<dyn std::error::Error>);
    };
    
    //downloading maf files parallelly and merge them into single maf file
    let download_futures = futures::stream::iter(
        url.into_iter().map(|url|{
            async move {
                match reqwest::get(&url).await {
                    Ok(resp) if resp.status().is_success() => {
                        match resp.bytes().await {
                            Ok(content) => {
                                let mut decoder = GzDecoder::new(&content[..]);
                                let mut decompressed_content = Vec::new();
                                match decoder.read_to_end(&mut decompressed_content) {
                                    Ok(_) => {
                                        let text = String::from_utf8_lossy(&decompressed_content).to_string();
                                        return Ok((url.clone(),text))
                                    }
                                    Err(e) => {
                                        let error_msg = format!("Failed to decompress downloaded maf file: {}", e);
                                        Err((url.clone(), error_msg))
                                    }
                                }
                            }
                            Err(e) => {
                                let error_msg = format!("Failed to decompress downloaded maf file: {}", e);
                                Err((url.clone(), error_msg))
                            }
                        }
                    }
                    Ok(resp) => {
                        let error_msg = format!("HTTP error: {}", resp.status());
                        Err((url.clone(), error_msg))
                    }
                    Err(e) => {
                        let error_msg = format!("Server request failed: {}", e);
                        Err((url.clone(), error_msg))
                    }
                }
            }
        })
    );

    // binary output
    let mut encoder = GzEncoder::new(io::stdout(), Compression::default());
    let _ = encoder.write_all(&maf_col.join("\t").as_bytes().to_vec()).expect("Failed to write header");
    let _ = encoder.write_all(b"\n").expect("Failed to write newline");

    download_futures.buffer_unordered(20).for_each(|result| {
        match result {
            Ok((url, content)) => {
                match select_maf_col(content, &maf_col, &url) {
                    Ok((maf_bit,mafrows)) => {
                        if mafrows > 0 {
                            encoder.write_all(&maf_bit).expect("Failed to write file");
                        } else {
                            let error = ErrorEntry {
                                url: url.clone(),
                                error: "Empty maf file".to_string(),
                            };
                            let error_js = serde_json::to_string(&error).unwrap();
                            writeln!(io::stderr(), "{}", error_js).expect("Failed to output stderr!");
                        }
                    }
                    Err((url,error)) => {
                        let error = ErrorEntry {
                            url,
                            error,
                        };
                        let error_js = serde_json::to_string(&error).unwrap();
                        writeln!(io::stderr(), "{}", error_js).expect("Failed to output stderr!");
                    }
                }
            }
            Err((url, error)) => {
                let error = ErrorEntry {
                    url,
                    error,
                };
                let error_js = serde_json::to_string(&error).unwrap();
                writeln!(io::stderr(), "{}", error_js).expect("Failed to output stderr!");
            }
        };
        async {}
    }).await;
    
    // Finalize output and printing errors
    encoder.finish().expect("Maf file output error!");
    // Manually flush stdout and stderr
    io::stdout().flush().expect("Failed to flush stdout");
    io::stderr().flush().expect("Failed to flush stderr");
    Ok(())
}
