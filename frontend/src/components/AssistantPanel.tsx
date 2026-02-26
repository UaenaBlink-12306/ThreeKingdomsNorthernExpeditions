import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { chatAssistant } from "../api";
import type { DiffSummary } from "../utils/diff";
import { computeLogDelta } from "../utils/logDelta";
import type { ChatMode, GameState } from "../types";
import { reportConsoleError } from "../utils/errorLogger";

type ConversationRole = "user" | "assistant";

interface ConversationMessage {
  role: ConversationRole;
  content: string;
}

interface AssistantPanelProps {
  state: GameState;
  prevState: GameState | null;
  summary: DiffSummary;
}

type LoadingState = Record<ChatMode, boolean>;

const INITIAL_LOADING: LoadingState = {
  preturn_advisor: false,
  afterturn_interpreter: false,
  scenario_mentor: false,
  roleplay: false,
};

function formatError(mode: ChatMode, err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `[AI助理:${mode}] ${detail}`;
}

export default function AssistantPanel({ state, prevState, summary }: AssistantPanelProps) {
  const [loading, setLoading] = useState<LoadingState>(INITIAL_LOADING);
  const [error, setError] = useState("");
  const [advisorText, setAdvisorText] = useState("暂无建议。");
  const [interpreterText, setInterpreterText] = useState("暂无解读。");
  const [mentorInput, setMentorInput] = useState("");
  const [mentorMessages, setMentorMessages] = useState<ConversationMessage[]>([]);
  const [roleplayCharacter, setRoleplayCharacter] = useState("前线统帅");
  const [roleplayInput, setRoleplayInput] = useState("");
  const [roleplayMessages, setRoleplayMessages] = useState<ConversationMessage[]>([]);

  const lastAdvisorKey = useRef("");
  const lastInterpreterKey = useRef("");

  const deltaLog = useMemo(
    () => computeLogDelta(prevState?.log ?? [], state.log),
    [prevState?.log, state.log]
  );

  async function requestAssistant(
    mode: ChatMode,
    options?: { userMessage?: string; roleplayCharacter?: string }
  ): Promise<string | null> {
    setLoading((current) => ({ ...current, [mode]: true }));
    setError("");
    try {
      const response = await chatAssistant({
        mode,
        game_state: state,
        previous_state: prevState,
        delta_summary: summary.lines,
        delta_log: deltaLog,
        user_message: options?.userMessage,
        roleplay_character: options?.roleplayCharacter,
      });
      return response.content;
    } catch (err) {
      reportConsoleError("assistant.request_failed", err, {
        mode,
        gameId: state.game_id,
        turn: state.turn,
        nodeId: state.current_node_id,
      });
      setError(formatError(mode, err));
      return null;
    } finally {
      setLoading((current) => ({ ...current, [mode]: false }));
    }
  }

  useEffect(() => {
    if (state.outcome !== "ONGOING") {
      return;
    }
    const nextKey = [
      state.game_id,
      state.turn,
      state.current_node_id,
      state.phase,
      state.current_event.options.map((option) => option.id).join(","),
    ].join("|");
    if (lastAdvisorKey.current === nextKey) {
      return;
    }
    lastAdvisorKey.current = nextKey;

    void (async () => {
      const content = await requestAssistant("preturn_advisor");
      if (content) {
        setAdvisorText(content);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.game_id, state.turn, state.current_node_id, state.phase, state.outcome, state.current_event.options]);

  useEffect(() => {
    if (!prevState) {
      return;
    }
    const nextKey = [state.game_id, prevState.turn, state.turn, state.current_node_id, state.log.length].join("|");
    if (lastInterpreterKey.current === nextKey) {
      return;
    }
    lastInterpreterKey.current = nextKey;

    void (async () => {
      const content = await requestAssistant("afterturn_interpreter");
      if (content) {
        setInterpreterText(content);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevState, state.game_id, state.turn, state.current_node_id, state.log.length]);

  async function refreshAdvisor() {
    const content = await requestAssistant("preturn_advisor");
    if (content) {
      setAdvisorText(content);
    }
  }

  async function refreshInterpreter() {
    const content = await requestAssistant("afterturn_interpreter");
    if (content) {
      setInterpreterText(content);
    }
  }

  async function onMentorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = mentorInput.trim();
    if (!prompt) {
      return;
    }
    setMentorMessages((current) => [...current, { role: "user", content: prompt }]);
    setMentorInput("");
    const content = await requestAssistant("scenario_mentor", { userMessage: prompt });
    if (content) {
      setMentorMessages((current) => [...current, { role: "assistant", content }]);
    }
  }

  async function onRoleplaySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = roleplayInput.trim();
    if (!prompt) {
      return;
    }
    setRoleplayMessages((current) => [...current, { role: "user", content: prompt }]);
    setRoleplayInput("");
    const content = await requestAssistant("roleplay", {
      userMessage: prompt,
      roleplayCharacter,
    });
    if (content) {
      setRoleplayMessages((current) => [...current, { role: "assistant", content }]);
    }
  }

  return (
    <section className="panel assistant-panel">
      <header className="assistant-header">
        <h2>AI 军议台</h2>
        <small>DeepSeek 驱动的参谋与导师</small>
      </header>

      {error ? <p className="assistant-error">{error}</p> : null}

      <div className="assistant-grid">
        <section className="assistant-card">
          <div className="assistant-card-header">
            <h3>回合前参谋</h3>
            <button type="button" disabled={loading.preturn_advisor} onClick={() => void refreshAdvisor()}>
              {loading.preturn_advisor ? "分析中..." : "刷新"}
            </button>
          </div>
          <p className="assistant-output">{advisorText}</p>
        </section>

        <section className="assistant-card">
          <div className="assistant-card-header">
            <h3>回合后解读</h3>
            <button
              type="button"
              disabled={loading.afterturn_interpreter || !prevState}
              onClick={() => void refreshInterpreter()}
            >
              {loading.afterturn_interpreter ? "分析中..." : "刷新"}
            </button>
          </div>
          <p className="assistant-output">{interpreterText}</p>
        </section>
      </div>

      <div className="assistant-grid">
        <section className="assistant-card">
          <h3>新手导师</h3>
          <div className="assistant-conversation">
            {mentorMessages.length < 1 ? <p className="assistant-placeholder">可提问属性含义、胜负条件或战术选择。</p> : null}
            {mentorMessages.map((message, index) => (
              <p key={`mentor-${index}`} className={message.role === "assistant" ? "assistant-message" : "user-message"}>
                {message.content}
              </p>
            ))}
          </div>
          <form className="assistant-form" onSubmit={(event) => void onMentorSubmit(event)}>
            <input
              type="text"
              value={mentorInput}
              onChange={(event) => setMentorInput(event.target.value)}
              placeholder="例如：这里的 Doom 在机制上代表什么？"
            />
            <button type="submit" disabled={loading.scenario_mentor}>
              {loading.scenario_mentor ? "发送中..." : "提问"}
            </button>
          </form>
        </section>

        <section className="assistant-card">
          <h3>角色对话</h3>
          <div className="assistant-roleplay-tools">
            <label htmlFor="roleplay-character">角色</label>
            <select
              id="roleplay-character"
              value={roleplayCharacter}
              onChange={(event) => setRoleplayCharacter(event.target.value)}
            >
              <option value="前线统帅">前线统帅</option>
              <option value="朝堂谋士">朝堂谋士</option>
            </select>
          </div>
          <div className="assistant-conversation">
            {roleplayMessages.length < 1 ? <p className="assistant-placeholder">可用角色口吻咨询当下局势。</p> : null}
            {roleplayMessages.map((message, index) => (
              <p key={`roleplay-${index}`} className={message.role === "assistant" ? "assistant-message" : "user-message"}>
                {message.content}
              </p>
            ))}
          </div>
          <form className="assistant-form" onSubmit={(event) => void onRoleplaySubmit(event)}>
            <input
              type="text"
              value={roleplayInput}
              onChange={(event) => setRoleplayInput(event.target.value)}
              placeholder="例如：眼下应先稳陇右还是先压 Doom？"
            />
            <button type="submit" disabled={loading.roleplay}>
              {loading.roleplay ? "发送中..." : "发言"}
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}
