import os
import json
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END

# Load environment variables (pulls in LangSmith tracing keys automatically if set)
load_dotenv()

app = FastAPI(title="CoFoundr AI Backend")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class ChatRequest(BaseModel):
    message: str
    history: list = []

class PitchRequest(BaseModel):
    message: str
    feedback: str = ""

class KPIRequest(BaseModel):
    mrr: str
    burn_rate: str
    churn: str

class MarketResearchRequest(BaseModel):
    niche: str

class GTMRequest(BaseModel):
    context: str

class CompetitorRequest(BaseModel):
    context: str

class GenericAgentRequest(BaseModel):
    context: str = ""

class GraphState(TypedDict):
    input_message: str
    chat_history: str
    reply: str
    action_plan: str
    is_finalized: bool

# Endpoints
@app.post("/api/idea-agent")
async def idea_agent(req: ChatRequest):
    api_key_groq = os.getenv("GROQ_API_KEY")
    api_key_openai = os.getenv("OPENAI_API_KEY")
    
    if not api_key_groq or not api_key_openai:
        return JSONResponse({"reply": "System Error: Both GROQ_API_KEY and OPENAI_API_KEY must be set in the .env file."}, status_code=400)
    
    llm = ChatGroq(model_name="llama-3.1-8b-instant", api_key=api_key_groq)
    action_llm = ChatGroq(model_name="llama-3.1-8b-instant", api_key=api_key_groq) 
    
    def brainstorm_node(state: GraphState):
        if "finalize" in state["input_message"].lower():
            return {"is_finalized": True, "reply": "I have finalized your idea! Generating your ultra-fast Execution Blueprint now..."}
            
        system_prompt = SystemMessage(content="""You are an elite Silicon Valley startup co-founder and product strategist.
Your goal is to rapidly help the user validate their startup idea with MINIMAL friction.
Ask ONLY 1 sharp question regarding their idea. 
Once they answer that single question, IMMEDIATELY tell the user to type "FINALIZE" so we can build the blueprint. Do not drag out the conversation.""")
        
        prompt = f"Previous Chat:\n{state['chat_history']}\n\nUser: {state['input_message']}"
        res = llm.invoke([system_prompt, HumanMessage(content=prompt)])
        return {"reply": res.content, "is_finalized": False}

    def action_plan_node(state: GraphState):
        system_prompt = SystemMessage(content="You are an elite execution strategist. You read the user's idea and generate a massive, structured Action Plan in Markdown.")
        prompt = f"Based on this startup idea session, generate a highly detailed Action Plan (include Features, Go-To-Market, and Next 30 Days):\n\nContext:\n{state['chat_history']}"
        res = action_llm.invoke([system_prompt, HumanMessage(content=prompt)])
        return {"action_plan": res.content}

    def router(state: GraphState):
        if state["is_finalized"]:
            return "action_plan_node"
        return END

    # Build LangGraph
    workflow = StateGraph(GraphState)
    workflow.add_node("brainstorm", brainstorm_node)
    workflow.add_node("action_plan_node", action_plan_node)
    
    workflow.add_edge(START, "brainstorm")
    workflow.add_conditional_edges("brainstorm", router)
    workflow.add_edge("action_plan_node", END)
    
    graph = workflow.compile()
    
    history_str = req.history[0] if req.history else ""
    initial_state = {"input_message": req.message, "chat_history": history_str, "is_finalized": False, "reply": "", "action_plan": ""}
    
    try:
        final_state = graph.invoke(initial_state)
        return {
            "reply": final_state.get("reply", ""),
            "is_finalized": final_state.get("is_finalized", False),
            "action_plan": final_state.get("action_plan", "")
        }
    except Exception as e:
        return JSONResponse({"reply": f"Error running LangGraph: {str(e)}"}, status_code=500)


@app.post("/api/pitch-deck")
async def pitch_deck(req: PitchRequest):
    """Generates or Updates a Full Markdown Pitch Deck"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        return JSONResponse({"reply": "System Error: OPENAI_API_KEY is not set in the .env file."}, status_code=400)
    
    try:
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key)
        system_prompt = SystemMessage(content="""You are an expert Startup Consultant. 
Generate a professional, compelling 5-slide Pitch Deck in Markdown format.
Headings should be (##). Include Problem, Solution, TAM, Go-To-Market, and Business Model.
Keep it strictly structured as a deck.""")
        
        if req.feedback:
            prompt = f"Here is the context and current Pitch Deck:\n{req.message}\n\nUSER FEEDBACK FOR REVISION:\n{req.feedback}\n\nApply the feedback and rewrite the Markdown Deck exactly as requested, updating only what makes sense."
        else:
            prompt = req.message

        messages = [system_prompt, HumanMessage(content=prompt)]
        response = llm.invoke(messages)
        return {"reply": response.content}
    except Exception as e:
        return JSONResponse({"reply": f"Error generating deck: {str(e)}"}, status_code=500)


@app.post("/api/manager-agent")
async def manager_agent(req: KPIRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        return JSONResponse({"error": "OPENAI_API_KEY missing."}, status_code=400)
    
    try:
        llm = ChatOpenAI(
            model="gpt-4o-mini", 
            api_key=api_key,
            model_kwargs={"response_format": {"type": "json_object"}}
        )
        
        prompt = f"""You are an elite fractional CFO and Growth Hacker. 
Analyze these startup metrics and output EXACTLY a JSON format. No conversational filler. Provide 3 tactical tasks and 2 risks.
Metrics: MRR: {req.mrr}, Burn Rate: {req.burn_rate}, Churn: {req.churn}.
SCHEMA for strict adherence: {{"risks": ["risk 1", "risk 2"], "tasks": ["task 1", "task 2", "task 3"]}}"""
        
        messages = [HumanMessage(content=prompt)]
        response = llm.invoke(messages)
        
        parsed = json.loads(response.content)
        return parsed
    except Exception as e:
        return JSONResponse({"error": f"Failed to parse JSON from AI: {str(e)}"}, status_code=500)

@app.post("/api/market-research")
async def market_research(req: GenericAgentRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return JSONResponse({"error": "GROQ_API_KEY missing."}, status_code=400)
    try:
        llm = ChatGroq(model_name="llama-3.1-8b-instant", groq_api_key=api_key)
        prompt = f"Based on this startup brainstorm idea: '{req.context}', deduce the specific market niche and conduct a market analysis. Output your findings strictly in Markdown. Include TAM, Target Demographic, and 3 Key Industry Trends."
        res = llm.invoke([HumanMessage(content=prompt)])
        return {"report": res.content}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/gtm-agent")
async def gtm_agent(req: GTMRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return JSONResponse({"error": "GROQ_API_KEY missing."}, status_code=400)
    try:
        llm = ChatGroq(model_name="llama-3.1-8b-instant", groq_api_key=api_key)
        prompt = f"Using this startup brainstorming context, generate an elite 4-Phase Go-To-Market execution plan. Output in beautiful Markdown.\nContext:\n{req.context}"
        res = llm.invoke([SystemMessage(content="You are an elite Growth Hacker."), HumanMessage(content=prompt)])
        return {"plan": res.content}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/competitors")
async def competitors_agent(req: CompetitorRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key: return JSONResponse({"error": "OPENAI_API_KEY missing."}, status_code=400)
    try:
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key, model_kwargs={"response_format": {"type": "json_object"}})
        prompt = f"""Based on this startup idea: '{req.context}', output exactly 3 competitors.
Format strictly as JSON: {{"competitors": [{{"name": "...", "target": "...", "share": "XX%", "pro": "...", "con": "..."}}]}}"""
        res = llm.invoke([HumanMessage(content=prompt)])
        return json.loads(res.content)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/health-agent")
async def health_agent(req: GenericAgentRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    try:
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key, model_kwargs={"response_format": {"type": "json_object"}})
        res = llm.invoke([HumanMessage(content='Generate mock JSON for server health. Schema: {"uptime": "99.9%", "latency": "42ms", "deployments": ["v1.2", "v1.3"]}')])
        return json.loads(res.content)
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/resource-agent")
async def resource_agent(req: GenericAgentRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    try:
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key, model_kwargs={"response_format": {"type": "json_object"}})
        res = llm.invoke([HumanMessage(content='Generate mock JSON: {"frontend": "40%", "backend": "30%", "ai": "30%"}')])
        return json.loads(res.content)
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/funnel-agent")
async def funnel_agent(req: GenericAgentRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    try:
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key, model_kwargs={"response_format": {"type": "json_object"}})
        res = llm.invoke([HumanMessage(content='Generate mock JSON: {"landing": "1000", "signup": "300", "paid": "50"}')])
        return json.loads(res.content)
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/investor-agent")
async def investor_agent(req: GenericAgentRequest):
    api_key = os.getenv("GROQ_API_KEY")
    try:
        llm = ChatGroq(model_name="llama-3.1-8b-instant", groq_api_key=api_key)
        res = llm.invoke([HumanMessage(content=f"Draft a short, generic but engaging quarterly investor update email for a startup. Output ONLY Markdown.")])
        return {"report": res.content}
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/billing-agent")
async def billing_agent(req: GenericAgentRequest):
    return {"mrr": "$12,450", "invoices": "24 Paid"}

@app.post("/api/audit-agent")
async def audit_agent(req: GenericAgentRequest):
    return {"events": ["Admin Login from IP 1.2.3.4", "Stripe key rotated", "DB Backed up"]}

# Serve Frontend static files
@app.get("/")
async def read_index():
    return FileResponse('index.html')

app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
