use anyhow::Result;
use json::JsonValue;
use r2d2_sqlite::SqliteConnectionManager;
use rig::agent::AgentBuilder;
use rig::client::CompletionClient;
use rig::client::EmbeddingsClient;
use rig::completion::Prompt;
use rig::embeddings::builder::EmbeddingsBuilder;
use std::collections::HashMap;
//use rig::providers::ollama;
use rig::vector_store::in_memory_store::InMemoryVectorStore;
use schemars::JsonSchema;
use serde_json::{Map, Value, json};
use std::io::{self};
mod sjprovider; // Importing custom rig module for invoking SJ GPU server

#[allow(non_camel_case_types)]
#[derive(Debug, Clone)]
enum llm_backend {
    Ollama(),
    Sj(),
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct OutputJson {
    pub answer: String,
}

#[allow(non_camel_case_types)]
#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
enum cutoff_info {
    lesser(f32),
    greater(f32),
    equalto(f32),
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct Cutoff {
    cutoff_name: cutoff_info,
    units: Option<String>,
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct Filter {
    name: String,
    cutoff: Cutoff,
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct Group {
    name: String,
    filter: Filter,
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct DEOutput {
    group1: Group,
    group2: Group,
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_n) => {
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    let user_input_json: &JsonValue = &json_string["user_input"];
                    //let user_input = "Does aspirin leads to decrease in death rates among Africans?";
                    //let user_input = "Show the point deletion in TP53 gene.";
                    //let user_input = "Generate DE plot for men with weight greater than 30lbs vs women less than 20lbs";
                    let user_input: &str;
                    match user_input_json.as_str() {
                        Some(inp) => user_input = inp,
                        None => panic!("user_input field is missing in input json"),
                    }

                    let dataset_db_json: &JsonValue = &json_string["dataset_db"];
                    let mut dataset_db: Option<&str> = None;
                    match dataset_db_json.as_str() {
                        Some(inp) => dataset_db = Some(inp),
                        None => {}
                    }

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
                        let ollama_client = rig::providers::ollama::Client::builder()
                            .base_url(apilink)
                            .build()
                            .expect("Ollama server not found");
                        let embedding_model = ollama_client.embedding_model(embedding_model_name);
                        let comp_model = ollama_client.completion_model(comp_model_name);
                        final_output = run_pipeline(
                            user_input,
                            comp_model,
                            embedding_model,
                            llm_backend_type,
                            temperature,
                            max_new_tokens,
                            top_p,
                            dataset_db,
                        )
                        .await;
                    // "gpt-oss:20b" "granite3-dense:latest" "PetrosStav/gemma3-tools:12b" "llama3-groq-tool-use:latest" "PetrosStav/gemma3-tools:12b"
                    } else if llm_backend_name == "SJ".to_string() {
                        llm_backend_type = llm_backend::Sj();
                        // Initialize Sj provider client
                        let sj_client = sjprovider::Client::builder()
                            .base_url(apilink)
                            .build()
                            .expect("SJ server not found");
                        let embedding_model = sj_client.embedding_model(embedding_model_name);
                        let comp_model = sj_client.completion_model(comp_model_name);
                        final_output = run_pipeline(
                            user_input,
                            comp_model,
                            embedding_model,
                            llm_backend_type,
                            temperature,
                            max_new_tokens,
                            top_p,
                            dataset_db,
                        )
                        .await;
                    }

                    match final_output {
                        Some(fin_out) => {
                            println!("final_output:{:?}", fin_out);
                        }
                        None => {
                            println!("final_output:{{\"{}\":\"{}\"}}", "chartType", "unknown");
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

async fn run_pipeline(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    llm_backend_type: llm_backend,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
    dataset_db: Option<&str>,
) -> Option<String> {
    let mut classification: String = classify_query_by_dataset_type(
        user_input,
        comp_model.clone(),
        embedding_model.clone(),
        &llm_backend_type,
        temperature,
        max_new_tokens,
        top_p,
    )
    .await;
    classification = classification.replace("\"", "");
    let final_output;
    if classification == "dge".to_string() {
        let de_result = extract_DE_search_terms_from_query(
            user_input,
            comp_model,
            embedding_model,
            &llm_backend_type,
            temperature,
            max_new_tokens,
            top_p,
        )
        .await;
        final_output = format!(
            "{{\"{}\":\"{}\",\"{}\":[{}}}",
            "chartType",
            "dge",
            "DE_output",
            de_result + &"]"
        );
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
        )
        .await;
    } else if classification == "hierarchial".to_string() {
        // Not implemented yet
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "hierarchial");
    } else if classification == "snv_indel".to_string() {
        // Not implemented yet
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "snv_indel");
    } else if classification == "cnv".to_string() {
        // Not implemented yet
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "cnv");
    } else if classification == "variant_calling".to_string() {
        // Not implemented yet and will never be supported. Need a separate messages for this
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "variant_calling");
    } else if classification == "surivial".to_string() {
        // Not implemented yet
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "surivial");
    } else if classification == "none".to_string() {
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "none");
        println!("The input query did not match any known features in Proteinpaint");
    } else {
        final_output = format!(
            "{{\"{}\":\"{}\"}}",
            "chartType",
            "unknown:".to_string() + &classification
        );
    }
    Some(final_output)
}

async fn classify_query_by_dataset_type(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    llm_backend_type: &llm_backend,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
) -> String {
    // Create a string to hold the file contents
    let contents = String::from("SNV/SNP or point mutations nucleotide mutations are very common forms of mutations which can often give rise to genetic diseases such as cancer, Alzheimer's disease etc. They can be duw to substitution of nucleotide, or insertion or deletion of a nucleotide. Indels are multi-nucleotide insertion/deletion/substitutions. Complex indels are indels where insertion and deletion have happened in the same genomic locus. Every genomic sample from each patient has its own set of mutations therefore requiring personalized treatment. 

If a ProteinPaint dataset contains SNV/Indel/SV data then return JSON with single key, 'snv_indel'.

---

Copy number variation (CNV) is a phenomenon in which sections of the genome are repeated and the number of repeats in the genome varies between individuals.[1] Copy number variation is a special type of structural variation: specifically, it is a type of duplication or deletion event that affects a considerable number of base pairs.

If a ProteinPaint dataset contains copy number variation data then return JSON with single key, 'cnv'.

---

Structural variants/fusions (SV) are genomic mutations when eith a DNA region is translocated or copied to an entirely different genomic locus. In case of transcriptomic data, when RNA is fused from two different genes its called a gene fusion.

If a ProteinPaint dataset contains structural variation or gene fusion data then return JSON with single key, 'sv_fusion'.
---

Hierarchial clustering of gene expression is an unsupervised learning technique where several number of relevant genes and the samples are clustered so as to determine (previously unknown) cohorts of samples (or patients) or structure in data. It is very commonly used to determine subtypes of a particular disease based on RNA sequencing data. 

If a ProteinPaint dataset contains hierarchial data then return JSON with single key, 'hierarchial'.

---

Differential Gene Expression (DGE or DE) is a technique where the most upregulated and downregulated genes between two cohorts of samples (or patients) are determined. A volcano plot is shown with fold-change in the x-axis and adjusted p-value on the y-axis. So, the upregulated and downregulared genes are on opposite sides of the graph and the most significant genes (based on adjusted p-value) is on the top of the graph. Following differential gene expression generally GeneSet Enrichment Analysis (GSEA) is carried out where based on the genes and their corresponding fold changes the upregulation/downregulation of genesets (or pathways) is determined.

If a ProteinPaint dataset contains differential gene expression data then return JSON with single key, 'dge'.

---

Survival analysis (also called time-to-event analysis or duration analysis) is a branch of statistics aimed at analyzing the duration of time from a well-defined time origin until one or more events happen, called survival times or duration times. In other words, in survival analysis, we are interested in a certain event and want to analyze the time until the event happens.

There are two main methods of survival analysis:

1) Kaplan-Meier (HM) analysis is a univariate test that only takes into account a single categorical variable.
2) Cox proportional hazards model (coxph) is a multivariate test that can take into account multiple variables.

   The hazard ratio (HR) is an indicator of the effect of the stimulus (e.g. drug dose, treatment) between two cohorts of patients.
   HR = 1: No effect
   HR < 1: Reduction in the hazard
   HR > 1: Increase in Hazard

If a ProteinPaint dataset contains survival data then return JSON with single key, 'survival'.

---

Next generation sequencing reads (NGS) are mapped to a human genome using alignment algorithm such as burrows-wheelers alignment algorithm. Then these reads are called using variant calling algorithms such as GATK (Genome Analysis Toolkit). However this type of analysis is too compute intensive and beyond the scope of visualization software such as ProteinPaint.

If a user query asks about variant calling or mapping reads then JSON with single key, 'variant_calling'.

---

Summary plot in ProteinPaint shows the various facets of the datasets. It may show all the samples according to their respective diagnosis or subtypes of cancer. It is also useful for visualizing all the different facets of the dataset. You can display a categorical variable and overlay another variable on top it and stratify (or divide) using a third variable simultaneously. You can also custom filters to the dataset so that you can only study part of the dataset. If a user query asks about variant calling or mapping reads then JSON with single key, 'summary'.

Sample Query1: \"Show all fusions for patients with age less than 30\"
Sample Answer1: { \"answer\": \"summary\" }

Sample Query1: \"List all molecular subtypes of leukemia\"
Sample Answer1: { \"answer\": \"summary\" } 

---

If a query does not match any of the fields described above, then return JSON with single key, 'none'
");

    // Split the contents by the delimiter "---"
    let parts: Vec<&str> = contents.split("---").collect();
    let schema_json: Value = serde_json::to_value(schemars::schema_for!(OutputJson)).unwrap(); // error handling here

    let additional;
    match llm_backend_type {
        llm_backend::Ollama() => {
            additional = json!({
                    "format": schema_json
            }
                );
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

    let top_k: usize = 3;
    // Create embeddings and add to vector store
    let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
        .documents(rag_docs)
        .expect("Reason1")
        .build()
        .await
        .unwrap();

    // Create vector store
    let mut vector_store = InMemoryVectorStore::<String>::default();
    InMemoryVectorStore::add_documents(&mut vector_store, embeddings);

    // Create RAG agent
    let agent = AgentBuilder::new(comp_model).preamble("Generate classification for the user query into summary, dge, hierarchial, snv_indel, cnv, variant_calling, sv_fusion and none categories. Return output in JSON with ALWAYS a single word answer { \"answer\": \"dge\" }, that is 'summary' for summary plot, 'dge' for differential gene expression, 'hierarchial' for hierarchial clustering, 'snv_indel' for SNV/Indel, 'cnv' for CNV and 'sv_fusion' for SV/fusion, 'variant_calling' for variant calling, 'surivial' for survival data, 'none' for none of the previously described categories. The summary plot list and summarizes the cohort of patients according to the user query. The answer should always be in lower case").dynamic_context(top_k, vector_store.index(embedding_model)).temperature(temperature).additional_params(additional).build();

    let response = agent.prompt(user_input).await.expect("Failed to prompt ollama");

    //println!("Ollama: {}", response);
    let result = response.replace("json", "").replace("```", "");
    let json_value: Value = serde_json::from_str(&result).expect("REASON");
    match llm_backend_type {
        llm_backend::Ollama() => json_value.as_object().unwrap()["answer"].to_string().replace("\"", ""),
        llm_backend::Sj() => {
            let json_value2: Value =
                serde_json::from_str(&json_value[0]["generated_text"].to_string()).expect("REASON2");
            //println!("json_value2:{}", json_value2.as_str().unwrap());
            let json_value3: Value = serde_json::from_str(&json_value2.as_str().unwrap()).expect("REASON2");
            //let json_value3: Value = serde_json::from_str(&json_value2["answer"].to_string()).expect("REASON2");
            //println!("Classification result:{}", json_value3["answer"]);
            json_value3["answer"].to_string()
        }
    }
}

#[allow(non_snake_case)]
async fn extract_DE_search_terms_from_query(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    llm_backend_type: &llm_backend,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
) -> String {
    let contents = String::from("Differential Gene Expression (DGE or DE) is a technique where the most upregulated and downregulated genes between two cohorts of samples (or patients) are determined. A volcano plot is shown with fold-change in the x-axis and adjusted p-value on the y-axis. So, the upregulated and downregulared genes are on opposite sides of the graph and the most significant genes (based on adjusted p-value) is on the top of the graph.

The user may select a cutoff for a continuous variables such as age. In such cases the group should only include the range specified by the user. Inside the JSON each entry the name of the group must be inside the field \"name\". For the cutoff (if provided) a field called \"cutoff\" must be provided which should contain a subfield \"name\" containing the name of the cutoff, followed by \"greater\"/\"lesser\"/\"equal\" to followed by the numeric value of the cutoff. If the unit of the variable is provided such as cm,m,inches,celsius etc. then add it to a separate field called \"units\".  

Example input user queries:
When two groups are found give the following JSON output show {\"group1\": \"groupA\", \"group2\": \"groupB\"} 
User query1: \"Show me the differential gene expression plot for groups groupA and groupB\"
Output JSON query1: {\"group1\": {\"name\": \"groupA\"}, \"group2\": {\"name\": \"groupB\"}}

User query2: \"Show volcano plot for White vs Black\"
Output JSON query2: {\"group1\": {\"name\": \"White\"}, \"group2\": {\"name\": \"Black\"}}

In case no suitable groups are found, show {\"output\":\"No suitable two groups found for differential gene expression\"}
User query3: \"Who wants to have vodka?\"
Output JSON query3: {\"output\":\"No suitable two groups found for differential gene expression\"}

User query4: \"Show volcano plot for Asians with age less than 20 and African greater than 80\"
Output JSON query4: {\"group1\": {\"name\": \"Asians\", \"filter\": {\"name\": \"age\", \"cutoff\": {\"lesser\": 20}}}, \"group2\": {\"name\": \"African\", \"filter\": {\"name\": \"age\", \"cutoff\": {\"greater\": 80}}}}

User query5: \"Show Differential gene expression plot for males with height greater than 185cm and women with less than 100cm\"
Output JSON query5: {\"group1\": {\"name\": \"males\", \"filter\": {\"name\": \"height\", \"cutoff\": {\"greater\": 185, \"units\":\"cm\"}}}, \"group2\": {\"name\": \"women\", \"filter\": {\"name\": \"height\", \"cutoff\": {\"lesser\": 100, \"units\": \"cm\"}}}}");

    // Split the contents by the delimiter "---"
    let parts: Vec<&str> = contents.split("---").collect();

    let schema_json: Value = serde_json::to_value(schemars::schema_for!(DEOutput)).unwrap(); // error handling here

    //println!("DE schema:{}", schema_json);

    let additional;
    match llm_backend_type {
        llm_backend::Ollama() => {
            additional = json!({
                    "format": schema_json
            }
                );
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

    let rag_docs_length = rag_docs.len();
    // Create embeddings and add to vector store
    let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
        .documents(rag_docs)
        .expect("Reason1")
        .build()
        .await
        .unwrap();

    // Create vector store
    let mut vector_store = InMemoryVectorStore::<String>::default();
    InMemoryVectorStore::add_documents(&mut vector_store, embeddings);

    // Create RAG agent
    let router_instructions = "Extract the group variable names for differential gene expression from input query. When two groups are found give the following JSON output with no extra comments. Show {{\"group1\": {\"name\": \"groupA\"}, \"group2\": {\"name\": \"groupB\"}}}. In case no suitable groups are found, show {\"output\":\"No suitable two groups found for differential gene expression\"}. In case of a continuous variable such as age, height added additional field to the group called \"filter\". This should contain a sub-field called \"names\" followed by a subfield called \"cutoff\". This sub-field should contain a key either greater, lesser or equalto. If the continuous variable has units provided by the user then add it in a separate field called \"units\". User query1: \"Show volcano plot for Asians with age less than 20 and African greater than 80\". Output JSON query1: {\"group1\": {\"name\": \"Asians\", \"filter\": {\"name\": \"age\", \"cutoff\": {\"lesser\": 20}}}, \"group2\": {\"name\": \"African\", \"filter\": {\"name\": \"age\", \"cutoff\": {\"greater\": 80}}}}. User query2: \"Show Differential gene expression plot for males with height greater than 185cm and women with less than 100cm\". Output JSON query2: {\"group1\": {\"name\": \"males\", \"filter\": {\"name\": \"height\", \"cutoff\": {\"greater\": 185, \"units\":\"cm\"}}}, \"group2\": {\"name\": \"women\", \"filter\": {\"name\": \"height\", \"cutoff\": {\"lesser\": 100, \"units\": \"cm\"}}}}. User query3: \"Show DE plot between healthy and diseased groups. Output JSON query3: {\"group1\":{\"name\":\"healthy\"},\"group2\":{\"name\":\"diseased\"}}";
    //println! {"router_instructions:{}",router_instructions};
    let agent = AgentBuilder::new(comp_model)
        .preamble(router_instructions)
        .dynamic_context(rag_docs_length, vector_store.index(embedding_model))
        .temperature(temperature)
        .additional_params(additional)
        .build();

    let response = agent.prompt(user_input).await.expect("Failed to prompt ollama");

    //println!("Ollama_groups: {}", response);
    let result = response.replace("json", "").replace("```", "");
    //println!("result_groups:{}", result);
    let json_value: Value = serde_json::from_str(&result).expect("REASON");
    //println!("json_value:{}", json_value);
    match llm_backend_type {
        llm_backend::Ollama() => json_value.to_string(),
        llm_backend::Sj() => {
            let json_value2: Value =
                serde_json::from_str(&json_value[0]["generated_text"].to_string()).expect("REASON2");
            //println!("json_value2:{}", json_value2.as_str().unwrap());
            let json_value3: Value = serde_json::from_str(&json_value2.as_str().unwrap()).expect("REASON2");
            //println!("Classification result:{}", json_value3);
            json_value3.to_string()
        }
    }
}

struct DbRows {
    name: String,
    description: Option<String>,
    term_type: Option<String>,
    values: Vec<String>,
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

async fn parse_dataset_db(db: &str) -> Vec<String> {
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
    //let mut file = File::open(dataset_agnostic_file).unwrap();

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
                //println!("Field details:{}", item.parse_db_rows());
                rag_docs.push(item.parse_db_rows());
                names.push(name)
            }
            None => {}
        }
    }
    //println!("names:{:?}", names);
    rag_docs
}

async fn extract_summary_information(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    llm_backend_type: &llm_backend,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
    dataset_db: Option<&str>,
) -> String {
    match dataset_db {
        Some(db) => {
            let rag_docs = parse_dataset_db(db).await;
            //println!("rag_docs:{:?}", rag_docs);
            let additional;
            match llm_backend_type {
                llm_backend::Ollama() => {
                    additional = json!({});
                }
                llm_backend::Sj() => {
                    additional = json!({
                            "max_new_tokens": max_new_tokens,
                            "top_p": top_p
                    });
                }
            }

            let rag_docs_length = rag_docs.len();
            // Create embeddings and add to vector store
            let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
                .documents(rag_docs)
                .expect("Reason1")
                .build()
                .await
                .unwrap();

            // Create vector store
            let mut vector_store = InMemoryVectorStore::<String>::default();
            InMemoryVectorStore::add_documents(&mut vector_store, embeddings);

            //let system_prompt = "I am an assistant that figures out the summary term from its respective dataset file. Extract the summary term {summary_term} from user query. The final output must be in the following JSON format {{\"chartType\":\"summary\",\"term\":{{\"id\":\"{{summary_term}}\"}}}}";

            let top_k = rag_docs_length;
            let system_prompt = String::from(
                "I am an assistant that extracts the summary term from user query. It has four fields: group_categories (required), overlay (optional), filter (optional) and divide_by (optional). group_categories (required) is the primary variable being displayed. Overlay consists of the variable that must be overlayed on top of group_categories. divide_by is the variable used to stratify group_categories into two or more categories. The final output must be in the following JSON format with no extra comments: {\"chartType\":\"summary\",\"term\":{\"group_categories\":\"{group_category_answer}\",\"overlay\":\"{overlay_answer}\",\"divide_by\":\"{divide_by_answer}\",\"filter\":\"{filter_answer}\"}}. The values being added to the JSON parameters must be previously defined as field in the database. If the filter variable is a \"value\" of a \"field\" in the database, use the field name and add the value as a \"filter cutoff\" . If the \"filter\" field is defined in the user query, it should contain an array with each item containing a subfield called \"name\" with the name of the filter variable. If the type of variable is \"categories\", add another field as \"variable_type\" = \"categories\". In case the type of the variable is \"categories\", show the sub-category as a separate sub-field \"cutoff\" with a sub nested JSON with \"name\" as the field containing the subcategory name. In case the type of the variable is \"float\" it should contain a subfield called \"name\" followed by subfield \"variable_type\" = \"float\". In the \"cutoff\" subfield, the nested JSON should contain the field \"lower\" containing the lower numeric limit and the \"upper\" field containing the upper numeric limit. If the upper and lower cutoffs are not defined in the user query, use a default value of 0 and 100 respectively. Sample query1: \"Show ETR1 subtype\" Answer query1: \"{\"chartType\":\"summary\",\"term\":{\"group_categories\":\"ETR1\"}}. Sample query2: \"Show hyperdiploid subtype with age overlayed on top of it\" Answer query2: \"{\"chartType\":\"summary\",\"term\":{\"group_categories\":\"hyperdiploid\", \"overlay\":\"age\"}}. Sample query3: \"Show BAR1 subtype with age overlayed on top of it and stratify it on the basis of gender\" Answer query4: \"{\"chartType\":\"summary\",\"term\":{\"group_categories\":\"BAR1\", \"overlay\":\"age\", \"divide_by\":\"sex\"}}. Sample query5: \"Show summary for cancer-diagnosis only for men\". Since gender is a categorical variable and the user wants to select for men, the answer query for sample query5 is as follows: \"{\"chartType\":\"summary\",\"term\":{\"group_categories\":\"cancer-diagnosis\", \"filter\": {\"name\": \"gender\", \"variable_type\": \"categories\", \"cutoff\": {\"name\": \"male\"}}}}. Sample query6: \"Show molecular subtype summary for patients with age less than 30\". Age is a float variable so we need to provide the lower and higher cutoffs. So the answer to sample query6 is as follows: \"{\"chartType\":\"summary\",\"term\":{\"group_categories\":\"Molecular subtype\", \"filter\": {\"name\": \"age\", \"variable_type\": \"float\", \"cutoff\": {\"lower\": 0, \"higher\": 30}}}} ",
            );
            //println!("system_prompt:{}", system_prompt);
            // Create RAG agent
            let agent = AgentBuilder::new(comp_model)
                .preamble(&system_prompt)
                .dynamic_context(top_k, vector_store.index(embedding_model))
                .temperature(temperature)
                .additional_params(additional)
                .build();

            let response = agent.prompt(user_input).await.expect("Failed to prompt ollama");

            //println!("Ollama: {}", response);
            let result = response.replace("json", "").replace("```", "");
            //println!("result:{}", result);
            let json_value: Value = serde_json::from_str(&result).expect("REASON");
            //println!("Classification result:{}", json_value);

            match llm_backend_type {
                llm_backend::Ollama() => json_value.to_string(),
                llm_backend::Sj() => {
                    let json_value2: Value =
                        serde_json::from_str(&json_value[0]["generated_text"].to_string()).expect("REASON2");
                    //println!("json_value2:{}", json_value2.as_str().unwrap());
                    let json_value3: Value = serde_json::from_str(&json_value2.as_str().unwrap()).expect("REASON2");
                    //println!("Classification result:{}", json_value3);
                    json_value3.to_string()
                }
            }
        }
        None => {
            panic!("Dataset db file needed for summary term extraction from user input")
        }
    }
}
