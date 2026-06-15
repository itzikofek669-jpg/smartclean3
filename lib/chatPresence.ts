// מעקב אחרי הצ'אט הפעיל כרגע (פתוח על המסך) —
// כדי לא להקפיץ פופ-אפ "הודעה חדשה" כשהמשתמש כבר נמצא באותו צ'אט.
let activeChatId: string | null = null;

export function setActiveChat(id: string | null) {
  activeChatId = id || null;
}

export function getActiveChat(): string | null {
  return activeChatId;
}
