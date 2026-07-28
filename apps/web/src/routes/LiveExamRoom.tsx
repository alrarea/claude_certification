import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { connectLiveExamSocket, type LiveExamEvent, type LiveExamSocketStatus } from "../lib/liveExamSocket";
import { AppShell } from "../components/AppShell";
import { FullPageLoader } from "../components/FullPageLoader";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";

type Phase = "lobby" | "question" | "reveal" | "completed" | "cancelled";

interface RoomOption {
  id: string;
  optionText: string;
  isCorrect?: boolean;
  explanation?: string;
}

interface RoomQuestion {
  questionId: string;
  questionText: string;
  difficulty: string;
  options: RoomOption[];
}

interface RoomState {
  certificationName: string;
  difficulty: string;
  phase: Phase;
  currentIndex: number;
  totalQuestions: number;
  phaseStartedAt: string | null;
  answerSeconds: number;
  revealSeconds: number;
  isHost: boolean;
  joined: boolean;
  currentQuestion: RoomQuestion | null;
  myAnswer: { selectedOptionId: string | null; isCorrect: boolean | null } | null;
  progress: { answeredCount: number; totalParticipants: number } | null;
  roster: { userId: string; name: string }[];
}

interface Results {
  scorePct: number;
  answeredCorrect: number;
  totalQuestions: number;
  byTopic: { title: string; correct: number; total: number }[];
  byDifficulty: { difficulty: string; correct: number; total: number }[];
}

export function LiveExamRoom() {
  const { id = "" } = useParams();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socketStatus, setSocketStatus] = useState<LiveExamSocketStatus>("connecting");
  const [now, setNow] = useState(() => Date.now());
  const [results, setResults] = useState<Results | null>(null);
  const [answering, setAnswering] = useState(false);
  const advancedRef = useRef<string>("");

  async function loadSnapshot() {
    try {
      const data = await apiFetch(`/live-exams/${id}`);
      if (!data.isHost && !data.joined && data.phase !== "completed" && data.phase !== "cancelled") {
        await apiFetch(`/live-exams/${id}/join`, { method: "POST" });
        const refreshed = await apiFetch(`/live-exams/${id}`);
        setRoom(refreshed);
      } else {
        setRoom(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live exam");
    }
  }

  useEffect(() => {
    loadSnapshot();
    const socket = connectLiveExamSocket(
      id,
      (event: LiveExamEvent) => {
        setRoom((prev) => {
          if (!prev) return prev;
          switch (event.type) {
            case "roster":
              return { ...prev, roster: event.roster as RoomState["roster"] };
            case "progress":
              return {
                ...prev,
                progress: { answeredCount: event.answeredCount as number, totalParticipants: event.totalParticipants as number },
              };
            case "question": {
              const q = event.question as RoomQuestion;
              return {
                ...prev,
                phase: "question",
                currentIndex: event.index as number,
                totalQuestions: event.total as number,
                phaseStartedAt: event.phaseStartedAt as string,
                answerSeconds: event.answerSeconds as number,
                currentQuestion: { ...q, options: q.options.map((o) => ({ id: o.id, optionText: o.optionText })) },
                myAnswer: null,
                progress: { answeredCount: 0, totalParticipants: prev.roster.length },
              };
            }
            case "reveal": {
              const correctOptionId = event.correctOptionId as string;
              const explanations = event.explanations as Record<string, string>;
              return {
                ...prev,
                phase: "reveal",
                phaseStartedAt: event.phaseStartedAt as string,
                revealSeconds: event.revealSeconds as number,
                currentQuestion: prev.currentQuestion
                  ? {
                      ...prev.currentQuestion,
                      options: prev.currentQuestion.options.map((o) => ({
                        ...o,
                        isCorrect: o.id === correctOptionId,
                        explanation: explanations[o.id],
                      })),
                    }
                  : null,
              };
            }
            case "completed":
              return { ...prev, phase: "completed" };
            case "cancelled":
              return { ...prev, phase: "cancelled" };
            default:
              return prev;
          }
        });
      },
      (status) => {
        setSocketStatus(status);
        if (status === "open") loadSnapshot();
      }
    );

    const tickTimer = setInterval(() => setNow(Date.now()), 250);
    return () => {
      socket.close();
      clearInterval(tickTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (room?.phase === "completed" && room.joined && !results) {
      apiFetch(`/live-exams/${id}/results`)
        .then(setResults)
        .catch(() => {});
    }
  }, [room?.phase, room?.joined, id, results]);

  // Every connected client (host included) independently notices its own
  // countdown hit zero and calls the shared advance endpoint - a conditional
  // update server-side means only the first caller actually transitions.
  useEffect(() => {
    if (!room?.phaseStartedAt) return;
    const durationSec = room.phase === "question" ? room.answerSeconds : room.phase === "reveal" ? room.revealSeconds : null;
    if (durationSec == null) return;

    const deadline = new Date(room.phaseStartedAt).getTime() + durationSec * 1000;
    const key = `${room.phase}-${room.currentIndex}`;
    if (now >= deadline && advancedRef.current !== key) {
      advancedRef.current = key;
      const endpoint = room.phase === "question" ? "reveal" : "next";
      apiFetch(`/live-exams/${id}/${endpoint}`, { method: "POST" }).catch(() => {});
    }
  }, [now, room, id]);

  async function submitAnswer(optionId: string) {
    if (!room?.currentQuestion) return;
    setAnswering(true);
    try {
      await apiFetch(`/live-exams/${id}/questions/${room.currentQuestion.questionId}/answer`, {
        method: "POST",
        body: JSON.stringify({ selectedOptionId: optionId }),
      });
      setRoom((prev) => (prev ? { ...prev, myAnswer: { selectedOptionId: optionId, isCorrect: null } } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answer");
    } finally {
      setAnswering(false);
    }
  }

  async function startExam() {
    try {
      await apiFetch(`/live-exams/${id}/start`, { method: "POST" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    }
  }

  async function revealNow() {
    await apiFetch(`/live-exams/${id}/reveal`, { method: "POST" }).catch(() => {});
  }

  async function nextNow() {
    await apiFetch(`/live-exams/${id}/next`, { method: "POST" }).catch(() => {});
  }

  async function cancelExam() {
    await apiFetch(`/live-exams/${id}/cancel`, { method: "POST" }).catch(() => {});
  }

  if (error) {
    return (
      <AppShell maxWidth={700}>
        <Alert kind="error">{error}</Alert>
      </AppShell>
    );
  }
  if (!room) {
    return (
      <AppShell maxWidth={700}>
        <FullPageLoader label="Joining live exam..." />
      </AppShell>
    );
  }

  const durationSec = room.phase === "question" ? room.answerSeconds : room.phase === "reveal" ? room.revealSeconds : null;
  const deadline = room.phaseStartedAt && durationSec != null ? new Date(room.phaseStartedAt).getTime() + durationSec * 1000 : null;
  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const timeUp = deadline != null && now >= deadline;

  return (
    <AppShell maxWidth={700}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 24 }}>{room.certificationName} live exam</h1>
        {socketStatus !== "open" && (
          <span className="text-xs" style={{ color: "var(--color-ink-500)" }}>
            {socketStatus === "connecting" ? "Connecting..." : "Reconnecting..."}
          </span>
        )}
      </div>
      <p className="text-sm" style={{ color: "var(--color-ink-500)", marginBottom: 20, textTransform: "capitalize" }}>
        {room.difficulty} &middot; Question {Math.min(room.currentIndex + 1, room.totalQuestions)} of {room.totalQuestions}
      </p>

      {room.phase === "lobby" && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, marginBottom: 12 }}>Waiting for everyone to join</h2>
          <ul className="text-sm flex flex-col gap-1" style={{ marginBottom: 16 }}>
            {room.roster.map((p) => (
              <li key={p.userId}>{p.name}</li>
            ))}
          </ul>
          {room.isHost ? (
            <Button variant="clay" onClick={startExam} disabled={room.roster.length === 0}>
              Start exam
            </Button>
          ) : (
            <p className="text-sm">Waiting for the host to start...</p>
          )}
        </div>
      )}

      {(room.phase === "question" || room.phase === "reveal") && room.currentQuestion && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          {secondsLeft != null && (
            <p className="text-sm" style={{ color: "var(--color-clay)", marginBottom: 8 }}>
              {room.phase === "question" ? "Answer" : "Next question"} in {secondsLeft}s
            </p>
          )}
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>{room.currentQuestion.questionText}</h2>
          <div className="flex flex-col gap-3">
            {room.currentQuestion.options.map((o) => {
              const isSelected = room.myAnswer?.selectedOptionId === o.id;
              const revealed = room.phase === "reveal";
              const disabled = !room.joined || !!room.myAnswer || timeUp || revealed || answering;
              return (
                <div key={o.id}>
                  <button
                    onClick={() => !disabled && submitAnswer(o.id)}
                    disabled={disabled}
                    className="card"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "14px 18px",
                      cursor: disabled ? "default" : "pointer",
                      borderColor: isSelected ? "var(--color-ink)" : undefined,
                      background: revealed && o.isCorrect ? "var(--color-success-bg)" : "#fff",
                      fontSize: 15,
                    }}
                  >
                    {o.optionText}
                  </button>
                  {revealed && o.explanation && (
                    <p className="text-xs" style={{ color: "var(--color-ink-500)", marginLeft: 4, marginTop: 6 }}>
                      {o.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {room.isHost && room.phase === "question" && room.progress && (
            <div className="flex items-center justify-between" style={{ marginTop: 20 }}>
              <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>
                {room.progress.answeredCount}/{room.progress.totalParticipants} answered
              </span>
              <Button size="sm" variant="secondary" onClick={revealNow}>
                Reveal now
              </Button>
            </div>
          )}
          {room.isHost && room.phase === "reveal" && (
            <div className="flex items-center justify-end" style={{ marginTop: 20 }}>
              <Button size="sm" variant="secondary" onClick={nextNow}>
                Next now
              </Button>
            </div>
          )}
        </div>
      )}

      {room.phase === "completed" && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, marginBottom: 12 }}>Session complete</h2>
          {room.joined ? (
            results ? (
              <>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 40, color: "var(--color-clay)", marginBottom: 12 }}>
                  {results.scorePct}%
                </p>
                <p className="text-sm" style={{ marginBottom: 16 }}>
                  {results.answeredCorrect}/{results.totalQuestions} correct
                </p>
                <ul className="text-sm flex flex-col gap-2">
                  {results.byTopic.map((t) => (
                    <li key={t.title} className="flex items-center justify-between">
                      <span>{t.title}</span>
                      <span style={{ color: "var(--color-ink-500)" }}>
                        {t.correct}/{t.total}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <FullPageLoader label="Scoring..." />
            )
          ) : (
            <p className="text-sm">The host has ended this session.</p>
          )}
          <Link to="/exam/new" style={{ color: "var(--color-clay)", display: "inline-block", marginTop: 16 }}>
            &larr; Back to exams
          </Link>
        </div>
      )}

      {room.phase === "cancelled" && (
        <div className="card" style={{ padding: 24 }}>
          <p className="text-sm">This live exam was cancelled by the host.</p>
          <Link to="/exam/new" style={{ color: "var(--color-clay)", display: "inline-block", marginTop: 12 }}>
            &larr; Back to exams
          </Link>
        </div>
      )}

      {room.isHost && room.phase !== "completed" && room.phase !== "cancelled" && (
        <Button variant="ghost" size="sm" onClick={cancelExam}>
          Cancel session
        </Button>
      )}
    </AppShell>
  );
}
