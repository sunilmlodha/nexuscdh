/**
 * POST /api/seed
 * Creates comprehensive demo data: taxonomy, actions, strategies, audiences,
 * customer profiles, event triggers, contact policies, experiments, decision logs.
 *
 * GET /api/seed
 * Returns current data counts so the UI can show what's seeded.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Deterministic tenant UUID — upserted before all other seed data
const TENANT_ID = 'f0000000-0000-4000-a000-000000000001';
const TENANT    = TENANT_ID; // alias used throughout seed data arrays

// Deterministic UUIDs for seed data (v4 format, hardcoded for repeatability)
const IDS = {
  // categories
  CAT_SALES:    'a1000001-0000-4000-a000-000000000001',
  CAT_SERVICE:  'a1000002-0000-4000-a000-000000000002',
  CAT_RETAIN:   'a1000003-0000-4000-a000-000000000003',
  CAT_ONBOARD:  'a1000004-0000-4000-a000-000000000004',
  CAT_CROSS:    'a1000005-0000-4000-a000-000000000005',
  // topics
  TOP_INSURE:   'b2000001-0000-4000-a000-000000000001',
  TOP_MORTGAGE: 'b2000002-0000-4000-a000-000000000002',
  TOP_CREDIT:   'b2000003-0000-4000-a000-000000000003',
  TOP_SAVINGS:  'b2000004-0000-4000-a000-000000000004',
  TOP_LOYALTY:  'b2000005-0000-4000-a000-000000000005',
  TOP_SERVICE:  'b2000006-0000-4000-a000-000000000006',
  TOP_ONBOARD:  'b2000007-0000-4000-a000-000000000007',
  // actions
  ACT_001: 'c3000001-0000-4000-a000-000000000001',
  ACT_002: 'c3000002-0000-4000-a000-000000000002',
  ACT_003: 'c3000003-0000-4000-a000-000000000003',
  ACT_004: 'c3000004-0000-4000-a000-000000000004',
  ACT_005: 'c3000005-0000-4000-a000-000000000005',
  ACT_006: 'c3000006-0000-4000-a000-000000000006',
  ACT_007: 'c3000007-0000-4000-a000-000000000007',
  ACT_008: 'c3000008-0000-4000-a000-000000000008',
  // policies
  POL_001: 'd4000001-0000-4000-a000-000000000001',
  POL_002: 'd4000002-0000-4000-a000-000000000002',
  // strategies
  STR_001: 'e5000001-0000-4000-a000-000000000001',
  STR_002: 'e5000002-0000-4000-a000-000000000002',
  STR_003: 'e5000003-0000-4000-a000-000000000003',
  STR_004: 'e5000004-0000-4000-a000-000000000004',
  // audiences
  AUD_001: 'f6000001-0000-4000-a000-000000000001',
  AUD_002: 'f6000002-0000-4000-a000-000000000002',
  AUD_003: 'f6000003-0000-4000-a000-000000000003',
  AUD_004: 'f6000004-0000-4000-a000-000000000004',
  // triggers
  TRG_001: 'a7000001-0000-4000-a000-000000000001',
  TRG_002: 'a7000002-0000-4000-a000-000000000002',
  TRG_003: 'a7000003-0000-4000-a000-000000000003',
  TRG_004: 'a7000004-0000-4000-a000-000000000004',
  // experiments
  EXP_001: 'b8000001-0000-4000-a000-000000000001',
  EXP_002: 'b8000002-0000-4000-a000-000000000002',
};

function db() {
  if (!SUPA_URL || !SUPA_KEY) throw new Error('Supabase not configured');
  return createClient(SUPA_URL, SUPA_KEY);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureTenant(client: any) {
  const { error } = await client.from('tenants').upsert(
    { id: TENANT_ID, name: 'Demo Organisation', industry: 'retail_banking' },
    { onConflict: 'id' }
  );
  if (error) throw new Error(`Tenant upsert failed: ${error.message}`);
}

// ─── seed data ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: IDS.CAT_SALES,   tenant_id: TENANT, name: 'Sales',      description: 'Revenue-generating offers and upsells' },
  { id: IDS.CAT_SERVICE, tenant_id: TENANT, name: 'Service',    description: 'Customer service and support offers' },
  { id: IDS.CAT_RETAIN,  tenant_id: TENANT, name: 'Retention',  description: 'Churn prevention and loyalty programs' },
  { id: IDS.CAT_ONBOARD, tenant_id: TENANT, name: 'Onboarding', description: 'New customer activation journeys' },
  { id: IDS.CAT_CROSS,   tenant_id: TENANT, name: 'Cross-sell', description: 'Adjacent product recommendations' },
];

const TOPICS = [
  { id: IDS.TOP_INSURE,   tenant_id: TENANT, category_id: IDS.CAT_SALES,   name: 'Home Insurance',   description: 'Home & contents protection products' },
  { id: IDS.TOP_MORTGAGE, tenant_id: TENANT, category_id: IDS.CAT_SALES,   name: 'Mortgage Products',description: 'Home loan offers and refinance' },
  { id: IDS.TOP_CREDIT,   tenant_id: TENANT, category_id: IDS.CAT_CROSS,   name: 'Credit Cards',     description: 'Premium and rewards card offers' },
  { id: IDS.TOP_SAVINGS,  tenant_id: TENANT, category_id: IDS.CAT_CROSS,   name: 'Savings Accounts', description: 'High-yield and term deposit offers' },
  { id: IDS.TOP_LOYALTY,  tenant_id: TENANT, category_id: IDS.CAT_RETAIN,  name: 'Loyalty Rewards',  description: 'Points, cashback and member perks' },
  { id: IDS.TOP_SERVICE,  tenant_id: TENANT, category_id: IDS.CAT_SERVICE, name: 'Self-Service',     description: 'App and online banking adoption' },
  { id: IDS.TOP_ONBOARD,  tenant_id: TENANT, category_id: IDS.CAT_ONBOARD, name: 'Welcome Journey',  description: 'First 90-day activation nudges' },
];

// Table name aliases (Supabase schema uses action_categories / action_topics)
const TBL_CATEGORIES = 'action_categories';
const TBL_TOPICS     = 'action_topics';

const ACTIONS = [
  { id: IDS.ACT_001, tenant_id: TENANT, topic_id: IDS.TOP_INSURE,   category_id: IDS.CAT_SALES,   name: 'Home Insurance Upsell',    headline: 'Protect your home from $12/month',    description: 'Tailored home insurance offer for mortgage customers without existing cover.',     offer_code: 'HOME2024', channels: ['email','web'],   base_propensity: 0.62, expected_value: 480,  status: 'active' },
  { id: IDS.ACT_002, tenant_id: TENANT, topic_id: IDS.TOP_MORTGAGE, category_id: IDS.CAT_SALES,   name: 'Mortgage Refinance Offer', headline: 'Lock in a better rate today',          description: 'Refinance offer for customers with variable-rate mortgages above 6.5%.',         offer_code: 'REFI2024', channels: ['email','phone'], base_propensity: 0.45, expected_value: 1200, status: 'active' },
  { id: IDS.ACT_003, tenant_id: TENANT, topic_id: IDS.TOP_CREDIT,   category_id: IDS.CAT_CROSS,   name: 'Platinum Card Upgrade',    headline: 'Earn 3x points on every purchase',    description: 'Upgrade offer for high-spend customers on basic card tier.',                       offer_code: 'PLAT2024', channels: ['web','app'],     base_propensity: 0.38, expected_value: 240,  status: 'active' },
  { id: IDS.ACT_004, tenant_id: TENANT, topic_id: IDS.TOP_SAVINGS,  category_id: IDS.CAT_CROSS,   name: 'Term Deposit Offer',       headline: '5.2% p.a. for 12 months',             description: 'High-yield term deposit for customers with idle transaction account balances.',    offer_code: 'TD2024',   channels: ['email','app'],   base_propensity: 0.55, expected_value: 360,  status: 'active' },
  { id: IDS.ACT_005, tenant_id: TENANT, topic_id: IDS.TOP_LOYALTY,  category_id: IDS.CAT_RETAIN,  name: 'Loyalty Points Boost',     headline: '500 bonus points — just for you',    description: "Re-engagement offer for customers who haven't transacted in 60+ days.",           offer_code: 'LOYAL24',  channels: ['email','sms'],   base_propensity: 0.71, expected_value: 85,   status: 'active' },
  { id: IDS.ACT_006, tenant_id: TENANT, topic_id: IDS.TOP_SERVICE,  category_id: IDS.CAT_SERVICE, name: 'App Activation Nudge',     headline: 'Your app is ready — tap to explore', description: "Activation nudge for customers who downloaded the app but haven't logged in.",     offer_code: 'APP2024',  channels: ['sms','push'],    base_propensity: 0.80, expected_value: 50,   status: 'active' },
  { id: IDS.ACT_007, tenant_id: TENANT, topic_id: IDS.TOP_ONBOARD,  category_id: IDS.CAT_ONBOARD, name: 'Direct Debit Setup',       headline: 'Set up auto-pay in 60 seconds',       description: 'Onboarding action to encourage direct debit setup within first 30 days.',          offer_code: 'DD2024',   channels: ['email','web'],   base_propensity: 0.66, expected_value: 120,  status: 'active' },
  { id: IDS.ACT_008, tenant_id: TENANT, topic_id: IDS.TOP_INSURE,   category_id: IDS.CAT_SALES,   name: 'Contents Insurance Add-on',headline: 'Add contents cover for $6/month',     description: 'Contents-only add-on for renters and existing home-structure policyholders.',      offer_code: 'CONT24',   channels: ['web','email'],   base_propensity: 0.49, expected_value: 200,  status: 'active' },
];

const POLICIES = [
  { id: IDS.POL_001, tenant_id: TENANT, name: 'Standard Contact Policy', max_per_day: 2, max_per_week: 5,  max_per_month: 12, fatigue_window_days: 7, conversion_cooldown_days: 30, requires_consent: true, fairness_enabled: false, fairness_threshold: 0.1,  suppression_rules: ['age < 18','consent = false','account_status = closed'], status: 'active' },
  { id: IDS.POL_002, tenant_id: TENANT, name: 'VIP Customer Policy',     max_per_day: 3, max_per_week: 8,  max_per_month: 20, fatigue_window_days: 3, conversion_cooldown_days: 14, requires_consent: true, fairness_enabled: true,  fairness_threshold: 0.05, fairness_attribute: 'customer_segment', suppression_rules: ['consent = false'], status: 'active' },
];

const STRATEGIES = [
  { id: IDS.STR_001, tenant_id: TENANT, name: 'Home Insurance Growth',   description: 'Target mortgage customers without home insurance coverage.', category_id: IDS.CAT_SALES,   topic_id: IDS.TOP_INSURE,   action_ids: [IDS.ACT_001,IDS.ACT_008], channel_ids: ['email','web'],       audience_ids: [IDS.AUD_001], policy_id: IDS.POL_001, arbitration: 'propensity' as const, priority: 'high' as const,     status: 'active' as const, eligibility_rules: [{ attribute:'has_mortgage',op:'=',value:'true' },{ attribute:'has_home_insurance',op:'=',value:'false' },{ attribute:'age',op:'>=',value:'25' }] },
  { id: IDS.STR_002, tenant_id: TENANT, name: 'Premium Card Cross-sell', description: 'Upgrade high-spend transactors to Platinum card tier.',       category_id: IDS.CAT_CROSS,   topic_id: IDS.TOP_CREDIT,   action_ids: [IDS.ACT_003],             channel_ids: ['web','app'],         audience_ids: [IDS.AUD_002], policy_id: IDS.POL_001, arbitration: 'value' as const,      priority: 'standard' as const, status: 'active' as const, eligibility_rules: [{ attribute:'monthly_spend',op:'>=',value:'2000' },{ attribute:'credit_card_tier',op:'!=',value:'platinum' },{ attribute:'credit_score',op:'>=',value:'700' }] },
  { id: IDS.STR_003, tenant_id: TENANT, name: 'Re-engagement Campaign',  description: 'Win back dormant customers with loyalty incentives.',         category_id: IDS.CAT_RETAIN,  topic_id: IDS.TOP_LOYALTY,  action_ids: [IDS.ACT_005],             channel_ids: ['email','sms'],       audience_ids: [IDS.AUD_003], policy_id: IDS.POL_002, arbitration: 'propensity' as const, priority: 'standard' as const, status: 'active' as const, eligibility_rules: [{ attribute:'days_since_last_transaction',op:'>=',value:'60' },{ attribute:'account_status',op:'=',value:'active' }] },
  { id: IDS.STR_004, tenant_id: TENANT, name: 'New Customer Onboarding', description: 'Drive key activation milestones in first 90 days.',           category_id: IDS.CAT_ONBOARD, topic_id: IDS.TOP_ONBOARD,  action_ids: [IDS.ACT_006,IDS.ACT_007], channel_ids: ['email','sms','push'], audience_ids: [IDS.AUD_004], policy_id: IDS.POL_001, arbitration: 'propensity' as const, priority: 'high' as const,     status: 'active' as const, eligibility_rules: [{ attribute:'account_age_days',op:'<=',value:'90' },{ attribute:'has_direct_debit',op:'=',value:'false' }] },
];

const AUDIENCES = [
  { id: IDS.AUD_001, tenant_id: TENANT, name: 'Mortgage Holders — No Insurance', description: 'Active mortgage customers who do not have a home insurance policy.',                       rules: [{ attribute:'has_mortgage',op:'=',value:'true' },{ attribute:'has_home_insurance',op:'=',value:'false' }], estimated_size: 12400, status: 'active' },
  { id: IDS.AUD_002, tenant_id: TENANT, name: 'High Spend Transactors',          description: 'Customers spending $2k+ monthly across all card transactions.',                           rules: [{ attribute:'monthly_spend',op:'>=',value:'2000' },{ attribute:'credit_card_tier',op:'!=',value:'platinum' }], estimated_size: 8750,  status: 'active' },
  { id: IDS.AUD_003, tenant_id: TENANT, name: 'Dormant Customers (60d+)',         description: 'Previously active customers with no transaction in 60+ days.',                            rules: [{ attribute:'days_since_last_transaction',op:'>=',value:'60' },{ attribute:'account_status',op:'=',value:'active' }], estimated_size: 5200,  status: 'active' },
  { id: IDS.AUD_004, tenant_id: TENANT, name: 'New Joiners — First 90 Days',     description: "Customers who joined within the last 90 days and haven't completed onboarding.",          rules: [{ attribute:'account_age_days',op:'<=',value:'90' }], estimated_size: 3800,  status: 'active' },
];

const EVENT_TRIGGERS = [
  { id: IDS.TRG_001, tenant_id: TENANT, name: 'Mortgage Application Approved', event_type: 'mortgage.approved', description: 'Fires when a mortgage application is approved — triggers home insurance upsell.', strategy_ids: [IDS.STR_001], event_conditions: { attribute:'status',op:'=',value:'approved' }, channel_ids: ['email','web'], enabled: true, status: 'active' },
  { id: IDS.TRG_002, tenant_id: TENANT, name: 'High-Value Purchase Detected',  event_type: 'transaction.large', description: 'Fires when a single transaction exceeds $500 — triggers premium card upsell.',  strategy_ids: [IDS.STR_002], event_conditions: { attribute:'amount',op:'>=',value:'500' },  channel_ids: ['app','web'],   enabled: true, status: 'active' },
  { id: IDS.TRG_003, tenant_id: TENANT, name: 'Login After 60 Days Inactivity',event_type: 'session.login',    description: 'Fires on login after 60+ day gap — triggers re-engagement offer.',              strategy_ids: [IDS.STR_003], event_conditions: { attribute:'days_since_last_login',op:'>=',value:'60' }, channel_ids: ['web','app'],   enabled: true, status: 'active' },
  { id: IDS.TRG_004, tenant_id: TENANT, name: 'New Account Created',           event_type: 'account.created',  description: 'Fires on new account creation — starts onboarding journey.',                    strategy_ids: [IDS.STR_004], event_conditions: {},                                                         channel_ids: ['email','sms'], enabled: true, status: 'active' },
];

const EXPERIMENTS = [
  {
    id: IDS.EXP_001, tenant_id: TENANT,
    name: 'Insurance Upsell: Email vs Web',
    description: 'Champion/Challenger — comparing email vs web channel for home insurance upsell.',
    strategy_id: IDS.STR_001,
    status: 'running',
    variants: [
      { name: 'Email-first',  action_id: IDS.ACT_001, channel: 'email', traffic_pct: 70, is_champion: true },
      { name: 'Web banner',   action_id: IDS.ACT_001, channel: 'web',   traffic_pct: 30, is_champion: false },
    ],
    traffic_split: { champion: 70, challenger: 30 },
    metric: 'conversion_rate',
    start_date: '2026-05-01', end_date: '2026-07-31',
    auto_promote: true, promote_threshold: 0.05,
    results: { champion_cr: 0.068, challenger_cr: 0.054, p_value: 0.031 },
  },
  {
    id: IDS.EXP_002, tenant_id: TENANT,
    name: 'Platinum Card: Headline Copy Test',
    description: 'A/B test on headline copy for Platinum card upgrade offer.',
    strategy_id: IDS.STR_002,
    status: 'paused',
    variants: [
      { name: 'Points focus',   action_id: IDS.ACT_003, channel: 'web', traffic_pct: 50, is_champion: true },
      { name: 'Prestige focus', action_id: IDS.ACT_003, channel: 'web', traffic_pct: 50, is_champion: false },
    ],
    traffic_split: { champion: 50, challenger: 50 },
    metric: 'click_through_rate',
    start_date: '2026-04-15', end_date: '2026-06-15',
    auto_promote: false, promote_threshold: 0.10,
    results: { champion_cr: 0.042, challenger_cr: 0.039, p_value: 0.21 },
  },
];

const CUSTOMER_PROFILES = [
  {
    customer_id: 'cust-001', tenant_id: TENANT,
    attributes: {
      name: 'Sarah Mitchell',
      age: 38, gender: 'F', email: 'sarah.mitchell@example.com',
      customer_segment: 'affluent', monthly_income: 9500,
      has_mortgage: true, has_home_insurance: false, has_contents_insurance: false,
      credit_card_tier: 'gold', credit_score: 780, monthly_spend: 3200,
      account_status: 'active', account_age_days: 1842,
      days_since_last_transaction: 2, channel_preference: 'email',
      consent: true, marketing_opt_in: true,
      products: ['mortgage', 'savings', 'credit_card'],
    },
    last_seen_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    customer_id: 'cust-002', tenant_id: TENANT,
    attributes: {
      name: 'James Okonkwo',
      age: 44, gender: 'M', email: 'j.okonkwo@example.com',
      customer_segment: 'mass_affluent', monthly_income: 7200,
      has_mortgage: false, has_home_insurance: false, has_contents_insurance: false,
      credit_card_tier: 'standard', credit_score: 710, monthly_spend: 2400,
      account_status: 'active', account_age_days: 3210,
      days_since_last_transaction: 72, channel_preference: 'sms',
      consent: true, marketing_opt_in: true,
      products: ['savings', 'credit_card'],
    },
    last_seen_at: new Date(Date.now() - 72 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    customer_id: 'cust-003', tenant_id: TENANT,
    attributes: {
      name: 'Emma Nguyen',
      age: 27, gender: 'F', email: 'emma.nguyen@example.com',
      customer_segment: 'emerging', monthly_income: 4800,
      has_mortgage: false, has_home_insurance: false, has_contents_insurance: false,
      credit_card_tier: 'none', credit_score: 640, monthly_spend: 890,
      account_status: 'active', account_age_days: 45,
      days_since_last_transaction: 3, channel_preference: 'app',
      consent: true, marketing_opt_in: false,
      has_direct_debit: false,
      products: ['transaction'],
    },
    last_seen_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    customer_id: 'cust-004', tenant_id: TENANT,
    attributes: {
      name: 'David Chen',
      age: 52, gender: 'M', email: 'd.chen@example.com',
      customer_segment: 'high_value', monthly_income: 18000,
      has_mortgage: true, has_home_insurance: true, has_contents_insurance: true,
      credit_card_tier: 'platinum', credit_score: 820, monthly_spend: 7500,
      account_status: 'active', account_age_days: 5480,
      days_since_last_transaction: 1, channel_preference: 'web',
      consent: true, marketing_opt_in: true,
      products: ['mortgage', 'home_insurance', 'contents_insurance', 'credit_card', 'savings', 'term_deposit'],
    },
    last_seen_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    customer_id: 'cust-005', tenant_id: TENANT,
    attributes: {
      name: 'Priya Sharma',
      age: 33, gender: 'F', email: 'priya.sharma@example.com',
      customer_segment: 'mass_market', monthly_income: 5500,
      has_mortgage: true, has_home_insurance: false, has_contents_insurance: false,
      credit_card_tier: 'standard', credit_score: 690, monthly_spend: 1800,
      account_status: 'active', account_age_days: 920,
      days_since_last_transaction: 5, channel_preference: 'email',
      consent: true, marketing_opt_in: true,
      products: ['mortgage', 'credit_card'],
    },
    last_seen_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    customer_id: 'cust-006', tenant_id: TENANT,
    attributes: {
      name: 'Marcus Williams',
      age: 41, gender: 'M', email: 'm.williams@example.com',
      customer_segment: 'affluent', monthly_income: 11200,
      has_mortgage: true, has_home_insurance: false, has_contents_insurance: false,
      credit_card_tier: 'gold', credit_score: 760, monthly_spend: 4100,
      account_status: 'active', account_age_days: 2890,
      days_since_last_transaction: 1, channel_preference: 'web',
      consent: true, marketing_opt_in: true,
      products: ['mortgage', 'savings', 'credit_card'],
    },
    last_seen_at: new Date().toISOString(),
  },
];

const DECISION_LOGS = [
  { tenant_id: TENANT, customer_id: 'cust-001', strategy_id: IDS.STR_001, strategy_name: 'Home Insurance Growth',   action_id: IDS.ACT_001, action_name: 'Home Insurance Upsell',  channel_id: 'email', served: true,  propensity: 0.62, outcome: 'accepted', customer_attributes: { age:38, has_mortgage:true },                     trace: [{ step:'eligibility',passed:true },{ step:'policy',passed:true }], decision_latency_ms: 48 },
  { tenant_id: TENANT, customer_id: 'cust-002', strategy_id: IDS.STR_003, strategy_name: 'Re-engagement Campaign',  action_id: IDS.ACT_005, action_name: 'Loyalty Points Boost',   channel_id: 'email', served: true,  propensity: 0.71, outcome: 'rejected', customer_attributes: { age:44, days_since_last_transaction:72 },          trace: [{ step:'eligibility',passed:true },{ step:'policy',passed:true }], decision_latency_ms: 52 },
  { tenant_id: TENANT, customer_id: 'cust-005', strategy_id: IDS.STR_001, strategy_name: 'Home Insurance Growth',   action_id: IDS.ACT_001, action_name: 'Home Insurance Upsell',  channel_id: 'email', served: true,  propensity: 0.55, outcome: null,       customer_attributes: { age:33, has_mortgage:true },                     trace: [{ step:'eligibility',passed:true }],                               decision_latency_ms: 41 },
  { tenant_id: TENANT, customer_id: 'cust-006', strategy_id: IDS.STR_002, strategy_name: 'Premium Card Cross-sell', action_id: IDS.ACT_003, action_name: 'Platinum Card Upgrade',   channel_id: 'web',   served: true,  propensity: 0.38, outcome: 'accepted', customer_attributes: { monthly_spend:4100, credit_score:760 },           trace: [{ step:'eligibility',passed:true }],                               decision_latency_ms: 39 },
  { tenant_id: TENANT, customer_id: 'cust-003', strategy_id: IDS.STR_004, strategy_name: 'New Customer Onboarding', action_id: IDS.ACT_006, action_name: 'App Activation Nudge',   channel_id: 'sms',   served: true,  propensity: 0.80, outcome: 'accepted', customer_attributes: { age:27, account_age_days:45 },                   trace: [{ step:'eligibility',passed:true }],                               decision_latency_ms: 35 },
  { tenant_id: TENANT, customer_id: 'cust-004', strategy_id: IDS.STR_001, strategy_name: 'Home Insurance Growth',   action_id: IDS.ACT_001, action_name: 'Home Insurance Upsell',  channel_id: 'email', served: false, propensity: 0.62, outcome: null,       customer_attributes: { has_home_insurance:true },                        trace: [{ step:'eligibility',passed:false, reason:'has_home_insurance = true' }], decision_latency_ms: 22, suppression_reason: 'Customer already has home insurance' },
  { tenant_id: TENANT, customer_id: 'cust-001', strategy_id: IDS.STR_002, strategy_name: 'Premium Card Cross-sell', action_id: IDS.ACT_003, action_name: 'Platinum Card Upgrade',   channel_id: 'web',   served: true,  propensity: 0.38, outcome: 'accepted', customer_attributes: { monthly_spend:3200 },                             trace: [],                                                                 decision_latency_ms: 44 },
  { tenant_id: TENANT, customer_id: 'cust-005', strategy_id: IDS.STR_003, strategy_name: 'Re-engagement Campaign',  action_id: IDS.ACT_005, action_name: 'Loyalty Points Boost',   channel_id: 'sms',   served: false, propensity: 0.71, outcome: null,       customer_attributes: {},                                                 trace: [{ step:'policy',passed:false, reason:'max_per_week exceeded' }],  decision_latency_ms: 29, suppression_reason: 'Contact limit reached' },
];

// ─── route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const client = db();
    const [
      { count: cats   }, { count: topics }, { count: actions },
      { count: strats }, { count: auds   }, { count: profs  },
      { count: trigs  }, { count: exps   }, { count: logs   },
      { count: pols   },
    ] = await Promise.all([
      client.from(TBL_CATEGORIES).select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT),
      client.from(TBL_TOPICS).select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT),
      client.from('actions').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT),
      client.from('strategies').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT),
      client.from('audiences').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT),
      client.from('customer_profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT),
      client.from('event_triggers').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT),
      client.from('experiments').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT),
      client.from('decision_log').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT),
      client.from('contact_policies').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT),
    ]);
    return NextResponse.json({
      categories: cats ?? 0, topics: topics ?? 0, actions: actions ?? 0,
      strategies: strats ?? 0, audiences: auds ?? 0, customer_profiles: profs ?? 0,
      event_triggers: trigs ?? 0, experiments: exps ?? 0, decision_logs: logs ?? 0,
      contact_policies: pols ?? 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'DB error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const wipe = body.wipe === true;

  try {
    const client = db();
    const results: Record<string, unknown> = {};

    // Ensure tenant row exists before inserting FK-dependent records
    await ensureTenant(client);

    if (wipe) {
      // decision_log has a no-delete Postgres rule — skip it on wipe
      await Promise.all([
        client.from('experiments').delete().eq('tenant_id', TENANT),
        client.from('event_triggers').delete().eq('tenant_id', TENANT),
        client.from('customer_profiles').delete().eq('tenant_id', TENANT),
        client.from('audiences').delete().eq('tenant_id', TENANT),
        client.from('strategies').delete().eq('tenant_id', TENANT),
        client.from('actions').delete().eq('tenant_id', TENANT),
        client.from('contact_policies').delete().eq('tenant_id', TENANT),
        client.from(TBL_TOPICS).delete().eq('tenant_id', TENANT),
        client.from(TBL_CATEGORIES).delete().eq('tenant_id', TENANT),
      ]);
    }

    // categories + topics
    const { error: catErr } = await client.from(TBL_CATEGORIES).upsert(CATEGORIES, { onConflict: 'id' });
    results.categories = catErr ? `error: ${catErr.message}` : CATEGORIES.length;
    const { error: topErr } = await client.from(TBL_TOPICS).upsert(TOPICS, { onConflict: 'id' });
    results.topics = topErr ? `error: ${topErr.message}` : TOPICS.length;

    // actions
    const { error: actErr } = await client.from('actions').upsert(ACTIONS, { onConflict: 'id' });
    results.actions = actErr ? `error: ${actErr.message}` : ACTIONS.length;

    // contact policies
    const { error: polErr } = await client.from('contact_policies').upsert(POLICIES, { onConflict: 'id' });
    results.contact_policies = polErr ? `error: ${polErr.message}` : POLICIES.length;

    // strategies
    const { error: strErr } = await client.from('strategies').upsert(STRATEGIES, { onConflict: 'id' });
    results.strategies = strErr ? `error: ${strErr.message}` : STRATEGIES.length;

    // audiences
    const { error: audErr } = await client.from('audiences').upsert(AUDIENCES, { onConflict: 'id' });
    results.audiences = audErr ? `error: ${audErr.message}` : AUDIENCES.length;

    // event triggers
    const { error: trgErr } = await client.from('event_triggers').upsert(EVENT_TRIGGERS, { onConflict: 'id' });
    results.event_triggers = trgErr ? `error: ${trgErr.message}` : EVENT_TRIGGERS.length;

    // experiments
    const { error: expErr } = await client.from('experiments').upsert(EXPERIMENTS, { onConflict: 'id' });
    results.experiments = expErr ? `error: ${expErr.message}` : EXPERIMENTS.length;

    // customer profiles via upsert
    let profCount = 0;
    for (const p of CUSTOMER_PROFILES) {
      const { error: profErr } = await client.from('customer_profiles').upsert(
        { ...p, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,customer_id' }
      );
      if (!profErr) profCount++;
    }
    results.customer_profiles = profCount;

    // decision logs — append-only (no update/delete), use insert with ignoreDuplicates
    const LOG_IDS = [
      'c0000001-1000-4000-a000-000000000001',
      'c0000002-1000-4000-a000-000000000002',
      'c0000003-1000-4000-a000-000000000003',
      'c0000004-1000-4000-a000-000000000004',
      'c0000005-1000-4000-a000-000000000005',
      'c0000006-1000-4000-a000-000000000006',
      'c0000007-1000-4000-a000-000000000007',
      'c0000008-1000-4000-a000-000000000008',
    ];
    const { error: logErr } = await client.from('decision_log').upsert(
      DECISION_LOGS.map((l, i) => ({ ...l, id: LOG_IDS[i], created_at: new Date(Date.now() - i * 3600000).toISOString() })),
      { onConflict: 'id', ignoreDuplicates: true }
    );
    results.decision_logs = logErr ? `error: ${logErr.message}` : DECISION_LOGS.length;

    return NextResponse.json({ ok: true, seeded: results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Seed failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
