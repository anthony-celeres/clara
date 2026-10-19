'use client';

import React from 'react';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  text: string;
}

export default function ChatBubble({ role, text }: ChatBubbleProps) {
  const isUser = role === 'user';

  // Basic formatter to support markdown-like bold (**text**) and bullet lists
  const formatMessageText = (rawText: string) => {
    if (!rawText) return '';
    
    // Split by lines
    const lines = rawText.split('\n');
    return lines.map((line, lineIndex) => {
      let content: React.ReactNode = line;

      // Handle bullet lists: line starting with "- " or "* "
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
      if (isBullet) {
        const bulletContent = line.replace(/^[-*]\s+/, '');
        content = (
          <li key={lineIndex} className="list-disc ml-5 mb-1 text-sm md:text-base leading-relaxed">
            {parseBoldText(bulletContent)}
          </li>
        );
      } else {
        content = (
          <p key={lineIndex} className="mb-1.5 last:mb-0 text-sm md:text-base leading-relaxed">
            {parseBoldText(line)}
          </p>
        );
      }

      return content;
    });
  };

  const parseBoldText = (textChunk: string) => {
    // Regex split on **
    const parts = textChunk.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, index) => {
      // Odd indexes are the bolded matches
      if (index % 2 === 1) {
        return <strong key={index} className="font-bold">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div
      className={`message max-w-[75%] px-[18px] py-[14px] rounded-[18px] text-[16px] leading-[24px] select-text animate-message
        ${isUser 
          ? 'self-end bg-[var(--user-bubble-bg)] text-[var(--user-bubble-text)] rounded-br-[4px]' 
          : 'self-start bg-[var(--bot-bubble-bg)] text-[var(--bot-bubble-text)] rounded-bl-[4px]'
        }`}
    >
      <div className="flex flex-col">{formatMessageText(text)}</div>
    </div>
  );
}
