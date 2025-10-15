// Compile: cd .. && cargo build --release
// Test: cd .. && export RUST_BACKTRACE=full && time cargo test --  --nocapture (runs all test except those marked as "ignored")
// Ignored tests: cd .. && export RUST_BACKTRACE=full && time cargo test -- --ignored --nocapture
use async_stream::stream;
use futures::StreamExt;
use rig::client::{ClientBuilderError, CompletionClient, EmbeddingsClient, ProviderClient, VerifyClient, VerifyError};
use rig::completion::{GetTokenUsage, Usage};
use rig::message::ConvertMessage;
use rig::streaming::RawStreamingChoice;
use rig::{
    Embed, OneOrMany,
    completion::{self, CompletionError, CompletionRequest},
    embeddings::{self, EmbeddingError, EmbeddingsBuilder},
    impl_conversion_traits, message,
    message::{ImageDetail, Text},
    streaming,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::convert::TryInto;
//use std::time::Duration;
use std::{convert::TryFrom, str::FromStr};
use url::Url;

// ---------- Main Client ----------
pub struct ClientBuilder<'a> {
    base_url: &'a str,
    http_client: Option<reqwest::Client>,
}

impl<'a> ClientBuilder<'a> {
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Self {
            base_url: "",
            http_client: None,
        }
    }

    pub fn base_url(mut self, base_url: &'a str) -> Self {
        //println!("base_url:{}", base_url);
        self.base_url = base_url;
        self
    }

    pub fn build(self) -> Result<Client, ClientBuilderError> {
        let http_client = if let Some(http_client) = self.http_client {
            http_client
        } else {
            reqwest::Client::builder().build()?
        };

        Ok(Client {
            base_url: Url::parse(self.base_url).map_err(|_| ClientBuilderError::InvalidProperty("base_url"))?,
            http_client,
        })
    }
}

#[derive(Clone, Debug)]
pub struct Client {
    base_url: Url,
    http_client: reqwest::Client,
}

impl Default for Client {
    fn default() -> Self {
        Self::new()
    }
}

impl Client {
    pub fn builder() -> ClientBuilder<'static> {
        ClientBuilder::new()
    }

    pub fn completion_model(&self, model: &str) -> CompletionModel {
        CompletionModel::new(self.clone(), model)
    }

    pub fn embedding_model(&self, model: &str) -> EmbeddingModel {
        EmbeddingModel::new(self.clone(), model, 0)
    }

    pub fn new() -> Self {
        Self::builder().build().expect("Myprovider client should build")
    }

    pub(crate) fn post(&self, path: &str) -> Result<reqwest::RequestBuilder, url::ParseError> {
        let url = self.base_url.join(path)?;
        Ok(self.http_client.post(url))
    }

    pub(crate) fn get(&self, path: &str) -> Result<reqwest::RequestBuilder, url::ParseError> {
        let url = self.base_url.join(path)?;
        Ok(self.http_client.get(url))
    }
}

impl ProviderClient for Client {
    fn from_env() -> Self
    where
        Self: Sized,
    {
        let api_base = std::env::var("MYPROVIDER_API_BASE_URL").expect("MYPROVIDER_API_BASE_URL not set");
        Self::builder().base_url(&api_base).build().unwrap()
    }

    fn from_val(input: rig::client::ProviderValue) -> Self {
        let rig::client::ProviderValue::Simple(_) = input else {
            panic!("Incorrect provider value type")
        };

        Self::new()
    }
}

impl CompletionClient for Client {
    type CompletionModel = CompletionModel;

    fn completion_model(&self, model: &str) -> CompletionModel {
        CompletionModel::new(self.clone(), model)
    }
}

impl EmbeddingsClient for Client {
    type EmbeddingModel = EmbeddingModel;
    fn embedding_model(&self, model: &str) -> EmbeddingModel {
        EmbeddingModel::new(self.clone(), model, 0)
    }
    fn embedding_model_with_ndims(&self, model: &str, ndims: usize) -> EmbeddingModel {
        EmbeddingModel::new(self.clone(), model, ndims)
    }
    fn embeddings<D: Embed>(&self, model: &str) -> EmbeddingsBuilder<EmbeddingModel, D> {
        EmbeddingsBuilder::new(self.embedding_model(model))
    }
}

impl VerifyClient for Client {
    async fn verify(&self) -> Result<(), VerifyError> {
        let response = self.get("api/tags").expect("Failed to build request").send().await?;
        match response.status() {
            reqwest::StatusCode::OK => Ok(()),
            _ => {
                response.error_for_status()?;
                Ok(())
            }
        }
    }
}

impl_conversion_traits!(
    AsTranscription,
    AsImageGeneration,
    AsAudioGeneration for Client
);

// ---------- API Error and Response Structures ----------

#[derive(Debug, Deserialize)]
struct ApiErrorResponse {
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ApiResponse<T> {
    Ok(T),
    Err(ApiErrorResponse),
}

// ---------- Embedding API ----------

#[derive(Debug, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub model: String,
    pub embeddings: Vec<Vec<f64>>,
    #[serde(default)]
    pub total_duration: Option<u32>,
    #[serde(default)]
    pub load_duration: Option<u32>,
    #[serde(default)]
    pub prompt_eval_count: Option<u32>,
}

impl From<ApiErrorResponse> for EmbeddingError {
    fn from(err: ApiErrorResponse) -> Self {
        EmbeddingError::ProviderError(err.message)
    }
}

impl From<ApiResponse<EmbeddingResponse>> for Result<EmbeddingResponse, EmbeddingError> {
    fn from(value: ApiResponse<EmbeddingResponse>) -> Self {
        match value {
            ApiResponse::Ok(response) => Ok(response),
            ApiResponse::Err(err) => Err(EmbeddingError::ProviderError(err.message)),
        }
    }
}

// ---------- Embedding Model ----------

#[derive(Clone)]
pub struct EmbeddingModel {
    client: Client,
    pub model: String,
    ndims: usize,
}

impl EmbeddingModel {
    pub fn new(client: Client, model: &str, ndims: usize) -> Self {
        Self {
            client,
            model: model.to_owned(),
            ndims,
        }
    }
}

impl embeddings::EmbeddingModel for EmbeddingModel {
    const MAX_DOCUMENTS: usize = 1024;
    fn ndims(&self) -> usize {
        self.ndims
    }

    async fn embed_texts(
        &self,
        documents: impl IntoIterator<Item = String>,
    ) -> Result<Vec<embeddings::Embedding>, EmbeddingError> {
        let docs: Vec<String> = documents.into_iter().collect();
        let payload = json!({
            "model": self.model,
            "input": docs,
        });
        let response = self
            .client
            .post("api/embed")?
            .json(&payload)
            .send()
            .await
            .map_err(|e| EmbeddingError::ProviderError(e.to_string()))?;
        if response.status().is_success() {
            let api_resp: EmbeddingResponse = response
                .json()
                .await
                .map_err(|e| EmbeddingError::ProviderError(e.to_string()))?;
            if api_resp.embeddings.len() != docs.len() {
                return Err(EmbeddingError::ResponseError(
                    "Number of returned embeddings does not match input".into(),
                ));
            }
            Ok(api_resp
                .embeddings
                .into_iter()
                .zip(docs.into_iter())
                .map(|(vec, document)| embeddings::Embedding { document, vec })
                .collect())
        } else {
            Err(EmbeddingError::ProviderError(response.text().await?))
        }
    }
    //Ok(Vec::<Embedding>::new())
}

// ---------- Completion API ----------

#[derive(Debug, Serialize, Deserialize)]
pub struct CompletionResponse {
    pub model: String,
    pub message: Message,
    pub timestamp: String,
}
impl TryFrom<CompletionResponse> for completion::CompletionResponse<CompletionResponse> {
    type Error = CompletionError;
    fn try_from(resp: CompletionResponse) -> Result<Self, Self::Error> {
        match resp.message {
            // Process only if an assistant message is present.
            Message::Assistant { content, id } => {
                //let mut assistant_contents = Vec::new();
                // Add the assistant's text content if any.
                //if !content.is_empty() {
                //    assistant_contents.push(completion::AssistantContent2::text(&content));
                //}

                let choice = rig::one_or_many::OneOrMany::one(completion::AssistantContent::text(&content));
                //let prompt_tokens = resp.prompt_eval_count.unwrap_or(0);
                //let completion_tokens = resp.eval_count.unwrap_or(0);

                let raw_response = CompletionResponse {
                    model: resp.model,
                    message: Message::Assistant { content, id },
                    timestamp: resp.timestamp,
                };

                Ok(completion::CompletionResponse {
                    choice,
                    usage: Usage {
                        input_tokens: 0,  // Not provided by custom provider
                        output_tokens: 0, // Not provided by custom provider
                        total_tokens: 0,  // Not provided by custom provider
                    },
                    raw_response,
                })
            }
            _ => Err(CompletionError::ResponseError(
                "Chat response does not include an assistant message".into(),
            )),
        }
    }
}

// ---------- Completion Model ----------

#[derive(Clone)]
pub struct CompletionModel {
    client: Client,
    pub model: String,
}

impl CompletionModel {
    pub fn new(client: Client, model: &str) -> Self {
        Self {
            client,
            model: model.to_owned(),
        }
    }

    fn create_completion_request(&self, completion_request: CompletionRequest) -> Result<Value, CompletionError> {
        let mut partial_history = vec![];
        if let Some(docs) = completion_request.normalized_documents() {
            partial_history.push(docs);
        }
        partial_history.extend(completion_request.chat_history);

        // Initialize full history with preamble (or empty if non-existent)
        let mut full_history: Vec<Message> = completion_request
            .preamble
            .map_or_else(Vec::new, |preamble| vec![Message::system(&preamble)]);

        // Convert and extend the rest of the history
        full_history.extend(
            partial_history
                .into_iter()
                .map(|msg| Message::convert_from_message(msg))
                .collect::<Result<Vec<Vec<Message>>, _>>()?
                .into_iter()
                .flatten()
                .collect::<Vec<Message>>(),
        );

        // Convert internal prompt into a provider Message
        //let max_new_tokens: u64;
        let top_p: f64;
        let mut schema_json_string: Option<String> = None;
        match completion_request.additional_params {
            Some(extra) => {
                top_p = extra["top_p"].as_f64().unwrap();
                if let Value::Object(obj) = extra {
                    if obj.contains_key("schema_json") {
                        schema_json_string = Some(String::from(obj["schema_json"].as_str().unwrap()));
                        //println!("schema_json_string:{:?}", schema_json_string);
                    }
                }
            }
            None => {
                panic!("top_p not found!");
            }
        }

        let mut user_query = "";
        let mut system_prompt = "";
        for message in &full_history {
            match message {
                self::Message::User {
                    content: text,
                    images: _,
                    name: _,
                } => {
                    //println!("User:{:?}", text);
                    user_query = text;
                }
                self::Message::System {
                    content: text,
                    images: _,
                    name: _,
                } => {
                    system_prompt = text;
                    //println!("System:{:?}", text);
                }
                self::Message::Assistant { content: _, id: _ } => {}
                self::Message::ToolResult { content: _, name: _ } => {}
            }
        }
        let final_text = system_prompt.replace(&"{question}", &user_query);

        // Convert and extend the rest of the history
        //full_history.extend(
        //    partial_history
        //        .into_iter()
        //        .map(Message::convert_from_message)
        //        .collect::<Result<Vec<Vec<Message>>, _>>()?
        //        .into_iter()
        //        .flatten()
        //        .collect::<Vec<Message>>(),
        //);

        let mut request_payload;
        match schema_json_string {
            // JSON schema is only added if its provided
            Some(_schema) => {
                request_payload = json!({
                    "model": self.model,
                    "messages": [{"role": "user", "content": final_text}],
                    "raw": false,
                    "stream": false,
                    "keep_alive": 15, // Keep the LLM loaded for 15mins
                    //"format":schema,
                    "options": {
                    "top_p": top_p,
                    "temperature": completion_request.temperature,
                    "num_ctx": 10000
                    }
                });
            }
            None => {
                request_payload = json!({
                    "model": self.model,
                    "messages": [{"role": "user", "content": final_text}],
                    "raw": false,
                    "stream": false,
                    "keep_alive": 15, // Keep the LLM loaded for 15mins
                    "options": {
                    "top_p": top_p,
                    "temperature": completion_request.temperature,
                    "num_ctx": 10000
                    }
                });
            }
        }
        //let mut request_payload = json!({
        //"model": "llama3.3:70b",
        //"messages": [{"role": "user", "content": "Tell me about Canada."}],
        //"stream": false,
        //"format": {
        //  "type": "object",
        //  "properties": {
        //    "name": {
        //      "type": "string"
        //    },
        //    "capital": {
        //      "type": "string"
        //    },
        //    "languages": {
        //      "type": "array",
        //      "items": {
        //        "type": "string"
        //      }
        //    }
        //  },
        //  "required": [
        //    "name",
        //    "capital",
        //    "languages"
        //  ]
        //}
        //});

        //println!("request_payload:{}", request_payload);
        if !completion_request.tools.is_empty() {
            request_payload["tools"] = json!(
                completion_request
                    .tools
                    .into_iter()
                    .map(|tool| tool.into())
                    .collect::<Vec<ToolDefinition>>()
            );
        }

        //tracing::debug!(target: "rig", "Chat mode payload: {}", request_payload);

        Ok(request_payload)
    }
}

// ---------- CompletionModel Implementation ----------

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct StreamingCompletionResponse {
    pub done_reason: Option<String>,
    pub total_duration: Option<u64>,
    pub load_duration: Option<u64>,
    pub prompt_eval_count: Option<u64>,
    pub prompt_eval_duration: Option<u64>,
    pub eval_count: Option<u64>,
    pub eval_duration: Option<u64>,
}

impl GetTokenUsage for StreamingCompletionResponse {
    fn token_usage(&self) -> Option<rig::completion::Usage> {
        let mut usage = rig::completion::Usage::new();
        let input_tokens = self.prompt_eval_count.unwrap_or_default();
        let output_tokens = self.eval_count.unwrap_or_default();
        usage.input_tokens = input_tokens;
        usage.output_tokens = output_tokens;
        usage.total_tokens = input_tokens + output_tokens;

        Some(usage)
    }
}

impl completion::CompletionModel for CompletionModel {
    type Response = CompletionResponse;
    type StreamingResponse = StreamingCompletionResponse;

    async fn completion(
        &self,
        completion_request: CompletionRequest,
    ) -> Result<completion::CompletionResponse<Self::Response>, CompletionError> {
        let request_payload = self.create_completion_request(completion_request)?;

        let response = self
            .client
            .post(&"api/chat")?
            .json(&request_payload)
            .send()
            .await
            .map_err(|e| CompletionError::ProviderError(e.to_string()))?;
        //println!("response:{:?}", response);
        if response.status().is_success() {
            let text = response
                .text()
                .await
                .map_err(|e| CompletionError::ProviderError(e.to_string()))?;
            let text_json: Value = serde_json::from_str(&text)?;
            //tracing::debug!(target: "rig", "Myprovider chat response: {}", text);
            let chat_resp: CompletionResponse = CompletionResponse {
                model: text_json["model_name"].to_string(),
                message: Message::Assistant {
                    id: text_json["id"].to_string(),
                    content: text_json["message"].to_string(),
                },
                timestamp: text_json["created_at"].to_string(),
            };
            //println!("chat_resp:{:?}", chat_resp);
            let conv: completion::CompletionResponse<CompletionResponse> = chat_resp.try_into()?;
            Ok(conv)
        } else {
            let err_text = response
                .text()
                .await
                .map_err(|e| CompletionError::ProviderError(e.to_string()))?;
            Err(CompletionError::ProviderError(err_text))
        }
    }

    async fn stream(
        &self,
        request: CompletionRequest,
    ) -> Result<streaming::StreamingCompletionResponse<Self::StreamingResponse>, CompletionError> {
        let mut request_payload = self.create_completion_request(request)?;
        merge_inplace(&mut request_payload, json!({"stream": true}));

        let response = self
            .client
            .post("api/chat")?
            .json(&request_payload)
            .send()
            .await
            .map_err(|e| CompletionError::ProviderError(e.to_string()))?;

        if !response.status().is_success() {
            let err_text = response
                .text()
                .await
                .map_err(|e| CompletionError::ProviderError(e.to_string()))?;
            return Err(CompletionError::ProviderError(err_text));
        }

        let stream = Box::pin(stream! {
            let mut stream = response.bytes_stream();
            while let Some(chunk_result) = stream.next().await {
                let chunk = match chunk_result {
                    Ok(c) => c,
                    Err(e) => {
                        yield Err(CompletionError::from(e));
                        break;
                    }
                };

                let text = match String::from_utf8(chunk.to_vec()) {
                    Ok(t) => t,
                    Err(e) => {
                        yield Err(CompletionError::ResponseError(e.to_string()));
                        break;
                    }
                };


                for line in text.lines() {
                    let line = line.to_string();

                    let Ok(response) = serde_json::from_str::<CompletionResponse>(&line) else {
                        continue;
                    };

                    match response.message {
                        Message::Assistant{ content, .. } => {
                            if !content.is_empty() {
                                yield Ok(RawStreamingChoice::Message(content))
                            }
                        }
                        _ => {
                            continue;
                        }
                    }

                    //if response.message {
                    //    yield Ok(RawStreamingChoice::FinalResponse(StreamingCompletionResponse {
                    //        total_duration: response.total_duration,
                    //        load_duration: response.load_duration,
                    //        prompt_eval_count: response.prompt_eval_count,
                    //        prompt_eval_duration: response.prompt_eval_duration,
                    //        eval_count: response.eval_count,
                    //        eval_duration: response.eval_duration,
                    //        done_reason: response.done_reason,
                    //    }));
                    //}
                }
            }
        });

        Ok(streaming::StreamingCompletionResponse::stream(stream))
    }
}

// ---------- Tool Definition Conversion ----------

/// Myprovider-required tool definition format.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub type_field: String, // Fixed as "function"
    pub function: completion::ToolDefinition,
}

/// Convert internal ToolDefinition (from the completion module) into Myprovider's tool definition.
impl From<rig::completion::ToolDefinition> for ToolDefinition {
    fn from(tool: rig::completion::ToolDefinition) -> Self {
        ToolDefinition {
            type_field: "function".to_owned(),
            function: completion::ToolDefinition {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct ToolCall {
    // pub id: String,
    #[serde(default, rename = "type")]
    pub r#type: ToolType,
    pub function: Function,
}
#[derive(Default, Debug, Serialize, Deserialize, PartialEq, Clone)]
#[serde(rename_all = "lowercase")]
pub enum ToolType {
    #[default]
    Function,
}
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Function {
    pub name: String,
    pub arguments: Value,
}

// ---------- Provider Message Definition ----------

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[serde(tag = "role", rename_all = "lowercase")]
pub enum Message {
    User {
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        images: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
    },
    Assistant {
        #[serde(default)]
        content: String,
        #[serde(default)]
        id: String,
        //#[serde(skip_serializing_if = "Option::is_none")]
        //thinking: Option<String>,
        //#[serde(skip_serializing_if = "Option::is_none")]
        //images: Option<Vec<String>>,
        //#[serde(skip_serializing_if = "Option::is_none")]
        //name: Option<String>,
        //#[serde(default, deserialize_with = "json_utils::null_or_vec")]
        //tool_calls: Vec<ToolCall>,
    },
    System {
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        images: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        name: Option<String>,
    },
    #[serde(rename = "tool")]
    ToolResult {
        #[serde(rename = "tool_name")]
        name: String,
        content: String,
    },
}

/// -----------------------------
/// Provider Message Conversions
/// -----------------------------
/// Conversion from an internal Rig message (crate::message::Message) to a provider Message.
/// (Only User and Assistant variants are supported.)
impl ConvertMessage for Message {
    type Error = rig::message::MessageError;
    fn convert_from_message(internal_msg: message::Message) -> Result<Vec<Self>, Self::Error> {
        use rig::message::Message as InternalMessage;
        match internal_msg {
            InternalMessage::User { content, .. } => {
                let (tool_results, other_content): (Vec<_>, Vec<_>) = content
                    .into_iter()
                    .partition(|content| matches!(content, rig::message::UserContent::ToolResult(_)));

                if !tool_results.is_empty() {
                    tool_results
                        .into_iter()
                        .map(|content| match content {
                            rig::message::UserContent::ToolResult(rig::message::ToolResult { id, content, .. }) => {
                                // Ollama expects a single string for tool results, so we concatenate
                                let content_string = content
                                    .into_iter()
                                    .map(|content| match content {
                                        rig::message::ToolResultContent::Text(text) => text.text,
                                        _ => "[Non-text content]".to_string(),
                                    })
                                    .collect::<Vec<_>>()
                                    .join("\n");

                                Ok::<_, rig::message::MessageError>(Message::ToolResult {
                                    name: id,
                                    content: content_string,
                                })
                            }
                            _ => unreachable!(),
                        })
                        .collect::<Result<Vec<_>, _>>()
                } else {
                    // Ollama requires separate text content and images array
                    let (texts, _images) =
                        other_content
                            .into_iter()
                            .fold((Vec::new(), Vec::new()), |(mut texts, mut images), content| {
                                match content {
                                    rig::message::UserContent::Text(rig::message::Text { text }) => texts.push(text),
                                    rig::message::UserContent::Image(rig::message::Image { data, .. }) => {
                                        images.push(data)
                                    }
                                    rig::message::UserContent::Document(rig::message::Document { data, .. }) => {
                                        texts.push(data.to_string())
                                    }
                                    _ => {} // Audio not supported by Ollama
                                }
                                (texts, images)
                            });

                    Ok(vec![Message::User {
                        content: texts.join(" "),
                        images: None,
                        name: None,
                    }])
                }
            }
            InternalMessage::Assistant { content, .. } => {
                let mut thinking: Option<String> = None;
                let (text_content, _tool_calls) =
                    content
                        .into_iter()
                        .fold((Vec::new(), Vec::new()), |(mut texts, mut tools), content| {
                            match content {
                                rig::message::AssistantContent::Text(text) => texts.push(text.text),
                                rig::message::AssistantContent::ToolCall(_tool_call) => tools.push(_tool_call),
                                rig::message::AssistantContent::Reasoning(rig::message::Reasoning {
                                    reasoning,
                                    ..
                                }) => {
                                    thinking = Some(reasoning.first().cloned().unwrap_or(String::new()));
                                }
                            }
                            (texts, tools)
                        });

                // `OneOrMany` ensures at least one `AssistantContent::Text` or `ToolCall` exists,
                //  so either `content` or `tool_calls` will have some content.
                #[allow(unreachable_code)]
                Ok(vec![Message::Assistant {
                    content: text_content.join(" "),
                    id: todo!(),
                }])
            }
        }
    }
}

/// Conversion from provider Message to a completion message.
/// This is needed so that responses can be converted back into chat history.
impl From<Message> for rig::completion::Message {
    fn from(msg: Message) -> Self {
        match msg {
            Message::User { content, .. } => rig::completion::Message::User {
                content: OneOrMany::one(rig::completion::message::UserContent::Text(Text { text: content })),
            },
            Message::Assistant { content, .. } => {
                let assistant_contents = vec![rig::completion::message::AssistantContent::Text(Text { text: content })];
                rig::completion::Message::Assistant {
                    id: None,
                    content: OneOrMany::many(assistant_contents).unwrap(),
                }
            }
            // System and ToolResult are converted to User message as needed.
            Message::System { content, .. } => rig::completion::Message::User {
                content: OneOrMany::one(rig::completion::message::UserContent::Text(Text { text: content })),
            },
            Message::ToolResult { name, content } => rig::completion::Message::User {
                content: OneOrMany::one(message::UserContent::tool_result(
                    name,
                    OneOrMany::one(message::ToolResultContent::text(content)),
                )),
            },
        }
    }
}

impl Message {
    /// Constructs a system message.
    pub fn system(content: &str) -> Self {
        Message::System {
            content: content.to_owned(),
            images: None,
            name: None,
        }
    }
}

// ---------- Additional Message Types ----------

impl From<rig::message::ToolCall> for ToolCall {
    fn from(tool_call: rig::message::ToolCall) -> Self {
        Self {
            r#type: ToolType::Function,
            function: Function {
                name: tool_call.function.name,
                arguments: tool_call.function.arguments,
            },
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct SystemContent {
    #[serde(default)]
    r#type: SystemContentType,
    text: String,
}

#[derive(Default, Debug, Serialize, Deserialize, PartialEq, Clone)]
#[serde(rename_all = "lowercase")]
pub enum SystemContentType {
    #[default]
    Text,
}

impl From<String> for SystemContent {
    fn from(s: String) -> Self {
        SystemContent {
            r#type: SystemContentType::default(),
            text: s,
        }
    }
}

impl FromStr for SystemContent {
    type Err = std::convert::Infallible;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(SystemContent {
            r#type: SystemContentType::default(),
            text: s.to_string(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct AssistantContent {
    pub text: String,
}

impl FromStr for AssistantContent {
    type Err = std::convert::Infallible;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(AssistantContent { text: s.to_owned() })
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum UserContent {
    Text { text: String },
    Image { image_url: ImageUrl },
    // Audio variant removed as Ollama API does not support audio input.
}

impl FromStr for UserContent {
    type Err = std::convert::Infallible;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(UserContent::Text { text: s.to_owned() })
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct ImageUrl {
    pub url: String,
    #[serde(default)]
    pub detail: ImageDetail,
}

// ---------JSON utils functions -----------------------------

pub fn merge_inplace(a: &mut serde_json::Value, b: serde_json::Value) {
    if let (serde_json::Value::Object(a_map), serde_json::Value::Object(b_map)) = (a, b) {
        b_map.into_iter().for_each(|(key, value)| {
            a_map.insert(key, value);
        });
    }
}

// =================================================================
// Tests
// =================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use rig::agent::AgentBuilder;
    use rig::completion::request::Prompt;
    //use rig::providers::myprovider;
    use rig::vector_store::in_memory_store::InMemoryVectorStore;
    //use serde_json::json;
    use serde_json;
    use std::fs::{self};
    use std::path::Path;

    // Test deserialization and conversion for the /api/chat endpoint.
    #[tokio::test]
    #[ignore]

    async fn test_ollama_implementation() {
        let user_input = "Generate DE plot for men with weight greater than 30lbs vs women less than 20lbs";
        let serverconfig_file_path = Path::new("../../serverconfig.json");
        let absolute_path = serverconfig_file_path.canonicalize().unwrap();

        // Read the file
        let data = fs::read_to_string(absolute_path).unwrap();

        // Parse the JSON data
        let json: serde_json::Value = serde_json::from_str(&data).unwrap();

        // Initialize Myprovider client
        let myprovider_host = json["ollama_apilink"].as_str().unwrap();
        let myprovider_embedding_model = json["ollama_embedding_model_name"].as_str().unwrap();
        let myprovider_comp_model = json["ollama_comp_model_name"].as_str().unwrap();
        let myprovider_client = Client::builder()
            .base_url(myprovider_host)
            .build()
            .expect("myprovider server not found");
        //let myprovider_client = myprovider::Client::new();
        let embedding_model = myprovider_client.embedding_model(myprovider_embedding_model);
        let comp_model = myprovider_client.completion_model(myprovider_comp_model); // "granite3-dense:latest" "PetrosStav/gemma3-tools:12b" "llama3-groq-tool-use:latest" "PetrosStav/gemma3-tools:12b"

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

        //let schema_json: Value = serde_json::to_value(schemars::schema_for!(OutputJson)).unwrap(); // error handling here

        //let additional = json!({
        //    "format": schema_json
        //});

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

        let max_new_tokens: usize = 512;
        let top_p: f32 = 0.95;
        let temperature: f64 = 0.01;
        let additional = json!({
                "max_new_tokens": max_new_tokens,
                "top_p": top_p
        });

        // Create RAG agent
        let agent = AgentBuilder::new(comp_model).preamble("Generate classification for the user query into summary, dge, hierarchial, snv_indel, cnv, variant_calling, sv_fusion and none categories. Return output in JSON with ALWAYS a single word answer { \"answer\": \"dge\" }, that is 'summary' for summary plot, 'dge' for differential gene expression, 'hierarchial' for hierarchial clustering, 'snv_indel' for SNV/Indel, 'cnv' for CNV and 'sv_fusion' for SV/fusion, 'variant_calling' for variant calling, 'surivial' for survival data, 'none' for none of the previously described categories. The answer should always be in lower case. \nQuestion= {question} \nanswer").dynamic_context(top_k, vector_store.index(embedding_model)).additional_params(additional).temperature(temperature).build();

        let response = agent.prompt(user_input).await.expect("Failed to prompt myprovider");

        //println!("Myprovider: {}", response);
        let result = response.replace("json", "").replace("```", "");
        //println!("result:{}", result);
        let json_value: Value = serde_json::from_str(&result).expect("REASON2");
        let json_value2: Value = serde_json::from_str(&json_value["content"].to_string()).expect("REASON3");
        let json_value3: Value = serde_json::from_str(&json_value2.as_str().unwrap()).expect("REASON4");
        assert_eq!(json_value3["answer"].to_string().replace("\"", ""), "dge");
    }
}
