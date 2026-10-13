
type StatusType = "waiting" | "success" | "error" | "info";

interface StatusMessageProps {
  status: StatusType;
  message: string;
}

export default function StatusMessage({
  status,
  message,
}: StatusMessageProps) {
  return (
    <div className={`status-message status-${status}`}>
      <span className="status-indicator" />
      <p>{message}</p>
    </div>
  );
}
