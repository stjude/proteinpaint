// Syntax: cd .. && cargo build --release && time cat ~/sjpp/test.txt | target/release/aichatbot
#![allow(non_snake_case)]
use anyhow::Result;
use json::JsonValue;
use rig::agent::AgentBuilder;
use rig::completion::Prompt;
use schemars::JsonSchema;
use serde_json::{Value, json};
use std::fs;
use std::io;
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

                    let llm_backend_type: llm_backend;
                    let mut final_output: Option<String> = None;
                    let temperature: f64 = 0.01;
                    let max_new_tokens: usize = 512;
                    let top_p: f32 = 0.95;
                    if llm_backend_name != "ollama" && llm_backend_name != "SJ" {
                        panic!(
                            "This code currently supports only Ollama and SJ provider. llm_backend_name must be \"ollama\" or \"SJ\""
                        );
                    } else if llm_backend_name == "ollama".to_string() {
                        llm_backend_type = llm_backend::Ollama();
                        // Initialize Ollama client
                        let ollama_client = ollama::Client::builder()
                            .base_url(apilink)
                            .build()
                            .expect("Ollama server not found");
                        let embedding_model = ollama_client.embedding_model(embedding_model_name);
                        let comp_model = ollama_client.completion_model(comp_model_name);
                        final_output = Some(
                            classify_query_by_dataset_type(
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
                        llm_backend_type = llm_backend::Sj();
                        // Initialize Sj provider client
                        let sj_client = sjprovider::Client::builder()
                            .base_url(apilink)
                            .build()
                            .expect("SJ server not found");
                        let embedding_model = sj_client.embedding_model(embedding_model_name);
                        let comp_model = sj_client.completion_model(comp_model_name);
                        final_output = Some(
                            classify_query_by_dataset_type(
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
                            println!("final_output:{{\"{}\":{}}}", "plot", fin_out);
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

#[allow(non_camel_case_types)]
#[derive(Debug, Clone)]
pub enum llm_backend {
    Ollama(),
    Sj(),
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct OutputJson {
    pub answer: String,
}

async fn classify_query_by_dataset_type(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    _embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    llm_backend_type: &llm_backend,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
    ai_route: &str,
) -> String {
    // Read the file
    let ai_route_data = fs::read_to_string(ai_route).unwrap();

    // Parse the JSON data
    let ai_json: Value = serde_json::from_str(&ai_route_data).expect("AI JSON file does not have the correct format");

    // Create a string to hold the file contents
    let mut contents = String::from("");

    if let Some(object) = ai_json.as_object() {
        contents = object["general"].to_string();
        for (key, value) in object {
            if key != "general" {
                contents += &value.as_str().unwrap();
                contents += "---"; // Adding delimiter
            }
        }
    }

    // Removing the last "---" characters
    contents.pop();
    contents.pop();
    contents.pop();

    // Split the contents by the delimiter "---"
    let parts: Vec<&str> = contents.split("---").collect();
    let schema_json: Value = serde_json::to_value(schemars::schema_for!(OutputJson)).unwrap(); // error handling here
    let schema_json_string = serde_json::to_string_pretty(&schema_json).unwrap();

    let additional;
    match llm_backend_type {
        llm_backend::Ollama() => {
            additional = json!({
                    "max_new_tokens": max_new_tokens,
                    "top_p": top_p,
                    "schema_json": schema_json_string
            });
        }
        llm_backend::Sj() => {
            additional = json!({
                    "max_new_tokens": max_new_tokens,
                    "top_p": top_p
            });
        }
    }

    // Print the separated parts
    let mut rag_docs = Vec::<String>::new();
    for (_i, part) in parts.iter().enumerate() {
        //println!("Part {}: {}", i + 1, part.trim());
        rag_docs.push(part.trim().to_string())
    }

    //let top_k: usize = 3; // Embedding model not used currently
    // Create embeddings and add to vector store
    //let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
    //    .documents(rag_docs)
    //    .expect("Reason1")
    //    .build()
    //    .await
    //    .unwrap();

    //// Create vector store
    //let mut vector_store = InMemoryVectorStore::<String>::default();
    //InMemoryVectorStore::add_documents(&mut vector_store, embeddings);

    // Create RAG agent
    let agent = AgentBuilder::new(comp_model)
        .preamble(&(contents + &"\nQuestion= {question} \nanswer"))
        .temperature(temperature)
        .additional_params(additional)
        .build();
    //.dynamic_context(top_k, vector_store.index(embedding_model))

    let response = agent.prompt(user_input).await.expect("Failed to prompt server");

    //println!("Ollama: {}", response);
    let result = response.replace("json", "").replace("```", "");
    let json_value: Value = serde_json::from_str(&result).expect("REASON");
    match llm_backend_type {
        llm_backend::Ollama() => {
            let json_value2: Value = serde_json::from_str(&json_value["content"].to_string()).expect("REASON2");
            let json_value3: Value = serde_json::from_str(&json_value2.as_str().unwrap()).expect("REASON3");
            json_value3["answer"].to_string()
        }
        llm_backend::Sj() => {
            let json_value2: Value =
                serde_json::from_str(&json_value[0]["generated_text"].to_string()).expect("REASON2");
            //println!("json_value2:{}", json_value2.as_str().unwrap());
            let json_value3: Value = serde_json::from_str(&json_value2.as_str().unwrap()).expect("REASON3");
            //let json_value3: Value = serde_json::from_str(&json_value2["answer"].to_string()).expect("REASON2");
            //println!("Classification result:{}", json_value3["answer"]);
            json_value3["answer"].to_string()
        }
    }
}
