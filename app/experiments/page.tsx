'use client';
import { useState, useEffect } from 'react';
import { FlaskConical, Plus, Play, Pause, CheckCircle2, Trash2, X, Save } from 'lucide-react';

interface Variant {
  name: string;
  strategyId: string;
  trafficPct: number;
}

interface Experiment {
  id?: string;
  name: string;
  description?: string;
  status: string;
  variants: Variant[];
  auto_promote: boolean;
  promotion_threshold: number;
  winner_strategy_id?: string;
  stats?: Record<string, { total: number; served: number; accepted: number; acceptanceRate: number }>;
}

const STATUS_STYLES: Record<string, { background: string; color: string; label: string }> = {
  draft:     { background: '#F3F4F6', color: '#6B7280', label: 'Draft' },
  running:   { background: '#DBEAFE', color: '#1D4ED8', label: 'Running' },
  paused:    { background: '#FEF3C7', color: '#D97706', label: 'Paused' },
  completed: { background: '#D1FAE5', color: '#059669', label: 'Completed' },
};

const VARIANT_COLORS = ['#1D4ED8', '#7C3AED', '#059669', '#D97706'];

const emptyVariant = (): Variant => ({ name: '', strategyId: '', trafficPct: 0 });

function ExperimentModal({
  exp,
  onClose,
  onSaved,
}: {
  exp: Experiment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(exp?.name ?? '');
  const [description, setDescription] = useState(exp?.description ?? '');
  const [status, setStatus] = useState(exp?.status ?? 'draft');
  const [variants, setVariants] = useState<Variant[]>(
    exp?.variants?.length ? exp.variants : [emptyVariant(), emptyVariant()]
  );
  const [autoPromote, setAutoPromote] = useState(exp?.auto_promote ?? false);
  const [threshold, setThreshold] = useState(exp?.promotion_threshold ?? 0.6);
  const [saving, setSaving] = useState(false);

  const totalTraffic = variants.reduce((s, v) => s + (Number(v.trafficPct) || 0), 0);
  const trafficOk = totalTraffic === 100;

  const updateVariant = (i: number, field: keyof Variant, value: string | number) => {
    setVariants(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v));
  };

  const addVariant = () => {
    if (variants.length < 4) setVariants(prev => [...prev, emptyVariant()]);
  };

  const removeVariant = (i: number) => {
    if (variants.length > 2) setVariants(prev => prev.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const body: Experiment = {
      ...(exp?.id ? { id: exp.id } : {}),
      name,
      description,
      status,
      variants,
      auto_promote: autoPromote,
      promotion_threshold: threshold,
    };
    try {
      await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
    >
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, width: '100%', maxWidth: 600,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>
            {exp ? 'Edit Experiment' : 'New Experiment'}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>
              Name *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Credit Card Offer vs Control"
              autoFocus
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
                borderRadius: 6, fontSize: 13, color: 'var(--text)', background: 'var(--bg)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
                borderRadius: 6, fontSize: 13, color: 'var(--text)', background: 'var(--bg)',
                outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Status */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>
              Status
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
                borderRadius: 6, fontSize: 13, color: 'var(--text)', background: 'var(--bg)',
                outline: 'none', boxSizing: 'border-box',
              }}
            >
              <option value="draft">Draft</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Variants */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                Variants
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontSize: 12, fontWeight: 500,
                  color: trafficOk ? '#059669' : '#DC2626',
                }}>
                  Total: {totalTraffic}%{!trafficOk && ' (must equal 100)'}
                </span>
                {variants.length < 4 && (
                  <button
                    onClick={addVariant}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '3px 10px', fontSize: 12,
                      cursor: 'pointer', color: 'var(--text-muted)',
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {variants.map((v, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 80px 28px',
                    gap: 8, alignItems: 'center',
                    background: '#F9FAFB', borderRadius: 8, padding: '10px 12px',
                  }}
                >
                  <input
                    value={v.name}
                    onChange={e => updateVariant(i, 'name', e.target.value)}
                    placeholder={`Variant ${String.fromCharCode(65 + i)}`}
                    style={{
                      padding: '6px 10px', border: '1px solid var(--border)',
                      borderRadius: 6, fontSize: 12, color: 'var(--text)', background: 'white',
                      outline: 'none',
                    }}
                  />
                  <input
                    value={v.strategyId}
                    onChange={e => updateVariant(i, 'strategyId', e.target.value)}
                    placeholder="Strategy ID"
                    style={{
                      padding: '6px 10px', border: '1px solid var(--border)',
                      borderRadius: 6, fontSize: 12, color: 'var(--text)', background: 'white',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      value={v.trafficPct}
                      onChange={e => updateVariant(i, 'trafficPct', Number(e.target.value))}
                      min={0}
                      max={100}
                      style={{
                        width: '100%', padding: '6px 10px', border: '1px solid var(--border)',
                        borderRadius: 6, fontSize: 12, color: 'var(--text)', background: 'white',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>%</span>
                  </div>
                  <button
                    onClick={() => removeVariant(i)}
                    disabled={variants.length <= 2}
                    style={{
                      background: 'none', border: 'none', cursor: variants.length > 2 ? 'pointer' : 'default',
                      color: variants.length > 2 ? '#DC2626' : '#D1D5DB', padding: 0, display: 'flex', alignItems: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-promote */}
          <div style={{
            background: '#F9FAFB', borderRadius: 8, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoPromote}
                onChange={e => setAutoPromote(e.target.checked)}
                style={{ width: 15, height: 15, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                Auto-promote winner
              </span>
            </label>
            {autoPromote && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 25 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  Promotion threshold
                </label>
                <input
                  type="number"
                  value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  min={0.5}
                  max={0.99}
                  step={0.01}
                  style={{
                    width: 80, padding: '6px 10px', border: '1px solid var(--border)',
                    borderRadius: 6, fontSize: 12, color: 'var(--text)', background: 'white',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>acceptance rate</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '16px 24px', borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            style={{
              padding: '8px 18px', borderRadius: 6, border: 'none',
              background: name.trim() ? 'var(--brand-accent)' : '#9CA3AF',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 500, color: '#fff',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Save size={13} />
            {saving ? 'Saving…' : 'Save Experiment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExp, setEditingExp] = useState<Experiment | null>(null);

  const fetchExperiments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/experiments?tenantId=f0000000-0000-4000-a000-000000000001');
      if (res.ok) {
        const data = await res.json();
        setExperiments(Array.isArray(data) ? data : data.experiments ?? []);
      }
    } catch {
      // ignore fetch errors silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExperiments(); }, []);

  const openNew = () => { setEditingExp(null); setShowModal(true); };
  const openEdit = (exp: Experiment) => { setEditingExp(exp); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingExp(null); };
  const handleSaved = () => { closeModal(); fetchExperiments(); };

  const deleteExp = async (exp: Experiment) => {
    if (!window.confirm(`Delete experiment "${exp.name}"?`)) return;
    await fetch(`/api/experiments?id=${exp.id}`, { method: 'DELETE' });
    fetchExperiments();
  };

  const updateStatus = async (exp: Experiment, newStatus: string) => {
    await fetch('/api/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...exp, status: newStatus }),
    });
    fetchExperiments();
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Experiments</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Champion/Challenger A/B testing for strategies
          </p>
        </div>
        <button
          onClick={openNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--brand-accent)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '10px 18px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          New Experiment
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading experiments…
        </div>
      )}

      {/* Empty state */}
      {!loading && experiments.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '80px 24px',
          border: '1px solid var(--border)', borderRadius: 12,
          background: 'var(--card)',
        }}>
          <FlaskConical size={64} style={{ color: 'var(--brand-accent)', marginBottom: 20 }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
            No experiments yet
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 400, margin: 0 }}>
            Create an A/B test to compare two strategy variants and automatically promote the winner
          </p>
          <button
            onClick={openNew}
            style={{
              marginTop: 24, display: 'flex', alignItems: 'center', gap: 7,
              background: 'var(--brand-accent)', color: '#fff',
              border: 'none', borderRadius: 8, padding: '10px 18px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            New Experiment
          </button>
        </div>
      )}

      {/* Experiments grid */}
      {!loading && experiments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          {experiments.map(exp => {
            const statusStyle = STATUS_STYLES[exp.status] ?? STATUS_STYLES.draft;
            return (
              <div
                key={exp.id}
                style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 12, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                {/* Card header */}
                <div style={{ padding: '18px 20px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>
                        {exp.name}
                      </div>
                      {exp.description && (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          {exp.description}
                        </div>
                      )}
                    </div>
                    <span style={{
                      ...statusStyle,
                      fontSize: 11, fontWeight: 600, padding: '3px 9px',
                      borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {statusStyle.label}
                    </span>
                  </div>
                </div>

                {/* Variants */}
                <div style={{ padding: '0 20px 14px', flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Variants
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {(exp.variants ?? []).map((v, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                            {v.name || `Variant ${String.fromCharCode(65 + i)}`}
                            {v.strategyId && (
                              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                                · {v.strategyId}
                              </span>
                            )}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                            {v.trafficPct}%
                          </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: '#F3F4F6', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${v.trafficPct}%`,
                            background: VARIANT_COLORS[i % VARIANT_COLORS.length],
                            borderRadius: 3,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats row (only when running) */}
                {exp.status === 'running' && exp.stats && (
                  <div style={{
                    margin: '0 20px 14px',
                    background: '#F9FAFB', borderRadius: 8, padding: '10px 14px',
                    display: 'flex', gap: 20,
                  }}>
                    {Object.entries(exp.stats).map(([variantName, s]) => (
                      <div key={variantName} style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 2 }}>
                          {variantName}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text)' }}>
                          <span style={{ fontWeight: 600 }}>{s.served.toLocaleString()}</span> served
                          {' · '}
                          <span style={{ fontWeight: 600 }}>
                            {(s.acceptanceRate * 100).toFixed(1)}%
                          </span> accepted
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Card footer */}
                <div style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {exp.status === 'draft' && (
                    <button
                      onClick={() => updateStatus(exp, 'running')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'none', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '5px 12px',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        color: '#1D4ED8',
                      }}
                    >
                      <Play size={12} /> Start
                    </button>
                  )}
                  {exp.status === 'running' && (
                    <button
                      onClick={() => updateStatus(exp, 'paused')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'none', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '5px 12px',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        color: '#D97706',
                      }}
                    >
                      <Pause size={12} /> Pause
                    </button>
                  )}
                  {exp.status === 'paused' && (
                    <button
                      onClick={() => updateStatus(exp, 'running')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'none', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '5px 12px',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        color: '#1D4ED8',
                      }}
                    >
                      <Play size={12} /> Resume
                    </button>
                  )}
                  {(exp.status === 'running' || exp.status === 'paused') && (
                    <button
                      onClick={() => updateStatus(exp, 'completed')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'none', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '5px 12px',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        color: '#059669',
                      }}
                    >
                      <CheckCircle2 size={12} /> Complete
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(exp)}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '5px 12px',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Edit
                  </button>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => deleteExp(exp)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'none', border: '1px solid transparent',
                      borderRadius: 6, padding: '5px 10px',
                      fontSize: 12, cursor: 'pointer', color: '#DC2626',
                    }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ExperimentModal
          exp={editingExp}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
