/**
 * Stratcheck design-system primitives.
 *
 * One typed component layer over the CSS custom properties in globals.css, so
 * pages stop hand-rolling inline styles and stay consistent in both themes.
 * Import from '@/components/ui'.
 */
'use client';

import { forwardRef } from 'react';
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';

// ── tokens (mirror globals.css; use for ad-hoc styling) ──────────────────────
export const tokens = {
  radius: 8, radiusLg: 12, radiusSm: 4,
  space: (n: number) => n * 4,
  panel: { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12 } as CSSProperties,
};

// ── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';
const BTN_VARIANT: Record<ButtonVariant, CSSProperties> = {
  primary:   { background: 'var(--brand-accent)', color: '#fff', border: '1px solid transparent' },
  secondary: { background: 'var(--bg-panel)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
  ghost:     { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent' },
  danger:    { background: 'var(--danger)', color: '#fff', border: '1px solid transparent' },
};
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; icon?: LucideIcon }>(
  function Button({ variant = 'primary', size = 'md', icon: Icon, children, style, disabled, ...rest }, ref) {
    const pad = size === 'sm' ? '6px 12px' : '8px 16px';
    return (
      <button ref={ref} disabled={disabled} style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: pad, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1, transition: 'opacity .15s', ...BTN_VARIANT[variant], ...style,
      }} {...rest}>
        {Icon && <Icon size={size === 'sm' ? 13 : 14} />}{children}
      </button>
    );
  });

// ── Card / Panel ─────────────────────────────────────────────────────────────
export function Card({ children, style, padded = true }: { children: ReactNode; style?: CSSProperties; padded?: boolean }) {
  return <div style={{ ...tokens.panel, padding: padded ? 18 : 0, ...style }}>{children}</div>;
}

// ── Badge ──────────────────────────────────────────────────────────────────--
type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
const BADGE_TONE: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--bg)', fg: 'var(--text-secondary)' },
  brand:   { bg: 'color-mix(in srgb, var(--brand-accent) 14%, transparent)', fg: 'var(--brand-accent)' },
  success: { bg: 'var(--success-l)', fg: 'var(--success)' },
  warning: { bg: 'var(--warning-l)', fg: 'var(--warning)' },
  danger:  { bg: 'var(--danger-l)', fg: 'var(--danger)' },
  info:    { bg: 'var(--info-l)', fg: 'var(--info)' },
};
export function Badge({ children, tone = 'neutral', icon: Icon }: { children: ReactNode; tone?: BadgeTone; icon?: LucideIcon }) {
  const t = BADGE_TONE[tone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 16, background: t.bg, color: t.fg, fontSize: 11, fontWeight: 600 }}>{Icon && <Icon size={12} />}{children}</span>;
}

// ── Field (label + input/select) ─────────────────────────────────────────────
const FIELD_LBL: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 };
const FIELD_CTRL: CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ style, ...rest }, ref) { return <input ref={ref} style={{ ...FIELD_CTRL, ...style }} {...rest} />; });

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ style, children, ...rest }, ref) { return <select ref={ref} style={{ ...FIELD_CTRL, ...style }} {...rest}>{children}</select>; });

export function Field({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return <div style={style}><label style={FIELD_LBL}>{label}</label>{children}</div>;
}

// ── PageHeader ─────────────────────────────────────────────────────────────--
export function PageHeader({ icon: Icon, title, subtitle, actions }: { icon?: LucideIcon; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {Icon && <Icon size={24} color="var(--brand-accent)" />}
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h1>
          {subtitle && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────--
export function EmptyState({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <Card style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      {Icon && <Icon size={28} style={{ marginBottom: 10, opacity: 0.6 }} />}
      <div>{children}</div>
    </Card>
  );
}

// ── Notice (info/error banner) ───────────────────────────────────────────────
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'danger' | 'success' }) {
  const color = tone === 'danger' ? 'var(--danger)' : tone === 'success' ? 'var(--success)' : 'var(--brand-accent)';
  return <div style={{ ...tokens.panel, padding: 14, borderLeft: `3px solid ${color}`, fontSize: 13, color: 'var(--text-secondary)' }}>{children}</div>;
}

// ── Modal ──────────────────────────────────────────────────────────────────--
export function Modal({ open, onClose, title, children, width = 460 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...tokens.panel, padding: 26, width, maxWidth: '92vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
