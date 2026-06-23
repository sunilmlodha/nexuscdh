'use client';

import { useState } from 'react';
import { Palette, Plus, Crown, Check } from 'lucide-react';
import { Button, Card, Badge, Field, Input, Select, PageHeader, EmptyState, Notice, Modal } from '@/components/ui';

const COLORS = [
  ['--brand-accent', 'Brand accent'], ['--bg', 'Background'], ['--bg-panel', 'Panel'],
  ['--text-primary', 'Text primary'], ['--text-secondary', 'Text secondary'], ['--text-muted', 'Text muted'],
  ['--border', 'Border'], ['--success', 'Success'], ['--warning', 'Warning'], ['--danger', 'Danger'], ['--info', 'Info'],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      <Card><div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>{children}</div></Card>
    </div>
  );
}

export default function DesignSystemPage() {
  const [modal, setModal] = useState(false);
  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader icon={Palette} title="Design System" subtitle="Typed primitives over the theme tokens — the shared vocabulary every page builds from." />

      <Section title="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button icon={Plus}>With icon</Button>
        <Button size="sm">Small</Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="Badges">
        <Badge>Neutral</Badge>
        <Badge tone="brand">Brand</Badge>
        <Badge tone="success" icon={Check}>Champion</Badge>
        <Badge tone="warning">Shadow</Badge>
        <Badge tone="danger">Retired</Badge>
        <Badge tone="info" icon={Crown}>Info</Badge>
      </Section>

      <Section title="Form fields">
        <Field label="Text input" style={{ width: 220 }}><Input placeholder="cust_123" /></Field>
        <Field label="Select" style={{ width: 220 }}><Select><option>email</option><option>phone</option><option>device</option></Select></Field>
      </Section>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Notices</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Notice tone="info">Informational message using the brand accent.</Notice>
          <Notice tone="success">Operation completed successfully.</Notice>
          <Notice tone="danger">Something went wrong — run the migration to enable this feature.</Notice>
        </div>
      </div>

      <Section title="Overlays">
        <Button onClick={() => setModal(true)}>Open modal</Button>
        <Modal open={modal} onClose={() => setModal(false)} title="Example modal">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Modals share the same panel chrome and close affordance everywhere.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={() => setModal(false)}>Confirm</Button>
          </div>
        </Modal>
      </Section>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Empty state</div>
        <EmptyState icon={Palette}>Nothing here yet — primitives render the same empty pattern across pages.</EmptyState>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Color tokens</div>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {COLORS.map(([v, label]) => (
              <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 30, height: 30, borderRadius: 6, background: `var(${v})`, border: '1px solid var(--border)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{v}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
