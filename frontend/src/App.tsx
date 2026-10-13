
import { useRef, useState } from "react";
import type { MutableRefObject } from "react";
import StatusMessage from "./component/StatusMessage";
import "./App.css";

type MessageStatus = "waiting" | "success" | "error" | "info";

interface ServerMessage {
  type: string;
  status: MessageStatus;
  message: string;
}

interface LogEntry {
  id: number;
  player: string;
  message: string;
  status: MessageStatus;
}

interface PlayerPanelProps {
  title: string;
  playerName: string;
  onNameChange: (name: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  connected: boolean;
}

function PlayerPanel({
  title,
  playerName,
  onNameChange,
  onConnect,
  onDisconnect,
  connected,
}: PlayerPanelProps) {
  return (
    <article className="player-panel">
      <div className="player-panel-header">
        <div>
          <span className="player-label">{title}</span>
          <h2>Connection</h2>
        </div>

        <span
          className={`connection-indicator ${
            connected ? "is-connected" : "is-disconnected"
          }`}
        >
          <span className="indicator-dot" />
          {connected ? "Connected" : "Offline"}
        </span>
      </div>

      <label className="input-label" htmlFor={`${title}-name`}>
        Player name
      </label>

      <input
        id={`${title}-name`}
        type="text"
        placeholder="Enter player name"
        value={playerName}
        onChange={(event) => onNameChange(event.target.value)}
        disabled={connected}
      />

      <div className="button-group">
        <button
          className="connect-button"
          type="button"
          onClick={onConnect}
          disabled={connected || !playerName.trim()}
        >
          Connect
        </button>

        <button
          className="disconnect-button"
          type="button"
          onClick={onDisconnect}
          disabled={!connected}
        >
          Disconnect
        </button>
      </div>
    </article>
  );
}

function App() {
  const player1 = useRef<WebSocket | null>(null);
  const player2 = useRef<WebSocket | null>(null);

  const [player1Name, setPlayer1Name] = useState("Player 1");
  const [player2Name, setPlayer2Name] = useState("Player 2");

  const [player1Connected, setPlayer1Connected] = useState(false);
  const [player2Connected, setPlayer2Connected] = useState(false);

  const [serverMessage, setServerMessage] = useState<ServerMessage>({
    type: "info",
    status: "info",
    message: "Connect a player to start.",
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);

  function addLog(
    player: string,
    message: string,
    status: MessageStatus = "info",
  ) {
    setLogs((previous) => [
      {
        id: Date.now() + Math.random(),
        player,
        message,
        status,
      },
      ...previous,
    ]);
  }

  function connectPlayer(
    playerName: string,
    socketRef: MutableRefObject<WebSocket | null>,
    setConnected: (connected: boolean) => void,
  ) {
    const name = playerName.trim();

    if (!name) {
      setServerMessage({
        type: "error",
        status: "error",
        message: "Player name cannot be empty.",
      });
      return;
    }

    const existingSocket = socketRef.current;

    if (
      existingSocket &&
      (existingSocket.readyState === WebSocket.OPEN ||
        existingSocket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // WebSocket endpoint. HTTP endpoint tetap tidak diubah.
    const socket = new WebSocket("ws://127.0.0.1:8000/ws");
    socketRef.current = socket;

    setServerMessage({
      type: "info",
      status: "waiting",
      message: `${name} is connecting to the server...`,
    });

    addLog(name, "Connecting to server.", "waiting");

    socket.onopen = () => {
      setConnected(true);

      setServerMessage({
        type: "success",
        status: "success",
        message: `${name} connected to the server.`,
      });

      addLog(name, "WebSocket connection established.", "success");
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      let message: ServerMessage;

      try {
        const parsed: unknown = JSON.parse(event.data);

        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "message" in parsed
        ) {
          const data = parsed as Record<string, unknown>;

          const status: MessageStatus =
            data.status === "waiting" ||
            data.status === "success" ||
            data.status === "error" ||
            data.status === "info"
              ? data.status
              : "info";

          message = {
            type: typeof data.type === "string" ? data.type : "message",
            status,
            message:
              typeof data.message === "string"
                ? data.message
                : event.data,
          };
        } else {
          message = {
            type: "message",
            status: "info",
            message: event.data,
          };
        }
      } catch {
        message = {
          type: "message",
          status: "info",
          message: event.data,
        };
      }

      setServerMessage(message);
      addLog(name, message.message, message.status);
    };

    socket.onerror = () => {
      setServerMessage({
        type: "error",
        status: "error",
        message: `WebSocket error for ${name}. Check the backend server.`,
      });

      addLog(name, "WebSocket error.", "error");
    };

    socket.onclose = (event: CloseEvent) => {
      if (socketRef.current === socket) {
        socketRef.current = null;
        setConnected(false);

        setServerMessage({
          type: event.code === 1000 ? "info" : "error",
          status: event.code === 1000 ? "info" : "error",
          message:
            event.code === 1000
              ? `${name} disconnected.`
              : `${name}'s connection closed (code ${event.code}).`,
        });
      }

      addLog(
        name,
        `Connection closed (code ${event.code}).`,
        event.code === 1000 ? "info" : "error",
      );
    };
  }

  function disconnectPlayer(
    playerName: string,
    socketRef: MutableRefObject<WebSocket | null>,
  ) {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close(1000, "Disconnected by user");
    }

    socketRef.current = null;
    addLog(playerName, "Disconnect requested.", "info");
  }

  return (
    <main className="app-container">
      <header className="page-header">
        <div>
          <span className="eyebrow">MULTIPLAYER QUIZ</span>
          <h1>Kuwizz</h1>
          <p>
            Beat your friends in your field.
          </p>
        </div>
      </header>

      
<section className="quiz-hero">
  <div className="quiz-hero-content">
    <span className="eyebrow">READY TO PLAY?</span>
    <h2>Apantatt?</h2>
    <p>
      Connect with another player and get ready to challenge
      each other in a multiplayer quiz.
    </p>

    <div className="quiz-hero-tags">
      <span>✦ Multiplayer</span>
      <span>◷ Real-time</span>
    </div>
  </div>

  <div className="quiz-visual" aria-hidden="true">
    <div className="quiz-decor decor-one">✦</div>
    <div className="quiz-decor decor-two">?</div>

    <div className="quiz-card quiz-card-back">
      <div className="quiz-card-top">
        <span>QUIZ TIME</span>
        <span>✦</span>
      </div>
      <div className="quiz-card-lines">
        <span />
        <span />
      </div>
      <div className="quiz-card-skeleton">
        <span />
        <span />
        <span />
      </div>
    </div>

    <div className="quiz-card quiz-card-front">
      <div className="quiz-card-top">
        <span className="quiz-icon">?</span>
        <span className="quiz-category">QUICK QUIZ</span>
      </div>

      <h3>Ready for a challenge?</h3>
      <p>Choose your answer</p>

      <div className="quiz-answer answer-selected">
        <span>A</span>
        <span>Knowledge</span>
        <span>✓</span>
      </div>

      <div className="quiz-answer">
        <span>B</span>
        <span>Strategy</span>
      </div>
    </div>

    <div className="quiz-score-card">
      <span className="score-star">★</span>
      <div>
        <strong>+100 XP</strong>
        <span>Great answer!</span>
      </div>
    </div>
  </div>
</section>


      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Players</h2>
            <p>Manage each player's connection.</p>
          </div>

          <span className="section-count">2 PLAYERS</span>
        </div>

        <div className="players-grid">
          <PlayerPanel
            title="Player 01"
            playerName={player1Name}
            onNameChange={setPlayer1Name}
            onConnect={() =>
              connectPlayer(
                player1Name,
                player1,
                setPlayer1Connected,
              )
            }
            onDisconnect={() =>
              disconnectPlayer("Player 1", player1)
            }
            connected={player1Connected}
          />

          <PlayerPanel
            title="Player 02"
            playerName={player2Name}
            onNameChange={setPlayer2Name}
            onConnect={() =>
              connectPlayer(
                player2Name,
                player2,
                setPlayer2Connected,
              )
            }
            onDisconnect={() =>
              disconnectPlayer("Player 2", player2)
            }
            connected={player2Connected}
          />
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Server Status</h2>
            <p>Latest connection status or backend message.</p>
          </div>
        </div>

        <div className="status-container">
          <StatusMessage
            status={serverMessage.status}
            message={serverMessage.message}
          />
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Activity Log</h2>
            <p>Recent connection events and received messages.</p>
          </div>

          <button
            className="clear-log-button"
            type="button"
            onClick={() => setLogs([])}
          >
            Clear logs
          </button>
        </div>

        <div className="activity-card">
          {logs.length === 0 ? (
            <div className="empty-state">
              <strong>No activity yet</strong>
              <p>Connection events will appear here.</p>
            </div>
          ) : (
            <div className="activity-list">
              {logs.map((log) => (
                <div className="activity-row" key={log.id}>
                  <span
                    className={`activity-indicator status-${log.status}`}
                  />

                  <div className="activity-details">
                    <strong>{log.player}</strong>
                    <span>{log.message}</span>
                  </div>

                  <span
                    className={`activity-tag status-${log.status}`}
                  >
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
