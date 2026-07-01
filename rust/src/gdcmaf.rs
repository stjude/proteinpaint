/*
  This script download cohort maf files from GDC, concatenate them into a single file that includes user specified columns.

  Input JSON:
    host: GDC host
    fileIdLst: An array of uuid
    headers: required headers for GDC API
  Output gzip compressed maf file to stdout.

  Example of usage:
      headers='{"X-Forwarded-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.…ML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0", "X-Forwarded-For": "127.0.0.1"}'
    echo '{"host": "https://api.gdc.cancer.gov/data/","columns": ["Hugo_Symbol", "Entrez_Gene_Id", "Center", "NCBI_Build", "Chromosome", "Start_Position"], "fileIdLst": ["8b31d6d1-56f7-4aa8-b026-c64bafd531e7", "b429fcc1-2b59-4b4c-a472-fb27758f6249"], "headers": '$headers'}'|./target/release/gdcmaf
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

// Flatten a std::error::Error (e.g. reqwest::Error) and its `source()` chain into
// a single string, so the real transport-level cause (e.g. "connection closed
// before message completed", connection reset, HTTP/2 stream error) is visible in
// the per-file error rather than only the top-level wrapper message.
fn format_error_chain(e: &dyn std::error::Error) -> String {
    let mut msg = e.to_string();
    let mut src = e.source();
    while let Some(s) = src {
        msg.push_str(" -> ");
        msg.push_str(&s.to_string());
        src = s.source();
    }
    msg
}

// Render the first bytes of a response body for diagnostics: helps tell whether the
// server returned gzip (magic 1f 8b), plain text, or an HTML/JSON error page.
fn preview_bytes(content: &[u8]) -> String {
    let n = content.len().min(64);
    let hex: Vec<String> = content[..n].iter().map(|b| format!("{:02x}", b)).collect();
    let ascii = String::from_utf8_lossy(&content[..n]);
    format!("hex=[{}] ascii=\"{}\"", hex.join(" "), ascii.escape_default())
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
    let mut req_headers = reqwest::header::HeaderMap::new();
    if let Some(headers_val) = file_id_lst_js.get("headers") {
        let headers_obj = match headers_val.as_object() {
            Some(obj) => obj,
            None => {
                let header_error = ErrorEntry {
                    url: String::new(),
                    error: "headers is not an object".to_string(),
                };
                let header_error_js = serde_json::to_string(&header_error).unwrap();
                writeln!(io::stderr(), "{}", header_error_js).expect("Failed to output stderr!");
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "headers is not an object",
                )) as Box<dyn std::error::Error>);
            }
        };
        for (key, value) in headers_obj {
            req_headers.insert(
                reqwest::header::HeaderName::from_bytes(key.as_bytes()).expect("Invalid header key"),
                reqwest::header::HeaderValue::from_str(value.as_str().expect("Invalid string value"))
                    .expect("Invalid header value"),
            );
        }
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

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30)) // 30-second timeout per request
        .connect_timeout(Duration::from_secs(15))
        // Allow keep-alive connection reuse. Previously this was pool_max_idle_per_host(0)
        // to dodge a "connection closed before message completed" race, but disabling reuse
        // forces a brand-new connection per file, which is far harsher on a server that caps
        // concurrent connections (e.g. qa-int). Mid-body drops are now handled by retrying the
        // whole download (see the retry loop below) rather than by refusing to reuse connections.
        .build()
        .map_err(|e| {
            let client_error = ErrorEntry {
                url: String::new(),
                error: format!("Client build error: {}", e),
            };
            let client_error_js = serde_json::to_string(&client_error)
                .unwrap_or_else(|_| "{\"url\":\"\",\"error\":\"Failed to serialize client build error\"}".to_string());
            writeln!(io::stderr(), "{}", client_error_js).expect("Failed to write client build error to stderr");
            e
        })?;

    // Number of files downloaded concurrently. Driven by the input JSON "concurrency" field,
    // which the /gdc/mafBuild handler sets from serverconfig.features.gdcMafConcurrency, so it
    // can be dialed down per environment (e.g. qa-int, which appears to cap simultaneous
    // connections) without a rebuild; falls back to 20 when absent.
    let concurrency = file_id_lst_js
        .get("concurrency")
        .and_then(|v| v.as_u64())
        .filter(|n| *n >= 1)
        .unwrap_or(20) as usize;

    //downloading maf files parallelly and merge them into single maf file
    let download_futures = futures::stream::iter(url.into_iter().map(|url| {
        let client = client.clone();
        let req_headers = req_headers.clone();
        async move {
            // Bounded retry for transient transport failures, up to MAX_ATTEMPTS with backoff.
            // The whole download (send + body read) is inside the loop so a mid-body drop
            // ("connection closed before message completed") is retried, not just connect/send
            // failures. Non-2xx responses and decompression failures are NOT transient and break
            // immediately. The metadata captured before consuming the body feeds the error text.
            const MAX_ATTEMPTS: u32 = 3;
            let mut attempt: u32 = 0;
            loop {
                attempt += 1;

                let mut request = client.get(&url);
                for (name, value) in req_headers.iter() {
                    request = request.header(name.clone(), value.clone());
                }

                // --- send ---
                let resp = match request.send().await {
                    Ok(resp) => resp,
                    Err(e) if attempt < MAX_ATTEMPTS && (e.is_request() || e.is_timeout() || e.is_connect()) => {
                        tokio::time::sleep(Duration::from_millis(500 * attempt as u64)).await;
                        continue;
                    }
                    Err(e) => {
                        break Err((url.clone(), format!("Server request failed: {}", format_error_chain(&e))));
                    }
                };

                // Capture response metadata before the body is consumed, for diagnostics.
                let status = resp.status();
                let version = format!("{:?}", resp.version());
                let content_type = resp
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();
                let content_encoding = resp
                    .headers()
                    .get(reqwest::header::CONTENT_ENCODING)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();

                if !status.is_success() {
                    // non-2xx: a server-side decision, not transient - capture a snippet of the
                    // error body (often an HTML/JSON page from a proxy/WAF) and stop.
                    let body_snippet = match resp.text().await {
                        Ok(t) => t.chars().take(200).collect::<String>().escape_default().to_string(),
                        Err(_) => String::new(),
                    };
                    break Err((
                        url.clone(),
                        format!(
                            "HTTP error {} ({}, content-type '{}', content-encoding '{}'), body: {}",
                            status, version, content_type, content_encoding, body_snippet
                        ),
                    ));
                }

                // --- read body ---
                let content = match resp.bytes().await {
                    Ok(content) => content,
                    Err(_e) if attempt < MAX_ATTEMPTS => {
                        // transport/read failure AFTER headers (e.g. "connection closed before
                        // message completed") - typically transient, so retry the whole download
                        tokio::time::sleep(Duration::from_millis(500 * attempt as u64)).await;
                        continue;
                    }
                    Err(e) => {
                        break Err((
                            url.clone(),
                            format!(
                                "Failed to read response body (HTTP {}, {}, content-type '{}', content-encoding '{}'): {}",
                                status,
                                version,
                                content_type,
                                content_encoding,
                                format_error_chain(&e)
                            ),
                        ));
                    }
                };

                // --- decompress (not transient: do not retry) ---
                let mut decoder = GzDecoder::new(&content[..]);
                let mut decompressed_content = Vec::new();
                break match decoder.read_to_end(&mut decompressed_content) {
                    Ok(_) => Ok((url.clone(), String::from_utf8_lossy(&decompressed_content).to_string())),
                    Err(e) => Err((
                        url.clone(),
                        format!(
                            "Failed to decompress MAF file (HTTP {}, {}, content-type '{}', content-encoding '{}', body {} bytes, first bytes {}): {}",
                            status,
                            version,
                            content_type,
                            content_encoding,
                            content.len(),
                            preview_bytes(&content),
                            e
                        ),
                    )),
                };
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
        .buffer_unordered(concurrency)
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

#[cfg(test)]
mod tests {
    use super::*;

    // ---- select_maf_col ----

    // Minimal MAF-like content: a comment line, a header line (detected by the
    // "Hugo_Symbol" substring), then data rows.
    const MAF: &str = "# version 2.4\n\
        Hugo_Symbol\tEntrez_Gene_Id\tChromosome\tStart_Position\n\
        TP53\t7157\tchr17\t7577120\n\
        KRAS\t3845\tchr12\t25398284\n";

    fn cols(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn select_maf_col_selects_and_orders_requested_columns() {
        // request a subset, in an order different from the file's column order
        let (bytes, rows) = select_maf_col(MAF.to_string(), &cols(&["Chromosome", "Hugo_Symbol"]), "u").unwrap();
        assert_eq!(rows, 2, "two data rows should be emitted");
        assert_eq!(String::from_utf8(bytes).unwrap(), "chr17\tTP53\nchr12\tKRAS\n");
    }

    #[test]
    fn select_maf_col_skips_comment_lines_and_header() {
        // comment (#) and header lines must not be counted or emitted as data
        let (bytes, rows) = select_maf_col(MAF.to_string(), &cols(&["Hugo_Symbol"]), "u").unwrap();
        assert_eq!(rows, 2);
        assert_eq!(String::from_utf8(bytes).unwrap(), "TP53\nKRAS\n");
    }

    #[test]
    fn select_maf_col_errors_on_missing_column() {
        let err = select_maf_col(MAF.to_string(), &cols(&["No_Such_Column"]), "the-url").unwrap_err();
        assert_eq!(err.0, "the-url", "error should carry the url");
        assert!(
            err.1.contains("No_Such_Column"),
            "error should name the missing column: {}",
            err.1
        );
    }

    #[test]
    fn select_maf_col_header_only_yields_no_rows() {
        let header_only = "Hugo_Symbol\tChromosome\n";
        let (bytes, rows) = select_maf_col(header_only.to_string(), &cols(&["Hugo_Symbol"]), "u").unwrap();
        assert_eq!(rows, 0);
        assert!(bytes.is_empty());
    }

    // NOTE: a data row with fewer fields than the header currently panics
    // (maf_cont_lst[*x] index out of bounds); that ragged-row hardening is
    // deferred to Step 5, where a test for graceful handling should be added.

    // ---- format_error_chain ----

    #[derive(Debug)]
    struct TestErr {
        msg: String,
        src: Option<Box<dyn std::error::Error + 'static>>,
    }
    impl std::fmt::Display for TestErr {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "{}", self.msg)
        }
    }
    impl std::error::Error for TestErr {
        fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
            self.src.as_deref()
        }
    }

    #[test]
    fn format_error_chain_single_error() {
        let e = TestErr {
            msg: "top".into(),
            src: None,
        };
        assert_eq!(format_error_chain(&e), "top");
    }

    #[test]
    fn format_error_chain_walks_source_chain() {
        let root = TestErr {
            msg: "root".into(),
            src: None,
        };
        let middle = TestErr {
            msg: "middle".into(),
            src: Some(Box::new(root)),
        };
        let top = TestErr {
            msg: "top".into(),
            src: Some(Box::new(middle)),
        };
        assert_eq!(format_error_chain(&top), "top -> middle -> root");
    }

    // ---- preview_bytes ----

    #[test]
    fn preview_bytes_shows_gzip_magic() {
        // gzip magic 1f 8b should be visible so we can tell gzip from plaintext
        let out = preview_bytes(&[0x1f, 0x8b, 0x08, 0x00]);
        assert!(out.contains("hex=[1f 8b 08 00]"), "got: {}", out);
    }

    #[test]
    fn preview_bytes_renders_plaintext_in_ascii() {
        let out = preview_bytes(b"Hugo_Symbol");
        assert!(
            out.contains("Hugo_Symbol"),
            "ascii preview should show plaintext: {}",
            out
        );
    }

    #[test]
    fn preview_bytes_truncates_to_64_bytes() {
        // 100 'A' (0x41) bytes -> only 64 should be rendered in the hex section
        let out = preview_bytes(&[0x41u8; 100]);
        assert_eq!(
            out.matches("41").count(),
            64,
            "should cap the hex preview at 64 bytes: {}",
            out
        );
    }
}
