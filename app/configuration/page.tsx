'use client';

import { useState } from 'react';
import { useStore, INDUSTRY_TEMPLATES, IndustryTemplate } from '@/lib/store';
import { usePermission } from '@/lib/auth';
import { CheckCircle2, Sparkles, AlertTriangle, ChevronRight, Layers, Radio, GitBranch } from 'lucide-react';

// ── Full taxonomy seed data per industry ─────────────────────────────────────

const TEMPLATE_SEEDS: Record<IndustryTemplate, {
  categories: { name: string; color: string; description: string }[];
  topics: { categoryName: string; name: string; description: string }[];
  actions: { topicName: string; name: string; channels: string[]; propensity: number; headline: string; offerCode: string }[];
  policies: { name: string; maxPerDay: number; maxPerWeek: number; maxPerMonth: number; fairness: boolean }[];
}> = {
  retail_banking: {
    categories: [
      { name: 'Acquisition',     color: '#1D4ED8', description: 'Bring in new customers to the bank' },
      { name: 'Cross-sell',      color: '#7C3AED', description: 'Offer additional products to existing customers' },
      { name: 'Upsell',          color: '#059669', description: 'Upgrade customers to premium products' },
      { name: 'Retention',       color: '#D97706', description: 'Prevent customer churn and disengagement' },
      { name: 'Nurture',         color: '#DC2626', description: 'Deepen engagement with low-activity customers' },
      { name: 'Win-back',        color: '#0891B2', description: 'Re-engage lapsed or churned customers' },
    ],
    topics: [
      { categoryName:'Cross-sell',  name:'Mortgage Offers',          description:'Home loan and remortgage opportunities' },
      { categoryName:'Cross-sell',  name:'Credit Card Offers',       description:'New and upgrade credit card offers' },
      { categoryName:'Cross-sell',  name:'Savings & ISAs',           description:'Savings accounts and ISA products' },
      { categoryName:'Cross-sell',  name:'Personal Loans',           description:'Unsecured personal lending' },
      { categoryName:'Cross-sell',  name:'Investments & Pensions',   description:'Wealth and investment products' },
      { categoryName:'Upsell',      name:'Premium Current Account',  description:'Upgrade from standard to premium account' },
      { categoryName:'Upsell',      name:'Platinum Card Upgrade',    description:'Upgrade to Platinum credit card' },
      { categoryName:'Retention',   name:'Churn Prevention',         description:'Retain at-risk customers' },
      { categoryName:'Retention',   name:'Digital Adoption',         description:'Move customers to digital channels' },
      { categoryName:'Acquisition', name:'Current Account Switch',   description:'Current account switching incentive' },
    ],
    actions: [
      { topicName:'Mortgage Offers',         name:'Remortgage Deal Alert',        channels:['email','web'],              propensity:0.72, headline:'Your fixed rate is ending soon',    offerCode:'MORT-Q1' },
      { topicName:'Mortgage Offers',         name:'First-Time Buyer Guide',       channels:['web','paid_social'],        propensity:0.61, headline:'Take your first step onto the ladder', offerCode:'FTB-2026' },
      { topicName:'Credit Card Offers',      name:'Platinum Card Upgrade',        channels:['email','mobile_app'],       propensity:0.68, headline:'Upgrade to Platinum — 0% for 24 months', offerCode:'PLAT-UP' },
      { topicName:'Credit Card Offers',      name:'Cashback Card Offer',          channels:['email','paid_social'],      propensity:0.59, headline:'Earn 1% cashback on everything',      offerCode:'CB-NEW' },
      { topicName:'Savings & ISAs',          name:'Cash ISA Top-Up Reminder',     channels:['email','push'],             propensity:0.77, headline:'Use your £20,000 ISA allowance',       offerCode:'ISA-Q1' },
      { topicName:'Personal Loans',          name:'Pre-Approved Loan Offer',      channels:['mobile_app','email'],       propensity:0.64, headline:'You\'re pre-approved up to £25,000',  offerCode:'LOAN-PA' },
      { topicName:'Premium Current Account', name:'Premium Account Upgrade',      channels:['email','branch'],           propensity:0.55, headline:'Upgrade to Premium — travel insurance included', offerCode:'PREM-UP' },
      { topicName:'Digital Adoption',        name:'Mobile Banking Activation',    channels:['email','sms'],              propensity:0.82, headline:'Set up mobile banking in 2 minutes',   offerCode:'MOB-ACT' },
      { topicName:'Churn Prevention',        name:'Loyalty Reward Offer',         channels:['email','mobile_app'],       propensity:0.88, headline:'A thank you for 5 years with us',       offerCode:'LOYAL-5Y' },
    ],
    policies: [
      { name:'Global Contact Policy',   maxPerDay:2, maxPerWeek:5,  maxPerMonth:15, fairness:false },
      { name:'Email Frequency Policy',  maxPerDay:1, maxPerWeek:3,  maxPerMonth:8,  fairness:false },
      { name:'High-Value Policy',       maxPerDay:1, maxPerWeek:2,  maxPerMonth:6,  fairness:true  },
    ],
  },
  insurance: {
    categories: [
      { name:'Acquisition',       color:'#1D4ED8', description:'New-to-book customers' },
      { name:'Renewal',           color:'#059669', description:'Policy renewal and retention' },
      { name:'Cross-sell',        color:'#7C3AED', description:'Additional product lines' },
      { name:'Claims Prevention', color:'#DC2626', description:'Reduce claims through proactive outreach' },
      { name:'Retention',         color:'#D97706', description:'Prevent policy lapse and churn' },
    ],
    topics: [
      { categoryName:'Renewal',           name:'Motor Renewal',           description:'Car insurance renewal' },
      { categoryName:'Renewal',           name:'Home Renewal',            description:'Home and contents renewal' },
      { categoryName:'Cross-sell',        name:'Life Cover',              description:'Life insurance cross-sell' },
      { categoryName:'Cross-sell',        name:'Health Insurance',        description:'Private health add-ons' },
      { categoryName:'Claims Prevention', name:'Safe Driving Tips',       description:'Telematics-based safety nudges' },
      { categoryName:'Retention',         name:'Loyal Customer Rewards',  description:'Multi-year customer benefits' },
    ],
    actions: [
      { topicName:'Motor Renewal',         name:'Renewal Quote Ready',        channels:['email','sms'],        propensity:0.85, headline:'Your motor insurance renewal is ready', offerCode:'MOT-REN' },
      { topicName:'Home Renewal',          name:'Home Cover Renewal',         channels:['email','mobile_app'], propensity:0.82, headline:'Renew your home insurance today',       offerCode:'HOME-REN' },
      { topicName:'Life Cover',            name:'Life Cover Quote',           channels:['email','web'],        propensity:0.48, headline:'Protect what matters most',            offerCode:'LIFE-Q' },
      { topicName:'Safe Driving Tips',     name:'Driving Score Alert',        channels:['push','email'],       propensity:0.71, headline:'Your driving score this month',         offerCode:'DRV-SCR' },
      { topicName:'Loyal Customer Rewards',name:'Multi-Policy Discount',      channels:['email','mobile_app'], propensity:0.78, headline:'Save 15% with a second policy',        offerCode:'MULTI-15' },
    ],
    policies: [
      { name:'Renewal Contact Policy',  maxPerDay:1, maxPerWeek:3, maxPerMonth:8,  fairness:false },
      { name:'Claims Period Policy',    maxPerDay:2, maxPerWeek:5, maxPerMonth:12, fairness:false },
    ],
  },
  telco: {
    categories: [
      { name:'Acquisition',    color:'#1D4ED8', description:'Win new subscribers' },
      { name:'Upgrade',        color:'#7C3AED', description:'Device and plan upgrades' },
      { name:'Retention',      color:'#D97706', description:'Reduce churn' },
      { name:'Cross-sell',     color:'#059669', description:'Bundle and add-on sales' },
      { name:'Churn Prevention', color:'#DC2626', description:'Re-engage at-risk subscribers' },
    ],
    topics: [
      { categoryName:'Upgrade',         name:'Handset Upgrade',        description:'New device offers' },
      { categoryName:'Upgrade',         name:'Plan Upsell',            description:'Move to higher data plan' },
      { categoryName:'Cross-sell',      name:'Broadband Bundle',       description:'Add home broadband' },
      { categoryName:'Cross-sell',      name:'TV & Entertainment',     description:'Streaming add-ons' },
      { categoryName:'Churn Prevention',name:'Loyalty Offers',         description:'Targeted retention deals' },
      { categoryName:'Retention',       name:'Roaming Packages',       description:'International travel add-ons' },
    ],
    actions: [
      { topicName:'Handset Upgrade',   name:'New iPhone Offer',          channels:['sms','email','paid_social'],  propensity:0.67, headline:'Time for a new phone?',               offerCode:'IPHONE-UP' },
      { topicName:'Plan Upsell',       name:'Unlimited Data Upgrade',    channels:['push','email'],               propensity:0.73, headline:'Switch to Unlimited — same price',   offerCode:'UNLIM-1' },
      { topicName:'Broadband Bundle',  name:'Fibre Broadband Bundle',    channels:['email','paid_search'],        propensity:0.55, headline:'Add home broadband, save £10/month', offerCode:'FIBRE-BND' },
      { topicName:'Loyalty Offers',    name:'Stay & Save Offer',         channels:['sms','email'],                propensity:0.81, headline:'Stay with us — here\'s a thank you', offerCode:'STAY-SAVE' },
    ],
    policies: [
      { name:'Mobile Contact Policy', maxPerDay:2, maxPerWeek:4, maxPerMonth:10, fairness:false },
      { name:'Churn Window Policy',   maxPerDay:3, maxPerWeek:6, maxPerMonth:14, fairness:false },
    ],
  },
  retail: {
    categories: [
      { name:'Acquisition',    color:'#1D4ED8', description:'New customer acquisition' },
      { name:'Loyalty',        color:'#7C3AED', description:'Loyalty programme engagement' },
      { name:'Replenishment',  color:'#059669', description:'Repeat purchase prompts' },
      { name:'Cross-sell',     color:'#D97706', description:'Complementary product recommendations' },
      { name:'Win-back',       color:'#DC2626', description:'Lapsed customer reactivation' },
    ],
    topics: [
      { categoryName:'Loyalty',       name:'Points Redemption',        description:'Remind customers to use points' },
      { categoryName:'Loyalty',       name:'Status Upgrade',           description:'Tier upgrade milestones' },
      { categoryName:'Replenishment', name:'Reorder Reminder',         description:'Consumable product reorder prompts' },
      { categoryName:'Cross-sell',    name:'Complementary Products',   description:'Based on purchase history' },
      { categoryName:'Win-back',      name:'Lapsed Customer Offer',    description:'Re-engage after 90+ days inactive' },
    ],
    actions: [
      { topicName:'Points Redemption',   name:'Redeem Your Points',         channels:['email','push'],           propensity:0.79, headline:'You have 500 points to spend',        offerCode:'PTS-RDM' },
      { topicName:'Status Upgrade',      name:'Gold Status Achieved',       channels:['email','push'],           propensity:0.88, headline:'Congratulations — you\'re Gold!',    offerCode:'GOLD-UP' },
      { topicName:'Reorder Reminder',    name:'Time to Reorder',            channels:['email','sms'],            propensity:0.82, headline:'Running low? Order again in 1 click', offerCode:'REORD-1' },
      { topicName:'Lapsed Customer Offer',name:'We Miss You — 20% Off',     channels:['email','paid_social'],    propensity:0.61, headline:'It\'s been a while — here\'s 20% off', offerCode:'MISS20' },
    ],
    policies: [
      { name:'Email Frequency Policy',    maxPerDay:1, maxPerWeek:3, maxPerMonth:8,  fairness:false },
      { name:'Promotional Events Policy', maxPerDay:2, maxPerWeek:5, maxPerMonth:14, fairness:false },
    ],
  },
  sme_banking: {
    categories: [
      { name:'Acquisition',     color:'#1D4ED8', description:'New business customers' },
      { name:'Lending',         color:'#DC2626', description:'Business finance products' },
      { name:'Cash Management', color:'#059669', description:'Payments and treasury solutions' },
      { name:'International',   color:'#D97706', description:'Trade finance and FX' },
      { name:'Retention',       color:'#7C3AED', description:'Business relationship retention' },
    ],
    topics: [
      { categoryName:'Lending',         name:'Business Loan Offers',     description:'Unsecured and secured business lending' },
      { categoryName:'Lending',         name:'Invoice Finance',          description:'Invoice discounting and factoring' },
      { categoryName:'Cash Management', name:'Digital Payments',         description:'Payment solutions and POS' },
      { categoryName:'International',   name:'FX Services',              description:'Foreign exchange and hedging' },
      { categoryName:'Retention',       name:'Relationship Review',      description:'Annual relationship manager touchpoint' },
    ],
    actions: [
      { topicName:'Business Loan Offers', name:'Pre-Approved Business Loan', channels:['email','branch'],  propensity:0.62, headline:'You\'re pre-approved for £50,000',    offerCode:'BIZ-LOAN' },
      { topicName:'Invoice Finance',      name:'Invoice Finance Quote',      channels:['email','web'],     propensity:0.51, headline:'Release cash from outstanding invoices', offerCode:'INV-FIN' },
      { topicName:'FX Services',          name:'FX Rate Alert',              channels:['email','push'],    propensity:0.74, headline:'Favourable rate for your upcoming payment', offerCode:'FX-ALERT' },
      { topicName:'Relationship Review',  name:'Annual Review Invite',       channels:['email','branch'],  propensity:0.88, headline:'Let\'s review your business goals',      offerCode:'ANN-REV' },
    ],
    policies: [
      { name:'SME Contact Policy',       maxPerDay:1, maxPerWeek:2, maxPerMonth:6,  fairness:false },
      { name:'Lending Outreach Policy',  maxPerDay:1, maxPerWeek:2, maxPerMonth:4,  fairness:false },
    ],
  },
  healthcare: {
    categories: [
      { name:'Preventive',  color:'#059669', description:'Preventive care and screenings' },
      { name:'Adherence',   color:'#1D4ED8', description:'Treatment plan adherence' },
      { name:'Wellness',    color:'#7C3AED', description:'Lifestyle and wellness programmes' },
      { name:'Referral',    color:'#D97706', description:'Specialist referrals' },
      { name:'Education',   color:'#0891B2', description:'Health literacy and information' },
    ],
    topics: [
      { categoryName:'Preventive', name:'Annual Check-up',        description:'Routine health screening reminders' },
      { categoryName:'Adherence',  name:'Medication Reminder',    description:'Prescription and adherence support' },
      { categoryName:'Wellness',   name:'Wellness Programme',     description:'Lifestyle coaching and fitness' },
      { categoryName:'Referral',   name:'Specialist Referral',    description:'Guided specialist pathway' },
    ],
    actions: [
      { topicName:'Annual Check-up',    name:'Book Your Check-up',      channels:['email','sms'],   propensity:0.78, headline:'Your annual check-up is due',        offerCode:'CHK-ANN' },
      { topicName:'Medication Reminder',name:'Prescription Reminder',   channels:['push','sms'],    propensity:0.88, headline:'Time to order your repeat prescription', offerCode:'MED-REM' },
      { topicName:'Wellness Programme', name:'Join Our 8-Week Programme',channels:['email','app'],  propensity:0.55, headline:'8 weeks to a healthier you',           offerCode:'WELL-8W' },
    ],
    policies: [
      { name:'Patient Communication Policy', maxPerDay:2, maxPerWeek:5, maxPerMonth:12, fairness:true },
    ],
  },
  wealth_management: {
    categories: [
      { name:'Acquisition',       color:'#1D4ED8', description:'New wealth clients' },
      { name:'Portfolio Review',  color:'#7C3AED', description:'Investment performance and rebalancing' },
      { name:'Life Events',       color:'#059669', description:'Trigger-based event marketing' },
      { name:'Education',         color:'#D97706', description:'Financial planning education' },
      { name:'Retention',         color:'#DC2626', description:'Client retention and deepening' },
    ],
    topics: [
      { categoryName:'Portfolio Review', name:'Portfolio Rebalance',    description:'Quarterly rebalancing opportunities' },
      { categoryName:'Life Events',      name:'Retirement Planning',    description:'Retirement milestone triggers' },
      { categoryName:'Life Events',      name:'ISA Season',             description:'Annual ISA allowance utilisation' },
      { categoryName:'Retention',        name:'Annual Review',          description:'Annual relationship review' },
    ],
    actions: [
      { topicName:'Portfolio Rebalance', name:'Rebalance Recommendation',channels:['email','branch'],    propensity:0.71, headline:'Your portfolio may need rebalancing',  offerCode:'REB-Q1' },
      { topicName:'ISA Season',          name:'ISA Top-Up Opportunity',  channels:['email','mobile_app'],propensity:0.82, headline:'Use your £20,000 ISA allowance',       offerCode:'ISA-TOP' },
      { topicName:'Annual Review',       name:'Annual Review Invite',    channels:['email','branch'],    propensity:0.91, headline:'Your annual review is due',             offerCode:'ANN-WM' },
    ],
    policies: [
      { name:'Wealth Client Policy', maxPerDay:1, maxPerWeek:2, maxPerMonth:6, fairness:false },
    ],
  },
  utilities: {
    categories: [
      { name:'Acquisition',         color:'#1D4ED8', description:'New utility customers' },
      { name:'Smart Adoption',      color:'#059669', description:'Smart meter and technology adoption' },
      { name:'Tariff Optimisation', color:'#7C3AED', description:'Best tariff and switching offers' },
      { name:'Energy Saving',       color:'#D97706', description:'Reduction and sustainability nudges' },
      { name:'Retention',           color:'#DC2626', description:'Prevent switching to competitor' },
    ],
    topics: [
      { categoryName:'Smart Adoption',      name:'Smart Meter Install',    description:'Smart meter installation booking' },
      { categoryName:'Tariff Optimisation', name:'Tariff Review',          description:'Better tariff recommendations' },
      { categoryName:'Energy Saving',       name:'Energy Saving Tips',     description:'Personalised energy reduction advice' },
      { categoryName:'Retention',           name:'Loyalty Offers',         description:'Renewal and loyalty incentives' },
    ],
    actions: [
      { topicName:'Smart Meter Install', name:'Book Smart Meter',         channels:['email','web'],   propensity:0.65, headline:'Book your free smart meter installation', offerCode:'SMTR-BOOK' },
      { topicName:'Tariff Review',       name:'Better Tariff Found',       channels:['email','push'],  propensity:0.79, headline:'We found a better tariff for you',       offerCode:'TARIFF-OPT' },
      { topicName:'Energy Saving Tips',  name:'Monthly Energy Report',     channels:['email','push'],  propensity:0.84, headline:'Your energy report is ready',            offerCode:'ENRG-RPT' },
      { topicName:'Loyalty Offers',      name:'Loyalty Discount',          channels:['email','sms'],   propensity:0.87, headline:'Thank you — here\'s your loyalty reward', offerCode:'LOYAL-UTL' },
    ],
    policies: [
      { name:'Utility Contact Policy', maxPerDay:1, maxPerWeek:3, maxPerMonth:8, fairness:false },
    ],
  },
  custom: {
    categories: [
      { name:'Acquisition', color:'#1D4ED8', description:'Win new customers' },
      { name:'Retention',   color:'#059669', description:'Retain existing customers' },
      { name:'Cross-sell',  color:'#7C3AED', description:'Sell additional products' },
      { name:'Nurture',     color:'#D97706', description:'Deepen customer engagement' },
    ],
    topics: [],
    actions: [],
    policies: [
      { name:'Default Contact Policy', maxPerDay:2, maxPerWeek:5, maxPerMonth:15, fairness:false },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────

const INDUSTRY_ICONS: Record<IndustryTemplate, string> = {
  retail_banking:    '🏦',
  insurance:         '🛡️',
  telco:             '📡',
  retail:            '🛍️',
  sme_banking:       '💼',
  healthcare:        '🏥',
  wealth_management: '📈',
  utilities:         '⚡',
  custom:            '⚙️',
};

export default function ConfigurationPage() {
  const {
    tenant, updateTenant,
    categories, topics, actions, policies,
    addCategory, addTopic, addAction, addPolicy,
    deleteCategory, deleteTopic, deleteAction, deletePolicy,
  } = useStore();
  const canWrite = usePermission('settings:write');

  const [applying, setApplying] = useState<IndustryTemplate | null>(null);
  const [applied, setApplied]   = useState<IndustryTemplate | null>(null);
  const [confirmClear, setConfirmClear] = useState<IndustryTemplate | null>(null);

  const hasContent = categories.length > 0 || topics.length > 0 || actions.length > 0;

  const applyTemplate = async (industry: IndustryTemplate, clearExisting: boolean) => {
    setApplying(industry);
    setConfirmClear(null);

    await new Promise(r => setTimeout(r, 300));

    if (clearExisting) {
      // Clear existing taxonomy and policies
      [...actions].forEach(a => deleteAction(a.id));
      [...topics].forEach(t => deleteTopic(t.id));
      [...categories].forEach(c => deleteCategory(c.id));
      [...policies].forEach(p => deletePolicy(p.id));
      await new Promise(r => setTimeout(r, 100));
    }

    const seed = TEMPLATE_SEEDS[industry];
    const now  = new Date().toISOString();

    // Create categories
    const catMap: Record<string, string> = {};
    for (const cat of seed.categories) {
      const c = addCategory({ name: cat.name, description: cat.description, color: cat.color });
      catMap[cat.name] = c.id;
    }

    // Create topics
    const topicMap: Record<string, string> = {};
    for (const t of seed.topics) {
      const categoryId = catMap[t.categoryName];
      if (!categoryId) continue;
      const topic = addTopic({ name: t.name, description: t.description, categoryId });
      topicMap[t.name] = topic.id;
    }

    // Create actions
    for (const a of seed.actions) {
      const topicId = topicMap[a.topicName];
      if (!topicId) continue;
      const topic = seed.topics.find(t => t.name === a.topicName);
      const categoryId = topic ? catMap[topic.categoryName] : '';
      addAction({
        name: a.name, topicId, categoryId,
        channels: a.channels as any,
        basePropensity: a.propensity,
        headline: a.headline,
        offerCode: a.offerCode,
        status: 'active',
      });
    }

    // Create policies
    for (const p of seed.policies) {
      addPolicy({
        name: p.name, maxPerDay: p.maxPerDay, maxPerWeek: p.maxPerWeek,
        maxPerMonth: p.maxPerMonth, fatigueWindowDays: 7,
        conversionCooldownDays: 30, requiresConsent: true,
        consentTypes: ['marketing'], fairnessEnabled: p.fairness,
        fairnessThreshold: 0.85, channelIds: [], suppressionRules: [],
        lobId: undefined, status: 'active',
      });
    }

    // Update tenant industry
    updateTenant({ industry, name: tenant.name });

    setApplying(null);
    setApplied(industry);
    setTimeout(() => setApplied(null), 3000);
  };

  const handleApply = (industry: IndustryTemplate) => {
    if (!canWrite) return;
    if (hasContent && industry !== tenant.industry) {
      setConfirmClear(industry);
    } else {
      applyTemplate(industry, false);
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Industry Templates</h1>
        <p className="page-subtitle">
          Apply a template to instantly seed your taxonomy, actions, and policies.
          One click — {Object.values(TEMPLATE_SEEDS).reduce((sum, t) => sum + t.categories.length, 0) / Object.keys(TEMPLATE_SEEDS).length | 0} categories, topics, and actions configured for your industry.
        </p>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Current config summary */}
        {hasContent && (
          <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Layers size={16} />
            <div style={{ flex: 1, fontSize: 13 }}>
              <strong>You have existing configuration:</strong> {categories.length} categories · {topics.length} topics · {actions.length} actions · {policies.length} policies.
              Applying a new template will ask you whether to replace or merge.
            </div>
          </div>
        )}

        {/* Template grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {(Object.entries(TEMPLATE_SEEDS) as [IndustryTemplate, typeof TEMPLATE_SEEDS[IndustryTemplate]][]).map(([industry, seed]) => {
            const meta   = INDUSTRY_TEMPLATES[industry];
            const isActive = tenant.industry === industry;
            const isApplying = applying === industry;
            const wasApplied = applied === industry;

            return (
              <div key={industry}
                style={{
                  background: 'white',
                  border: `2px solid ${isActive ? 'var(--brand-accent)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: 20,
                  position: 'relative',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  cursor: canWrite ? 'pointer' : 'default',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
              >
                {/* Active badge */}
                {isActive && (
                  <div style={{ position: 'absolute', top: 12, right: 12 }}>
                    <span className="badge badge-blue">Current</span>
                  </div>
                )}

                {/* Icon + name */}
                <div style={{ fontSize: 32, marginBottom: 8 }}>{INDUSTRY_ICONS[industry]}</div>
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)', marginBottom: 4 }}>
                  {meta.label}
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, marginTop: 8 }}>
                  {[
                    { icon: '🗂️', label: `${seed.categories.length} categories` },
                    { icon: '⚡', label: `${seed.actions.length} actions` },
                    { icon: '🛡️', label: `${seed.policies.length} policies` },
                  ].map(s => (
                    <div key={s.label} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {s.icon} {s.label}
                    </div>
                  ))}
                </div>

                {/* LOBs */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Lines of Business</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {meta.lobs.slice(0, 4).map(lob => (
                      <span key={lob} className="badge badge-gray" style={{ fontSize: 10 }}>{lob}</span>
                    ))}
                    {meta.lobs.length > 4 && <span className="badge badge-gray" style={{ fontSize: 10 }}>+{meta.lobs.length - 4} more</span>}
                  </div>
                </div>

                {/* Categories preview */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Categories</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {seed.categories.map(c => (
                      <span key={c.name} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: c.color + '18', color: c.color }}>
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Apply button */}
                {canWrite && (
                  <button
                    onClick={() => handleApply(industry)}
                    disabled={isApplying || !canWrite}
                    className={wasApplied ? 'btn btn-sm' : isActive ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                    style={{ width: '100%', justifyContent: 'center', ...(wasApplied ? { background: 'var(--success)', color: 'white' } : {}) }}
                  >
                    {wasApplied ? (
                      <><CheckCircle2 size={13} /> Applied!</>
                    ) : isApplying ? (
                      <>Applying…</>
                    ) : isActive ? (
                      <>Re-apply template</>
                    ) : (
                      <>Apply {meta.label} template <ChevronRight size={13} /></>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* What gets seeded */}
        <div className="card card-body" style={{ background: 'var(--bg)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="var(--brand-accent)" />
            What applying a template does
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { icon: <Layers size={16} color="var(--brand-accent)" />, title: 'Seeds your Taxonomy', body: 'Creates Action Categories with colours, Topics within each category, and fully configured Actions with channels, propensity scores, headlines, and offer codes.' },
              { icon: <Radio size={16} color="var(--brand-accent)" />, title: 'Configures Policies', body: 'Creates industry-appropriate Engagement Policies with sensible contact frequency limits and fairness controls pre-configured for your sector.' },
              { icon: <GitBranch size={16} color="var(--brand-accent)" />, title: 'Ready to build strategies', body: 'Once applied, go to Strategies and create your first decision strategy. All taxonomy and policies are already configured and ready to use.' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.icon}
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{item.title}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm clear modal */}
      {confirmClear && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <span className="modal-title">Replace existing configuration?</span>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                <AlertTriangle size={15} />
                <div>
                  <strong>This will delete</strong> your current {categories.length} categories, {topics.length} topics, {actions.length} actions, and {policies.length} policies and replace them with the {INDUSTRY_TEMPLATES[confirmClear].label} template.
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Your strategies will remain but their action and category references will be cleared. You can also merge — this adds the template on top of your existing configuration.
              </p>
            </div>
            <div className="modal-footer" style={{ gap: 8 }}>
              <button onClick={() => setConfirmClear(null)} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={() => applyTemplate(confirmClear, false)} className="btn btn-secondary btn-sm">Merge — add on top</button>
              <button onClick={() => applyTemplate(confirmClear, true)} className="btn btn-danger btn-sm">Replace existing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
