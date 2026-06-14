/**
 * NexusCDH Enterprise Store
 *
 * Industry-agnostic Customer Decision Hub.
 * Configurable for: Retail Banking, Insurance, Telco, Retail, SME, Healthcare, etc.
 *
 * Pega CDH-equivalent concepts:
 *   Taxonomy:        Action Category → Action Topic → Action
 *   Channels:        Owned (email, web, app, branch) + Paid (social, display, search, programmatic)
 *   Strategies:      Decision flows with eligibility, arbitration, suppression
 *   Policies:        Contact frequency limits, consent gates, D&I/fairness thresholds
 *   Adaptive Models: Propensity scores per action, updated by feedback loop
 *   Audiences:       Segment definitions used in eligibility and arbitration
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Tenant / Line of Business ────────────────────────────────────────────────

export type IndustryTemplate =
  | 'retail_banking' | 'insurance' | 'telco' | 'retail' | 'sme_banking'
  | 'healthcare' | 'wealth_management' | 'utilities' | 'custom';

export interface Tenant {
  id: string;
  name: string;
  industry: IndustryTemplate;
  lobs: LineOfBusiness[];
  createdAt: string;
}

export interface LineOfBusiness {
  id: string;
  name: string;           // e.g. "Personal Banking", "Business Lending"
  description?: string;
}

// ─── Taxonomy: Category → Topic → Action ─────────────────────────────────────

export interface ActionCategory {
  id: string;
  name: string;           // e.g. "Retention", "Cross-sell", "Acquisition", "Nurture"
  description?: string;
  color: string;          // hex — used in UI badges
  createdAt: string;
}

export interface ActionTopic {
  id: string;
  categoryId: string;
  name: string;           // e.g. "Mortgage Offers", "Credit Card Upsell"
  description?: string;
  createdAt: string;
}

export interface Action {
  id: string;
  topicId: string;
  categoryId: string;
  name: string;           // e.g. "Platinum Card Upgrade"
  description?: string;
  // Channel assignment
  channels: ChannelId[];
  // Propensity (baseline; adaptive model refines this)
  basePropensity: number;
  // Creative / content
  headline?: string;
  body?: string;
  ctaLabel?: string;
  imageUrl?: string;
  // Reporting
  offerCode?: string;
  value?: number;        // expected revenue / CLV impact
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export type ChannelType = 'owned' | 'paid';

export type ChannelId =
  // Owned
  | 'email' | 'web' | 'mobile_app' | 'branch' | 'call_centre' | 'sms' | 'push' | 'in_app'
  // Paid
  | 'paid_social' | 'display' | 'programmatic' | 'paid_search' | 'connected_tv' | 'direct_mail';

export interface Channel {
  id: ChannelId;
  name: string;
  type: ChannelType;
  icon: string;
  enabled: boolean;
  // Throttle: max messages per customer per day across this channel
  dailyCap: number;
  weeklyCap: number;
  // Latency: realtime (<1s), near-realtime (<1m), batch (daily)
  latency: 'realtime' | 'near_realtime' | 'batch';
}

// ─── Engagement Policies ──────────────────────────────────────────────────────

export interface ContactPolicy {
  id: string;
  name: string;
  description?: string;
  // Scope
  lobId?: string;         // null = global
  channelIds: ChannelId[];
  // Contact frequency
  maxPerDay: number;
  maxPerWeek: number;
  maxPerMonth: number;
  fatigueWindowDays: number;
  // Cooldown after conversion
  conversionCooldownDays: number;
  // Consent
  requiresConsent: boolean;
  consentTypes: string[];  // e.g. ['marketing', 'profiling']
  // Fairness / bias controls
  fairnessEnabled: boolean;
  fairnessThreshold: number;   // 0.0–1.0
  fairnessAttribute?: string;  // e.g. 'gender', 'ethnicity', 'age_band'
  // Suppression
  suppressionRules: string[];
  status: 'active' | 'draft';
  createdAt: string;
  updatedAt: string;
}

// ─── Adaptive Models ──────────────────────────────────────────────────────────

export interface AdaptiveModel {
  id: string;
  name: string;
  description?: string;
  actionId: string;        // which action this model predicts propensity for
  modelType: 'logistic_regression' | 'gradient_boosting' | 'neural_net' | 'bayesian';
  features: string[];      // customer attribute names used as features
  // Performance
  auc: number;
  liftAtDecile1: number;
  trainedAt: string;
  status: 'live' | 'training' | 'shadow' | 'retired';
  // Predictions generated
  predictionsToday: number;
  createdAt: string;
}

// ─── Audiences / Segments ─────────────────────────────────────────────────────

export type RuleOp = '>=' | '<=' | '=' | '!=' | 'IN' | 'NOT IN' | 'CONTAINS' | 'STARTS_WITH';

export interface SegmentRule {
  attribute: string;
  op: RuleOp;
  value: string;
  logicOp?: 'AND' | 'OR';
}

export interface Audience {
  id: string;
  name: string;
  description?: string;
  rules: SegmentRule[];
  estimatedSize?: number;
  status: 'active' | 'draft';
  createdAt: string;
  updatedAt: string;
}

// ─── Strategies ───────────────────────────────────────────────────────────────

export type Priority = 'low' | 'standard' | 'high' | 'critical';
export type ArbitrationMethod = 'propensity' | 'value' | 'weighted' | 'random_ab';

export interface EligibilityRule {
  attribute: string;
  op: RuleOp;
  value: string;
}

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  // Scope
  lobId?: string;
  // Taxonomy
  categoryId?: string;
  topicId?: string;
  actionIds: string[];
  // Channels this strategy fires on
  channelIds: ChannelId[];
  // Audiences this strategy targets
  audienceIds: string[];
  // Eligibility
  eligibilityRules: EligibilityRule[];
  // Arbitration — how to rank actions when multiple qualify
  arbitration: ArbitrationMethod;
  priority: Priority;
  // Contact policy to apply
  policyId?: string;
  // Adaptive model to use for propensity
  modelId?: string;
  // Schedule
  startDate?: string;
  endDate?: string;
  status: 'active' | 'draft' | 'paused' | 'ended';
  createdAt: string;
  updatedAt: string;
}

// ─── Decision Records ─────────────────────────────────────────────────────────

export interface DecisionRecord {
  id: string;
  customerId: string;
  strategyId: string;
  strategyName: string;
  actionId?: string;
  actionName?: string;
  channelId?: ChannelId;
  served: boolean;
  suppressionReason?: string;
  propensity?: number;
  outcome?: 'accepted' | 'rejected' | 'ignored';
  timestamp: string;
}

// ─── Default channels ─────────────────────────────────────────────────────────

export const DEFAULT_CHANNELS: Channel[] = [
  // Owned
  { id:'email',       name:'Email',           type:'owned', icon:'✉️',  enabled:true,  dailyCap:1, weeklyCap:3,  latency:'batch' },
  { id:'web',         name:'Web',             type:'owned', icon:'🌐',  enabled:true,  dailyCap:5, weeklyCap:20, latency:'realtime' },
  { id:'mobile_app',  name:'Mobile App',      type:'owned', icon:'📱',  enabled:true,  dailyCap:3, weeklyCap:10, latency:'realtime' },
  { id:'sms',         name:'SMS',             type:'owned', icon:'💬',  enabled:false, dailyCap:1, weeklyCap:2,  latency:'near_realtime' },
  { id:'push',        name:'Push',            type:'owned', icon:'🔔',  enabled:false, dailyCap:2, weeklyCap:5,  latency:'near_realtime' },
  { id:'in_app',      name:'In-App',          type:'owned', icon:'📲',  enabled:false, dailyCap:3, weeklyCap:10, latency:'realtime' },
  { id:'branch',      name:'Branch',          type:'owned', icon:'🏦',  enabled:false, dailyCap:1, weeklyCap:1,  latency:'near_realtime' },
  { id:'call_centre', name:'Call Centre',     type:'owned', icon:'📞',  enabled:false, dailyCap:1, weeklyCap:2,  latency:'realtime' },
  // Paid
  { id:'paid_social',   name:'Paid Social',     type:'paid', icon:'📣',  enabled:true,  dailyCap:3, weeklyCap:10, latency:'near_realtime' },
  { id:'display',       name:'Display',         type:'paid', icon:'🖥️',  enabled:false, dailyCap:5, weeklyCap:20, latency:'batch' },
  { id:'programmatic',  name:'Programmatic',    type:'paid', icon:'⚙️',  enabled:false, dailyCap:5, weeklyCap:20, latency:'batch' },
  { id:'paid_search',   name:'Paid Search',     type:'paid', icon:'🔍',  enabled:false, dailyCap:3, weeklyCap:10, latency:'realtime' },
  { id:'connected_tv',  name:'Connected TV',    type:'paid', icon:'📺',  enabled:false, dailyCap:2, weeklyCap:5,  latency:'batch' },
  { id:'direct_mail',   name:'Direct Mail',     type:'paid', icon:'📬',  enabled:false, dailyCap:1, weeklyCap:1,  latency:'batch' },
];

// ─── Industry templates ───────────────────────────────────────────────────────

export const INDUSTRY_TEMPLATES: Record<IndustryTemplate, { label: string; lobs: string[]; categories: string[]; sampleTopics: string[] }> = {
  retail_banking: {
    label: 'Retail Banking',
    lobs: ['Personal Banking', 'Mortgages', 'Credit Cards', 'Savings & Investments', 'Personal Loans'],
    categories: ['Acquisition', 'Cross-sell', 'Upsell', 'Retention', 'Nurture', 'Win-back'],
    sampleTopics: ['Mortgage Offers', 'Credit Card Upgrade', 'Savings Account', 'Personal Loan', 'Digital Banking Adoption'],
  },
  insurance: {
    label: 'Insurance',
    lobs: ['Motor', 'Home & Contents', 'Life', 'Health', 'Business Insurance'],
    categories: ['Acquisition', 'Renewal', 'Cross-sell', 'Claims Prevention', 'Retention'],
    sampleTopics: ['Motor Renewal', 'Home Cover Upgrade', 'Life Cover', 'Health Add-ons'],
  },
  telco: {
    label: 'Telco',
    lobs: ['Consumer Mobile', 'Home Broadband', 'Business Mobile', 'TV & Entertainment'],
    categories: ['Acquisition', 'Upgrade', 'Retention', 'Churn Prevention', 'Cross-sell'],
    sampleTopics: ['Handset Upgrade', 'Plan Upsell', 'Bundle Offer', 'Loyalty Reward'],
  },
  retail: {
    label: 'Retail',
    lobs: ['Fashion', 'Electronics', 'Home & Garden', 'Loyalty Programme', 'Online'],
    categories: ['Acquisition', 'Replenishment', 'Cross-sell', 'Loyalty', 'Win-back'],
    sampleTopics: ['Loyalty Points Offer', 'Replenishment Reminder', 'Complementary Products', 'Seasonal Promotion'],
  },
  sme_banking: {
    label: 'SME Banking',
    lobs: ['Business Current Account', 'Business Lending', 'Trade Finance', 'Payments'],
    categories: ['Acquisition', 'Lending', 'Cash Management', 'International', 'Retention'],
    sampleTopics: ['Business Loan Offer', 'Invoice Finance', 'FX Service', 'Digital Banking'],
  },
  healthcare: {
    label: 'Healthcare',
    lobs: ['Primary Care', 'Specialist Referrals', 'Preventive Health', 'Chronic Care Management'],
    categories: ['Preventive', 'Adherence', 'Referral', 'Education', 'Wellness'],
    sampleTopics: ['Annual Check-up', 'Medication Reminder', 'Specialist Referral', 'Wellness Programme'],
  },
  wealth_management: {
    label: 'Wealth Management',
    lobs: ['Portfolio Management', 'Retirement Planning', 'Tax Planning', 'Estate Planning'],
    categories: ['Acquisition', 'Portfolio Review', 'Life Events', 'Education', 'Retention'],
    sampleTopics: ['Portfolio Rebalance', 'Retirement Plan Review', 'ISA Top-up', 'Investment Opportunity'],
  },
  utilities: {
    label: 'Utilities',
    lobs: ['Gas', 'Electricity', 'Water', 'Smart Home'],
    categories: ['Acquisition', 'Retention', 'Smart Adoption', 'Energy Saving', 'Tariff Optimisation'],
    sampleTopics: ['Smart Meter Install', 'Green Tariff', 'Energy Saving Tips', 'Tariff Review'],
  },
  custom: {
    label: 'Custom',
    lobs: ['Line of Business 1'],
    categories: ['Acquisition', 'Retention', 'Cross-sell', 'Nurture'],
    sampleTopics: [],
  },
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface CDHStore {
  // Configuration
  tenant: Tenant;
  updateTenant: (patch: Partial<Tenant>) => void;

  // Taxonomy
  categories: ActionCategory[];
  topics: ActionTopic[];
  actions: Action[];
  addCategory: (c: Omit<ActionCategory, 'id' | 'createdAt'>) => ActionCategory;
  updateCategory: (id: string, patch: Partial<ActionCategory>) => void;
  deleteCategory: (id: string) => void;
  addTopic: (t: Omit<ActionTopic, 'id' | 'createdAt'>) => ActionTopic;
  updateTopic: (id: string, patch: Partial<ActionTopic>) => void;
  deleteTopic: (id: string) => void;
  addAction: (a: Omit<Action, 'id' | 'createdAt' | 'updatedAt'>) => Action;
  updateAction: (id: string, patch: Partial<Action>) => void;
  deleteAction: (id: string) => void;

  // Channels
  channels: Channel[];
  updateChannel: (id: ChannelId, patch: Partial<Channel>) => void;

  // Policies
  policies: ContactPolicy[];
  addPolicy: (p: Omit<ContactPolicy, 'id' | 'createdAt' | 'updatedAt'>) => ContactPolicy;
  updatePolicy: (id: string, patch: Partial<ContactPolicy>) => void;
  deletePolicy: (id: string) => void;

  // Audiences
  audiences: Audience[];
  addAudience: (a: Omit<Audience, 'id' | 'createdAt' | 'updatedAt'>) => Audience;
  updateAudience: (id: string, patch: Partial<Audience>) => void;
  deleteAudience: (id: string) => void;

  // Strategies
  strategies: Strategy[];
  addStrategy: (s: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt'>) => Strategy;
  updateStrategy: (id: string, patch: Partial<Strategy>) => void;
  deleteStrategy: (id: string) => void;

  // Adaptive models
  models: AdaptiveModel[];
  addModel: (m: Omit<AdaptiveModel, 'id' | 'createdAt'>) => AdaptiveModel;
  updateModel: (id: string, patch: Partial<AdaptiveModel>) => void;

  // Decisions
  decisions: DecisionRecord[];
  recordDecision: (d: Omit<DecisionRecord, 'id'>) => void;
  clearDecisions: () => void;

  // Hydration from Supabase
  hydrateFromDB: (data: {
    categories?: ActionCategory[];
    topics?: ActionTopic[];
    actions?: Action[];
    policies?: ContactPolicy[];
    strategies?: Strategy[];
    audiences?: Audience[];
  }) => void;
}

const now = new Date().toISOString();

export const useStore = create<CDHStore>()(
  persist(
    (set) => ({
      tenant: {
        id: 'default',
        name: 'My Organisation',
        industry: 'retail_banking',
        lobs: INDUSTRY_TEMPLATES.retail_banking.lobs.map((name, i) => ({ id: `lob-${i}`, name })),
        createdAt: now,
      },
      updateTenant: (patch) => set(s => ({ tenant: { ...s.tenant, ...patch } })),

      categories: [],
      topics: [],
      actions: [],

      addCategory: (c) => {
        const cat: ActionCategory = { ...c, id: `CAT-${Date.now()}`, createdAt: now };
        set(s => ({ categories: [...s.categories, cat] }));
        return cat;
      },
      updateCategory: (id, patch) => set(s => ({ categories: s.categories.map(c => c.id===id?{...c,...patch}:c) })),
      deleteCategory: (id) => set(s => ({
        categories: s.categories.filter(c => c.id!==id),
        topics: s.topics.filter(t => t.categoryId!==id),
        actions: s.actions.filter(a => a.categoryId!==id),
      })),

      addTopic: (t) => {
        const topic: ActionTopic = { ...t, id: `TOP-${Date.now()}`, createdAt: now };
        set(s => ({ topics: [...s.topics, topic] }));
        return topic;
      },
      updateTopic: (id, patch) => set(s => ({ topics: s.topics.map(t => t.id===id?{...t,...patch}:t) })),
      deleteTopic: (id) => set(s => ({
        topics: s.topics.filter(t => t.id!==id),
        actions: s.actions.filter(a => a.topicId!==id),
      })),

      addAction: (a) => {
        const action: Action = { ...a, id: `ACT-${Date.now()}`, createdAt: now, updatedAt: now };
        set(s => ({ actions: [...s.actions, action] }));
        return action;
      },
      updateAction: (id, patch) => set(s => ({ actions: s.actions.map(a => a.id===id?{...a,...patch,updatedAt:new Date().toISOString()}:a) })),
      deleteAction: (id) => set(s => ({ actions: s.actions.filter(a => a.id!==id) })),

      channels: DEFAULT_CHANNELS,
      updateChannel: (id, patch) => set(s => ({ channels: s.channels.map(c => c.id===id?{...c,...patch}:c) })),

      policies: [],
      addPolicy: (p) => {
        const policy: ContactPolicy = { ...p, id: `POL-${Date.now()}`, createdAt: now, updatedAt: now };
        set(s => ({ policies: [...s.policies, policy] }));
        return policy;
      },
      updatePolicy: (id, patch) => set(s => ({ policies: s.policies.map(p => p.id===id?{...p,...patch,updatedAt:new Date().toISOString()}:p) })),
      deletePolicy: (id) => set(s => ({ policies: s.policies.filter(p => p.id!==id) })),

      audiences: [],
      addAudience: (a) => {
        const aud: Audience = { ...a, id: `AUD-${Date.now()}`, createdAt: now, updatedAt: now };
        set(s => ({ audiences: [...s.audiences, aud] }));
        return aud;
      },
      updateAudience: (id, patch) => set(s => ({ audiences: s.audiences.map(a => a.id===id?{...a,...patch,updatedAt:new Date().toISOString()}:a) })),
      deleteAudience: (id) => set(s => ({ audiences: s.audiences.filter(a => a.id!==id) })),

      strategies: [],
      addStrategy: (s) => {
        const strategy: Strategy = { ...s, id: `STR-${Date.now()}`, createdAt: now, updatedAt: now };
        set(st => ({ strategies: [...st.strategies, strategy] }));
        return strategy;
      },
      updateStrategy: (id, patch) => set(s => ({ strategies: s.strategies.map(st => st.id===id?{...st,...patch,updatedAt:new Date().toISOString()}:st) })),
      deleteStrategy: (id) => set(s => ({ strategies: s.strategies.filter(st => st.id!==id) })),

      models: [],
      addModel: (m) => {
        const model: AdaptiveModel = { ...m, id: `MDL-${Date.now()}`, createdAt: now };
        set(s => ({ models: [...s.models, model] }));
        return model;
      },
      updateModel: (id, patch) => set(s => ({ models: s.models.map(m => m.id===id?{...m,...patch}:m) })),

      decisions: [],
      recordDecision: (d) => set(s => ({
        decisions: [{ ...d, id: `DEC-${Date.now()}` }, ...s.decisions].slice(0, 1000),
      })),
      clearDecisions: () => set({ decisions: [] }),

      hydrateFromDB: (data) => set(s => ({
        categories: data.categories?.length ? data.categories : s.categories,
        topics:     data.topics?.length     ? data.topics     : s.topics,
        actions:    data.actions?.length    ? data.actions    : s.actions,
        policies:   data.policies?.length   ? data.policies   : s.policies,
        strategies: data.strategies?.length ? data.strategies : s.strategies,
        audiences:  data.audiences?.length  ? data.audiences  : s.audiences,
      })),
    }),
    { name: 'nexuscdh-enterprise-store' }
  )
);
