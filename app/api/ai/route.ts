/**
 * POST /api/ai
 *
 * Unified agentic endpoint. `action` selects the capability:
 *
 *   rules_from_text      — natural language → eligibility rules array
 *   explain_decision     — why was this action served (or suppressed)?
 *   campaign_to_strategy — campaign brief → full strategy scaffold
 *   suggest_suppression  — plain-English policy description → suppression conditions
 *   strategy_critique    — review a strategy config and return improvement suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

// ─── helpers ────────────────────────────────────────────────────────────────

function systemPrompt(persona: string) {
  return `You are an expert ${persona} inside Stratcheck, an enterprise Customer Decision Hub modelled on Pega CDH / Customer Engagement Studio.
Stratcheck has: Strategies, Engagement Policies (eligibility rules + suppression rules + contact limits), Actions (with propensity scores), Audiences (segment rules), Channels, Adaptive Models, and Event Triggers.
Respond ONLY with valid JSON that matches the schema described in the user message. No markdown, no explanation.`;
}

async function callClaude(system: string, user: string): Promise<string> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = msg.content[0];
  return block.type === 'text' ? block.text.trim() : '';
}

function parseJSON<T>(raw: string): T {
  // Strip any accidental markdown fences
  const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(clean) as T;
}

// ─── action handlers ─────────────────────────────────────────────────────────

async function rulesFromText(text: string) {
  const raw = await callClaude(
    systemPrompt('decision-rules engineer'),
    `Convert the following plain-English eligibility description into a JSON array of eligibility rules.
Each rule: { "attribute": string, "op": ">" | ">=" | "<" | "<=" | "=" | "!=" | "IN" | "NOT IN" | "CONTAINS", "value": string }.
Plain English: "${text}"
Return ONLY the JSON array.`
  );
  return parseJSON<unknown[]>(raw);
}

async function explainDecision(context: {
  actionName: string;
  strategyName: string;
  served: boolean;
  propensity: number;
  suppressionReason?: string;
  customerAttributes?: Record<string, unknown>;
  eligibilityRules?: unknown[];
  policyConditions?: unknown[];
}) {
  const raw = await callClaude(
    systemPrompt('decision explainability analyst'),
    `Explain this NBA decision in plain English for a business user (not a developer). Be concise — 2-4 sentences.
Context: ${JSON.stringify(context, null, 2)}
Return JSON: { "headline": string (max 12 words), "explanation": string, "keyFactors": string[] (max 3 items), "recommendation": string | null }`
  );
  return parseJSON<{ headline: string; explanation: string; keyFactors: string[]; recommendation: string | null }>(raw);
}

async function campaignToStrategy(brief: string, availableCategories: string[], availableChannels: string[]) {
  const raw = await callClaude(
    systemPrompt('marketing strategy architect'),
    `Convert this campaign brief into a Stratcheck strategy scaffold.
Brief: "${brief}"
Available categories: ${JSON.stringify(availableCategories)}
Available channels: ${JSON.stringify(availableChannels)}
Return JSON matching this schema:
{
  "name": string,
  "description": string,
  "suggestedCategory": string,
  "arbitration": "propensity" | "value" | "weighted",
  "priority": "low" | "standard" | "high" | "critical",
  "suggestedChannels": string[],
  "suggestedActions": [{ "name": string, "headline": string, "description": string, "suggestedPropensity": number }],
  "suggestedEligibilityRules": [{ "attribute": string, "op": string, "value": string }],
  "suggestedAudience": { "name": string, "description": string, "rules": [{ "attribute": string, "op": string, "value": string }] },
  "rationale": string
}`
  );
  return parseJSON<unknown>(raw);
}

async function suggestSuppression(text: string) {
  const raw = await callClaude(
    systemPrompt('engagement policy specialist'),
    `Convert this plain-English suppression requirement into structured suppression conditions for Stratcheck.
Requirement: "${text}"
Return JSON:
{
  "suppressionConditions": [{ "attribute": string, "op": string, "value": string, "reason": string }],
  "contactLimitSuggestion": { "maxPerDay": number | null, "maxPerWeek": number | null, "maxPerMonth": number | null } | null,
  "explanation": string
}`
  );
  return parseJSON<unknown>(raw);
}

async function strategyCritique(strategy: unknown) {
  const raw = await callClaude(
    systemPrompt('CDH strategy reviewer'),
    `Review this Stratcheck strategy configuration and return improvement suggestions.
Strategy: ${JSON.stringify(strategy, null, 2)}
Return JSON:
{
  "score": number (0-100, overall quality),
  "summary": string,
  "issues": [{ "severity": "high" | "medium" | "low", "field": string, "issue": string, "fix": string }],
  "strengths": string[],
  "recommendations": string[]
}`
  );
  return parseJSON<unknown>(raw);
}

// ─── route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action } = body;

  try {
    switch (action) {
      case 'rules_from_text': {
        const rules = await rulesFromText(body.text as string);
        return NextResponse.json({ rules });
      }
      case 'explain_decision': {
        const result = await explainDecision(body.context as Parameters<typeof explainDecision>[0]);
        return NextResponse.json(result);
      }
      case 'campaign_to_strategy': {
        const result = await campaignToStrategy(
          body.brief as string,
          (body.availableCategories as string[]) ?? [],
          (body.availableChannels as string[]) ?? [],
        );
        return NextResponse.json(result);
      }
      case 'suggest_suppression': {
        const result = await suggestSuppression(body.text as string);
        return NextResponse.json(result);
      }
      case 'strategy_critique': {
        const result = await strategyCritique(body.strategy);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI call failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
