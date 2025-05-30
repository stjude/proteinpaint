/*
  This script downloads cohort maf files from GDC and gracefully handles timeout and other possible errors related to GDC api processing for use by the client file summary div

  Key improvements:
  1. Graceful error handling - individual file failures don't stop the entire process
  2. Better timeout handling with retries
  3. More detailed error reporting
  4. Continues processing even when some files fail

  Input JSON:
    caseFiles
    mafOptions: For SNVindel filtering
  Output mutations as JSON array.

  Example of usage:
    echo '{"caseFiles": {"MP2PRT-PATFJE": {"maf": "26ea7b6f-8bc4-4e83-ace1-2125b493a361"},"MP2PRT-PAPIGD": {"maf": "653d7458-f4af-4328-a1ce-3bbf22a2e347"}},"mafOptions": {"minTotalDepth": 10,"minAltAlleleCount": 2}}' | ./target/release/gdcGRIN2
*/

use flate2::read::GzDecoder;
use futures::StreamExt;
use memchr::memchr;
use serde::Deserialize;
use serde_json;
use std::collections::HashMap;
use std::io::{self, Read};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;
use tokio::io::{AsyncReadExt, BufReader};
use tokio::sync::Mutex;
use tokio::time::timeout;

// Struct to hold error information for JSON output
#[derive(serde::Serialize, Clone)]
struct ErrorEntry {
    case_id: String,
    data_type: String,
    error_type: String,
    error_details: String,
    attempts_made: u32,
}

// Struct for the final output that includes both successful data and errors
#[derive(serde::Serialize)]
struct GdcOutput {
    successful_data: Vec<Vec<Vec<String>>>, // Array of successful file data arrays
    failed_files: Vec<ErrorEntry>,
    summary: OutputSummary,
}

#[derive(serde::Serialize)]
struct OutputSummary {
    total_files: usize,
    successful_files: usize,
    failed_files: usize,
}

// Define the structure for datadd
#[derive(Deserialize, Debug)]
struct DataType {
    cnv: Option<String>,
    maf: Option<String>,
}

// Define the structure for mafOptions
#[derive(Deserialize, Debug)]
struct MafOptions {
    #[serde(rename = "minTotalDepth")]
    min_total_depth: i32,
    #[serde(rename = "minAltAlleleCount")]
    min_alt_allele_count: i32,
}

// Define the top-level input structure
#[derive(Deserialize, Debug)]
struct InputData {
    #[serde(rename = "caseFiles")]
    case_files: HashMap<String, DataType>,
    #[serde(rename = "mafOptions")]
    maf_options: Option<MafOptions>,
}

// Function to parse TSV content
fn parse_content(
    content: &str,
    case_id: &str,
    data_type: &str,
    min_total_depth: i32,
    min_alt_allele_count: i32,
) -> Result<Vec<Vec<String>>, (String, String, String)> {
    let lines = content.lines();
    let mut parsed_data = Vec::new();
    let mut columns_indices: Vec<usize> = Vec::new();
    let mut header_mk: &str = "";
    let mut columns = Vec::new();

    if data_type == "cnv" {
        header_mk = "GDC_Aliquot_ID";
        columns = vec!["Chromosome", "Start", "End", "Segment_Mean"]
    } else if data_type == "maf" {
        header_mk = "Hugo_Symbol";
        columns = vec!["Chromosome", "Start_Position", "End_Position", "t_depth", "t_alt_count"]
    };

    let mut header: Vec<String> = Vec::new();

    for line in lines {
        if line.starts_with("#") {
            continue;
        } else if line.contains(&header_mk) {
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
            out_lst.push(case_id.to_string());

            for x in columns_indices.iter() {
                let mut element = cont_lst[*x].to_string();

                if data_type == "cnv" && &header[*x] == "Segment_Mean" {
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

            if data_type == "maf" {
                let alle_depth = match out_lst[4].parse::<i32>() {
                    Ok(value) => value,
                    Err(_) => {
                        let error_msg = "Failed to convert t_depth to i32.".to_string();
                        return Err((case_id.to_string(), data_type.to_string(), error_msg));
                    }
                };
                let alt_count = match out_lst[5].parse::<i32>() {
                    Ok(value) => value,
                    Err(_) => {
                        let error_msg = "Failed to convert t_alt_count to i32.".to_string();
                        return Err((case_id.to_string(), data_type.to_string(), error_msg));
                    }
                };

                if alle_depth >= min_total_depth && alt_count >= min_alt_allele_count {
                    out_lst = out_lst[0..4].to_vec();
                    out_lst.push("mutation".to_string());
                } else {
                    keep_ck = false;
                }
            }

            if keep_ck {
                parsed_data.push(out_lst);
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

/// Downloads a single file with minimal retry logic for transient failures
async fn download_single_file(
    case_id: String,
    data_type: String,
    url: String,
    max_attempts: u32,
) -> Result<(String, String, String), (String, String, String, u32)> {
    let mut last_error = String::new();
    let mut error_type = String::new();

    for attempt in 0..max_attempts {
        // Build HTTP client with aggressive timeouts for real-time processing
        let client = match reqwest::Client::builder()
            .timeout(Duration::from_secs(10)) // 10 second timeout per request
            .connect_timeout(Duration::from_secs(3)) // 3 second connect timeout
            .build()
        {
            Ok(client) => client,
            Err(e) => {
                last_error = format!("Client build error: {}", e);
                error_type = "client_build_error".to_string();
                continue;
            }
        };

        // Attempt download with tight timeout - fail fast if server is slow
        match timeout(Duration::from_secs(12), client.get(&url).send()).await {
            Ok(Ok(resp)) if resp.status().is_success() => {
                match resp.bytes().await {
                    Ok(content) => {
                        // Handle both compressed and uncompressed content
                        let text = if memchr(0x00, &content).is_some() {
                            // Likely compressed (gzipped) content
                            let mut decoder = GzDecoder::new(&content[..]);
                            let mut decompressed_content = Vec::new();
                            match decoder.read_to_end(&mut decompressed_content) {
                                Ok(_) => String::from_utf8_lossy(&decompressed_content).to_string(),
                                Err(e) => {
                                    last_error = format!("Decompression failed: {}", e);
                                    error_type = "decompression_error".to_string();
                                    continue; // Retry on decompression failure
                                }
                            }
                        } else {
                            // Plain text content
                            String::from_utf8_lossy(&content).to_string()
                        };

                        // Success! Return immediately
                        return Ok((case_id, data_type, text));
                    }
                    Err(e) => {
                        last_error = format!("Failed to read response bytes: {}", e);
                        error_type = "connection_error".to_string();
                        // This could be "connection closed before message completed"
                        // Worth retrying for transient network issues
                    }
                }
            }
            Ok(Ok(resp)) => {
                last_error = format!(
                    "HTTP error {}: {}",
                    resp.status(),
                    resp.status().canonical_reason().unwrap_or("Unknown")
                );
                error_type = if resp.status().is_client_error() {
                    "client_error".to_string()
                } else {
                    "server_error".to_string()
                };
                // Don't retry 4xx errors (client errors), but retry 5xx (server errors)
                if resp.status().is_client_error() {
                    break; // No point retrying client errors
                }
            }
            Ok(Err(e)) => {
                last_error = format!("Request error: {}", e);
                error_type = "network_error".to_string();
                // Network errors are worth retrying
            }
            Err(_) => {
                last_error = "Request timeout (12s) - server too slow".to_string();
                error_type = "timeout_error".to_string();
                // Timeouts might be transient, worth a quick retry
            }
        }

        // If this isn't the last attempt, wait briefly before retrying
        if attempt < max_attempts - 1 {
            // Silent retry - no stderr noise
            tokio::time::sleep(Duration::from_secs(1)).await; // 1 second between retries
        }
    }

    Err((
        case_id,
        data_type,
        format!("{}: {}", error_type, last_error),
        max_attempts,
    ))
}

/// Main download function with structured JSON output including errors
async fn download_data(
    data4dl: HashMap<String, DataType>,
    host: &str,
    min_total_depth: i32,
    min_alt_allele_count: i32,
) {
    // Generate URLs from data4dl, handling optional cnv and maf
    let data_urls: Vec<(String, String, String)> = data4dl
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
        .collect();

    let total_files = data_urls.len();

    // Use atomic counters that can be safely shared across async closures
    let successful_downloads = Arc::new(AtomicUsize::new(0));
    let failed_downloads = Arc::new(AtomicUsize::new(0));

    // Create shared vectors to collect successful data and errors
    let successful_data = Arc::new(Mutex::new(Vec::<Vec<Vec<String>>>::new()));
    let errors = Arc::new(Mutex::new(Vec::<ErrorEntry>::new()));

    // Create download futures with smart retry logic
    let download_futures = futures::stream::iter(data_urls.into_iter().map(|(case_id, data_type, url)| {
        async move {
            // Try each file up to 2 times for transient failures
            download_single_file(case_id, data_type, url, 2).await
        }
    }));

    // Execute downloads concurrently with high concurrency for speed
    download_futures
        .buffer_unordered(15) // Increased to 15 concurrent downloads for speed
        .for_each(|download_result| {
            let successful_downloads = Arc::clone(&successful_downloads);
            let failed_downloads = Arc::clone(&failed_downloads);
            let successful_data = Arc::clone(&successful_data);
            let errors = Arc::clone(&errors);

            async move {
                match download_result {
                    Ok((case_id, data_type, content)) => {
                        // Successfully downloaded, now try to parse
                        match parse_content(&content, &case_id, &data_type, min_total_depth, min_alt_allele_count) {
                            Ok(parsed_data) => {
                                // Store successful data
                                successful_data.lock().await.push(parsed_data);
                                successful_downloads.fetch_add(1, Ordering::Relaxed);
                            }
                            Err((cid, dtp, error)) => {
                                failed_downloads.fetch_add(1, Ordering::Relaxed);
                                let error = ErrorEntry {
                                    case_id: cid,
                                    data_type: dtp,
                                    error_type: "parsing_error".to_string(),
                                    error_details: error,
                                    attempts_made: 1,
                                };
                                errors.lock().await.push(error);
                            }
                        }
                    }
                    Err((case_id, data_type, error_details, attempts)) => {
                        failed_downloads.fetch_add(1, Ordering::Relaxed);

                        // Parse error type from error details
                        let (error_type, clean_details) = if error_details.contains(":") {
                            let parts: Vec<&str> = error_details.splitn(2, ": ").collect();
                            (parts[0].to_string(), parts[1].to_string())
                        } else {
                            ("unknown_error".to_string(), error_details)
                        };

                        let error = ErrorEntry {
                            case_id,
                            data_type,
                            error_type,
                            error_details: clean_details,
                            attempts_made: attempts,
                        };
                        errors.lock().await.push(error);
                    }
                }
            }
        })
        .await;

    // Create final output structure
    let success_count = successful_downloads.load(Ordering::Relaxed);
    let failed_count = failed_downloads.load(Ordering::Relaxed);

    let output = GdcOutput {
        successful_data: successful_data.lock().await.clone(),
        failed_files: errors.lock().await.clone(),
        summary: OutputSummary {
            total_files,
            successful_files: success_count,
            failed_files: failed_count,
        },
    };

    // Output the complete structure as JSON
    match serde_json::to_string(&output) {
        Ok(json) => println!("{}", json),
        Err(_) => {
            // Silent failure - exit without stderr
            std::process::exit(1);
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    const HOST: &str = "https://api.gdc.cancer.gov/data/";

    // Read input with timeout
    let timeout_duration = Duration::from_secs(10); // Increased timeout for input

    let result = timeout(timeout_duration, async {
        let mut buffer = String::new();
        let mut reader = BufReader::new(tokio::io::stdin());
        reader.read_to_string(&mut buffer).await?;
        Ok::<String, io::Error>(buffer)
    })
    .await;

    // Handle input parsing (silently)
    let input_js: InputData = match result {
        Ok(Ok(buffer)) => match serde_json::from_str(&buffer) {
            Ok(js) => js,
            Err(_e) => {
                // Silent failure - exit without stderr
                std::process::exit(1);
            }
        },
        Ok(Err(_e)) => {
            // Silent failure - exit without stderr
            std::process::exit(1);
        }
        Err(_) => {
            // Silent failure - exit without stderr
            std::process::exit(1);
        }
    };

    // Validate input (silently)
    if input_js.case_files.is_empty() {
        // Silent failure - exit without stderr
        std::process::exit(1);
    }

    let case_files = input_js.case_files;

    // Set default maf_options
    let (min_total_depth, min_alt_allele_count) = match input_js.maf_options {
        Some(options) => (options.min_total_depth, options.min_alt_allele_count),
        None => (10, 2), // Default values
    };

    // Download data - this will now handle errors gracefully
    download_data(case_files, HOST, min_total_depth, min_alt_allele_count).await;

    // Always exit successfully - individual file failures are logged but don't stop the process
    Ok(())
}
