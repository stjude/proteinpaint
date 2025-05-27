use flate2::read::GzDecoder;
use futures::StreamExt;
use memchr::memchr;
use serde::Deserialize;
use serde_json;
use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::time::Duration;
use tokio::io::{AsyncReadExt, BufReader};
use tokio::time::timeout;

// Struct to hold error information
#[derive(serde::Serialize)]
struct ErrorEntry {
    case: String,
    error: String,
}

// Define the structure for datadd
#[derive(Deserialize, Debug)]
struct DataType {
    cnv: Option<String>,
    maf: Option<String>,
}

// Function to parse TSV content
// CNV:
// Select cnv columns ["Chromosome","Start","End","Segment_Mean"]
// Segment_Mean >= 0.2 => gain; Segment_Mean <= -0.2 => loss
// MAF:
// Select MAF columns ["Chromosome","Start_Position","End_Position"]
fn parse_content(content: &str, case_id: &str, data_type: &str) -> Result<Vec<Vec<String>>, (String, String, String)> {
    //) -> Result<String, (String, String, String)> {
    let lines = content.lines();
    let mut parsed_data = Vec::new();
    //let mut parsed_data: String = String::new();
    let mut columns_indices: Vec<usize> = Vec::new();
    let mut header_mk: &str = "";
    let mut columns = Vec::new(); // columns selected from GDC file
    if data_type == "cnv" {
        header_mk = "GDC_Aliquot_ID";
        columns = vec!["Chromosome", "Start", "End", "Segment_Mean"]
    } else if data_type == "maf" {
        header_mk = "Hugo_Symbol";
        columns = vec!["Chromosome", "Start_Position", "End_Position"]
    };
    let mut header: Vec<String> = Vec::new(); // GDC file header
    for line in lines {
        if line.starts_with("#") {
            continue;
        } else if line.contains(&header_mk) {
            // header line
            header = line.split("\t").map(|s| s.to_string()).collect();
            for col in &columns {
                match header.iter().position(|x| x == col) {
                    Some(index) => {
                        columns_indices.push(index);
                    }
                    None => {
                        let error_msg = format!("Column {} was not found", col);
                        return Err((case_id.to_string(), data_type.to_string(), error_msg));
                    }
                }
            }
        } else {
            let mut keep_ck: bool = true;
            let cont_lst: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
            let mut out_lst: Vec<String> = Vec::new();
            // add sample ID first
            out_lst.push(case_id.to_string());
            for x in columns_indices.iter() {
                let mut element = cont_lst[*x].to_string();
                if data_type == "cnv" && &header[*x] == "Segment_Mean" {
                    // convert to f32 (segment_mean)
                    let seg_mean = match element.parse::<f32>() {
                        Ok(val) => val,
                        Err(_e) => {
                            let error_msg = "Segment_Mean in cnv file is not float".to_string();
                            return Err((case_id.to_string(), data_type.to_string(), error_msg));
                        }
                    };
                    if seg_mean >= 0.3 {
                        element = "gain".to_string();
                    } else if seg_mean <= -0.4 {
                        element = "loss".to_string();
                    } else {
                        keep_ck = false;
                    }
                }
                out_lst.push(element);
            }
            // add lsn.type to snv
            if data_type == "maf" {
                out_lst.push("mutation".to_string());
            }
            if keep_ck {
                parsed_data.push(out_lst);
                //parsed_data.push_str(out_lst.join("\t").as_str());
                //parsed_data.push_str("\n");
            }
        }
    }
    if columns_indices.is_empty() {
        return Err((
            case_id.to_string(),
            data_type.to_string(),
            "No matching columns found. Problematic file!".to_string(),
        ));
    };
    Ok(parsed_data)
}

// Function to download data
//async fn download_data(data4dl: HashMap<String,DataType>, host: &str) -> Vec<Result<(String, String), (String, String)>> {
async fn download_data(data4dl: HashMap<String, DataType>, host: &str) -> () {
    // Generate URLs from data4dl, handling optional cnv and maf
    let data_urls = data4dl
        .into_iter()
        .flat_map(|(case_id, data_types)| {
            let mut urls = Vec::new();
            if let Some(cnv_uuid) = &data_types.cnv {
                urls.push((case_id.clone(), "cnv".to_string(), format!("{}{}", host, cnv_uuid)));
            }
            if let Some(maf_uuid) = &data_types.maf {
                urls.push((case_id.clone(), "maf".to_string(), format!("{}{}", host, maf_uuid)));
            }
            urls
        })
        .collect::<Vec<_>>();
    let download_futures = futures::stream::iter(data_urls.into_iter().map(|(case_id, data_type, url)| {
        async move {
            //let case_dt = format!("{}/{}",case_id,data_type).to_string();
            // Build HTTP client with timeouts
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(60)) // 60-second timeout per request
                .connect_timeout(Duration::from_secs(30))
                .build()
                .map_err(|_e| "Client build error".to_string());
            // Handle client creation result
            match client {
                Ok(client) => {
                    match client.get(&url).send().await {
                        Ok(resp) if resp.status().is_success() => {
                            match resp.bytes().await {
                                Ok(content) => {
                                    // if data_type == "cnv" {
                                    if !memchr(0x00, &content).is_some() {
                                        // CNV files are plain text
                                        let text = String::from_utf8_lossy(&content).to_string();
                                        Ok((case_id.clone(), data_type.clone(), text))
                                    } else {
                                        let mut decoder = GzDecoder::new(&content[..]);
                                        let mut decompressed_content = Vec::new();
                                        match decoder.read_to_end(&mut decompressed_content) {
                                            Ok(_) => {
                                                let text = String::from_utf8_lossy(&decompressed_content).to_string();
                                                Ok((case_id.clone(), data_type.clone(), text))
                                            }
                                            Err(e) => {
                                                let error_msg = format!(
                                                    "Failed to decompress {} file for {}: {}",
                                                    data_type, case_id, e
                                                );
                                                Err((case_id.clone(), data_type.clone(), error_msg))
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    let error_msg =
                                        format!("Failed to read bytes for {} file for {}: {}", data_type, case_id, e);
                                    Err((case_id.clone(), data_type.clone(), error_msg))
                                }
                            }
                        }
                        Ok(resp) => {
                            let error_msg =
                                format!("HTTP error for {} file for {}: {}", data_type, case_id, resp.status());
                            Err((case_id.clone(), data_type.clone(), error_msg))
                        }
                        Err(e) => {
                            let error_msg =
                                format!("Server request failed for {} file for {}: {}", data_type, case_id, e);
                            Err((case_id.clone(), data_type.clone(), error_msg))
                        }
                    }
                }
                Err(_e) => {
                    let error_msg = "Client build error".to_string();
                    Err((case_id, data_type, error_msg))
                }
            }
        }
    }));

    // Execute downloads concurrently and collect results
    download_futures
        .buffer_unordered(10)
        .for_each(|result| async {
            match result {
                Ok((case_id, data_type, content)) => match parse_content(&content, &case_id, &data_type) {
                    Ok(parsed_data) => match serde_json::to_string(&parsed_data) {
                        Ok(json) => println!("{}", json),
                        Err(e) => {
                            let error = ErrorEntry {
                                case: format!("{}: {}", case_id, data_type),
                                error: format!("Failed to convert data to JSON {}", e),
                            };
                            let error_js = serde_json::to_string(&error).unwrap();
                            eprintln!("{}", error_js);
                        }
                    },
                    Err((cid, dtp, error)) => {
                        let error = ErrorEntry {
                            case: format!("{}: {}", cid, dtp),
                            error,
                        };
                        let error_js = serde_json::to_string(&error).unwrap();
                        eprintln!("{}", error_js);
                    }
                },
                Err((case_id, data_type, error)) => {
                    let error = ErrorEntry {
                        case: format!("{}: {}", case_id, data_type),
                        error,
                    };
                    let error_js = serde_json::to_string(&error).unwrap();
                    eprintln!("{}", error_js);
                }
            }
        })
        .await;
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    const HOST: &str = "https://api.gdc.cancer.gov/data/";

    // Accepting the piped input json from nodejs
    let timeout_duration = Duration::from_secs(5); // Set a 5-second timeout

    // Wrap the read operation in a timeout
    let result = timeout(timeout_duration, async {
        let mut buffer = String::new(); // Initialize an empty string to store input
        let mut reader = BufReader::new(tokio::io::stdin()); // Create a buffered reader for stdin 
        reader.read_to_string(&mut buffer).await?; // Read a line asynchronously
        Ok::<String, io::Error>(buffer) // Return the input as a Result
    })
    .await;

    // Handle the result of the input timeout operation
    let input_js: HashMap<String, DataType> = match result {
        Ok(Ok(buffer)) => match serde_json::from_str(&buffer) {
            Ok(js) => js,
            Err(e) => {
                let stdin_error = ErrorEntry {
                    case: String::new(),
                    error: format!("Input JSON parsing error: {}", e),
                };
                writeln!(io::stderr(), "{}", serde_json::to_string(&stdin_error).unwrap()).unwrap();
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "Input JSON parsing Error!",
                )) as Box<dyn std::error::Error>);
            }
        },
        Ok(Err(_e)) => {
            let stdin_error = ErrorEntry {
                case: String::new(),
                error: "Error reading from stdin.".to_string(),
            };
            let stdin_error_js = serde_json::to_string(&stdin_error).unwrap();
            writeln!(io::stderr(), "{}", stdin_error_js).expect("Failed to output stderr!");
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Error reading from stdin!",
            )) as Box<dyn std::error::Error>);
        }
        Err(_) => {
            let stdin_error = ErrorEntry {
                case: String::new(),
                error: "Timeout while reading from stdin.".to_string(),
            };
            let stdin_error_js = serde_json::to_string(&stdin_error).unwrap();
            writeln!(io::stderr(), "{}", stdin_error_js).expect("Failed to output stderr!");
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Timeout while reading from stdin.",
            )) as Box<dyn std::error::Error>);
        }
    };

    // Download data
    download_data(input_js, HOST).await;

    Ok(())
}
