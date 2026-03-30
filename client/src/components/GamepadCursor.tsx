import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { type AppSection, type GamepadButtonEvents, BOTTOM_NAV_SECTIONS, useGamepad } from '../hooks/useGamepad';
import { useGamepadStore } from '../lib/stores/useGamepadStore';
import { dpadNavigate, clickFocused, getGamepadFocused, initFromCursor, clearGamepadFocus, closeTopModal } from '../lib/dpadNav';

interface GamepadCursorProps {
  onNavigate: (section: AppSection) => void;
}

export function GamepadCursor({ onNavigate }: GamepadCursorProps) {
  const navSection = useGamepadStore(s => s.navSection);
  const primaryAction = useGamepadStore(s => s.primaryAction);

  const cursorXRef = useRef(0);
  const cursorYRef = useRef(0);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const events: GamepadButtonEvents = {
    onButtonA: () => {
      if (clickFocused()) {
        console.log('[Gamepad] A pressed — click on focused element');
        return;
      }
      const x = cursorXRef.current;
      const y = cursorYRef.current;
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (el) {
        console.log('[Gamepad] A pressed — click on cursor pos', el.tagName, el.className?.slice?.(0, 40));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    },
    onButtonB: () => {
      clearGamepadFocus();
      // Try to close the topmost visible modal first; fall back to Escape
      if (!closeTopModal()) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      console.log('[Gamepad] B pressed — close modal / ESC');
    },
    onLB: () => {
      clearGamepadFocus();
      const idx = BOTTOM_NAV_SECTIONS.indexOf(navSection);
      const next = BOTTOM_NAV_SECTIONS[(idx - 1 + BOTTOM_NAV_SECTIONS.length) % BOTTOM_NAV_SECTIONS.length];
      console.log('[Gamepad] LB — navigate to', next);
      onNavigateRef.current(next);
    },
    onRB: () => {
      clearGamepadFocus();
      const idx = BOTTOM_NAV_SECTIONS.indexOf(navSection);
      const next = BOTTOM_NAV_SECTIONS[(idx + 1) % BOTTOM_NAV_SECTIONS.length];
      console.log('[Gamepad] RB — navigate to', next);
      onNavigateRef.current(next);
    },
    onStart: () => {
      const action = useGamepadStore.getState().primaryAction;
      if (action) {
        console.log('[Gamepad] Start pressed — primary action');
        action();
      }
    },
    onDpadLeft: () => {
      if (!getGamepadFocused()) initFromCursor(cursorXRef.current, cursorYRef.current);
      dpadNavigate('left');
      console.log('[Gamepad] D-pad left → spatial nav');
    },
    onDpadRight: () => {
      if (!getGamepadFocused()) initFromCursor(cursorXRef.current, cursorYRef.current);
      dpadNavigate('right');
      console.log('[Gamepad] D-pad right → spatial nav');
    },
    onDpadUp: () => {
      if (!getGamepadFocused()) initFromCursor(cursorXRef.current, cursorYRef.current);
      dpadNavigate('up');
      console.log('[Gamepad] D-pad up → spatial nav');
    },
    onDpadDown: () => {
      if (!getGamepadFocused()) initFromCursor(cursorXRef.current, cursorYRef.current);
      dpadNavigate('down');
      console.log('[Gamepad] D-pad down → spatial nav');
    },
  };

  const { connected, cursorX, cursorY, cursorVisible, mode } = useGamepad({
    currentSection: navSection,
    events,
  });

  cursorXRef.current = cursorX;
  cursorYRef.current = cursorY;

  const modeLabel = mode === 'cursor' ? 'cursore' : 'gioco';
  const modeColor = mode === 'cursor' ? '#a855f7' : '#22c55e';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {cursorVisible && (
        <div
          style={{
            position: 'fixed',
            left: cursorX,
            top: cursorY,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 2147483647,
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.9)) drop-shadow(0 2px 6px rgba(0,0,0,0.8))' }}
          >
            <circle cx="14" cy="14" r="10" fill="rgba(168,85,247,0.25)" stroke="rgba(168,85,247,0.9)" strokeWidth="2" />
            <circle cx="14" cy="14" r="3" fill="white" />
            <line x1="14" y1="2" x2="14" y2="8" stroke="rgba(168,85,247,0.9)" strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="20" x2="14" y2="26" stroke="rgba(168,85,247,0.9)" strokeWidth="2" strokeLinecap="round" />
            <line x1="2" y1="14" x2="8" y2="14" stroke="rgba(168,85,247,0.9)" strokeWidth="2" strokeLinecap="round" />
            <line x1="20" y1="14" x2="26" y2="14" stroke="rgba(168,85,247,0.9)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {connected && (
        <div
          style={{
            position: 'fixed',
            bottom: 76,
            right: 12,
            zIndex: 10001,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px 4px 7px',
            background: 'rgba(7,11,26,0.88)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${modeColor}44`,
            borderRadius: 20,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={modeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="6" width="20" height="12" rx="4" />
            <circle cx="7" cy="12" r="1.5" fill={modeColor} stroke="none" />
            <circle cx="17" cy="10" r="1" fill={modeColor} stroke="none" />
            <circle cx="17" cy="14" r="1" fill={modeColor} stroke="none" />
            <circle cx="15" cy="12" r="1" fill={modeColor} stroke="none" />
            <circle cx="19" cy="12" r="1" fill={modeColor} stroke="none" />
          </svg>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: modeColor,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {modeLabel}
          </span>
        </div>
      )}
    </>,
    document.body
  );
}
