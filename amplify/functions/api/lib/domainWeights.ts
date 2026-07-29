// Official CCAR-F / CCAR-P exam blueprint domain weightings. Question
// selection for a full exam or the placement assessment should mirror these
// percentages rather than whatever falls out of the pool's natural topic/
// question-count distribution.
export const CCAF_DOMAIN_WEIGHTS: Record<string, number> = {
  D1: 0.27, // Agentic Architecture & Orchestration
  D2: 0.18, // Tool Design & MCP Integration
  D3: 0.2, // Claude Code Configuration & Workflows
  D4: 0.2, // Prompt Engineering & Structured Output
  D5: 0.15, // Context Management & Reliability
};

export const CCAP_DOMAIN_WEIGHTS: Record<string, number> = {
  D1: 0.17, // Solution Design & Architecture
  D2: 0.13, // Claude Models, Prompting & Context Engineering
  D3: 0.19, // Integration
  D4: 0.16, // Evaluation, Testing & Optimization
  D5: 0.14, // Governance, Safety & Risk Management
  D6: 0.14, // Stakeholder Communication & Lifecycle Management
  D7: 0.07, // Developer Productivity & Operational Enablement
};

export function domainWeightsForCert(certCode: string): Record<string, number> | null {
  if (certCode === "CCAR-F") return CCAF_DOMAIN_WEIGHTS;
  if (certCode === "CCAR-P") return CCAP_DOMAIN_WEIGHTS;
  return null;
}

// Largest-remainder rounding so per-domain integer targets sum to exactly
// `total` instead of drifting from simple per-domain Math.round().
export function allocateByWeights(total: number, weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights);
  const raw = entries.map(([domain, w]) => [domain, w * total] as const);
  const floors = raw.map(([domain, v]) => [domain, Math.floor(v)] as const);
  const result: Record<string, number> = Object.fromEntries(floors);

  const allocated = floors.reduce((sum, [, v]) => sum + v, 0);
  const remainder = total - allocated;
  const byFractionDesc = raw
    .map(([domain, v], i) => [domain, v - floors[i][1]] as const)
    .sort((a, b) => b[1] - a[1]);

  for (let i = 0; i < remainder; i++) {
    result[byFractionDesc[i % byFractionDesc.length][0]]++;
  }
  return result;
}
