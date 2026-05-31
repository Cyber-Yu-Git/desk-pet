import type { NotificationConfig, PetConfig } from './types';

export const defaultPetConfig: PetConfig = {
  petName: '赛博宇',
  userName: '你',
  alwaysOnTop: true,
  doNotDisturb: false
};

export const defaultNotificationConfig: NotificationConfig = {
  enabled: true,
  soundEnabled: false
};

export const chatHistoryLimit = 200;

export const chatSystemPrompt =
  '你是“赛博宇的桌面AI宠物”，一个陪伴用户使用 AI 工具、管理待办和保持工作流顺畅的中文桌面伙伴。回答要简洁、温暖、可执行。';
