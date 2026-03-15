/**
 * Tests for appStore — covers saveScenarioGraph and saveTaxLawGraph actions:
 *  - POST when no active id (first save)
 *  - PUT when active id exists (update)
 *  - State is updated with returned id and graph data on success
 *  - No-op when activeTaxConfigId is null
 *  - Request body contains correct payload (name, tax_config_id, nodes, links)
 */

// ---------------------------------------------------------------------------
// Fetch mock — must be set up BEFORE importing the store
// ---------------------------------------------------------------------------

const mockFetch = jest.fn<Promise<Partial<Response>>, [string, RequestInit?]>();
global.fetch = mockFetch as unknown as typeof fetch;

import type { ScenarioNodeEntry, TaxLawNodeEntry, GraphLinkEntry } from '../types/graph';
import { useAppStore } from './appStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush all pending microtasks (lets .then() chains in the store resolve). */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function mockPostResponse(
  id: string,
  name: string,
  extra: Record<string, unknown> = {},
): void {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ id, name, ...extra }),
  } as unknown as Response);
}

function parsedBody(callIndex = 0): Record<string, unknown> {
  const body = (mockFetch.mock.calls[callIndex][1] as RequestInit | undefined)?.body;
  return JSON.parse(body as string) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SCENARIO_NODES: ScenarioNodeEntry[] = [
  { nodeId: 'node-src-1', inputId: 'gross_income', label: 'Gross Income', x: 40, y: 60, staticValueOverride: 52000 },
  { nodeId: 'node-src-2', inputId: 'deductions', label: 'Deductions', x: 40, y: 170 },
];

const LAW_NODES: TaxLawNodeEntry[] = [
  { nodeId: 'node-logic-1', ruleId: 7, ruleName: 'Income Tax', x: 340, y: 60, inputCount: 1 },
];

const LAW_LINKS: GraphLinkEntry[] = [
  { id: 'link-1', sourceNodeId: 'node-src-1', sourcePort: 'out', targetNodeId: 'node-logic-1', targetPort: 'gross_income' },
];

// ===========================================================================
// saveScenarioGraph
// ===========================================================================

describe('saveScenarioGraph', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useAppStore.setState({
      activeTaxConfigId: 1,
      activeScenarioGraphId: null,
      scenarioGraph: null,
    });
  });

  it('does nothing and never calls fetch when activeTaxConfigId is null', () => {
    useAppStore.setState({ activeTaxConfigId: null });
    useAppStore.getState().saveScenarioGraph('Unused', SCENARIO_NODES);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // --- POST (first save) ---

  it('POSTs to /api/v1/scenario-graphs when activeScenarioGraphId is null', () => {
    mockPostResponse('new-sg-id', 'My Scenario', { tax_config_id: 1, nodes_json: '[]', version: 1 });
    useAppStore.getState().saveScenarioGraph('My Scenario', SCENARIO_NODES);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/scenario-graphs');
    expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('sends name, tax_config_id and nodes in the POST body', () => {
    mockPostResponse('id', 'Test', { tax_config_id: 1, nodes_json: '[]', version: 1 });
    useAppStore.getState().saveScenarioGraph('Test', SCENARIO_NODES);

    const body = parsedBody();
    expect(body.name).toBe('Test');
    expect(body.tax_config_id).toBe(1);
    expect(body.nodes).toEqual(SCENARIO_NODES);
  });

  it('sets activeScenarioGraphId and scenarioGraph state after successful POST', async () => {
    mockPostResponse('new-sg-id', 'My Scenario', { tax_config_id: 1, nodes_json: '[]', version: 1 });
    useAppStore.getState().saveScenarioGraph('My Scenario', SCENARIO_NODES);
    await flush();

    const state = useAppStore.getState();
    expect(state.activeScenarioGraphId).toBe('new-sg-id');
    expect(state.scenarioGraph?.id).toBe('new-sg-id');
    expect(state.scenarioGraph?.name).toBe('My Scenario');
    expect(state.scenarioGraph?.taxConfigId).toBe(1);
    expect(state.scenarioGraph?.nodes).toEqual(SCENARIO_NODES);
    expect(state.scenarioGraph?.version).toBe(1);
  });

  // --- PUT (update existing) ---

  it('PUTs to /api/v1/scenario-graphs/:id when activeScenarioGraphId is set', () => {
    useAppStore.setState({ activeScenarioGraphId: 'existing-sg' });
    mockPostResponse('existing-sg', 'Updated', { tax_config_id: 1, nodes_json: '[]', version: 2 });
    useAppStore.getState().saveScenarioGraph('Updated', SCENARIO_NODES);

    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/scenario-graphs/existing-sg');
    expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe('PUT');
  });

  it('sends name and nodes in the PUT body', () => {
    useAppStore.setState({ activeScenarioGraphId: 'sg-abc' });
    mockPostResponse('sg-abc', 'Revised', { tax_config_id: 1, nodes_json: '[]', version: 3 });
    useAppStore.getState().saveScenarioGraph('Revised', SCENARIO_NODES);

    const body = parsedBody();
    expect(body.name).toBe('Revised');
    expect(body.nodes).toEqual(SCENARIO_NODES);
  });

  it('updates scenarioGraph state (but not activeScenarioGraphId) after successful PUT', async () => {
    useAppStore.setState({ activeScenarioGraphId: 'sg-existing' });
    mockPostResponse('sg-existing', 'Updated Name', { tax_config_id: 1, nodes_json: '[]', version: 4 });
    useAppStore.getState().saveScenarioGraph('Updated Name', SCENARIO_NODES);
    await flush();

    const state = useAppStore.getState();
    expect(state.activeScenarioGraphId).toBe('sg-existing'); // unchanged
    expect(state.scenarioGraph?.name).toBe('Updated Name');
    expect(state.scenarioGraph?.version).toBe(4);
  });

  it('Content-Type header is application/json', () => {
    mockPostResponse('id', 'Test', { tax_config_id: 1, nodes_json: '[]', version: 1 });
    useAppStore.getState().saveScenarioGraph('Test', []);

    const headers = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});

// ===========================================================================
// saveTaxLawGraph
// ===========================================================================

describe('saveTaxLawGraph', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useAppStore.setState({
      activeTaxConfigId: 1,
      activeTaxLawGraphId: null,
      taxLawGraph: null,
    });
  });

  it('does nothing and never calls fetch when activeTaxConfigId is null', () => {
    useAppStore.setState({ activeTaxConfigId: null });
    useAppStore.getState().saveTaxLawGraph('Unused', LAW_NODES, LAW_LINKS);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // --- POST (first save) ---

  it('POSTs to /api/v1/taxlaw-graphs when activeTaxLawGraphId is null', () => {
    mockPostResponse('new-law-id', 'Income Tax Law', { tax_config_id: 1, nodes_json: '[]', links_json: '[]', version: 1 });
    useAppStore.getState().saveTaxLawGraph('Income Tax Law', LAW_NODES, LAW_LINKS);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/taxlaw-graphs');
    expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('sends name, tax_config_id, nodes and links in the POST body', () => {
    mockPostResponse('id', 'Test Law', { tax_config_id: 1, nodes_json: '[]', links_json: '[]', version: 1 });
    useAppStore.getState().saveTaxLawGraph('Test Law', LAW_NODES, LAW_LINKS);

    const body = parsedBody();
    expect(body.name).toBe('Test Law');
    expect(body.tax_config_id).toBe(1);
    expect(body.nodes).toEqual(LAW_NODES);
    expect(body.links).toEqual(LAW_LINKS);
  });

  it('sets activeTaxLawGraphId and taxLawGraph state after successful POST', async () => {
    mockPostResponse('new-law-id', 'Income Tax Law', { tax_config_id: 1, nodes_json: '[]', links_json: '[]', version: 1 });
    useAppStore.getState().saveTaxLawGraph('Income Tax Law', LAW_NODES, LAW_LINKS);
    await flush();

    const state = useAppStore.getState();
    expect(state.activeTaxLawGraphId).toBe('new-law-id');
    expect(state.taxLawGraph?.id).toBe('new-law-id');
    expect(state.taxLawGraph?.name).toBe('Income Tax Law');
    expect(state.taxLawGraph?.taxConfigId).toBe(1);
    expect(state.taxLawGraph?.nodes).toEqual(LAW_NODES);
    expect(state.taxLawGraph?.links).toEqual(LAW_LINKS);
    expect(state.taxLawGraph?.version).toBe(1);
  });

  // --- PUT (update existing) ---

  it('PUTs to /api/v1/taxlaw-graphs/:id when activeTaxLawGraphId is set', () => {
    useAppStore.setState({ activeTaxLawGraphId: 'existing-law' });
    mockPostResponse('existing-law', 'Updated Law', { tax_config_id: 1, nodes_json: '[]', links_json: '[]', version: 2 });
    useAppStore.getState().saveTaxLawGraph('Updated Law', LAW_NODES, LAW_LINKS);

    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/taxlaw-graphs/existing-law');
    expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe('PUT');
  });

  it('sends name, nodes and links in the PUT body', () => {
    useAppStore.setState({ activeTaxLawGraphId: 'law-abc' });
    mockPostResponse('law-abc', 'Revised Law', { tax_config_id: 1, nodes_json: '[]', links_json: '[]', version: 3 });
    useAppStore.getState().saveTaxLawGraph('Revised Law', LAW_NODES, LAW_LINKS);

    const body = parsedBody();
    expect(body.name).toBe('Revised Law');
    expect(body.nodes).toEqual(LAW_NODES);
    expect(body.links).toEqual(LAW_LINKS);
  });

  it('updates taxLawGraph state after successful PUT', async () => {
    useAppStore.setState({ activeTaxLawGraphId: 'law-existing' });
    mockPostResponse('law-existing', 'Updated Law', { tax_config_id: 1, nodes_json: '[]', links_json: '[]', version: 5 });
    useAppStore.getState().saveTaxLawGraph('Updated Law', LAW_NODES, LAW_LINKS);
    await flush();

    const state = useAppStore.getState();
    expect(state.activeTaxLawGraphId).toBe('law-existing'); // unchanged
    expect(state.taxLawGraph?.name).toBe('Updated Law');
    expect(state.taxLawGraph?.version).toBe(5);
    expect(state.taxLawGraph?.nodes).toEqual(LAW_NODES);
    expect(state.taxLawGraph?.links).toEqual(LAW_LINKS);
  });

  it('Content-Type header is application/json', () => {
    mockPostResponse('id', 'Test', { tax_config_id: 1, nodes_json: '[]', links_json: '[]', version: 1 });
    useAppStore.getState().saveTaxLawGraph('Test', [], []);

    const headers = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('saves empty nodes and links arrays without error', async () => {
    mockPostResponse('law-empty', 'Empty Law', { tax_config_id: 1, nodes_json: '[]', links_json: '[]', version: 1 });
    useAppStore.getState().saveTaxLawGraph('Empty Law', [], []);
    await flush();

    expect(useAppStore.getState().taxLawGraph?.nodes).toEqual([]);
    expect(useAppStore.getState().taxLawGraph?.links).toEqual([]);
  });
});
