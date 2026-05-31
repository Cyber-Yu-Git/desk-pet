import { useEffect, useState } from 'react';
import { EventNames } from '../../shared/eventNames';
import type { ChatMessage, PetEvent, PetState } from '../../shared/types';
import { PetCanvas } from './pet/PetCanvas';

const stateLabels: Record<PetState, string> = {
  idle: '待机',
  working: '工作中',
  reminding: '提醒',
  success: '完成',
  error: '出错',
  waiting: '等待',
  sleeping: '休息',
  sharing: '分享'
};

export function App(): React.JSX.Element {
  const [petState, setPetState] = useState<PetState>('idle');
  const [version, setVersion] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState('');

  useEffect(() => {
    void window.deskPet.app.getVersion().then(setVersion);
    void refreshChatHistory();

    const removePetListener = window.deskPet.events.onPetEvent((event: PetEvent) => {
      if (event.type === EventNames.PetStateChange) {
        setPetState(event.state);
      }
    });

    const removeQuitListener = window.deskPet.events.onQuitRequest(() => {
      void window.deskPet.app.quit();
    });

    return () => {
      removePetListener();
      removeQuitListener();
    };
  }, []);

  async function refreshChatHistory(): Promise<void> {
    const result = await window.deskPet.chat.getHistory();

    if (result.ok) {
      setMessages(result.data);
    }
  }

  async function sendMessage(): Promise<void> {
    if (isSending) {
      return;
    }

    const content = draft.trim();

    if (!content) {
      setChatError('先输入一句话。');
      return;
    }

    setDraft('');
    setIsSending(true);
    setChatError('');

    const result = await window.deskPet.chat.sendMessage({ content });

    if (result.ok) {
      setMessages(result.data.messages);
      setPetState('success');
    } else {
      setChatError(result.error.message);
      setPetState('error');
      await refreshChatHistory();
    }

    setIsSending(false);
  }

  return (
    <main className="pet-shell">
      <section className="pet-card" aria-label="赛博宇桌宠">
        <div className="pet-stage">
          <PetCanvas state={petState} />
        </div>
        <div className="pet-bubble">
          <strong>赛博宇</strong>
          <span>{stateLabels[petState]}</span>
        </div>
        <div className="pet-actions">
          <button type="button" onClick={() => setPetState('idle')}>
            待机
          </button>
          <button type="button" onClick={() => setPetState('working')}>
            工作
          </button>
          <button type="button" onClick={() => setPetState('success')}>
            完成
          </button>
        </div>
        <section className="chat-panel" aria-label="和赛博宇聊天">
          <div className="chat-messages">
            {messages.length === 0 ? (
              <p className="chat-empty">跟我说点什么，我会记住最近的聊天。</p>
            ) : (
              messages.slice(-6).map((message) => (
                <div className={`chat-message chat-message-${message.role}`} key={message.id}>
                  {message.content}
                </div>
              ))
            )}
          </div>
          {chatError ? <div className="chat-error">{chatError}</div> : null}
          <form
            className="chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <input
              aria-label="聊天输入"
              disabled={isSending}
              maxLength={4000}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="问我一句..."
              value={draft}
            />
            <button disabled={isSending} type="submit">
              {isSending ? '...' : '发送'}
            </button>
          </form>
        </section>
        <small className="version">v{version || '0.1.0'}</small>
      </section>
    </main>
  );
}
