export type SharedRoomErrorCode =
  | "INVALID_ROOM_REQUEST"
  | "INVALID_PARTICIPANT_CREDENTIAL"
  | "ROOM_NOT_FOUND"
  | "ROOM_EXPIRED"
  | "ROOM_FULL"
  | "ROOM_STATE_CONFLICT"
  | "HOST_REQUIRED"
  | "CAPTURE_WINDOW_CLOSED"
  | "RATE_LIMITED"
  | "ROOM_CAPACITY_REACHED";

export class SharedRoomError extends Error {
  constructor(
    message: string,
    readonly code: SharedRoomErrorCode,
    readonly status: number,
  ) {
    super(message);
  }
}
