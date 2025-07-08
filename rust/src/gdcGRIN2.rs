/*
  This script can either download cohort maf/cnv files from GDC or read them from local files, with default behavior being to download from GDC. It gracefully handles timeout and other possible errors related to GDC API processing or file reading for use by the client file summary div.

  Key improvements:
  1. Graceful error handling - individual file failures don't stop the entire process
  2. Better timeout handling with retries
  3. More detailed error reporting
  4. Continues processing even when some files fail
  5. Added chromosome filtering
  6. Supports reading from local files with --from-file flag

  Command-line arguments:
  - --from-file: Read data from local files instead of downloading from GDC

  Input JSON:
    caseFiles
    mafOptions: For SNVindel filtering
    cnvOptions: For CNV filtering
    chromosomes: chromosomes will be included:[]

  Output mutations as JSON array.
    {
        grin2lesion:[],
        summary:{}
    }

  Example of usage:
    echo '{"caseFiles": {"MP2PRT-PATFJE": {"maf": "26ea7b6f-8bc4-4e83-ace1-2125b493a361"},"MP2PRT-PAPIGD": {"maf": "653d7458-f4af-4328-a1ce-3bbf22a2e347"}, "TCGA-CG-4300": { "cnv":"46372ec2-ff79-4d07-b375-9ba8a12c11f3", "maf":"c09b208d-2e7b-4116-9580-27f20f4c7e67"}},"mafOptions": {"minTotalDepth": 100,"minAltAlleleCount": 20,"hyperMutator":8000,"consequences":["missense_variant","frameshift_variant"]}, "cnvOptions":{"lossThreshold":-1, "gainThreshold": 1.5, "segLength":2000000, "hyperMutator":8000}, "chromosomes":["chr1","chr2","chr3"], "max_record": 100000}' | ./target/release/gdcGRIN2
  Example of usage (read from local files):
    echo '{"caseFiles": {"MP2PRT-PATFJE": {"maf": "26ea7b6f-8bc4-4e83-ace1-2125b493a361"},"MP2PRT-PAPIGD": {"maf": "653d7458-f4af-4328-a1ce-3bbf22a2e347"}, "TCGA-CG-4300": { "cnv":"46372ec2-ff79-4d07-b375-9ba8a12c11f3", "maf":"c09b208d-2e7b-4116-9580-27f20f4c7e67"}},"mafOptions": {"minTotalDepth": 100,"minAltAlleleCount": 20,"hyperMutator":8000,"consequences":["missense_variant","frameshift_variant"]}, "cnvOptions":{"lossThreshold":-1, "gainThreshold": 1.5, "segLength":2000000, "hyperMutator":8000}, "chromosomes":["chr1","chr2","chr3"], "max_record": 100000}' | ./target/release/gdcGRIN2 --from-file

*/

use flate2::read::GzDecoder;
use futures::StreamExt;
use memchr::memchr;
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
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
    #[serde(rename = "hyperMutator")]
    hyper_mutator: i32,
    consequences: Option<Vec<String>>, // Optional list of consequences to filter MAF files
}

// Define the structure for cnvOptions
#[derive(Deserialize, Debug)]
struct CnvOptions {
    #[serde(rename = "lossThreshold")]
    loss_threshold: f32,
    #[serde(rename = "gainThreshold")]
    gain_threshold: f32,
    #[serde(rename = "segLength")]
    seg_length: i32,
    #[serde(rename = "hyperMutator")]
    hyper_mutator: i32,
}

// struct for MAF filter details
#[derive(Clone, Serialize, Default)]
struct FilteredMafDetails {
    matched_consequences: HashMap<String, usize>,
    rejected_consequences: HashMap<String, usize>,
    t_alt_count: usize,
    t_depth: usize,
    invalid_rows: usize,
    excluded_by_min_depth: usize,
    excluded_by_min_alt_count: usize,
    excluded_by_consequence_type: usize,
    total_processed: usize,
    total_included: usize,
    skipped_chromosomes: HashMap<String, usize>,
}

// struct for CNV filter details
#[derive(Clone, Serialize, Default)]
struct FilteredCnvDetails {
    segment_mean: usize,
    seg_length: usize,
    invalid_rows: usize,
    excluded_by_loss_threshold: usize,
    excluded_by_gain_threshold: usize,
    excluded_by_segment_length: usize,
    total_processed: usize,
    total_included: usize,
    skipped_chromosomes: HashMap<String, usize>,
}

// struct for per-case filter details
#[derive(Clone, Serialize)]
struct FilteredCaseDetails {
    maf: FilteredMafDetails,
    cnv: FilteredCnvDetails,
}

// Final summary output (JSONL format)
#[derive(serde::Serialize)]
struct FinalSummary {
    total_files: usize,
    successful_files: usize,
    failed_files: usize,
    errors: Vec<ErrorEntry>,
    filtered_records: usize,
    filtered_maf_records: usize,
    filtered_cnv_records: usize,
    included_maf_records: usize,
    included_cnv_records: usize,
    filtered_records_by_case: HashMap<String, FilteredCaseDetails>,
    hyper_mutator_records: HashMap<String, Vec<String>>,
    excluded_by_max_record: HashMap<String, Vec<String>>,
}

// Enum to hold both SuccessfulFileoutput and FinalSummary
#[derive(Serialize)]
struct Output {
    grin2lesion: Vec<Vec<String>>,
    summary: FinalSummary,
}

// Define the top-level input structure
#[derive(Deserialize, Debug)]
struct InputData {
    #[serde(rename = "caseFiles")]
    case_files: HashMap<String, DataType>,
    #[serde(rename = "mafOptions")]
    maf_options: Option<MafOptions>,
    #[serde(rename = "cnvOptions")]
    cnv_options: Option<CnvOptions>,
    chromosomes: Vec<String>,
    max_record: usize,
}

// Configuration for different data types
#[derive(Deserialize, Debug)]
struct DataTypeConfig {
    header_marker: &'static str,
    output_columns: Vec<&'static str>,
}

// Function to parse TSV content
async fn parse_content(
    content: &str,
    case_id: &str,
    data_type: &str,
    min_total_depth: i32,
    min_alt_allele_count: i32,
    maf_hyper_mutator: i32,
    consequences: &Option<Vec<String>>,
    gain_threshold: f32,
    loss_threshold: f32,
    seg_length: i32,
    cnv_hyper_mutator: i32,
    chromosomes: &HashSet<String>,
    filtered_records: &Arc<Mutex<HashMap<String, FilteredCaseDetails>>>,
    filtered_maf_records: &AtomicUsize,
    filtered_cnv_records: &AtomicUsize,
    included_maf_records: &AtomicUsize,
    included_cnv_records: &AtomicUsize,
    hyper_mutator_records: &Arc<Mutex<HashMap<String, Vec<String>>>>,
) -> Result<Vec<Vec<String>>, (String, String, String)> {
    let config = match data_type {
        "cnv" => DataTypeConfig {
            header_marker: "Segment_Mean",
            output_columns: vec!["Chromosome", "Start", "End", "Segment_Mean"],
        },
        "maf" => DataTypeConfig {
            header_marker: "Hugo_Symbol",
            output_columns: vec!["Chromosome", "Start_Position", "End_Position", "t_depth", "t_alt_count"],
        },
        _ => {
            return Err((
                case_id.to_string(),
                data_type.to_string(),
                "Invalid data type".to_string(),
            ));
        }
    };

    // check hyperMutator for MAF and CNV files
    let hyper_mutator = if data_type == "maf" {
        maf_hyper_mutator
    } else {
        cnv_hyper_mutator
    };
    if hyper_mutator > 0 {
        let line_count = content.lines().count();
        if line_count as i32 > hyper_mutator {
            let mut hyper_records = hyper_mutator_records.lock().await;
            hyper_records
                .entry(data_type.to_string())
                .or_insert_with(Vec::new)
                .push(case_id.to_string());
            if data_type == "maf" {
                filtered_maf_records.fetch_add(line_count, Ordering::Relaxed);
            } else if data_type == "cnv" {
                filtered_cnv_records.fetch_add(line_count, Ordering::Relaxed);
            }
            return Ok(Vec::new());
        }
    };

    let lines = content.lines();
    let mut parsed_data = Vec::new();
    let mut columns_indices: Vec<usize> = Vec::new();
    let mut variant_classification_index: Option<usize> = None;
    let mut header: Vec<String> = Vec::new();

    for line in lines {
        if line.starts_with("#") {
            continue;
        };
        if line.contains(config.header_marker) {
            header = line.split("\t").map(|s| s.to_string()).collect();
            if let Err(err) = setup_columns(
                &header,
                &config,
                &mut columns_indices,
                &mut variant_classification_index,
                case_id,
                data_type,
            ) {
                return Err(err);
            }
            continue;
        };

        let row = match data_type {
            "maf" => {
                process_mafline(
                    line,
                    case_id,
                    data_type,
                    &columns_indices,
                    variant_classification_index,
                    consequences,
                    min_total_depth,
                    min_alt_allele_count,
                    chromosomes,
                    filtered_records,
                    filtered_maf_records,
                    included_maf_records,
                )
                .await
            }
            "cnv" => {
                process_cnvline(
                    line,
                    case_id,
                    data_type,
                    &header,
                    &columns_indices,
                    gain_threshold,
                    loss_threshold,
                    seg_length,
                    chromosomes,
                    filtered_records,
                    filtered_cnv_records,
                    included_cnv_records,
                )
                .await
            }
            _ => {
                return Err((
                    case_id.to_string(),
                    data_type.to_string(),
                    "Invalid data type".to_string(),
                ));
            }
        }?;

        if let Some(out_lst) = row {
            parsed_data.push(out_lst);
        };
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

// Set up column indices for processing
fn setup_columns(
    header: &[String],
    config: &DataTypeConfig,
    columns_indices: &mut Vec<usize>,
    variant_classification_index: &mut Option<usize>,
    case_id: &str,
    data_type: &str,
) -> Result<(), (String, String, String)> {
    for col in &config.output_columns {
        match header.iter().position(|x| x == col) {
            Some(index) => columns_indices.push(index),
            None => {
                return Err((
                    case_id.to_string(),
                    data_type.to_string(),
                    format!("Column {} was not found", col),
                ));
            }
        }
    }

    if data_type == "maf" {
        *variant_classification_index = header.iter().position(|x| x == "One_Consequence");
        if variant_classification_index.is_none() {
            return Err((
                case_id.to_string(),
                data_type.to_string(),
                "Column Variant_Classification was not found".to_string(),
            ));
        }
    }

    Ok(())
}

// Process a single row of MAF file
async fn process_mafline(
    line: &str,
    case_id: &str,
    data_type: &str,
    columns_indices: &[usize],
    variant_classification_index: Option<usize>,
    consequences: &Option<Vec<String>>,
    min_total_depth: i32,
    min_alt_allele_count: i32,
    chromosomes: &HashSet<String>,
    filtered_records: &Arc<Mutex<HashMap<String, FilteredCaseDetails>>>,
    filtered_maf_records: &AtomicUsize,
    included_maf_records: &AtomicUsize,
) -> Result<Option<Vec<String>>, (String, String, String)> {
    let cont_lst: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
    let mut out_lst = vec![case_id.to_string()];

    // Initialize or update case details
    let mut filtered_map = filtered_records.lock().await;
    filtered_map
        .entry(case_id.to_string())
        .or_insert_with(|| FilteredCaseDetails {
            maf: FilteredMafDetails::default(),
            cnv: FilteredCnvDetails::default(),
        });
    let case_details = filtered_map.get_mut(case_id).unwrap();

    // Track total processed records
    case_details.maf.total_processed += 1;

    // Handle consequence filtering and counting for MAF files

    if let Some(var_class_idx) = variant_classification_index {
        if var_class_idx < cont_lst.len() {
            let variant_classification = &cont_lst[var_class_idx];
            if let Some(consequence_filter) = consequences {
                if !consequence_filter.is_empty() {
                    if consequence_filter.contains(variant_classification) {
                        // Matched consequence
                        *case_details
                            .maf
                            .matched_consequences
                            .entry(variant_classification.to_string())
                            .or_insert(0) += 1;
                    } else {
                        // Unmatched consequence
                        *case_details
                            .maf
                            .rejected_consequences
                            .entry(variant_classification.to_string())
                            .or_insert(0) += 1;
                        case_details.maf.excluded_by_consequence_type += 1;
                        filtered_maf_records.fetch_add(1, Ordering::Relaxed);
                        return Ok(None);
                    }
                } else {
                    // Empty filter, count as matched
                    *case_details
                        .maf
                        .matched_consequences
                        .entry(variant_classification.to_string())
                        .or_insert(0) += 1;
                }
            } else {
                // No filter, count as matched
                *case_details
                    .maf
                    .matched_consequences
                    .entry(variant_classification.to_string())
                    .or_insert(0) += 1;
            }
        } else {
            case_details.maf.invalid_rows += 1;
            filtered_maf_records.fetch_add(1, Ordering::Relaxed);
            return Ok(None);
        }
    } else {
        case_details.maf.invalid_rows += 1;
        filtered_maf_records.fetch_add(1, Ordering::Relaxed);
        return Ok(None);
    }

    // Extract relevant columns
    for &x in columns_indices {
        if x >= cont_lst.len() {
            case_details.maf.invalid_rows += 1;
            filtered_maf_records.fetch_add(1, Ordering::Relaxed);
            return Ok(None); // Invalid row
        }
        let element = cont_lst[x].to_string();
        out_lst.push(element);
    }

    // Additional MAF-specific processing
    if out_lst.len() < 6 {
        case_details.maf.invalid_rows += 1;
        filtered_maf_records.fetch_add(1, Ordering::Relaxed);
        return Ok(None); // Not enough columns
    }

    let alle_depth = out_lst[4].parse::<i32>().map_err(|_| {
        case_details.maf.invalid_rows += 1;
        filtered_maf_records.fetch_add(1, Ordering::Relaxed);
        (
            case_id.to_string(),
            data_type.to_string(),
            "Failed to convert t_depth to integer.".to_string(),
        )
    })?;

    let alt_count = out_lst[5].parse::<i32>().map_err(|_| {
        case_details.maf.invalid_rows += 1;
        filtered_maf_records.fetch_add(1, Ordering::Relaxed);
        (
            case_id.to_string(),
            data_type.to_string(),
            "Failed to convert t_alt_count to integer.".to_string(),
        )
    })?;

    if alle_depth < min_total_depth {
        case_details.maf.t_depth += 1;
        case_details.maf.excluded_by_min_depth += 1;
        filtered_maf_records.fetch_add(1, Ordering::Relaxed);
        return Ok(None);
    }
    if alt_count < min_alt_allele_count {
        case_details.maf.t_alt_count += 1;
        case_details.maf.excluded_by_min_alt_count += 1;
        filtered_maf_records.fetch_add(1, Ordering::Relaxed);
        return Ok(None);
    }

    // Keep case_id, chr, start, end, and add "mutation"
    out_lst = out_lst[0..4].to_vec();
    out_lst.push("mutation".to_string());

    // adding 'chr' to chromosome if it is not start with 'chr'
    if !out_lst[1].starts_with("chr") {
        out_lst[1] = format!("chr{}", out_lst[1]);
    }

    // Chromosome filtering
    if !chromosomes.is_empty() && !chromosomes.contains(&out_lst[1]) {
        *case_details
            .maf
            .skipped_chromosomes
            .entry(out_lst[1].clone())
            .or_insert(0) += 1;
        filtered_maf_records.fetch_add(1, Ordering::Relaxed);
        return Ok(None);
    }

    // Update counters for included MAF records
    case_details.maf.total_included += 1;
    included_maf_records.fetch_add(1, Ordering::Relaxed);

    Ok(Some(out_lst))
}

// Process a single row of CNV file
async fn process_cnvline(
    line: &str,
    case_id: &str,
    data_type: &str,
    header: &[String],
    columns_indices: &[usize],
    gain_threshold: f32,
    loss_threshold: f32,
    seg_length: i32,
    chromosomes: &HashSet<String>,
    filtered_records: &Arc<Mutex<HashMap<String, FilteredCaseDetails>>>,
    filtered_cnv_records: &AtomicUsize,
    included_cnv_records: &AtomicUsize,
) -> Result<Option<Vec<String>>, (String, String, String)> {
    let cont_lst: Vec<String> = line.split("\t").map(|s| s.to_string()).collect();
    let mut out_lst = vec![case_id.to_string()];

    // Initialize or update case details
    let mut filtered_map = filtered_records.lock().await;
    filtered_map
        .entry(case_id.to_string())
        .or_insert_with(|| FilteredCaseDetails {
            maf: FilteredMafDetails::default(),
            cnv: FilteredCnvDetails::default(),
        });
    let case_details = filtered_map.get_mut(case_id).unwrap();

    // Track total processed records
    case_details.cnv.total_processed += 1;

    // Extract relevant columns
    for &x in columns_indices {
        if x >= cont_lst.len() {
            case_details.cnv.invalid_rows += 1;
            filtered_cnv_records.fetch_add(1, Ordering::Relaxed);
            return Ok(None); // Invalid row
        }
        let mut element = cont_lst[x].to_string();
        if header[x] == "Segment_Mean" {
            element = process_segment_mean(&element, case_id, data_type, gain_threshold, loss_threshold)?;
            if element.is_empty() {
                case_details.cnv.segment_mean += 1;
                let seg_mean = cont_lst[x].parse::<f32>().unwrap_or(0.0);
                if seg_mean > loss_threshold && seg_mean < gain_threshold {
                    // Between thresholds - not a significant gain or loss
                    if seg_mean >= 0.0 {
                        case_details.cnv.excluded_by_gain_threshold += 1;
                    } else {
                        case_details.cnv.excluded_by_loss_threshold += 1;
                    }
                }
                filtered_cnv_records.fetch_add(1, Ordering::Relaxed);
                return Ok(None);
            }
        }
        out_lst.push(element);
    }

    // filter cnvs based on segment length. Default: 0 (no filtering)
    // calculate segment length (End_Position - Start_Position)
    let end_position = out_lst[3].parse::<i32>().map_err(|_| {
        case_details.cnv.invalid_rows += 1;
        filtered_cnv_records.fetch_add(1, Ordering::Relaxed);
        (
            case_id.to_string(),
            data_type.to_string(),
            "Failed to convert End Position of cnv to integer.".to_string(),
        )
    })?;

    let start_position = out_lst[2].parse::<i32>().map_err(|_| {
        case_details.cnv.invalid_rows += 1;
        filtered_cnv_records.fetch_add(1, Ordering::Relaxed);
        (
            case_id.to_string(),
            data_type.to_string(),
            "Failed to convert Start Position of cnv to integer.".to_string(),
        )
    })?;
    let cnv_length = end_position - start_position;
    if seg_length > 0 && cnv_length > seg_length {
        case_details.cnv.seg_length += 1;
        case_details.cnv.excluded_by_segment_length += 1;
        filtered_cnv_records.fetch_add(1, Ordering::Relaxed);
        return Ok(None);
    }

    // adding 'chr' to chromosome if it is not start with 'chr'
    if !out_lst[1].starts_with("chr") {
        out_lst[1] = format!("chr{}", out_lst[1]);
    }

    // Chromosome filtering
    if !chromosomes.is_empty() && !chromosomes.contains(&out_lst[1]) {
        *case_details
            .cnv
            .skipped_chromosomes
            .entry(out_lst[1].clone())
            .or_insert(0) += 1;
        filtered_cnv_records.fetch_add(1, Ordering::Relaxed);
        return Ok(None);
    }

    // Update counters for included MAF records
    case_details.cnv.total_included += 1;
    included_cnv_records.fetch_add(1, Ordering::Relaxed);

    Ok(Some(out_lst))
}

// Process Segment_Mean for CNV files
fn process_segment_mean(
    element: &str,
    case_id: &str,
    data_type: &str,
    gain_threshold: f32,
    loss_threshold: f32,
) -> Result<String, (String, String, String)> {
    let seg_mean = element.parse::<f32>().map_err(|_| {
        (
            case_id.to_string(),
            data_type.to_string(),
            "Segment_Mean in cnv file is not float".to_string(),
        )
    })?;

    if seg_mean >= gain_threshold {
        Ok("gain".to_string())
    } else if seg_mean <= loss_threshold {
        Ok("loss".to_string())
    } else {
        Ok(String::new())
    }
}

/// Updated helper function to normalize MAF consequence types to frontend format
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

/// Downloading from GDC
/// Outputs JSONL format: one JSON object per line
async fn download_data(
    data4dl: HashMap<String, DataType>,
    host: &str,
    min_total_depth: i32,
    min_alt_allele_count: i32,
    maf_hyper_mutator: i32,
    consequences: &Option<Vec<String>>,
    gain_threshold: f32,
    loss_threshold: f32,
    seg_length: i32,
    cnv_hyper_mutator: i32,
    chromosomes: &HashSet<String>,
    max_record: usize,
) {
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

    // Counters for final summary
    let successful_downloads = Arc::new(AtomicUsize::new(0));
    let failed_downloads = Arc::new(AtomicUsize::new(0));
    let filtered_maf_records = Arc::new(AtomicUsize::new(0));
    let filtered_cnv_records = Arc::new(AtomicUsize::new(0));
    let filtered_records = Arc::new(Mutex::new(HashMap::<String, FilteredCaseDetails>::new()));
    let hyper_mutator_records = Arc::new(Mutex::new(HashMap::<String, Vec<String>>::new()));
    let excluded_by_max_record = Arc::new(Mutex::new(HashMap::<String, Vec<String>>::new()));
    let included_maf_records = Arc::new(AtomicUsize::new(0));
    let included_cnv_records = Arc::new(AtomicUsize::new(0));
    let all_records = Arc::new(Mutex::new(Vec::<Vec<String>>::new()));
    let data_count = Arc::new(AtomicUsize::new(0));

    // Only collect errors (successful data is output immediately)
    let errors = Arc::new(Mutex::new(Vec::<ErrorEntry>::new()));

    let download_futures = futures::stream::iter(
        data_urls
            .into_iter()
            .map(|(case_id, data_type, url)| async move { download_single_file(case_id, data_type, url, 2).await }),
    );

    // Process downloads and output results immediately as JSONL
    download_futures
        .buffer_unordered(20) // Increased concurrency for better performance
        .for_each(|download_result| {
            let successful_downloads = Arc::clone(&successful_downloads);
            let failed_downloads = Arc::clone(&failed_downloads);
            let filtered_maf_records = Arc::clone(&filtered_maf_records);
            let filtered_cnv_records = Arc::clone(&filtered_cnv_records);
            let filtered_records = Arc::clone(&filtered_records);
            let included_maf_records = Arc::clone(&included_maf_records);
            let included_cnv_records = Arc::clone(&included_cnv_records);
            let hyper_mutator_records = Arc::clone(&hyper_mutator_records);
            let excluded_by_max_record = Arc::clone(&excluded_by_max_record);
            let errors = Arc::clone(&errors);
            let all_records = Arc::clone(&all_records);
            let data_count = Arc::clone(&data_count);

            async move {
                let current_count = data_count.load(Ordering::Relaxed);
                if current_count >= max_record {
                    // Skip processing and mark as excluded by max_record
                    if let Ok((case_id, data_type, _)) = download_result {
                        let mut exclud_max_record = excluded_by_max_record.lock().await;
                        exclud_max_record
                            .entry(data_type.to_string())
                            .or_insert_with(Vec::new)
                            .push(case_id.to_string());
                        successful_downloads.fetch_add(1, Ordering::Relaxed);
                    }
                    return;
                }
                match download_result {
                    Ok((case_id, data_type, content)) => {
                        // Try to parse the content
                        match parse_content(
                            &content,
                            &case_id,
                            &data_type,
                            min_total_depth,
                            min_alt_allele_count,
                            maf_hyper_mutator,
                            &consequences,
                            gain_threshold,
                            loss_threshold,
                            seg_length,
                            cnv_hyper_mutator,
                            &chromosomes,
                            &filtered_records,
                            &filtered_maf_records,
                            &filtered_cnv_records,
                            &included_maf_records,
                            &included_cnv_records,
                            &hyper_mutator_records,
                        )
                        .await
                        {
                            Ok(parsed_data) => {
                                let remaining = max_record - current_count;
                                if parsed_data.len() <= remaining {
                                    data_count.fetch_add(parsed_data.len(), Ordering::Relaxed);
                                    all_records.lock().await.extend(parsed_data);
                                } else {
                                    // Skip file if it would exceed max_record
                                    let mut exclud_max_record = excluded_by_max_record.lock().await;
                                    exclud_max_record
                                        .entry(data_type.to_string())
                                        .or_insert_with(Vec::new)
                                        .push(case_id.to_string());
                                }
                                successful_downloads.fetch_add(1, Ordering::Relaxed);
                            }
                            Err((cid, dtp, error)) => {
                                // Parsing failed - add to errors
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
                        // Download failed - add to errors
                        failed_downloads.fetch_add(1, Ordering::Relaxed);

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

    // Output final summary as the last line
    let success_count = successful_downloads.load(Ordering::Relaxed);
    let failed_count = failed_downloads.load(Ordering::Relaxed);
    let filtered_maf_count = filtered_maf_records.load(Ordering::Relaxed);
    let filtered_cnv_count = filtered_cnv_records.load(Ordering::Relaxed);
    let included_maf_count = included_maf_records.load(Ordering::Relaxed);
    let included_cnv_count = included_cnv_records.load(Ordering::Relaxed);

    let summary = FinalSummary {
        total_files,
        successful_files: success_count,
        failed_files: failed_count,
        errors: errors.lock().await.clone(),
        filtered_records: filtered_maf_count + filtered_cnv_count,
        filtered_maf_records: filtered_maf_count,
        filtered_cnv_records: filtered_cnv_count,
        filtered_records_by_case: filtered_records.lock().await.clone(),
        included_maf_records: included_maf_count,
        included_cnv_records: included_cnv_count,
        hyper_mutator_records: hyper_mutator_records.lock().await.clone(),
        excluded_by_max_record: excluded_by_max_record.lock().await.clone(),
    };

    let output = Output {
        grin2lesion: all_records.lock().await.drain(..).collect(),
        summary,
    };

    // Output final summary - Node.js will know processing is complete when it sees this
    // if let Ok(json) = serde_json::to_string(&summary) {
    if let Ok(json) = serde_json::to_string(&output) {
        println!("{}", json);
        use std::io::Write;
        let _ = std::io::stdout().flush();
    }
}

/// Read data from local file
async fn localread_data(
    case_files: HashMap<String, DataType>,
    min_total_depth: i32,
    min_alt_allele_count: i32,
    maf_hyper_mutator: i32,
    consequences: &Option<Vec<String>>,
    gain_threshold: f32,
    loss_threshold: f32,
    seg_length: i32,
    cnv_hyper_mutator: i32,
    chromosomes: &HashSet<String>,
    max_record: usize,
) {
    let data_files: Vec<(String, String, String)> = case_files
        .into_iter()
        .flat_map(|(case_id, data_types)| {
            let mut files = Vec::new();
            if let Some(cnv_file) = &data_types.cnv {
                files.push((case_id.clone(), "cnv".to_string(), cnv_file.clone()));
            }
            if let Some(maf_file) = &data_types.maf {
                files.push((case_id.clone(), "maf".to_string(), maf_file.clone()));
            }
            files
        })
        .collect();
    let total_files = data_files.len();

    // Counters for final summary
    let successful_reads = Arc::new(AtomicUsize::new(0));
    let failed_reads = Arc::new(AtomicUsize::new(0));
    let filtered_maf_records = Arc::new(AtomicUsize::new(0));
    let filtered_cnv_records = Arc::new(AtomicUsize::new(0));
    let filtered_records = Arc::new(Mutex::new(HashMap::<String, FilteredCaseDetails>::new()));
    let hyper_mutator_records = Arc::new(Mutex::new(HashMap::<String, Vec<String>>::new()));
    let excluded_by_max_record = Arc::new(Mutex::new(HashMap::<String, Vec<String>>::new()));
    let included_maf_records = Arc::new(AtomicUsize::new(0));
    let included_cnv_records = Arc::new(AtomicUsize::new(0));
    let errors = Arc::new(Mutex::new(Vec::<ErrorEntry>::new()));
    let all_records = Arc::new(Mutex::new(Vec::<Vec<String>>::new()));
    let data_count = Arc::new(AtomicUsize::new(0));

    // Process files concurrently
    let read_futures = futures::stream::iter(data_files.into_iter().map(
        |(case_id, data_type, file_path)| async move {
            // read the local file
            match fs::read_to_string(&file_path) {
                Ok(content) => Ok((case_id, data_type, content)),
                Err(e) => Err((
                    case_id,
                    data_type,
                    format!("file_read_error: {}", e),
                    1, // Single attempt for local file readng
                )),
            }
        },
    ));

    // Process files and output results
    read_futures
        .buffer_unordered(3)
        .for_each(|read_result| {
            let successful_reads = Arc::clone(&successful_reads);
            let failed_reads = Arc::clone(&failed_reads);
            let filtered_maf_records = Arc::clone(&filtered_maf_records);
            let filtered_cnv_records = Arc::clone(&filtered_cnv_records);
            let filtered_records = Arc::clone(&filtered_records);
            let included_maf_records = Arc::clone(&included_maf_records);
            let included_cnv_records = Arc::clone(&included_cnv_records);
            let hyper_mutator_records = Arc::clone(&hyper_mutator_records);
            let excluded_by_max_record = Arc::clone(&excluded_by_max_record);
            let errors = Arc::clone(&errors);
            let all_records = Arc::clone(&all_records);
            let data_count = Arc::clone(&data_count);

            async move {
                let current_count = data_count.load(Ordering::Relaxed);
                if current_count >= max_record {
                    // Skip processing and mark as excluded by max_record
                    if let Ok((case_id, data_type, _)) = read_result {
                        let mut exclud_max_record = excluded_by_max_record.lock().await;
                        exclud_max_record
                            .entry(data_type.to_string())
                            .or_insert_with(Vec::new)
                            .push(case_id.to_string());
                        successful_reads.fetch_add(1, Ordering::Relaxed);
                    }
                    return;
                }
                match read_result {
                    Ok((case_id, data_type, content)) => {
                        match parse_content(
                            &content,
                            &case_id,
                            &data_type,
                            min_total_depth,
                            min_alt_allele_count,
                            maf_hyper_mutator,
                            consequences,
                            gain_threshold,
                            loss_threshold,
                            seg_length,
                            cnv_hyper_mutator,
                            chromosomes,
                            &filtered_records,
                            &filtered_maf_records,
                            &filtered_cnv_records,
                            &included_maf_records,
                            &included_cnv_records,
                            &hyper_mutator_records,
                        )
                        .await
                        {
                            Ok(parsed_data) => {
                                let remaining = max_record - current_count;
                                if parsed_data.len() <= remaining {
                                    data_count.fetch_add(parsed_data.len(), Ordering::Relaxed);
                                    all_records.lock().await.extend(parsed_data);
                                } else {
                                    // Skip file if it would exceed max_record
                                    let mut exclud_max_record = excluded_by_max_record.lock().await;
                                    exclud_max_record
                                        .entry(data_type.to_string())
                                        .or_insert_with(Vec::new)
                                        .push(case_id.to_string());
                                }
                                successful_reads.fetch_add(1, Ordering::Relaxed);
                            }
                            Err((cid, dtp, error)) => {
                                failed_reads.fetch_add(1, Ordering::Relaxed);
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
                        failed_reads.fetch_add(1, Ordering::Relaxed);
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
    // Output final summary as the last line
    let success_count = successful_reads.load(Ordering::Relaxed);
    let failed_count = failed_reads.load(Ordering::Relaxed);
    let filtered_maf_count = filtered_maf_records.load(Ordering::Relaxed);
    let filtered_cnv_count = filtered_cnv_records.load(Ordering::Relaxed);
    let included_maf_count = included_maf_records.load(Ordering::Relaxed);
    let included_cnv_count = included_cnv_records.load(Ordering::Relaxed);

    let summary = FinalSummary {
        total_files,
        successful_files: success_count,
        failed_files: failed_count,
        errors: errors.lock().await.clone(),
        filtered_records: filtered_maf_count + filtered_cnv_count,
        filtered_maf_records: filtered_maf_count,
        filtered_cnv_records: filtered_cnv_count,
        filtered_records_by_case: filtered_records.lock().await.clone(),
        included_maf_records: included_maf_count,
        included_cnv_records: included_cnv_count,
        hyper_mutator_records: hyper_mutator_records.lock().await.clone(),
        excluded_by_max_record: excluded_by_max_record.lock().await.clone(),
    };

    let output = Output {
        grin2lesion: all_records.lock().await.drain(..).collect(),
        summary,
    };

    // Output final JSON array
    if let Ok(json) = serde_json::to_string(&output) {
        println!("{}", json);
        use std::io::Write;
        let _ = std::io::stdout().flush();
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let from_file = args.contains(&"--from-file".to_string());

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
    let max_record: usize = input_js.max_record;

    // Set default maf_options
    let (min_total_depth, min_alt_allele_count, maf_hyper_mutator, consequences) = match input_js.maf_options {
        Some(options) => (
            options.min_total_depth,
            options.min_alt_allele_count,
            options.hyper_mutator,
            options.consequences.clone(),
        ),
        None => (10, 2, 8000, None), // Default values
    };

    // Set default cnv_options
    let (gain_threshold, loss_threshold, seg_length, cnv_hyper_mutator) = match input_js.cnv_options {
        Some(options) => (
            options.gain_threshold,
            options.loss_threshold,
            options.seg_length,
            options.hyper_mutator,
        ),
        None => (0.3, -0.4, 0, 500), // Default values
    };

    // Convert Vec<String> to HashSet<String> for faster lookup
    let chromosomes = input_js.chromosomes.into_iter().collect::<HashSet<String>>();

    if from_file {
        localread_data(
            case_files,
            min_total_depth,
            min_alt_allele_count,
            maf_hyper_mutator,
            &consequences,
            gain_threshold,
            loss_threshold,
            seg_length,
            cnv_hyper_mutator,
            &chromosomes,
            max_record,
        )
        .await;
    } else {
        // Download data from GDC- this will now handle errors gracefully
        download_data(
            case_files,
            HOST,
            min_total_depth,
            min_alt_allele_count,
            maf_hyper_mutator,
            &consequences,
            gain_threshold,
            loss_threshold,
            seg_length,
            cnv_hyper_mutator,
            &chromosomes,
            max_record,
        )
        .await;
    }

    // Always exit successfully - individual file failures are logged but don't stop the process
    Ok(())
}
