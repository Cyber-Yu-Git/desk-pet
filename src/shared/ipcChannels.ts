export const IpcChannels = {
  AppGetVersion: 'app:get-version',
  AppQuit: 'app:quit',
  PetSetState: 'pet:set-state',
  ChatGetHistory: 'chat:get-history',
  ChatSendMessage: 'chat:send-message',
  TodoCreate: 'todo:create',
  TodoList: 'todo:list',
  TodoComplete: 'todo:complete',
  TodoDelete: 'todo:delete',
  ReminderList: 'reminder:list',
  ReminderSnooze: 'reminder:snooze',
  AgentGetStatus: 'agent:get-status',
  AgentGetHistory: 'agent:get-history',
  MemoryList: 'memory:list',
  MemoryCreate: 'memory:create',
  MemoryDelete: 'memory:delete',
  SharePreview: 'share:preview',
  ShareGenerate: 'share:generate',
  SettingsGetPetConfig: 'settings:get-pet-config',
  SettingsUpdatePetConfig: 'settings:update-pet-config',
  SettingsGetNotificationConfig: 'settings:get-notification-config',
  SettingsUpdateNotificationConfig: 'settings:update-notification-config'
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
