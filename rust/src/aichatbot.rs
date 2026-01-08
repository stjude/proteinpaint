#![allow(non_snake_case)]
//use anyhow::Result;
//use json::JsonValue;
use r2d2_sqlite::SqliteConnectionManager;
use rig::agent::AgentBuilder;
use rig::completion::Prompt;
//use rig::embeddings::builder::EmbeddingsBuilder;
//use rig::vector_store::in_memory_store::InMemoryVectorStore;
use schemars::JsonSchema;
use serde_json::{Map, Value, json};
use std::collections::HashMap;
use std::fs;

// Struct for intaking data from dataset json
#[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
pub struct AiJsonFormat {
    pub hasGeneExpression: bool,
    pub hasDE: bool,
    pub db: String,     // Dataset db
    pub genedb: String, // Gene db
    pub charts: Vec<TrainTestData>,
}

#[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
pub struct TrainTestData {
    pub r#type: String,
    pub SystemPrompt: String,
    pub TrainingData: Vec<QuestionAnswer>,
    pub TestData: Vec<QuestionAnswer>,
}

#[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
pub struct QuestionAnswer {
    pub question: String,
    pub answer: AnswerFormat,
}

#[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
pub enum AnswerFormat {
    #[allow(non_camel_case_types)]
    summary_type(SummaryType),
    #[allow(non_camel_case_types)]
    DE_type(DEOutput),
}

#[allow(non_camel_case_types)]
#[derive(Debug, Clone)]
pub enum llm_backend {
    Ollama(),
    Sj(),
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
pub struct OutputJson {
    pub answer: String,
}

//#[tokio::main]
//async fn main() -> Result<()> {
//    let mut input = String::new();
//    match io::stdin().read_line(&mut input) {
//        // Accepting the piped input from nodejs (or command line from testing)
//        Ok(_n) => {
//            let input_json = json::parse(&input);
//            match input_json {
//                Ok(json_string) => {
//                    //println!("json_string:{}", json_string);
//                    let user_input_json: &JsonValue = &json_string["user_input"];
//                    let user_input: &str;
//                    match user_input_json.as_str() {
//                        Some(inp) => user_input = inp,
//                        None => panic!("user_input field is missing in input json"),
//                    }
//                    let dataset_db_json: &JsonValue = &json_string["dataset_db"];
//                    let dataset_db_str: &str;
//                    match dataset_db_json.as_str() {
//                        Some(inp) => dataset_db_str = inp,
//                        None => panic!("dataset_db field is missing in input json"),
//                    }
//                    let genedb_json: &JsonValue = &json_string["genedb"];
//                    let genedb_str: &str;
//                    match genedb_json.as_str() {
//                        Some(inp) => genedb_str = inp,
//                        None => panic!("genedb field is missing in input json"),
//                    }
//                    let aiRoute_json: &JsonValue = &json_string["aiRoute"];
//                    let aiRoute_str: &str;
//                    match aiRoute_json.as_str() {
//                        Some(inp) => aiRoute_str = inp,
//                        None => panic!("aiRoute field is missing in input json"),
//                    }
//                    if user_input.len() == 0 {
//                        panic!("The user input is empty");
//                    }
//                    let tpmasterdir_json: &JsonValue = &json_string["tpmasterdir"];
//                    let tpmasterdir: &str;
//                    match tpmasterdir_json.as_str() {
//                        Some(inp) => tpmasterdir = inp,
//                        None => panic!("tpmasterdir not found"),
//                    }
//                    let binpath_json: &JsonValue = &json_string["binpath"];
//                    let binpath: &str;
//                    match binpath_json.as_str() {
//                        Some(inp) => binpath = inp,
//                        None => panic!("binpath not found"),
//                    }
//                    let ai_json_file_json: &JsonValue = &json_string["aifiles"];
//                    let ai_json_file: String;
//                    match ai_json_file_json.as_str() {
//                        Some(inp) => ai_json_file = String::from(binpath) + &"/../../" + &inp,
//                        None => {
//                            panic!("ai json file not found")
//                        }
//                    }
//                    let ai_json_file = Path::new(&ai_json_file);
//                    let ai_json_file_path;
//                    let current_dir = std::env::current_dir().unwrap();
//                    match ai_json_file.canonicalize() {
//                        Ok(p) => ai_json_file_path = p,
//                        Err(_) => {
//                            panic!(
//                                "AI JSON file path not found:{:?}, current directory:{:?}",
//                                ai_json_file, current_dir
//                            )
//                        }
//                    }
//                    // Read the file
//                    let ai_data = fs::read_to_string(ai_json_file_path).unwrap();
//                    // Parse the JSON data
//                    let ai_json: AiJsonFormat =
//                        serde_json::from_str(&ai_data).expect("AI JSON file does not have the correct format");
//                    let genedb = String::from(tpmasterdir) + &"/" + &genedb_str;
//                    let dataset_db = String::from(tpmasterdir) + &"/" + &dataset_db_str;
//                    let airoute = String::from(binpath) + &"/../../" + &aiRoute_str;
//                    let apilink_json: &JsonValue = &json_string["apilink"];
//                    let apilink: &str;
//                    match apilink_json.as_str() {
//                        Some(inp) => apilink = inp,
//                        None => panic!("apilink field is missing in input json"),
//                    }
//                    let comp_model_name_json: &JsonValue = &json_string["comp_model_name"];
//                    let comp_model_name: &str;
//                    match comp_model_name_json.as_str() {
//                        Some(inp) => comp_model_name = inp,
//                        None => panic!("comp_model_name field is missing in input json"),
//                    }
//                    let embedding_model_name_json: &JsonValue = &json_string["embedding_model_name"];
//                    let embedding_model_name: &str;
//                    match embedding_model_name_json.as_str() {
//                        Some(inp) => embedding_model_name = inp,
//                        None => panic!("embedding_model_name field is missing in input json"),
//                    }
//                    let llm_backend_name_json: &JsonValue = &json_string["llm_backend_name"];
//                    let llm_backend_name: &str;
//                    match llm_backend_name_json.as_str() {
//                        Some(inp) => llm_backend_name = inp,
//                        None => panic!("llm_backend_name field is missing in input json"),
//                    }
//                    let llm_backend_type: llm_backend;
//                    let mut final_output: Option<String> = None;
//                    let temperature: f64 = 0.01;
//                    let max_new_tokens: usize = 512;
//                    let top_p: f32 = 0.95;
//                    let testing = false; // This variable is always false in production, this is true in test_ai.rs for testing code
//                    if llm_backend_name != "ollama" && llm_backend_name != "SJ" {
//                        panic!(
//                           "This code currently supports only Ollama and SJ provider. llm_backend_name must be \"ollama\" or \"SJ\""
//                       );
//                    } else if llm_backend_name == "ollama".to_string() {
//                        llm_backend_type = llm_backend::Ollama();
//                        // Initialize Ollama client
//                        let ollama_client = ollama::Client::builder()
//                            .base_url(apilink)
//                            .build()
//                            .expect("Ollama server not found");
//                        let embedding_model = ollama_client.embedding_model(embedding_model_name);
//                        let comp_model = ollama_client.completion_model(comp_model_name);
//                        final_output = run_pipeline(
//                            user_input,
//                            comp_model,
//                            embedding_model,
//                            llm_backend_type,
//                            temperature,
//                            max_new_tokens,
//                            top_p,
//                            &dataset_db,
//                            &genedb,
//                            &ai_json,
//                            &airoute,
//                            testing,
//                        )
//                        .await;
//                    } else if llm_backend_name == "SJ".to_string() {
//                        llm_backend_type = llm_backend::Sj();
//                        // Initialize Sj provider client
//                        let sj_client = sjprovider::Client::builder()
//                            .base_url(apilink)
//                            .build()
//                            .expect("SJ server not found");
//                        let embedding_model = sj_client.embedding_model(embedding_model_name);
//                        let comp_model = sj_client.completion_model(comp_model_name);
//                        final_output = run_pipeline(
//                            user_input,
//                            comp_model,
//                            embedding_model,
//                            llm_backend_type,
//                            temperature,
//                            max_new_tokens,
//                            top_p,
//                            &dataset_db,
//                            &genedb,
//                            &ai_json,
//                            &airoute,
//                            testing,
//                        )
//                        .await;
//                    }
//                    match final_output {
//                        Some(fin_out) => {
//                            println!("final_output:{:?}", fin_out.replace("\\", ""));
//                        }
//                        None => {
//                            println!("final_output:{{\"{}\":\"{}\"}}", "action", "unknown");
//                        }
//                    }
//                }
//                Err(error) => println!("Incorrect json:{}", error),
//            }
//        }
//        Err(error) => println!("Piping error: {}", error),
//    }
//    Ok(())
//}

#[allow(dead_code)]
pub async fn run_pipeline(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    llm_backend_type: llm_backend,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
    dataset_db: &str,
    genedb: &str,
    ai_json: &AiJsonFormat,
    ai_route: &str,
    testing: bool,
) -> Option<String> {
    let mut classification: String = classify_query_by_dataset_type(
        user_input,
        comp_model.clone(),
        embedding_model.clone(),
        &llm_backend_type,
        temperature,
        max_new_tokens,
        top_p,
        ai_route,
    )
    .await;
    classification = classification.replace("\"", "");
    let final_output;
    if classification == "dge".to_string() {
        final_output = extract_DE_search_terms_from_query(
            user_input,
            comp_model,
            embedding_model,
            &llm_backend_type,
            temperature,
            max_new_tokens,
            top_p,
            dataset_db,
            ai_json,
            testing,
        )
        .await;
    } else if classification == "summary".to_string() {
        final_output = extract_summary_information(
            user_input,
            comp_model,
            embedding_model,
            &llm_backend_type,
            temperature,
            max_new_tokens,
            top_p,
            dataset_db,
            genedb,
            ai_json,
            testing,
        )
        .await;
    } else if classification == "hierarchical".to_string() {
        // Not implemented yet
        if testing == true {
            final_output = format!("{{\"{}\":\"{}\"}}", "action", "hierarchical");
        } else {
            final_output = format!(
                "{{\"{}\":\"{}\",\"{}\":\"{}\"}}",
                "type", "html", "html", "hierarchical clustering agent not implemented yet"
            );
        }
    } else if classification == "snv_indel".to_string() {
        // Not implemented yet
        if testing == true {
            final_output = format!("{{\"{}\":\"{}\"}}", "action", "snv_indel");
        } else {
            final_output = format!(
                "{{\"{}\":\"{}\",\"{}\":\"{}\"}}",
                "type", "html", "html", "snv_indel agent not implemented yet"
            );
        }
    } else if classification == "cnv".to_string() {
        // Not implemented yet
        if testing == true {
            final_output = format!("{{\"{}\":\"{}\"}}", "action", "cnv");
        } else {
            final_output = format!(
                "{{\"{}\":\"{}\",\"{}\":\"{}\"}}",
                "type", "html", "html", "cnv agent not implemented yet"
            );
        }
    } else if classification == "variant_calling".to_string() {
        // Not implemented yet and will never be supported. Need a separate messages for this
        if testing == true {
            final_output = format!("{{\"{}\":\"{}\"}}", "action", "variant_calling");
        } else {
            final_output = format!(
                "{{\"{}\":\"{}\",\"{}\":\"{}\"}}",
                "type", "html", "html", "variant_calling agent not implemented yet"
            );
        }
    } else if classification == "survival".to_string() {
        // Not implemented yet
        if testing == true {
            final_output = format!("{{\"{}\":\"{}\"}}", "action", "surivial");
        } else {
            final_output = format!(
                "{{\"{}\":\"{}\",\"{}\":\"{}\"}}",
                "type", "html", "html", "survival agent not implemented yet"
            );
        }
    } else if classification == "none".to_string() {
        if testing == true {
            final_output = format!(
                "{{\"{}\":\"{}\",\"{}\":\"{}\"}}",
                "action", "none", "message", "The input query did not match any known features in Proteinpaint"
            );
        } else {
            final_output = format!(
                "{{\"{}\":\"{}\",\"{}\":\"{}\"}}",
                "type", "html", "html", "The input query did not match any known features in Proteinpaint"
            );
        }
    } else {
        if testing == true {
            final_output = format!("{{\"{}\":\"{}\"}}", "action", "unknown:".to_string() + &classification);
        } else {
            final_output = format!(
                "{{\"{}\":\"{}\",\"{}\":\"{}\"}}",
                "type",
                "html",
                "html",
                "unknown:".to_string() + &classification
            );
        }
    }
    Some(final_output)
}

#[allow(dead_code)]
pub async fn classify_query_by_dataset_type(
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
    let agent = AgentBuilder::new(comp_model).preamble(&(String::from("Generate classification for the user query into summary, dge, hierarchical, snv_indel, cnv, variant_calling, sv_fusion and none categories. Return output in JSON with ALWAYS a single word answer { \"answer\": \"dge\" }, that is 'summary' for summary plot, 'dge' for differential gene expression, 'hierarchical' for hierarchical clustering, 'snv_indel' for SNV/Indel, 'cnv' for CNV and 'sv_fusion' for SV/fusion, 'variant_calling' for variant calling, 'surivial' for survival data, 'none' for none of the previously described categories. The summary plot list and summarizes the cohort of patients according to the user query. The answer should always be in lower case\n The options are as follows:\n") + &contents + "\nQuestion= {question} \nanswer")).temperature(temperature).additional_params(additional).build();
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

// DE JSON output schema
fn get_DE_string() -> String {
    "DE".to_string()
}

#[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
pub struct DEOutput {
    // Serde uses this for deserialization.
    #[serde(default = "get_DE_string")]
    // Schemars uses this for schema generation.
    #[schemars(rename = "action")]
    action: String,
    group1: Vec<FilterTerm>,
    group2: Vec<FilterTerm>,
    message: Option<String>,
}

impl DEOutput {
    #[allow(dead_code)]
    pub fn sort_DEoutput_struct(mut self) -> DEOutput {
        // This function is necessary for testing (test_ai.rs) to see if two variables of type "SummaryType" are equal or not. Without this a vector of two Summarytype holding the same values but in different order will be classified separately.
        self.group1.sort();
        self.group2.sort();
        self.clone()
    }
}

#[allow(dead_code)]
#[allow(non_snake_case)]
pub async fn extract_DE_search_terms_from_query(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    _embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    llm_backend_type: &llm_backend,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
    dataset_db: &str,
    ai_json: &AiJsonFormat,
    testing: bool,
) -> String {
    match ai_json.hasDE {
        true => {
            let (rag_docs, db_vec) = parse_dataset_db(dataset_db).await;
            let schema_json: Value = serde_json::to_value(schemars::schema_for!(DEOutput)).unwrap(); // error handling here
            let schema_json_string = serde_json::to_string_pretty(&schema_json).unwrap();
            //println!("DE schema:{}", schema_json);

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

            let mut DE_data_check: Option<TrainTestData> = None;
            for chart in ai_json.charts.clone() {
                if chart.r#type == "DE" {
                    DE_data_check = Some(chart);
                    break;
                }
            }

            match DE_data_check {
                Some(DE_data) => {
                    let mut training_data: String = String::from("");
                    let mut train_iter = 0;
                    for ques_ans in DE_data.TrainingData {
                        match ques_ans.answer {
                            AnswerFormat::summary_type(_) => panic!("Summary type not valid for DE"),
                            AnswerFormat::DE_type(de_term) => {
                                let DE_answer: DEOutput = de_term;
                                train_iter += 1;
                                training_data += "Example question";
                                training_data += &train_iter.to_string();
                                training_data += &":";
                                training_data += &ques_ans.question;
                                training_data += &" ";
                                training_data += "Example answer";
                                training_data += &train_iter.to_string();
                                training_data += &":";
                                training_data += &serde_json::to_string(&DE_answer).unwrap();
                                training_data += &"\n";
                            }
                        }
                    }
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

                    //println!("rag_docs:{:?}", rag_docs);

                    // Create RAG agent
                    let router_instructions = String::from(
                        " I am an assistant that extracts the groups from the user prompt to carry out differential gene expression. The final output must be in the following JSON format with NO extra comments. There are three compulsory fields: \"action\", \"group1\" and \"group2\". In case of DE, the \"action\" field should ALWAYS be \"DE\". The fields \"group1\" and \"group2\" should ONLY either be a field in the sqlite db or a value of any of the fields inside the db. The optional \"message\" field contains any error message if required. In case if any of the groups are NOT found the group field should be an EMPTY vector and show the error message in the \"message\" field for e.g. {\"message\":\"The group was not found\"}. In case one of the groups contains a field from the database, but not a category or a value of the field, that group field should be EMPTY and the error message in the \"message\" field should be for e.g. {\"message\":\"This group is a field of the db, not one of the possible types or values of a field\"}",
                    ) + " The JSON schema is as follows"
                        + &schema_json_string
                        + &training_data
                        + "The sqlite db in plain language is as follows:\n"
                        + &rag_docs.join(",")
                        + &"\nQuestion: {question} \nanswer:";
                    //println! {"router_instructions:{}",router_instructions};
                    let agent = AgentBuilder::new(comp_model)
                        .preamble(&router_instructions)
                        //.dynamic_context(rag_docs_length, vector_store.index(embedding_model))
                        .temperature(temperature)
                        .additional_params(additional)
                        .build();

                    let response = agent.prompt(user_input).await.expect("Failed to prompt server");

                    //println!("Ollama_groups: {}", response);
                    let result = response.replace("json", "").replace("```", "");
                    //println!("result_groups:{}", result);
                    let json_value: Value = serde_json::from_str(&result).expect("REASON");
                    let final_llm_json;
                    match llm_backend_type {
                        llm_backend::Ollama() => {
                            let json_value2: Value =
                                serde_json::from_str(&json_value["content"].to_string()).expect("REASON2");
                            //println!("json_;value2:{:?}", json_value2);
                            let json_value3: Value =
                                serde_json::from_str(&json_value2.as_str().unwrap()).expect("REASON3");
                            final_llm_json = json_value3.to_string();
                        }
                        llm_backend::Sj() => {
                            let json_value2: Value =
                                serde_json::from_str(&json_value[0]["generated_text"].to_string()).expect("REASON2");
                            //println!("json_value2:{}", json_value2.as_str().unwrap());
                            let json_value3: Value =
                                serde_json::from_str(&json_value2.as_str().unwrap()).expect("REASON2");
                            //println!("Classification result:{}", json_value3);
                            final_llm_json = json_value3.to_string();
                        }
                    }
                    validate_DE_groups(final_llm_json.clone(), db_vec, testing)
                }
                None => {
                    panic!("DE chart train and test data is not defined in dataset JSON file")
                }
            }
        }
        false => {
            let final_exp;
            let message = "Differential gene expression not supported for this dataset";
            if testing == true {
                let mut new_json: Value = serde_json::from_str(&"{\"action\":\"DE\"}").expect("Not a valid JSON");
                if let Some(obj) = new_json.as_object_mut() {
                    obj.insert(String::from("group1"), serde_json::json!([]));
                    obj.insert(String::from("group2"), serde_json::json!([]));
                    obj.insert(String::from("message"), serde_json::json!(message));
                }
                final_exp = serde_json::to_string(&new_json).unwrap();
            } else {
                let mut err_json: Value = serde_json::from_str(&"{\"type\":\"html\"}").expect("Not a valid JSON");
                if let Some(obj) = err_json.as_object_mut() {
                    obj.insert(String::from("html"), serde_json::json!(message));
                };
                final_exp = serde_json::to_string(&err_json).unwrap();
            }
            final_exp
        }
    }
}

fn validate_DE_groups(raw_llm_json: String, db_vec: Vec<DbRows>, testing: bool) -> String {
    //println!("raw_llm_json:{}", raw_llm_json);
    let json_value: DEOutput =
	serde_json::from_str(&raw_llm_json).expect("Did not get a valid JSON of type {group1: group1, group2: group2, message: message, filter:[{term: term1, value: value1}]} from the LLM");
    let mut message: String = String::from("");
    match json_value.message {
        Some(mes) => {
            message = message + &mes; // Append any message given by the LLM
        }
        None => {}
    }

    let final_exp;
    if testing == true {
        let mut new_json: Value; // New JSON value that will contain items of the final validated JSON
        if json_value.action != String::from("DE") {
            message = message + &"Did not return a DE action";
            new_json = serde_json::json!(null);
        } else {
            new_json = serde_json::from_str(&"{\"action\":\"DE\"}").expect("Not a valid JSON");
        }
        let mut group1_verified: Option<Vec<FilterTerm>> = None;
        let (group1_filter_terms, filter_message_group1) = validate_filter(&json_value.group1, &message, &db_vec);
        if filter_message_group1.len() > 0 {
            message = message + &filter_message_group1;
        } else {
            group1_verified = Some(group1_filter_terms);
        }

        let mut group2_verified: Option<Vec<FilterTerm>> = None;
        let (group2_filter_terms, filter_message_group2) = validate_filter(&json_value.group2, &message, &db_vec);
        if filter_message_group2.len() > 0 {
            message = message + &filter_message_group2;
        } else {
            group2_verified = Some(group2_filter_terms);
        }

        if group1_verified.is_some() && group2_verified.is_some() {
            if let Some(obj) = new_json.as_object_mut() {
                obj.insert(String::from("group1"), serde_json::json!(group1_verified));
                obj.insert(String::from("group2"), serde_json::json!(group2_verified));
            }
        } else if group1_verified.is_some() && group2_verified.is_none() {
            message = message + &"Group2 not verified";
            if let Some(obj) = new_json.as_object_mut() {
                obj.insert(String::from("message"), serde_json::json!(message));
            }
        } else if group1_verified.is_none() && group2_verified.is_some() {
            message = message + &"Group1 not verified";
            if let Some(obj) = new_json.as_object_mut() {
                obj.insert(String::from("message"), serde_json::json!(message));
            }
        } else if group1_verified.is_none() && group2_verified.is_none() {
            message = message + &"Group1 and Group 2 not verified";
            if let Some(obj) = new_json.as_object_mut() {
                obj.insert(String::from("message"), serde_json::json!(message));
            }
        }

        if message.len() > 0 {
            if let Some(obj) = new_json.as_object_mut() {
                obj.insert(String::from("message"), serde_json::json!(message));
            }
        }
        final_exp = serde_json::to_string(&new_json).unwrap();
    } else {
        let mut pp_plot_json: Value =
            serde_json::from_str(&"{\"chartType\":\"differentialAnalysis\"}").expect("Not a valid JSON"); // The PP compliant plot JSON
        let mut err_json: Value; // Error JSON containing the error message (if present)
        if json_value.action != String::from("DE") {
            message = message + &"Did not return a DE action";
        }

        let mut group1_verified: Option<Vec<FilterTerm>> = None;
        let (group1_filter_terms, filter_message_group1) = validate_filter(&json_value.group1, &message, &db_vec);
        if filter_message_group1.len() > 0 {
            message = message + &filter_message_group1;
        } else {
            group1_verified = Some(group1_filter_terms);
        }

        let mut group2_verified: Option<Vec<FilterTerm>> = None;
        let (group2_filter_terms, filter_message_group2) = validate_filter(&json_value.group2, &message, &db_vec);
        if filter_message_group2.len() > 0 {
            message = message + &filter_message_group2;
        } else {
            group2_verified = Some(group2_filter_terms);
        }

        if group1_verified.is_some() && group2_verified.is_some() {
            if let Some(obj) = pp_plot_json.as_object_mut() {
                let (group1_verified_string, group1_filter_hits, gen_filter_message_group1) =
                    generate_filter_term_for_PP(group1_verified.unwrap());
                let (group2_verified_string, group2_filter_hits, gen_filter_message_group2) =
                    generate_filter_term_for_PP(group2_verified.unwrap());

                if gen_filter_message_group1.len() > 0 {
                    message = message + &gen_filter_message_group1;
                }

                if gen_filter_message_group2.len() > 0 {
                    message = message + &gen_filter_message_group2;
                }

                if group1_filter_hits > 0 && group2_filter_hits > 0 {
                    obj.insert(
                        String::from("group1"),
                        serde_json::from_str(&group1_verified_string).expect("Not a valid JSON"),
                    );
                    obj.insert(
                        String::from("group2"),
                        serde_json::from_str(&group2_verified_string).expect("Not a valid JSON"),
                    );
                } else if group1_filter_hits == 0 && group2_filter_hits > 0 {
                    if message.len() > 0 {
                        message = message + ", group1 array filter terms is empty";
                    } else {
                        message = "group1 array filter terms is empty".to_string();
                    }
                } else if group1_filter_hits > 0 && group2_filter_hits == 0 {
                    if message.len() > 0 {
                        message = message + ", group2 array filter terms is empty";
                    } else {
                        message = "group2 array filter terms is empty".to_string();
                    }
                } else {
                    if message.len() > 0 {
                        message = message + ", group1 and group2 array filter terms are empty";
                    } else {
                        message = "group1 and group2 array filter terms are empty".to_string();
                    }
                }
            }
        } else if group1_verified.is_some() && group2_verified.is_none() {
            message = message + &"Group2 not verified";
        } else if group1_verified.is_none() && group2_verified.is_some() {
            message = message + &"Group1 not verified";
        } else if group1_verified.is_none() && group2_verified.is_none() {
            message = message + &"Group1 and Group 2 not verified";
        }
        if message.len() > 0 {
            err_json = serde_json::from_str(&"{\"type\":\"html\"}").expect("Not a valid JSON");
            if let Some(obj) = err_json.as_object_mut() {
                // The `if let` ensures we only proceed if the top-level JSON is an object.
                // Append a new string field.
                obj.insert(String::from("html"), serde_json::json!(message));
            };
            final_exp = serde_json::to_string(&err_json).unwrap();
        } else {
            let mut pp_json: Value = serde_json::from_str(&"{\"type\":\"plot\"}").expect("Not a valid JSON");
            if let Some(obj) = pp_json.as_object_mut() {
                // The `if let` ensures we only proceed if the top-level JSON is an object.
                // Append a new string field.
                obj.insert(String::from("plot"), serde_json::json!(pp_plot_json));
            }
            final_exp = serde_json::to_string(&pp_json).unwrap();
        }
    }
    //println!("final_exp:{}", final_exp);
    final_exp
}

#[derive(Debug, Clone)]
struct DbRows {
    name: String,
    description: Option<String>,
    term_type: Option<String>,
    values: Vec<String>,
}

async fn parse_geneset_db(db: &str) -> Vec<String> {
    let manager = SqliteConnectionManager::file(db);
    let pool = r2d2::Pool::new(manager).unwrap();
    let conn = pool.get().unwrap();
    let sql_statement_genedb = "SELECT * from codingGenes";
    let mut genedb = conn.prepare(&sql_statement_genedb).unwrap();
    let mut rows_genedb = genedb.query([]).unwrap();
    let mut gene_list = Vec::<String>::new();
    while let Some(coding_gene) = rows_genedb.next().unwrap() {
        let code_gene: String = coding_gene.get(0).unwrap();
        gene_list.push(code_gene)
    }
    gene_list
}

trait ParseDbRows {
    fn parse_db_rows(&self) -> String;
}

impl ParseDbRows for DbRows {
    fn parse_db_rows(&self) -> String {
        let mut output: String = "Name of field is \"".to_string() + &self.name + &"\". ";

        match &self.term_type {
            Some(item_ty) => {
                output += "This field is of the type ";
                output += &item_ty;
                output += &". ";
            }
            None => {}
        }
        match &self.description {
            Some(desc) => output += desc,
            None => {}
        }
        if self.values.len() > 0 {
            output += "This contains the following values (separated by comma(,)):";
            output += &(self.values.join(",") + &".");
        }
        output
    }
}

async fn parse_dataset_db(db: &str) -> (Vec<String>, Vec<DbRows>) {
    let manager = SqliteConnectionManager::file(db);
    let pool = r2d2::Pool::new(manager).unwrap();
    let conn = pool.get().unwrap();

    let sql_statement_termhtmldef = "SELECT * from termhtmldef";
    let mut termhtmldef = conn.prepare(&sql_statement_termhtmldef).unwrap();
    let mut rows_termhtmldef = termhtmldef.query([]).unwrap();
    let mut description_map = HashMap::new();
    while let Some(row) = rows_termhtmldef.next().unwrap() {
        //println!("row:{:?}", row);
        let name: String = row.get(0).unwrap();
        //println!("name:{}", name);
        let json_html_str: String = row.get(1).unwrap();
        let json_html: Value = serde_json::from_str(&json_html_str).expect("Not a JSON");
        let json_html2: &Map<String, Value> = json_html.as_object().unwrap();
        let description: String = String::from(
            json_html2.get("description").unwrap()[0]
                .as_object()
                .unwrap()
                .get("value")
                .unwrap()
                .as_str()
                .unwrap(),
        );
        //println!("description:{}", description);
        description_map.insert(name, description);
    }

    //// Open the file
    //let mut file = File::open(dataset_file).unwrap();

    //// Create a string to hold the file contents
    //let mut contents = String::new();

    //// Read the file contents into the string
    //file.read_to_string(&mut contents).unwrap();

    //// Split the contents by the delimiter "---"
    //let parts: Vec<&str> = contents.split("\n").collect();

    //for (_i, part) in parts.iter().enumerate() {
    //    let sentence: &str = part.trim();
    //    let parts2: Vec<&str> = sentence.split(':').collect();
    //    //println!("parts2:{:?}", parts2);
    //    if parts2.len() == 2 {
    //        description_map.insert(parts2[0], parts2[1]);
    //        //println!("Part {}: {:?}", i + 1, parts2);
    //    }
    //}
    //println!("description_map:{:?}", description_map);

    let sql_statement_terms = "SELECT * from terms";
    let mut terms = conn.prepare(&sql_statement_terms).unwrap();
    let mut rows_terms = terms.query([]).unwrap();

    // Print the separated parts
    let mut rag_docs = Vec::<String>::new();
    let mut names = Vec::<String>::new();
    let mut db_vec = Vec::<DbRows>::new();
    while let Some(row) = rows_terms.next().unwrap() {
        //println!("row:{:?}", row);
        let name: String = row.get(0).unwrap();
        //println!("id:{}", name);
        match description_map.get(&name as &str) {
            Some(desc) => {
                let line: String = row.get(3).unwrap();
                //println!("line:{}", line);
                let json_data: Value = serde_json::from_str(&line).expect("Not a JSON");
                let values_json = json_data["values"].as_object();
                let mut keys = Vec::<String>::new();
                match values_json {
                    Some(values) => {
                        for (key, _value) in values {
                            keys.push(key.to_string())
                        }
                    }
                    None => {}
                }

                let item_type_json = json_data["type"].as_str();
                let mut item_type: Option<String> = None;
                match item_type_json {
                    Some(item_ty) => item_type = Some(String::from(item_ty)),
                    None => {}
                }

                //println!("items:{:?}", keys);
                let item: DbRows = DbRows {
                    name: name.clone(),
                    description: Some(String::from(desc.clone())),
                    term_type: item_type,
                    values: keys,
                };
                db_vec.push(item.clone());
                //println!("Field details:{}", item.parse_db_rows());
                rag_docs.push(item.parse_db_rows());
                names.push(name)
            }
            None => {}
        }
    }
    //println!("names:{:?}", names);
    (rag_docs, db_vec)
}

pub async fn extract_summary_information(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    _embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    llm_backend_type: &llm_backend,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
    dataset_db: &str,
    genedb: &str,
    ai_json: &AiJsonFormat,
    testing: bool,
) -> String {
    let (rag_docs, db_vec) = parse_dataset_db(dataset_db).await;
    let additional;
    let schema_json = schemars::schema_for!(SummaryType); // error handling here
    let schema_json_string = serde_json::to_string_pretty(&schema_json).unwrap();
    //println!("schema_json summary:{}", schema_json_string);
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

    let gene_list: Vec<String> = parse_geneset_db(genedb).await;
    let lowercase_user_input = user_input.to_lowercase();
    let user_words: Vec<&str> = lowercase_user_input.split_whitespace().collect();
    let user_words2: Vec<String> = user_words.into_iter().map(|s| s.to_string()).collect();

    let common_genes: Vec<String> = gene_list
        .into_iter()
        .filter(|x| user_words2.contains(&x.to_lowercase()))
        .collect();

    let mut summary_data_check: Option<TrainTestData> = None;
    for chart in ai_json.charts.clone() {
        if chart.r#type == "Summary" {
            summary_data_check = Some(chart);
            break;
        }
    }

    match summary_data_check {
        Some(summary_data) => {
            let mut training_data: String = String::from("");
            let mut train_iter = 0;
            for ques_ans in summary_data.TrainingData {
                match ques_ans.answer {
                    AnswerFormat::summary_type(sum) => {
                        let summary_answer: SummaryType = sum;
                        train_iter += 1;
                        training_data += "Example question";
                        training_data += &train_iter.to_string();
                        training_data += &":";
                        training_data += &ques_ans.question;
                        training_data += &" ";
                        training_data += "Example answer";
                        training_data += &train_iter.to_string();
                        training_data += &":";
                        training_data += &serde_json::to_string(&summary_answer).unwrap();
                        training_data += &"\n";
                    }
                    AnswerFormat::DE_type(_) => panic!("DE type not valid for summary"),
                }
            }

            let system_prompt: String = String::from(
                String::from(
                    "I am an assistant that extracts the summary terms from user query. The final output must be in the following JSON format with NO extra comments. There are three fields in the JSON to be returned: The \"action\" field will ALWAYS be \"summary\". The \"summaryterms\" field should contain all the variables that the user wants to visualize. The \"clinical\" subfield should ONLY contain names of the fields from the sqlite db. ",
                ) + &summary_data.SystemPrompt
                    + &" The \"filter\" field is optional and should contain an array of JSON terms with which the dataset will be filtered. A variable simultaneously CANNOT be part of both \"summaryterms\" and \"filter\". There are two kinds of filter variables: \"Categorical\" and \"Numeric\". \"Categorical\" variables are those variables which can have a fixed set of values e.g. gender, molecular subtypes. They are defined by the \"CategoricalFilterTerm\" which consists of \"term\" (a field from the sqlite3 db)  and \"value\" (a value of the field from the sqlite db).  \"Numeric\" variables are those which can have any numeric value. They are defined by \"NumericFilterTerm\" and contain  the subfields \"term\" (a field from the sqlite3 db), \"greaterThan\" an optional filter which is defined when a lower cutoff is defined in the user input for the numeric variable and \"lessThan\" an optional filter which is defined when a higher cutoff is defined in the user input for the numeric variable. A numeric filter term MUST have ATLEAST a \"lessThan\" or \"greaterThan\" field to be a valid filter term. The \"message\" field only contain messages of terms in the user input that were not found in their respective databases. The JSON schema is as follows:"
                    + &schema_json_string
                    + &training_data
                    + "The sqlite db in plain language is as follows:\n"
                    + &rag_docs.join(",")
                    + &"\n Relevant genes are as follows (separated by comma(,)):"
                    + &common_genes.join(",")
                    + &"\nQuestion: {question} \nanswer:",
            );

            //println!("system_prompt:{}", system_prompt);
            // Create RAG agent
            let agent = AgentBuilder::new(comp_model)
                .preamble(&system_prompt)
                //.dynamic_context(top_k, vector_store.index(embedding_model))
                .temperature(temperature)
                .additional_params(additional)
                .build();

            let response = agent.prompt(user_input).await.expect("Failed to prompt ollama");

            //println!("Ollama: {}", response);
            let result = response.replace("json", "").replace("```", "");
            //println!("result:{}", result);
            let json_value: Value = serde_json::from_str(&result).expect("REASON");
            //println!("Classification result:{}", json_value);

            let final_llm_json;
            match llm_backend_type {
                llm_backend::Ollama() => {
                    let json_value2: Value = serde_json::from_str(&json_value["content"].to_string()).expect("REASON2");
                    let json_value3: Value = serde_json::from_str(&json_value2.as_str().unwrap()).expect("REASON3");
                    final_llm_json = json_value3.to_string()
                }
                llm_backend::Sj() => {
                    let json_value2: Value =
                        serde_json::from_str(&json_value[0]["generated_text"].to_string()).expect("REASON2");
                    //println!("json_value2:{}", json_value2.as_str().unwrap());
                    let json_value3: Value = serde_json::from_str(&json_value2.as_str().unwrap()).expect("REASON3");
                    //println!("Classification result:{}", json_value3);
                    final_llm_json = json_value3.to_string()
                }
            }
            //println!("final_llm_json:{}", final_llm_json);
            let final_validated_json =
                validate_summary_output(final_llm_json.clone(), db_vec, common_genes, ai_json, testing);
            final_validated_json
        }
        None => {
            panic!("summary chart train and test data is not defined in dataset JSON file")
        }
    }
}

fn get_summary_string() -> String {
    "summary".to_string()
}

//const action: &str = &"summary";
//const geneExpression: &str = &"geneExpression";

#[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
pub struct SummaryType {
    // Serde uses this for deserialization.
    #[serde(default = "get_summary_string")]
    // Schemars uses this for schema generation.
    #[schemars(rename = "action")]
    action: String,
    summaryterms: Vec<SummaryTerms>,
    filter: Option<Vec<FilterTerm>>,
    message: Option<String>,
}

impl SummaryType {
    #[allow(dead_code)]
    pub fn sort_summarytype_struct(mut self) -> SummaryType {
        // This function is necessary for testing (test_ai.rs) to see if two variables of type "SummaryType" are equal or not. Without this a vector of two Summarytype holding the same values but in different order will be classified separately.
        self.summaryterms.sort();

        match self.filter.clone() {
            Some(ref mut filterterms) => filterterms.sort(),
            None => {}
        }
        self.clone()
    }
}

#[derive(PartialEq, Eq, Ord, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
enum SummaryTerms {
    #[allow(non_camel_case_types)]
    clinical(String),
    #[allow(non_camel_case_types)]
    geneExpression(String),
}

impl PartialOrd for SummaryTerms {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        match (self, other) {
            (SummaryTerms::clinical(_), SummaryTerms::clinical(_)) => Some(std::cmp::Ordering::Equal),
            (SummaryTerms::geneExpression(_), SummaryTerms::geneExpression(_)) => Some(std::cmp::Ordering::Equal),
            (SummaryTerms::clinical(_), SummaryTerms::geneExpression(_)) => Some(std::cmp::Ordering::Greater),
            (SummaryTerms::geneExpression(_), SummaryTerms::clinical(_)) => Some(std::cmp::Ordering::Greater),
        }
    }
}

#[derive(PartialEq, Eq, Ord, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
enum FilterTerm {
    Categorical(CategoricalFilterTerm),
    Numeric(NumericFilterTerm),
}

impl PartialOrd for FilterTerm {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        match (self, other) {
            (FilterTerm::Categorical(_), FilterTerm::Categorical(_)) => Some(std::cmp::Ordering::Equal),
            (FilterTerm::Numeric(_), FilterTerm::Numeric(_)) => Some(std::cmp::Ordering::Equal),
            (FilterTerm::Categorical(_), FilterTerm::Numeric(_)) => Some(std::cmp::Ordering::Greater),
            (FilterTerm::Numeric(_), FilterTerm::Categorical(_)) => Some(std::cmp::Ordering::Greater),
        }
    }
}

#[derive(PartialEq, Eq, PartialOrd, Ord, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
struct CategoricalFilterTerm {
    term: String,
    value: String,
}

#[derive(Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
#[allow(non_snake_case)]
struct NumericFilterTerm {
    term: String,
    greaterThan: Option<f32>,
    lessThan: Option<f32>,
}

impl PartialEq for NumericFilterTerm {
    fn eq(&self, other: &Self) -> bool {
        let greater_equality: bool;
        match (self.greaterThan, other.greaterThan) {
            (Some(a), Some(b)) => greater_equality = (a - b).abs() < 1e-6,
            (None, None) => greater_equality = true,
            _ => greater_equality = false,
        }

        let less_equality: bool;
        match (self.lessThan, other.lessThan) {
            (Some(a), Some(b)) => less_equality = (a - b).abs() < 1e-6,
            (None, None) => less_equality = true,
            _ => less_equality = false,
        }

        if greater_equality == true && less_equality == true {
            true
        } else {
            false
        }
    }
}

impl Eq for NumericFilterTerm {}

impl PartialOrd for NumericFilterTerm {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        if self.greaterThan < other.greaterThan {
            Some(std::cmp::Ordering::Less)
        } else if self.greaterThan > other.greaterThan {
            Some(std::cmp::Ordering::Greater)
        } else if self.lessThan < other.lessThan {
            Some(std::cmp::Ordering::Less)
        } else if self.lessThan > other.lessThan {
            Some(std::cmp::Ordering::Greater)
        } else {
            Some(std::cmp::Ordering::Equal)
        }
    }
}

impl Ord for NumericFilterTerm {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.partial_cmp(other).unwrap()
    }
}

fn validate_summary_output(
    raw_llm_json: String,
    db_vec: Vec<DbRows>,
    common_genes: Vec<String>,
    ai_json: &AiJsonFormat,
    testing: bool,
) -> String {
    println!("raw_llm_json:{:?}", raw_llm_json);
    let json_value: SummaryType =
       serde_json::from_str(&raw_llm_json).expect("Did not get a valid JSON of type {action: summary, summaryterms:[{clinical: term1}, {geneExpression: gene}], filter:[{term: term1, value: value1}]} from the LLM");
    let mut message: String = String::from("");
    match json_value.message {
        Some(mes) => {
            message = message + &mes; // Append any message given by the LLM
        }
        None => {}
    }

    let mut new_json: Value; // New JSON value that will contain items of the final validated JSON
    if json_value.action != String::from("summary") {
        message = message + &"Did not return a summary action";
        new_json = serde_json::json!(null);
    } else {
        new_json = serde_json::from_str(&"{\"action\":\"summary\"}").expect("Not a valid JSON");
    }

    let mut validated_summary_terms = Vec::<SummaryTerms>::new();
    let mut summary_terms_tobe_removed = Vec::<SummaryTerms>::new();
    for sum_term in &json_value.summaryterms {
        match sum_term {
            SummaryTerms::clinical(clin) => {
                let term_verification = verify_json_field(clin, &db_vec);
                if Some(term_verification.correct_field.clone()).is_some()
                    && term_verification.correct_value.clone().is_none()
                {
                    match term_verification.correct_field {
                        Some(tm) => validated_summary_terms.push(SummaryTerms::clinical(tm)),
                        None => {
                            message = message + &"'" + &clin + &"'" + &" not found in db.";
                        }
                    }
                } else if Some(term_verification.correct_field.clone()).is_some()
                    && Some(term_verification.correct_value.clone()).is_some()
                {
                    message = message
                        + &term_verification.correct_value.unwrap()
                        + &"is a value of "
                        + &term_verification.correct_field.unwrap()
                        + &".";
                }
            }
            SummaryTerms::geneExpression(gene) => {
                match ai_json.hasGeneExpression {
                    true => {
                        let mut num_gene_verification = 0;
                        for common_gene in &common_genes {
                            // Comparing predicted gene against the common gene
                            if common_gene == gene {
                                num_gene_verification += 1;
                                validated_summary_terms.push(SummaryTerms::geneExpression(String::from(gene)));
                            }
                        }

                        if num_gene_verification == 0 || common_genes.len() == 0 {
                            if message.to_lowercase().contains(&gene.to_lowercase()) { // Check if the LLM has already added the message, if not then add it
                            } else {
                                message = message + &"'" + &gene + &"'" + &" not found in genedb.";
                            }
                        }
                    }
                    false => {
                        let missing_gene_data: &str = "gene expression is not supported for this dataset";
                        if message.to_lowercase().contains(&missing_gene_data.to_lowercase()) { // Check if the LLM has already added the message, if not then add it
                        } else {
                            message = message + &"Gene expression not supported for this dataset";
                        }
                    }
                }
            }
        }
    }

    let mut pp_plot_json: Value; // The PP compliant plot JSON
    pp_plot_json = serde_json::from_str(&"{\"chartType\":\"summary\"}").expect("Not a valid JSON");
    match &json_value.filter {
        Some(filter_terms_array) => {
            let (validated_filter_terms, filter_message) = validate_filter(filter_terms_array, &message, &db_vec);
            if filter_message.len() > 0 {
                message = message + &filter_message
            }

            for summary_term in &validated_summary_terms {
                match summary_term {
                    SummaryTerms::clinical(clinicial_term) => {
                        for filter_term in &validated_filter_terms {
                            match filter_term {
                                FilterTerm::Categorical(categorical) => {
                                    if &categorical.term == clinicial_term {
                                        summary_terms_tobe_removed.push(summary_term.clone());
                                    }
                                }
                                FilterTerm::Numeric(numeric) => {
                                    if &numeric.term == clinicial_term {
                                        summary_terms_tobe_removed.push(summary_term.clone());
                                    }
                                }
                            }
                        }
                    }
                    SummaryTerms::geneExpression(gene) => {
                        for filter_term in &validated_filter_terms {
                            match filter_term {
                                FilterTerm::Categorical(categorical) => {
                                    if &categorical.term == gene {
                                        summary_terms_tobe_removed.push(summary_term.clone());
                                    }
                                }
                                FilterTerm::Numeric(numeric) => {
                                    if &numeric.term == gene {
                                        summary_terms_tobe_removed.push(summary_term.clone());
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if validated_filter_terms.len() > 0 {
                if testing == true {
                    if let Some(obj) = new_json.as_object_mut() {
                        obj.insert(String::from("filter"), serde_json::json!(validated_filter_terms));
                    }
                } else {
                    let (validated_filter_terms_PP, filter_hits, gen_filter_message) =
                        generate_filter_term_for_PP(validated_filter_terms);
                    if gen_filter_message.len() > 0 {
                        message = message + &gen_filter_message;
                    }

                    println!("validated_filter_terms_PP:{}", validated_filter_terms_PP);
                    if filter_hits > 0 {
                        if let Some(obj) = pp_plot_json.as_object_mut() {
                            obj.insert(
                                String::from("simpleFilter"),
                                serde_json::from_str(&validated_filter_terms_PP).expect("Not a valid JSON"),
                            );
                        }
                    }
                }
            }
        }
        None => {}
    }

    // Removing terms that are found both in filter term as well summary
    let mut validated_summary_terms_final = Vec::<SummaryTerms>::new();

    let mut sum_iter = 0;
    let mut pp_json: Value; // New JSON value that will contain items of the final PP compliant JSON
    pp_json = serde_json::from_str(&"{\"type\":\"plot\"}").expect("Not a valid JSON");

    for summary_term in &validated_summary_terms {
        let mut hit = 0;
        match summary_term {
            SummaryTerms::clinical(clinical_term) => {
                for summary_term2 in &summary_terms_tobe_removed {
                    match summary_term2 {
                        SummaryTerms::clinical(clinical_term2) => {
                            if clinical_term == clinical_term2 {
                                hit = 1;
                            }
                        }
                        SummaryTerms::geneExpression(gene2) => {
                            if clinical_term == gene2 {
                                hit = 1;
                            }
                        }
                    }
                }
            }
            SummaryTerms::geneExpression(gene) => {
                for summary_term2 in &summary_terms_tobe_removed {
                    match summary_term2 {
                        SummaryTerms::clinical(clinical_term2) => {
                            if gene == clinical_term2 {
                                hit = 1;
                            }
                        }
                        SummaryTerms::geneExpression(gene2) => {
                            if gene == gene2 {
                                hit = 1;
                            }
                        }
                    }
                }
            }
        }

        if hit == 0 {
            let mut termidpp: Option<TermIDPP> = None;
            let mut geneexp: Option<GeneExpressionPP> = None;
            match summary_term {
                SummaryTerms::clinical(clinical_term) => {
                    termidpp = Some(TermIDPP {
                        id: clinical_term.to_string(),
                    });
                }
                SummaryTerms::geneExpression(gene) => {
                    geneexp = Some(GeneExpressionPP {
                        gene: gene.to_string(),
                        r#type: "geneExpression".to_string(),
                    });
                }
            }
            if sum_iter == 0 {
                if termidpp.is_some() {
                    if let Some(obj) = pp_plot_json.as_object_mut() {
                        obj.insert(String::from("term"), serde_json::json!(Some(termidpp)));
                    }
                }

                if geneexp.is_some() {
                    let gene_term = GeneTerm { term: geneexp.unwrap() };
                    if let Some(obj) = pp_plot_json.as_object_mut() {
                        obj.insert(String::from("term"), serde_json::json!(gene_term));
                    }
                }
            } else if sum_iter == 1 {
                if termidpp.is_some() {
                    if let Some(obj) = pp_plot_json.as_object_mut() {
                        obj.insert(String::from("term2"), serde_json::json!(Some(termidpp)));
                    }
                }

                if geneexp.is_some() {
                    let gene_term = GeneTerm { term: geneexp.unwrap() };
                    if let Some(obj) = pp_plot_json.as_object_mut() {
                        obj.insert(String::from("term2"), serde_json::json!(gene_term));
                    }
                }
            }
            validated_summary_terms_final.push(summary_term.clone())
        }
        sum_iter += 1
    }

    if validated_summary_terms_final.len() == 0 {
        message += "No valid summary terms found for this query";
    }
    if let Some(obj) = new_json.as_object_mut() {
        obj.insert(
            String::from("summaryterms"),
            serde_json::json!(validated_summary_terms_final),
        );
    }

    if let Some(obj) = pp_json.as_object_mut() {
        // The `if let` ensures we only proceed if the top-level JSON is an object.
        // Append a new string field.
        obj.insert(String::from("plot"), serde_json::json!(pp_plot_json));
    }

    let mut err_json: Value; // Error JSON containing the error message (if present)
    if message.len() > 0 {
        if testing == false {
            err_json = serde_json::from_str(&"{\"type\":\"html\"}").expect("Not a valid JSON");
            if let Some(obj) = err_json.as_object_mut() {
                // The `if let` ensures we only proceed if the top-level JSON is an object.
                // Append a new string field.
                obj.insert(String::from("html"), serde_json::json!(message));
            };
            serde_json::to_string(&err_json).unwrap()
        } else {
            if let Some(obj) = new_json.as_object_mut() {
                // The `if let` ensures we only proceed if the top-level JSON is an object.
                // Append a new string field.
                obj.insert(String::from("message"), serde_json::json!(message));
            };
            serde_json::to_string(&new_json).unwrap()
        }
    } else {
        if testing == true {
            // When testing script output native LLM JSON
            serde_json::to_string(&new_json).unwrap()
        } else {
            // When in production output PP compliant JSON
            serde_json::to_string(&pp_json).unwrap()
        }
    }
}

fn getGeneExpression() -> String {
    "geneExpression".to_string()
}

#[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
struct TermIDPP {
    id: String,
}

#[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
struct GeneTerm {
    term: GeneExpressionPP,
}

#[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
struct GeneExpressionPP {
    gene: String,
    // Serde uses this for deserialization.
    #[serde(default = "getGeneExpression")]
    r#type: String,
}

#[derive(Debug, Clone)]
struct VerifiedField {
    correct_field: Option<String>,         // Name of the correct field
    correct_value: Option<String>, // Name of the correct value if there is a match between incorrect field and one of the values
    _probable_fields: Option<Vec<String>>, // If multiple fields are matching to the incomplete query
}

fn verify_json_field(llm_field_name: &str, db_vec: &Vec<DbRows>) -> VerifiedField {
    // Check if llm_field_name exists or not in db name field
    let verified_result: VerifiedField;
    if db_vec.iter().any(|item| item.name == llm_field_name) {
        //println!("Found \"{}\" in db", llm_field_name);
        verified_result = VerifiedField {
            correct_field: Some(String::from(llm_field_name)),
            correct_value: None,
            _probable_fields: None,
        };
    } else {
        println!("Did not find \"{}\" in db", llm_field_name);
        // Check to see if llm_field_name exists as values under any of the fields
        let (search_field, search_val) = verify_json_value(llm_field_name, &db_vec);

        match search_field {
            Some(x) => {
                verified_result = VerifiedField {
                    correct_field: Some(String::from(x)),
                    correct_value: search_val,
                    _probable_fields: None,
                };
            }
            None => {
                // Incorrect field found neither in any of the fields nor any of the values. This will then invoke embedding match across all the fields and their corresponding values

                let mut search_terms = Vec::<String>::new();
                search_terms.push(String::from(llm_field_name)); // Added the incorrect field item to the search
                verified_result = VerifiedField {
                    correct_field: None,
                    correct_value: None,
                    _probable_fields: None,
                };
            }
        }
    }
    verified_result
}

fn verify_json_value(llm_value_name: &str, db_vec: &Vec<DbRows>) -> (Option<String>, Option<String>) {
    let mut search_field: Option<String> = None;
    let mut search_val: Option<String> = None;
    for item in db_vec {
        for val in &item.values {
            if llm_value_name == val {
                search_field = Some(item.name.clone());
                search_val = Some(String::from(val));
                break;
            }
        }
        match search_field {
            Some(_) => break,
            None => {}
        }
    }
    (search_field, search_val)
}

fn validate_filter(
    filter_terms_array: &Vec<FilterTerm>,
    message: &str,
    db_vec: &Vec<DbRows>,
) -> (Vec<FilterTerm>, String) {
    let mut validated_filter_terms = Vec::<FilterTerm>::new();
    let mut filter_message: String = String::from("");
    for parsed_filter_term in filter_terms_array {
        match parsed_filter_term {
            FilterTerm::Categorical(categorical) => {
                let term_verification = verify_json_field(&categorical.term, &db_vec);
                let mut value_verification: Option<String> = None;
                for item in db_vec {
                    if &item.name == &categorical.term {
                        for val in &item.values {
                            if &categorical.value == val {
                                value_verification = Some(val.clone());
                                break;
                            }
                        }
                    }
                    if value_verification != None {
                        break;
                    }
                }
                if term_verification.correct_field.is_some() && value_verification.is_some() {
                    let verified_filter = CategoricalFilterTerm {
                        term: term_verification.correct_field.clone().unwrap(),
                        value: value_verification.clone().unwrap(),
                    };
                    let categorical_filter_term: FilterTerm = FilterTerm::Categorical(verified_filter);
                    validated_filter_terms.push(categorical_filter_term);
                }
                if term_verification.correct_field.is_none() {
                    filter_message = message.to_owned() + &"'" + &categorical.term + &"' filter term not found in db";
                }
                if value_verification.is_none() {
                    filter_message = message.to_owned()
                        + &"'"
                        + &categorical.value
                        + &"' filter value not found for filter field '"
                        + &categorical.term
                        + "' in db";
                }
            }
            FilterTerm::Numeric(numeric) => {
                let term_verification = verify_json_field(&numeric.term, &db_vec);
                if term_verification.correct_field.is_none() {
                    filter_message = message.to_owned() + &"'" + &numeric.term + &"' filter term not found in db";
                } else {
                    let numeric_filter_term: FilterTerm = FilterTerm::Numeric(numeric.clone());
                    validated_filter_terms.push(numeric_filter_term);
                }
            }
        }
    }
    (validated_filter_terms, filter_message)
}

fn generate_filter_term_for_PP(validated_filter_terms: Vec<FilterTerm>) -> (String, usize, String) {
    let mut validated_filter_terms_PP: String = "[".to_string();
    let mut filter_hits = 0;
    let mut message: String = "".to_string();
    for validated_term in validated_filter_terms {
        match validated_term {
            FilterTerm::Categorical(categorical_filter) => {
                let string_json = "{\"term\":\"".to_string()
                    + &categorical_filter.term
                    + &"\", \"category\":\""
                    + &categorical_filter.value
                    + &"\"},";
                validated_filter_terms_PP += &string_json;
                filter_hits += 1;
            }
            FilterTerm::Numeric(numeric_filter) => {
                let mut string_json = "".to_string();
                if numeric_filter.greaterThan.is_some() && numeric_filter.lessThan.is_none() {
                    string_json = "{\"term\":\"".to_string()
                        + &numeric_filter.term
                        + &"\", \"gt\":\""
                        + &numeric_filter.greaterThan.unwrap().to_string()
                        + &"\"},";
                } else if numeric_filter.greaterThan.is_none() && numeric_filter.lessThan.is_some() {
                    string_json = "{\"term\":\"".to_string()
                        + &numeric_filter.term
                        + &"\", \"lt\":\""
                        + &numeric_filter.lessThan.unwrap().to_string()
                        + &"\"},";
                } else if numeric_filter.greaterThan.is_some() && numeric_filter.lessThan.is_some() {
                    string_json = "{\"term\":\"".to_string()
                        + &numeric_filter.term
                        + &"\", \"lt\":\""
                        + &numeric_filter.lessThan.unwrap().to_string()
                        + &"\", \"gt\":\""
                        + &numeric_filter.greaterThan.unwrap().to_string()
                        + &"\"},";
                } else {
                    // When both greater and less than are none
                    message = format!(
                        "Numeric filter term {} is missing both greater than and less than values. One of them must be defined",
                        &numeric_filter.term
                    );
                }
                validated_filter_terms_PP += &string_json;
                filter_hits += 1;
            }
        };
    }
    if filter_hits > 0 {
        validated_filter_terms_PP.pop();
        validated_filter_terms_PP += &"]";
    }
    (validated_filter_terms_PP, filter_hits, message)
}
