/*
  This script download cohort maf files from GDC, concatenate them into a single file that includes user specified columns.

  Input JSON:
    host: GDC host
    fileIdLst: An array of uuid
  Output gzip compressed maf file to stdout.

  Example of usage:
    echo '{"host": "https://api.gdc.cancer.gov/data/","columns": ["Hugo_Symbol", "Entrez_Gene_Id", "Center", "NCBI_Build", "Chromosome", "Start_Position"], "fileIdLst": ["8b31d6d1-56f7-4aa8-b026-c64bafd531e7", "b429fcc1-2b59-4b4c-a472-fb27758f6249"]}'|./target/release/gdcmaf
*/

use flate2::Compression;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use futures::StreamExt;
use serde_json::Value;
use std::io::{self, Read, Write};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::io::{AsyncReadExt, BufReader};
use tokio::time::timeout;

// Struct to hold error information
#[derive(serde::Serialize)]
struct ErrorEntry {
    url: String,
    error: String,
}

fn select_maf_col(d: String, columns: &Vec<String>, url: &str) -> Result<(Vec<u8>, i32), (String, String)> {
    let mut maf_str: String = String::new();
    let mut header_indices: Vec<usize> = Vec::new();
    let lines = d.trim_end().split("\n");
    let mut mafrows = 0;
    for line in lines {
        if line.starts_with("#") {
            continue;
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
            if header_indices.is_empty() {
                return Err((url.to_string(), "No matching columns found".to_string()));
            }
        } else {
            let maf_cont_lst: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
            let mut maf_out_lst: Vec<String> = Vec::new();
            for x in header_indices.iter() {
                maf_out_lst.push(maf_cont_lst[*x].to_string());
            }
            maf_str.push_str(maf_out_lst.join("\t").as_str());
            maf_str.push_str("\n");
            mafrows += 1;
        }
    }
    Ok((maf_str.as_bytes().to_vec(), mafrows))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Accepting the piped input json from jodejs and assign to the variable
    // host: GDC host
    // url: urls to download single maf files
    let timeout_duration = Duration::from_secs(5); // Set a 10-second timeout

    // Wrap the read operation in a timeout
    let result = timeout(timeout_duration, async {
        let mut buffer = String::new(); // Initialize an empty string to store input
        let mut reader = BufReader::new(tokio::io::stdin()); // Create a buffered reader for stdin 
        reader.read_to_string(&mut buffer).await?; // Read a line asynchronously
        Ok::<String, io::Error>(buffer) // Return the input as a Result
    })
    .await;
    // Handle the result of the timeout operation
    let file_id_lst_js: Value = match result {
        Ok(Ok(buffer)) => match serde_json::from_str(&buffer) {
            Ok(js) => js,
            Err(e) => {
                let stdin_error = ErrorEntry {
                    url: String::new(),
                    error: format!("JSON parsing error: {}", e),
                };
                writeln!(io::stderr(), "{}", serde_json::to_string(&stdin_error).unwrap()).unwrap();
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "JSON parsing error!",
                )) as Box<dyn std::error::Error>);
            }
        },
        Ok(Err(_e)) => {
            let stdin_error = ErrorEntry {
                url: String::new(),
                error: "Error reading from stdin.".to_string(),
            };
            let stdin_error_js = serde_json::to_string(&stdin_error).unwrap();
            writeln!(io::stderr(), "{}", stdin_error_js).expect("Failed to output stderr!");
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Failed to output stderr!",
            )) as Box<dyn std::error::Error>);
        }
        Err(_) => {
            let stdin_error = ErrorEntry {
                url: String::new(),
                error: "Timeout while reading from stdin.".to_string(),
            };
            let stdin_error_js = serde_json::to_string(&stdin_error).unwrap();
            writeln!(io::stderr(), "{}", stdin_error_js).expect("Failed to output stderr!");
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "The columns in arg is not an array",
            )) as Box<dyn std::error::Error>);
        }
    };

    // reading the input from PP
    let host = file_id_lst_js
        .get("host")
        .expect("Host was not provided")
        .as_str()
        .expect("Host is not a string");
    let mut url: Vec<String> = Vec::new();
    let file_id_lst = file_id_lst_js
        .get("fileIdLst")
        .expect("File ID list is missed!")
        .as_array()
        .expect("File ID list is not an array");
    for v in file_id_lst {
        //url.push(Path::new(&host).join(&v.as_str().unwrap()).display().to_string());
        url.push(format!("{}/{}", host.trim_end_matches('/'), v.as_str().unwrap()));
    }

    // read columns as array from input json and convert data type from Vec<Value> to Vec<String>
    let maf_col: Vec<String>;
    if let Some(maf_col_value) = file_id_lst_js.get("columns") {
        //convert Vec<Value> to Vec<String>
        if let Some(maf_col_array) = maf_col_value.as_array() {
            maf_col = maf_col_array
                .iter()
                .map(|v| v.to_string().replace("\"", ""))
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
    let download_futures = futures::stream::iter(url.into_iter().map(|url| {
        async move {
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(60)) // 60-second timeout per request
                .connect_timeout(Duration::from_secs(15))
                .build()
                .map_err(|_e| {
                    let client_error = ErrorEntry {
                        url: url.clone(),
                        error: "Client build error".to_string(),
                    };
                    let client_error_js = serde_json::to_string(&client_error).unwrap();
                    writeln!(io::stderr(), "{}", client_error_js).expect("Failed to build reqwest client!");
                });
            match client.unwrap().get(&url).send().await {
                Ok(resp) if resp.status().is_success() => match resp.bytes().await {
                    Ok(content) => {
                        let mut decoder = GzDecoder::new(&content[..]);
                        let mut decompressed_content = Vec::new();
                        match decoder.read_to_end(&mut decompressed_content) {
                            Ok(_) => {
                                let text = String::from_utf8_lossy(&decompressed_content).to_string();
                                return Ok((url.clone(), text));
                            }
                            Err(e) => {
                                let error_msg = format!("Failed to decompress downloaded MAF file: {}", e);
                                Err((url.clone(), error_msg))
                            }
                        }
                    }
                    Err(e) => {
                        let error_msg = format!("Failed to decompress downloaded MAF file: {}", e);
                        Err((url.clone(), error_msg))
                    }
                },
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
    }));

    // binary output
    let encoder = Arc::new(Mutex::new(GzEncoder::new(io::stdout(), Compression::default())));

    // Write the header
    {
        let mut encoder_guard = encoder.lock().unwrap(); // Lock the Mutex to get access to the inner GzEncoder
        encoder_guard
            .write_all(&maf_col.join("\t").as_bytes().to_vec())
            .expect("Failed to write header");
        encoder_guard.write_all(b"\n").expect("Failed to write newline");
    }

    download_futures
        .buffer_unordered(20)
        .for_each(|result| {
            let encoder = Arc::clone(&encoder); // Clone the Arc for each task
            let maf_col_cp = maf_col.clone();
            async move {
                match result {
                    Ok((url, content)) => match select_maf_col(content, &maf_col_cp, &url) {
                        Ok((maf_bit, mafrows)) => {
                            if mafrows > 0 {
                                let mut encoder_guard = encoder.lock().unwrap();
                                encoder_guard.write_all(&maf_bit).expect("Failed to write file");
                            } else {
                                let error = ErrorEntry {
                                    url: url.clone(),
                                    error: "Empty MAF file".to_string(),
                                };
                                let error_js = serde_json::to_string(&error).unwrap();
                                writeln!(io::stderr(), "{}", error_js).expect("Failed to output stderr!");
                            }
                        }
                        Err((url, error)) => {
                            let error = ErrorEntry { url, error };
                            let error_js = serde_json::to_string(&error).unwrap();
                            writeln!(io::stderr(), "{}", error_js).expect("Failed to output stderr!");
                        }
                    },
                    Err((url, error)) => {
                        let error = ErrorEntry { url, error };
                        let error_js = serde_json::to_string(&error).unwrap();
                        writeln!(io::stderr(), "{}", error_js).expect("Failed to output stderr!");
                    }
                };
            }
        })
        .await;

    // Finalize output

    // Replace the value inside the Mutex with a dummy value (e.g., None)
    let mut encoder_guard = encoder.lock().unwrap();
    let encoder = std::mem::replace(
        &mut *encoder_guard,
        GzEncoder::new(io::stdout(), Compression::default()),
    );
    // Finalize the encoder
    encoder.finish().expect("Maf file output error!");

    // Manually flush stdout and stderr
    io::stdout().flush().expect("Failed to flush stdout");
    io::stderr().flush().expect("Failed to flush stderr");
    Ok(())
}
