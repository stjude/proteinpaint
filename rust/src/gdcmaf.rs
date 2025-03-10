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
use serde_json::{Value,json};
use std::path::Path;
use futures::StreamExt;
use std::io::{self,Read,Write};
use std::sync::Mutex;


// Struct to hold error information
#[derive(serde::Serialize)]
struct ErrorEntry {
    url: String,
    error: String,
}

fn select_maf_col(d:String,columns:&Vec<String>,url:&str,errors: &Mutex<Vec<ErrorEntry>>) -> (Vec<u8>,i32) {
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
                if let Some(index) = header.iter().position(|x| x == col) {
                    header_indices.push(index);
                } else {
                    let error_msg = format!("Column {} was not found", col);
                    errors.lock().unwrap().push(ErrorEntry {
                        url: url.to_string().clone(),
                        error: error_msg.clone(),
                    });
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
            mafrows += 1;
        }
    };
    (maf_str.as_bytes().to_vec(),mafrows)
}


#[tokio::main]
async fn main() -> Result<(),Box<dyn std::error::Error>> {
    // Create a thread-container for errors
    let errors = Mutex::new(Vec::<ErrorEntry>::new());
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
            errors.lock().unwrap().push(ErrorEntry {
                url: String::new(),
                error: "The columns of arg is not an array".to_string(),
            });
            panic!("Columns is not an array");
        }
    } else {
        errors.lock().unwrap().push(ErrorEntry {
            url: String::new(),
            error: "The key columns is missed from arg".to_string(),
        });
        panic!("Columns was not selected");
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
                                        let error_msg = format!("Decompression failed: {}", e);
                                        Err((url.clone(), error_msg))
                                    }
                                }
                            }
                            Err(e) => {
                                let error_msg = format!("Decompression failed: {}", e);
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

    // Collect all results before processing
    let results = download_futures.buffer_unordered(50).collect::<Vec<_>>().await;

    // Process results after all downloads are complete
    for result in results {
        match result {
            Ok((url, content)) => {
                let (maf_bit,mafrows) = select_maf_col(content, &maf_col, &url, &errors);
                if mafrows > 0 {
                    let _  = encoder.write_all(&maf_bit).expect("Failed to write file");
                } else {
                    errors.lock().unwrap().push(ErrorEntry {
                        url: url.clone(),
                        error: "Empty maf file".to_string(),
                    });
                }
            }
            Err((url, error)) => {
                errors.lock().unwrap().push(ErrorEntry {
                    url,
                    error,
                })
            }
        }
    };

    // Finalize output and printing errors
    encoder.finish().expect("Maf file output error!");

    // Manually flush stdout
    io::stdout().flush().expect("Failed to flush stdout");
    
    // After processing all downloads, output the errors as JSON to stderr
    let errors = errors.lock().unwrap();
    if !errors.is_empty() {
        let error_json = json!({
            "errors": errors.iter().collect::<Vec<&ErrorEntry>>()
        });
        let mut stderr = io::stderr();
        writeln!(stderr, "{}", error_json).expect("Failed to output stderr!");
        io::stderr().flush().expect("Failed to flush stderr");
    };

    Ok(())
}
