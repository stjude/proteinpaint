// Syntax: cd .. && cargo build --release && time cat ~/sjpp/test.txt | target/release/chat_dge
#![allow(non_snake_case)]
use crate::aichatbot::AiJsonFormat;
use anyhow::Result;
use json::JsonValue;
use std::fs;
use std::io;
use std::path::Path;
mod aichatbot; // Get summary agent

mod ollama; // Importing custom rig module for invoking ollama server
mod sjprovider; // Importing custom rig module for invoking SJ GPU server
mod test_ai; // Test examples for AI chatbot

#[tokio::main]
async fn main() -> Result<()> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_n) => {
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    //println!("json_string:{}", json_string);
                    let user_input_json: &JsonValue = &json_string["user_input"];
                    let user_input: &str;
                    match user_input_json.as_str() {
                        Some(inp) => user_input = inp,
                        None => panic!("user_input field is missing in input json"),
                    }

                    let dataset_db_json: &JsonValue = &json_string["dataset_db"];
                    let dataset_db_str: &str;
                    match dataset_db_json.as_str() {
                        Some(inp) => dataset_db_str = inp,
                        None => panic!("dataset_db field is missing in input json"),
                    }

                    if user_input.len() == 0 {
                        panic!("The user input is empty");
                    }

                    let tpmasterdir_json: &JsonValue = &json_string["tpmasterdir"];
                    let tpmasterdir: &str;
                    match tpmasterdir_json.as_str() {
                        Some(inp) => tpmasterdir = inp,
                        None => panic!("tpmasterdir not found"),
                    }

                    let binpath_json: &JsonValue = &json_string["binpath"];
                    let binpath: &str;
                    match binpath_json.as_str() {
                        Some(inp) => binpath = inp,
                        None => panic!("binpath not found"),
                    }

                    let ai_json_file_json: &JsonValue = &json_string["aifiles"];
                    let ai_json_file: String;
                    match ai_json_file_json.as_str() {
                        Some(inp) => ai_json_file = String::from(binpath) + &"/../../" + &inp,
                        None => {
                            panic!("ai json file not found")
                        }
                    }

                    let ai_json_file = Path::new(&ai_json_file);
                    let ai_json_file_path;
                    let current_dir = std::env::current_dir().unwrap();
                    match ai_json_file.canonicalize() {
                        Ok(p) => ai_json_file_path = p,
                        Err(_) => {
                            panic!(
                                "AI JSON file path not found:{:?}, current directory:{:?}",
                                ai_json_file, current_dir
                            )
                        }
                    }

                    // Read the file
                    let ai_data = fs::read_to_string(ai_json_file_path).unwrap();

                    // Parse the JSON data
                    let ai_json: AiJsonFormat =
                        serde_json::from_str(&ai_data).expect("AI JSON file does not have the correct format");
                    let dataset_db = String::from(tpmasterdir) + &"/" + &dataset_db_str;

                    let apilink_json: &JsonValue = &json_string["apilink"];
                    let apilink: &str;
                    match apilink_json.as_str() {
                        Some(inp) => apilink = inp,
                        None => panic!("apilink field is missing in input json"),
                    }

                    let comp_model_name_json: &JsonValue = &json_string["comp_model_name"];
                    let comp_model_name: &str;
                    match comp_model_name_json.as_str() {
                        Some(inp) => comp_model_name = inp,
                        None => panic!("comp_model_name field is missing in input json"),
                    }

                    let embedding_model_name_json: &JsonValue = &json_string["embedding_model_name"];
                    let embedding_model_name: &str;
                    match embedding_model_name_json.as_str() {
                        Some(inp) => embedding_model_name = inp,
                        None => panic!("embedding_model_name field is missing in input json"),
                    }

                    let llm_backend_name_json: &JsonValue = &json_string["llm_backend_name"];
                    let llm_backend_name: &str;
                    match llm_backend_name_json.as_str() {
                        Some(inp) => llm_backend_name = inp,
                        None => panic!("llm_backend_name field is missing in input json"),
                    }

                    let llm_backend_type: aichatbot::llm_backend;
                    let mut final_output: Option<String> = None;
                    let temperature: f64 = 0.01;
                    let max_new_tokens: usize = 512;
                    let top_p: f32 = 0.95;
                    let testing = false; // This variable is always false in production, this is true in test_ai.rs for testing code
                    if llm_backend_name != "ollama" && llm_backend_name != "SJ" {
                        panic!(
                            "This code currently supports only Ollama and SJ provider. llm_backend_name must be \"ollama\" or \"SJ\""
                        );
                    } else if llm_backend_name == "ollama".to_string() {
                        llm_backend_type = aichatbot::llm_backend::Ollama();
                        // Initialize Ollama client
                        let ollama_client = ollama::Client::builder()
                            .base_url(apilink)
                            .build()
                            .expect("Ollama server not found");
                        let embedding_model = ollama_client.embedding_model(embedding_model_name);
                        let comp_model = ollama_client.completion_model(comp_model_name);
                        final_output = Some(
                            aichatbot::extract_DE_search_terms_from_query(
                                user_input,
                                comp_model,
                                embedding_model,
                                &llm_backend_type,
                                temperature,
                                max_new_tokens,
                                top_p,
                                &dataset_db,
                                &ai_json,
                                testing,
                            )
                            .await,
                        );
                    } else if llm_backend_name == "SJ".to_string() {
                        llm_backend_type = aichatbot::llm_backend::Sj();
                        // Initialize Sj provider client
                        let sj_client = sjprovider::Client::builder()
                            .base_url(apilink)
                            .build()
                            .expect("SJ server not found");
                        let embedding_model = sj_client.embedding_model(embedding_model_name);
                        let comp_model = sj_client.completion_model(comp_model_name);
                        final_output = Some(
                            aichatbot::extract_DE_search_terms_from_query(
                                user_input,
                                comp_model,
                                embedding_model,
                                &llm_backend_type,
                                temperature,
                                max_new_tokens,
                                top_p,
                                &dataset_db,
                                &ai_json,
                                testing,
                            )
                            .await,
                        );
                    }

                    match final_output {
                        Some(fin_out) => {
                            println!("final_output:{:?}", fin_out.replace("\\", ""));
                        }
                        None => {
                            println!("final_output:{{\"{}\":\"{}\"}}", "action", "unknown");
                        }
                    }
                }
                Err(error) => println!("Incorrect json:{}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
    Ok(())
}
