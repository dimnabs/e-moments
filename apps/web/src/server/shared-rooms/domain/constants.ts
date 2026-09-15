export const SHARED_ROOM = {
  captureCount: 4,
  captureLeadMilliseconds: 3_000,
  captureIntervalMilliseconds: 5_000,
  captureUploadGraceMilliseconds: 90_000,
  inviteLifetimeMilliseconds: 2 * 60 * 60 * 1_000,
  lobbyInactivityMilliseconds: 30 * 60 * 1_000,
  maximumRooms: 12,
  maximumSseConnectionsPerParticipant: 2,
  maximumJsonBytes: 16 * 1024,
  maximumMultipartBytes: 6 * 1024 * 1024 + 128 * 1024,
  creationRateLimit: { attempts: 8, windowMilliseconds: 60 * 60 * 1_000 },
  uploadRateLimit: { attempts: 16, windowMilliseconds: 60 * 1_000 },
} as const;
