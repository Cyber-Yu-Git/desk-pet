export const EventNames = {
  PetStateChange: 'pet.state.change',
  ChatMessageSent: 'chat.message.sent',
  ChatMessageReceived: 'chat.message.received',
  TodoCreated: 'todo.created',
  TodoCompleted: 'todo.completed',
  TodoDue: 'todo.due',
  ReminderSnoozed: 'reminder.snoozed',
  AgentStarted: 'agent.started',
  AgentRunning: 'agent.running',
  AgentWaitingPermission: 'agent.waiting_permission',
  AgentCompleted: 'agent.completed',
  AgentFailed: 'agent.failed',
  AgentIdleTooLong: 'agent.idle_too_long',
  MemoryCreated: 'memory.created',
  ShareRequested: 'share.requested',
  ShareGenerated: 'share.generated',
  SettingsUpdated: 'settings.updated'
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];
