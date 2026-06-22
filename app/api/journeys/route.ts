import { NextRequest, NextResponse } from 'next/server';
import { IS_CONFIGURED, serviceSupabase } from '@/lib/supabase';
import { writeAudit, detectAction } from '@/lib/audit';
import { requireAuth } from '@/lib/api-guard';

const DEFAULT_TENANT = 'f0000000-0000-4000-a000-000000000001';
const ENTITY = 'journey';

const VALID_INDUSTRIES = ['banking','insurance','retail','telecoms','healthcare','automotive','custom'];
const VALID_STATUS     = ['draft','active','paused','archived'];

interface JourneyStage {
  id: string;
  name: string;
  day: number;
  channel: string;
  action_name: string;
  condition: string;
  wait_days: number;
  exit_on: string[];
}

interface JourneyTemplate {
  id: string;
  name: string;
  industry: string;
  line_of_business: string;
  description: string;
  estimated_duration_days: number;
  stages: JourneyStage[];
}

const JOURNEY_TEMPLATES: JourneyTemplate[] = [
  // ── BANKING ──────────────────────────────────────────────────────────────────
  {
    id: 'tpl-banking-onboard',
    name: 'New Customer Onboarding',
    industry: 'banking',
    line_of_business: 'Retail Banking',
    description: 'Guide new customers through account activation, first transaction, and digital adoption.',
    estimated_duration_days: 30,
    stages: [
      { id: 's1', name: 'Welcome Email', day: 0, channel: 'email', action_name: 'Send Welcome Pack', condition: 'account_opened = true', wait_days: 0, exit_on: ['opted_out'] },
      { id: 's2', name: 'App Download Nudge', day: 2, channel: 'sms', action_name: 'Prompt App Install', condition: 'app_installed = false', wait_days: 2, exit_on: ['app_installed'] },
      { id: 's3', name: 'First Deposit Incentive', day: 5, channel: 'email', action_name: 'Offer Bonus Interest', condition: 'first_deposit = false', wait_days: 3, exit_on: ['deposited', 'opted_out'] },
      { id: 's4', name: 'Card Activation Reminder', day: 10, channel: 'push', action_name: 'Activate Card CTA', condition: 'card_activated = false', wait_days: 5, exit_on: ['card_activated'] },
      { id: 's5', name: 'Digital Banking Tutorial', day: 14, channel: 'in_app', action_name: 'Show Feature Tour', condition: 'tutorial_completed = false', wait_days: 4, exit_on: ['tutorial_completed', 'opted_out'] },
    ],
  },
  {
    id: 'tpl-banking-mortgage',
    name: 'Mortgage Cross-Sell',
    industry: 'banking',
    line_of_business: 'Home Loans',
    description: 'Identify eligible customers and guide them through a mortgage enquiry funnel.',
    estimated_duration_days: 21,
    stages: [
      { id: 's1', name: 'Eligibility Signal', day: 0, channel: 'email', action_name: 'Mortgage Rate Alert', condition: 'savings_balance > 20000', wait_days: 0, exit_on: ['not_interested'] },
      { id: 's2', name: 'Calculator Tool Push', day: 3, channel: 'push', action_name: 'Try Mortgage Calculator', condition: 'clicked_email = true', wait_days: 3, exit_on: ['calculator_used', 'opted_out'] },
      { id: 's3', name: 'Adviser Booking', day: 7, channel: 'email', action_name: 'Book Free Consultation', condition: 'calculator_used = true', wait_days: 4, exit_on: ['appointment_booked', 'opted_out'] },
      { id: 's4', name: 'Document Checklist', day: 10, channel: 'sms', action_name: 'Send Docs Checklist', condition: 'appointment_booked = true', wait_days: 3, exit_on: ['documents_submitted'] },
    ],
  },
  {
    id: 'tpl-banking-churn',
    name: 'At-Risk Customer Win-Back',
    industry: 'banking',
    line_of_business: 'Retail Banking',
    description: 'Re-engage dormant or at-risk customers with targeted incentives.',
    estimated_duration_days: 14,
    stages: [
      { id: 's1', name: 'Dormancy Alert Email', day: 0, channel: 'email', action_name: 'We Miss You Offer', condition: 'days_inactive > 60', wait_days: 0, exit_on: ['logged_in', 'opted_out'] },
      { id: 's2', name: 'Fee Waiver SMS', day: 4, channel: 'sms', action_name: 'Waive Monthly Fee', condition: 'opened_email = false', wait_days: 4, exit_on: ['accepted', 'opted_out'] },
      { id: 's3', name: 'Cashback Offer', day: 9, channel: 'email', action_name: 'Cashback on Next 3 Txns', condition: 'still_inactive = true', wait_days: 5, exit_on: ['accepted', 'opted_out'] },
    ],
  },

  // ── INSURANCE ─────────────────────────────────────────────────────────────────
  {
    id: 'tpl-insurance-renewal',
    name: 'Policy Renewal Campaign',
    industry: 'insurance',
    line_of_business: 'Motor Insurance',
    description: 'Proactively renew policies before expiry with multi-touch reminders.',
    estimated_duration_days: 45,
    stages: [
      { id: 's1', name: '45-Day Notice', day: 0, channel: 'email', action_name: 'Renewal Reminder', condition: 'days_to_expiry = 45', wait_days: 0, exit_on: ['renewed', 'opted_out'] },
      { id: 's2', name: '30-Day SMS', day: 15, channel: 'sms', action_name: 'Renewal Urgency SMS', condition: 'renewed = false', wait_days: 15, exit_on: ['renewed', 'opted_out'] },
      { id: 's3', name: 'Loyalty Discount', day: 30, channel: 'email', action_name: 'Offer Loyalty Discount', condition: 'renewed = false', wait_days: 15, exit_on: ['renewed', 'opted_out'] },
      { id: 's4', name: 'Final Call', day: 42, channel: 'sms', action_name: '24h Final Reminder', condition: 'renewed = false', wait_days: 12, exit_on: ['renewed', 'lapsed'] },
    ],
  },
  {
    id: 'tpl-insurance-claim',
    name: 'Post-Claim Care Journey',
    industry: 'insurance',
    line_of_business: 'Home Insurance',
    description: 'Retain and reassure customers following a claims experience.',
    estimated_duration_days: 28,
    stages: [
      { id: 's1', name: 'Claim Acknowledgement', day: 0, channel: 'email', action_name: 'Claim Received Email', condition: 'claim_lodged = true', wait_days: 0, exit_on: [] },
      { id: 's2', name: 'Progress Update', day: 5, channel: 'sms', action_name: 'Claim Status Update', condition: 'claim_settled = false', wait_days: 5, exit_on: ['claim_settled'] },
      { id: 's3', name: 'Satisfaction Survey', day: 14, channel: 'email', action_name: 'Rate Your Experience', condition: 'claim_settled = true', wait_days: 9, exit_on: ['survey_completed', 'opted_out'] },
      { id: 's4', name: 'Upsell Contents Cover', day: 21, channel: 'email', action_name: 'Upgrade to Premium', condition: 'survey_score >= 4', wait_days: 7, exit_on: ['accepted', 'opted_out'] },
    ],
  },
  {
    id: 'tpl-insurance-onboard',
    name: 'New Policyholder Onboarding',
    industry: 'insurance',
    line_of_business: 'Life Insurance',
    description: 'Educate and engage new policyholders on their coverage and benefits.',
    estimated_duration_days: 21,
    stages: [
      { id: 's1', name: 'Policy Welcome', day: 0, channel: 'email', action_name: 'Welcome & Policy Summary', condition: 'policy_issued = true', wait_days: 0, exit_on: [] },
      { id: 's2', name: 'Benefits Explainer', day: 3, channel: 'email', action_name: 'What You Are Covered For', condition: 'welcome_opened = true', wait_days: 3, exit_on: ['opted_out'] },
      { id: 's3', name: 'App Registration', day: 7, channel: 'sms', action_name: 'Register on My Insurance App', condition: 'app_registered = false', wait_days: 4, exit_on: ['app_registered'] },
      { id: 's4', name: 'Beneficiary Prompt', day: 14, channel: 'email', action_name: 'Add a Beneficiary', condition: 'beneficiary_added = false', wait_days: 7, exit_on: ['beneficiary_added', 'opted_out'] },
    ],
  },

  // ── RETAIL ────────────────────────────────────────────────────────────────────
  {
    id: 'tpl-retail-abandon',
    name: 'Abandoned Cart Recovery',
    industry: 'retail',
    line_of_business: 'eCommerce',
    description: 'Recover lost revenue from shoppers who abandon their carts.',
    estimated_duration_days: 7,
    stages: [
      { id: 's1', name: 'First Reminder', day: 0, channel: 'email', action_name: 'You Left Something Behind', condition: 'cart_abandoned = true', wait_days: 0, exit_on: ['purchased', 'opted_out'] },
      { id: 's2', name: 'Social Proof Push', day: 1, channel: 'push', action_name: 'Others Are Viewing This', condition: 'purchased = false', wait_days: 1, exit_on: ['purchased', 'opted_out'] },
      { id: 's3', name: 'Discount Offer', day: 3, channel: 'email', action_name: '10% Off Your Cart', condition: 'purchased = false', wait_days: 2, exit_on: ['purchased', 'opted_out'] },
      { id: 's4', name: 'Last Chance SMS', day: 6, channel: 'sms', action_name: 'Cart Expiring Soon', condition: 'purchased = false', wait_days: 3, exit_on: ['purchased', 'cart_cleared'] },
    ],
  },
  {
    id: 'tpl-retail-loyalty',
    name: 'Loyalty Programme Activation',
    industry: 'retail',
    line_of_business: 'Loyalty & Rewards',
    description: 'Drive sign-ups and first redemption for loyalty programme members.',
    estimated_duration_days: 30,
    stages: [
      { id: 's1', name: 'Enrolment Invite', day: 0, channel: 'email', action_name: 'Join Our Rewards Club', condition: 'loyalty_member = false', wait_days: 0, exit_on: ['enrolled', 'opted_out'] },
      { id: 's2', name: 'Points Explainer', day: 1, channel: 'email', action_name: 'How Points Work', condition: 'enrolled = true', wait_days: 1, exit_on: [] },
      { id: 's3', name: 'First Purchase Bonus', day: 7, channel: 'push', action_name: 'Double Points This Weekend', condition: 'first_purchase = false', wait_days: 6, exit_on: ['first_purchase'] },
      { id: 's4', name: 'Tier Progress Nudge', day: 21, channel: 'email', action_name: 'You Are Close to Silver', condition: 'tier = bronze', wait_days: 14, exit_on: ['tier_upgraded', 'opted_out'] },
    ],
  },
  {
    id: 'tpl-retail-winback',
    name: 'Lapsed Customer Win-Back',
    industry: 'retail',
    line_of_business: 'eCommerce',
    description: 'Re-engage customers who have not purchased in 90+ days.',
    estimated_duration_days: 14,
    stages: [
      { id: 's1', name: 'We Miss You', day: 0, channel: 'email', action_name: 'Personalised Miss You Offer', condition: 'days_since_purchase > 90', wait_days: 0, exit_on: ['purchased', 'opted_out'] },
      { id: 's2', name: 'Exclusive Discount', day: 4, channel: 'email', action_name: '20% Exclusive Discount', condition: 'purchased = false', wait_days: 4, exit_on: ['purchased', 'opted_out'] },
      { id: 's3', name: 'Final Nudge', day: 11, channel: 'sms', action_name: 'Your Discount Expires Tomorrow', condition: 'purchased = false', wait_days: 7, exit_on: ['purchased', 'unsubscribed'] },
    ],
  },

  // ── TELECOMS ──────────────────────────────────────────────────────────────────
  {
    id: 'tpl-telecoms-upgrade',
    name: 'Handset Upgrade Upsell',
    industry: 'telecoms',
    line_of_business: 'Mobile',
    description: 'Prompt eligible customers to upgrade their device at contract renewal.',
    estimated_duration_days: 30,
    stages: [
      { id: 's1', name: 'Upgrade Eligible Alert', day: 0, channel: 'sms', action_name: 'You Are Eligible to Upgrade', condition: 'months_remaining <= 3', wait_days: 0, exit_on: ['upgraded', 'opted_out'] },
      { id: 's2', name: 'Device Showcase', day: 3, channel: 'email', action_name: 'Latest Handsets for You', condition: 'clicked_sms = true', wait_days: 3, exit_on: ['upgraded', 'opted_out'] },
      { id: 's3', name: 'Trade-In Offer', day: 10, channel: 'email', action_name: 'Get £150 Trade-In Value', condition: 'upgraded = false', wait_days: 7, exit_on: ['upgraded', 'opted_out'] },
      { id: 's4', name: 'Call Centre Prompt', day: 21, channel: 'push', action_name: 'Speak to an Expert', condition: 'upgraded = false', wait_days: 11, exit_on: ['call_booked', 'upgraded'] },
    ],
  },
  {
    id: 'tpl-telecoms-churn',
    name: 'Churn Prevention',
    industry: 'telecoms',
    line_of_business: 'Broadband',
    description: 'Identify and rescue customers at high churn risk before contract end.',
    estimated_duration_days: 21,
    stages: [
      { id: 's1', name: 'Retention Offer', day: 0, channel: 'email', action_name: 'Exclusive Loyalty Deal', condition: 'churn_score > 0.7', wait_days: 0, exit_on: ['retained', 'opted_out'] },
      { id: 's2', name: 'Speed Upgrade', day: 5, channel: 'sms', action_name: 'Free Speed Boost', condition: 'retained = false', wait_days: 5, exit_on: ['retained', 'opted_out'] },
      { id: 's3', name: 'Adviser Call', day: 12, channel: 'email', action_name: 'We Would Like to Call You', condition: 'retained = false', wait_days: 7, exit_on: ['retained', 'churned'] },
    ],
  },
  {
    id: 'tpl-telecoms-onboard',
    name: 'New Subscriber Onboarding',
    industry: 'telecoms',
    line_of_business: 'Mobile',
    description: 'Ensure new subscribers activate services and experience full value quickly.',
    estimated_duration_days: 14,
    stages: [
      { id: 's1', name: 'SIM Activation Guide', day: 0, channel: 'sms', action_name: 'Activate Your SIM Now', condition: 'sim_activated = false', wait_days: 0, exit_on: ['sim_activated'] },
      { id: 's2', name: 'App Setup', day: 2, channel: 'email', action_name: 'Download My Account App', condition: 'app_installed = false', wait_days: 2, exit_on: ['app_installed'] },
      { id: 's3', name: 'Data Usage Tips', day: 5, channel: 'push', action_name: 'Get the Most from Your Data', condition: 'app_installed = true', wait_days: 3, exit_on: ['opted_out'] },
      { id: 's4', name: 'Add-On Upsell', day: 10, channel: 'email', action_name: 'Add International Calling', condition: 'addon_active = false', wait_days: 5, exit_on: ['accepted', 'opted_out'] },
    ],
  },

  // ── HEALTHCARE ────────────────────────────────────────────────────────────────
  {
    id: 'tpl-healthcare-appt',
    name: 'Appointment Reminder & Follow-Up',
    industry: 'healthcare',
    line_of_business: 'Primary Care',
    description: 'Reduce no-shows and drive post-appointment care plan adherence.',
    estimated_duration_days: 14,
    stages: [
      { id: 's1', name: '7-Day Reminder', day: 0, channel: 'email', action_name: 'Appointment Reminder', condition: 'days_to_appt = 7', wait_days: 0, exit_on: ['cancelled', 'rescheduled'] },
      { id: 's2', name: '24h SMS Reminder', day: 6, channel: 'sms', action_name: 'Tomorrow Reminder', condition: 'appt_confirmed = false', wait_days: 6, exit_on: ['confirmed', 'cancelled'] },
      { id: 's3', name: 'Post-Appt Care Plan', day: 8, channel: 'email', action_name: 'Your Care Plan', condition: 'appt_attended = true', wait_days: 2, exit_on: [] },
      { id: 's4', name: 'Medication Adherence', day: 11, channel: 'push', action_name: 'Take Your Medication Reminder', condition: 'prescription_issued = true', wait_days: 3, exit_on: ['opted_out'] },
    ],
  },
  {
    id: 'tpl-healthcare-wellness',
    name: 'Preventive Wellness Programme',
    industry: 'healthcare',
    line_of_business: 'Health Insurance',
    description: 'Engage members in annual health checks and wellness incentives.',
    estimated_duration_days: 30,
    stages: [
      { id: 's1', name: 'Annual Check Invite', day: 0, channel: 'email', action_name: 'Book Your Health MOT', condition: 'health_check_due = true', wait_days: 0, exit_on: ['booked', 'opted_out'] },
      { id: 's2', name: 'Wellness Reward', day: 7, channel: 'push', action_name: 'Earn Points for Health Goals', condition: 'app_connected = true', wait_days: 7, exit_on: [] },
      { id: 's3', name: 'Check Reminder', day: 21, channel: 'sms', action_name: 'Still Time to Book', condition: 'booked = false', wait_days: 14, exit_on: ['booked', 'opted_out'] },
    ],
  },
  {
    id: 'tpl-healthcare-chronic',
    name: 'Chronic Condition Support Journey',
    industry: 'healthcare',
    line_of_business: 'Chronic Care Management',
    description: 'Ongoing engagement plan for patients managing a long-term condition.',
    estimated_duration_days: 90,
    stages: [
      { id: 's1', name: 'Care Plan Introduction', day: 0, channel: 'email', action_name: 'Your Personalised Care Plan', condition: 'diagnosis_confirmed = true', wait_days: 0, exit_on: [] },
      { id: 's2', name: 'Monthly Check-In', day: 30, channel: 'sms', action_name: 'Monthly Health Check-In', condition: 'active = true', wait_days: 30, exit_on: ['opted_out'] },
      { id: 's3', name: 'Lifestyle Tips', day: 45, channel: 'email', action_name: 'Tips for Managing Your Condition', condition: 'active = true', wait_days: 15, exit_on: ['opted_out'] },
      { id: 's4', name: 'Second Check-In', day: 60, channel: 'sms', action_name: '60-Day Check-In', condition: 'active = true', wait_days: 15, exit_on: ['opted_out'] },
      { id: 's5', name: 'Specialist Referral', day: 75, channel: 'email', action_name: 'Connect With a Specialist', condition: 'specialist_needed = true', wait_days: 15, exit_on: ['referral_accepted', 'opted_out'] },
    ],
  },

  // ── AUTOMOTIVE ────────────────────────────────────────────────────────────────
  {
    id: 'tpl-auto-service',
    name: 'Vehicle Service Reminder',
    industry: 'automotive',
    line_of_business: 'Aftersales',
    description: 'Drive service bookings and upsell maintenance packages.',
    estimated_duration_days: 21,
    stages: [
      { id: 's1', name: 'Service Due Alert', day: 0, channel: 'email', action_name: 'Your Car Is Due a Service', condition: 'months_since_service >= 11', wait_days: 0, exit_on: ['booked', 'opted_out'] },
      { id: 's2', name: 'Online Booking Push', day: 5, channel: 'sms', action_name: 'Book Online in 60 Seconds', condition: 'booked = false', wait_days: 5, exit_on: ['booked', 'opted_out'] },
      { id: 's3', name: 'Service Pack Offer', day: 10, channel: 'email', action_name: 'Save with a Service Plan', condition: 'booked = false', wait_days: 5, exit_on: ['booked', 'opted_out'] },
      { id: 's4', name: 'Final Reminder', day: 18, channel: 'sms', action_name: 'Dont Delay Your Service', condition: 'booked = false', wait_days: 8, exit_on: ['booked', 'declined'] },
    ],
  },
  {
    id: 'tpl-auto-finance',
    name: 'Finance Renewal Journey',
    industry: 'automotive',
    line_of_business: 'Motor Finance',
    description: 'Retain PCP/HP customers at end of agreement and encourage upgrade.',
    estimated_duration_days: 60,
    stages: [
      { id: 's1', name: '3-Month Finance Alert', day: 0, channel: 'email', action_name: 'Your Agreement Is Ending Soon', condition: 'months_to_end = 3', wait_days: 0, exit_on: ['responded', 'opted_out'] },
      { id: 's2', name: 'New Model Showcase', day: 14, channel: 'email', action_name: 'See the Latest Models', condition: 'responded = true', wait_days: 14, exit_on: ['test_drive_booked'] },
      { id: 's3', name: 'Equity Statement', day: 28, channel: 'sms', action_name: 'Your Equity Value Is Ready', condition: 'test_drive_booked = false', wait_days: 14, exit_on: ['responded'] },
      { id: 's4', name: 'Dealer Outreach', day: 45, channel: 'email', action_name: 'Your Local Dealer Will Call', condition: 'agreement_renewed = false', wait_days: 17, exit_on: ['agreement_renewed', 'declined'] },
    ],
  },
  {
    id: 'tpl-auto-insurance',
    name: 'GAP & Warranty Upsell',
    industry: 'automotive',
    line_of_business: 'Motor Insurance',
    description: 'Offer GAP insurance and extended warranty to recent vehicle purchasers.',
    estimated_duration_days: 14,
    stages: [
      { id: 's1', name: 'Purchase Congratulations', day: 0, channel: 'email', action_name: 'Welcome to Your New Car', condition: 'vehicle_purchased = true', wait_days: 0, exit_on: [] },
      { id: 's2', name: 'GAP Insurance Offer', day: 3, channel: 'email', action_name: 'Protect Your Investment with GAP', condition: 'gap_insurance = false', wait_days: 3, exit_on: ['accepted', 'opted_out'] },
      { id: 's3', name: 'Warranty Upsell', day: 7, channel: 'email', action_name: 'Extend Your Warranty', condition: 'extended_warranty = false', wait_days: 4, exit_on: ['accepted', 'opted_out'] },
    ],
  },
];

export async function GET(req: NextRequest) {
  const templates = req.nextUrl.searchParams.get('templates');
  if (templates === 'true') {
    return NextResponse.json({ data: JOURNEY_TEMPLATES });
  }

  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? DEFAULT_TENANT;
  const limit    = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '100'), 500);
  const offset   = Math.max(Number(req.nextUrl.searchParams.get('offset') ?? '0'), 0);
  if (!IS_CONFIGURED) return NextResponse.json({ data: [], configured: false });

  const { data, error, count } = await serviceSupabase!
    .from('journeys')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, configured: true });
}

export async function POST(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const guard = await requireAuth('strategies:write');
  if (!guard.ok) return guard.res;
  const tenantId = guard.ctx.tenantId;
  const actor    = guard.ctx.email ?? (body.actor as string) ?? 'system';

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 422 });
  if (body.industry && !VALID_INDUSTRIES.includes(body.industry as string))
    return NextResponse.json({ error: `Invalid industry: ${body.industry}` }, { status: 422 });
  if (body.status && !VALID_STATUS.includes(body.status as string))
    return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 422 });

  let stages = body.stages ?? [];
  let templateId: string | null = null;

  if (body.from_template && body.template_id) {
    const tpl = JOURNEY_TEMPLATES.find(t => t.id === body.template_id);
    if (tpl) {
      stages = tpl.stages;
      templateId = tpl.id;
    }
  }

  const payload = {
    tenant_id:        tenantId,
    name,
    description:      body.description ?? null,
    industry:         body.industry ?? null,
    line_of_business: body.line_of_business ?? null,
    stages,
    status:           body.status ?? 'draft',
    template_id:      templateId ?? (body.template_id as string | null) ?? null,
    updated_by:       actor,
    updated_at:       new Date().toISOString(),
  };

  let data: Record<string, unknown> | null = null, error: { message: string } | null = null;
  let before: Record<string, unknown> | null = null;

  if (body.id) {
    ({ data: before } = await serviceSupabase!
      .from('journeys').select('*').eq('id', body.id).eq('tenant_id', tenantId).single());
    ({ data, error } = await serviceSupabase!
      .from('journeys').update(payload).eq('id', body.id).eq('tenant_id', tenantId).select().single());
  } else {
    ({ data, error } = await serviceSupabase!
      .from('journeys').insert({ ...payload, created_by: actor }).select().single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    tenantId, entityType: ENTITY, entityId: String(data!.id), entityName: name,
    action: body.id ? detectAction(before?.status, data!.status) : 'created',
    changedBy: actor, before, after: data,
  });

  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!IS_CONFIGURED) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const guard = await requireAuth('strategies:write');
  if (!guard.ok) return guard.res;
  const id = req.nextUrl.searchParams.get('id');
  const tenantId = guard.ctx.tenantId;
  const actor = guard.ctx.email ?? req.nextUrl.searchParams.get('actor') ?? 'system';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: before } = await serviceSupabase!
    .from('journeys').select('*').eq('id', id).eq('tenant_id', tenantId).single();

  const { error } = await serviceSupabase!
    .from('journeys')
    .update({ deleted_at: new Date().toISOString(), updated_by: actor })
    .eq('id', id).eq('tenant_id', tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    tenantId, entityType: ENTITY, entityId: id,
    entityName: (before?.name as string) ?? undefined,
    action: 'deleted', changedBy: actor, before, after: null,
  });

  return NextResponse.json({ success: true });
}
