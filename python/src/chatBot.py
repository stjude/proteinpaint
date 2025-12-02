#!/usr/bin/env python3
import sys, os, json, httpx
from typing import Optional, Literal, List
from pydantic import BaseModel, Field
from typing_extensions import TypedDict
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END

# ──────────────────────────────────────────────────────────────────────────────
# LLM setup (you need to set OPENAI_API_KEY as env variable)
# ──────────────────────────────────────────────────────────────────────────────
OPENAI_API_KEY=os.environ["OPENAI_API_KEY"]
LLM = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.2,
    api_key=OPENAI_API_KEY
)

# ──────────────────────────────────────────────────────────────────────────────
# State & I/O models
# ──────────────────────────────────────────────────────────────────────────────
class Msg(TypedDict):
    role: str
    content: str

class State(TypedDict):
    messages: List[Msg]
    intent: str
    artifacts: dict
    context: dict  # holds dslabel/genome/gene(s) from the LLM ONLY

# ──────────────────────────────────────────────────────────────────────────────
# LLM router schema (single or multi)
# ──────────────────────────────────────────────────────────────────────────────


class RouterOutput(BaseModel):
    intent: Literal["expression", "multi_expression", "transcriptome_embedding", "fallback"] = Field(..., description="User intent")
    gene: Optional[str] = Field(None, description="Single HGNC-like symbol (uppercase, e.g., TP53)")
    genes: Optional[List[str]] = Field(None, description="List of HGNC-like symbols (uppercase, no duplicates)")
    method: Optional[Literal["UMAP", "t-SNE"]] = Field(None, description="Embedding method for transcriptome map")



ROUTER_SYS = (
    "You are an intent router for a genomics chatbot.\n"
    "Decide if the user wants:\n"
    "- expression: a summary/overview of a SINGLE gene's expression (mRNA level, RNA-seq, violin/box plots, etc.)\n"
    "- multi_expression: expression overview/heatmap/clustering for MULTIPLE genes\n"
    "- transcriptome_embedding: a sample-level embedding of transcriptomes (e.g., UMAP or t-SNE)\n"
    "- fallback: anything else\n\n"
    "STRICT CONSTRAINTS:\n"
    "- Return ONLY a JSON object that matches the schema.\n"
    "- For 'expression', set 'gene' to ONE uppercase HGNC-like symbol (^[A-Z][A-Z0-9-]{1,11}$). Set 'genes' and 'method' to null.\n"
    "- For 'multi_expression', set 'genes' to an array of 2+ uppercase symbols (no duplicates). Set 'gene' and 'method' to null.\n"
    "- For 'transcriptome_embedding', set 'method' to either 'UMAP' or 't-SNE'. Set 'gene' and 'genes' to null.\n"
    "- For 'fallback', set 'gene', 'genes', and 'method' to null.\n"
    "- Do not include any extra keys or text."
)


ROUTER_FEWSHOT = [
    ("show me KRAS expression",                 {"intent":"expression","gene":"KRAS","genes":None}),
    ("summarize expression of tp53",            {"intent":"expression","gene":"TP53","genes":None}),
    ("give an overview of EGFR mRNA",           {"intent":"expression","gene":"EGFR","genes":None}),
    ("violin plot for MYC expression",          {"intent":"expression","gene":"MYC","genes":None}),
    ("cluster expression for APOH, APP, CCND2", {"intent":"multi_expression","gene":None,"genes":["APOH","APP","CCND2"]}),
    ("heatmap EGFR ALK ROS1",                   {"intent":"multi_expression","gene":None,"genes":["EGFR","ALK","ROS1"]}),
    ("what's the weather tomorrow",             {"intent":"fallback","gene":None,"genes":None}),
    # NEW: transcriptome embeddings
    ("show transcriptome umap",                 {"intent":"transcriptome_embedding","gene":None,"genes":None,"method":"UMAP"}),
    ("plot transcriptome tSNE",                 {"intent":"transcriptome_embedding","gene":None,"genes":None,"method":"t-SNE"}),
    ("global sample map by RNA-seq (umap)",     {"intent":"transcriptome_embedding","gene":None,"genes":None,"method":"UMAP"}),
]



def semantic_route(prompt: str) -> RouterOutput:
    """LLM-only semantic router with structured output (no heuristics)."""
    parser_llm = LLM.with_structured_output(RouterOutput)
    msgs = [{"role": "system", "content": ROUTER_SYS}]
    for q, a in ROUTER_FEWSHOT:
        msgs.append({"role": "user", "content": q})
        # ensure assistant few-shot is strict JSON
        msgs.append({"role": "assistant", "content": json.dumps(a)})
    msgs.append({"role": "user", "content": prompt})
    return parser_llm.invoke(msgs)

# ──────────────────────────────────────────────────────────────────────────────
# LangGraph nodes (LLM-only routing, no regex, no heuristic guessing)
# ──────────────────────────────────────────────────────────────────────────────
def router_node(state: State) -> State:
    user_msg = state["messages"][-1]["content"]
    try:
        routed = semantic_route(user_msg)
        state["intent"] = routed.intent
        ctx = state.setdefault("context", {})
        if routed.intent == "expression":
            if not routed.gene:
                state["intent"] = "fallback"
            else:
                ctx["gene_hint"] = routed.gene
        elif routed.intent == "multi_expression":
            if not routed.genes or len(routed.genes) < 2:
                state["intent"] = "fallback"
            else:
                ctx["genes_hint"] = routed.genes
        elif routed.intent == "transcriptome_embedding":
            if not routed.method:
                state["intent"] = "fallback"
            else:
                ctx["embedding_method"] = routed.method  # <── store 'UMAP' or 't-SNE'
    except Exception:
        state["intent"] = "fallback"
    return state

def expression_agent(state: State) -> State:
    """Emit single-gene expression JSON using ONLY the LLM-provided gene."""
    gene = state.get("context", {}).get("gene_hint")
    if not gene:
        state.setdefault("artifacts", {})["result"] = {"answer": "I couldn’t identify a single gene to summarize."}
        return state
    payload = {
        "title": f"{gene} expression",
        "prog_language": "python",
        "plot": {
            "chartType": "summary",
            "childType": "violin",
            "term": {
                "term": {"gene": gene, "type": "geneExpression"},
                "q": {"mode": "continuous"}
            }
        }
    }
    state.setdefault("artifacts", {})["result"] = payload
    return state

def transcriptome_embedding_agent(state: State) -> State:
    method = state.get("context", {}).get("embedding_method")
    if method not in ("UMAP", "t-SNE"):
        state.setdefault("artifacts", {})["result"] = {"answer": "I couldn’t determine which embedding (UMAP or t-SNE) you want."}
        return state

    title = f"Transcriptome {method}"
    payload = {
        "title": title,
        "prog_language": "python",
        "plot": {
            "chartType": "sampleScatter",
            "name": title
        }
    }
    state.setdefault("artifacts", {})["result"] = payload
    return state


def multi_expression_agent(state: State) -> State:
    """Emit multi-gene hierCluster JSON using ONLY the LLM-provided genes."""
    genes = state.get("context", {}).get("genes_hint")
    if not genes or len(genes) < 2:
        state.setdefault("artifacts", {})["result"] = {"answer": "I couldn’t identify multiple genes from the request."}
        return state
    payload = {
        "prog_language": "python",
        "plot": {
            "chartType": "hierCluster",
            "dataType": "geneExpression",
            "terms": [{"gene": g, "type": "geneExpression"} for g in genes]
        }
    }
    state.setdefault("artifacts", {})["result"] = payload
    return state

def fallback_agent(state: State) -> State:
    """One-sentence fallback."""
    user_msg = state["messages"][-1]["content"]
    try:
        resp = LLM.invoke([
            {"role": "system", "content": "Answer briefly in one clear sentence."},
            {"role": "user", "content": user_msg},
        ])
        answer = (resp.content or "").strip()
    except Exception:
        answer = "I couldn’t answer that from the provided prompt."
    state.setdefault("artifacts", {})["result"] = {"answer": answer}
    return state

# ──────────────────────────────────────────────────────────────────────────────
# Build LangGraph
# ──────────────────────────────────────────────────────────────────────────────
graph_builder = StateGraph(State)
graph_builder.add_node("router", router_node)
graph_builder.add_node("expression", expression_agent)
graph_builder.add_node("multi_expression", multi_expression_agent)
graph_builder.add_node("fallback", fallback_agent)
graph_builder.add_node("transcriptome_embedding", transcriptome_embedding_agent)

graph_builder.add_edge(START, "router")

def router_decision(state: State):
    return state.get("intent", "fallback")

graph_builder.add_conditional_edges(
    "router",
    router_decision,
    {
        "expression": "expression",
        "multi_expression": "multi_expression",
        "transcriptome_embedding": "transcriptome_embedding",  # <── new route
        "fallback": "fallback"
    }
)
graph_builder.add_edge("expression", END)
graph_builder.add_edge("multi_expression", END)
graph_builder.add_edge("transcriptome_embedding", END)
graph_builder.add_edge("fallback", END)
GRAPH = graph_builder.compile()

# ──────────────────────────────────────────────────────────────────────────────
# CLI: stdin → stdout
# ──────────────────────────────────────────────────────────────────────────────
def main() -> int:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print("Error: No input provided", file=sys.stderr)
            return 1
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            print("Error: Input JSON must be an object (dictionary)", file=sys.stderr)
            return 1
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format - {e}", file=sys.stderr)
        return 1

    for key in ("prompt", "genome", "dslabel"):
        if key not in payload:
            print(f"Error: Missing required key '{key}'", file=sys.stderr)
            return 1
    prompt = payload["prompt"]
    if not isinstance(prompt, str):
        print("Error: 'prompt' must be a string", file=sys.stderr)
        return 1

    init_state: State = {
        "messages": [{"role": "user", "content": prompt}],
        "intent": "fallback",
        "artifacts": {},
        "context": {"genome": payload.get("genome"), "dslabel": payload.get("dslabel")},
    }
    out_state: State = GRAPH.invoke(init_state)
    result = out_state.get("artifacts", {}).get("result")

    sys.stdout.write(json.dumps(result, separators=(",", ":"), ensure_ascii=False))
    return 0

if __name__ == "__main__":
    sys.exit(main())
