// Syntax: cd .. && cargo build --release && time cat ~/sjpp/test.txt | target/release/aichatbot
#![allow(non_snake_case)]
use anyhow::Result;
use json::JsonValue;
use schemars::JsonSchema;
use std::io;
mod aichatbot; // Importing classification agent from aichatbot.rs
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

                    if user_input.len() == 0 {
                        panic!("The user input is empty");
                    }

                    let binpath_json: &JsonValue = &json_string["binpath"];
                    let binpath: &str;
                    match binpath_json.as_str() {
                        Some(inp) => binpath = inp,
                        None => panic!("binpath not found"),
                    }

                    let aiRoute_json: &JsonValue = &json_string["aiRoute"];
                    let aiRoute_str: &str;
                    match aiRoute_json.as_str() {
                        Some(inp) => aiRoute_str = inp,
                        None => panic!("aiRoute field is missing in input json"),
                    }
                    let airoute = String::from(binpath) + &"/../../" + &aiRoute_str;

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
                            aichatbot::classify_query_by_dataset_type(
                                user_input,
                                comp_model.clone(),
                                embedding_model.clone(),
                                &llm_backend_type,
                                temperature,
                                max_new_tokens,
                                top_p,
                                &airoute,
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
                            aichatbot::classify_query_by_dataset_type(
                                user_input,
                                comp_model.clone(),
                                embedding_model.clone(),
                                &llm_backend_type,
                                temperature,
                                max_new_tokens,
                                top_p,
                                &airoute,
                            )
                            .await,
                        );
                    }

                    match final_output {
                        Some(fin_out) => {
                            println!("{{\"{}\":{}}}", "route", fin_out);
                        }
                        None => {
                            println!("{{\"{}\":\"{}\"}}", "route", "unknown");
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

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct OutputJson {
    pub answer: String,
}
