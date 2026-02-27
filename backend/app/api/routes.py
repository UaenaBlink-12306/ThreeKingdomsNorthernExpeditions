from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.assistant import DeepSeekConfigError, GameAssistantService
from app.engine.runtime import GameEngine
from app.models.chat import ChatRequest, ChatResponse
from app.models.requests import ActRequest, NewGameRequest, ResetRequest
from app.models.state import GameState
from app.models.telemetry import ReplayView

router = APIRouter(tags=["game"])
engine = GameEngine()
assistant = GameAssistantService()


@router.post("/new_game", response_model=GameState)
def new_game(req: NewGameRequest) -> GameState:
    return engine.new_game(game_id=req.game_id, seed=req.seed)


@router.get("/state", response_model=GameState)
def get_state(game_id: str = Query(...)) -> GameState:
    try:
        return engine.get_state(game_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/act", response_model=GameState)
def act(req: ActRequest) -> GameState:
    try:
        return engine.act(req.game_id, req.action, req.payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/replay", response_model=ReplayView)
def get_replay(game_id: str = Query(...)) -> ReplayView:
    try:
        data = engine.get_replay(game_id)
        return ReplayView.model_validate(data)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/reset")
def reset(req: ResetRequest) -> dict[str, str]:
    engine.reset(req.game_id)
    return {"status": "ok"}


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    try:
        return assistant.reply(req)
    except DeepSeekConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
