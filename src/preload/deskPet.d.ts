import type { DeskPetApi } from './index';

declare global {
  interface Window {
    deskPet: DeskPetApi;
  }
}

export {};
