import React, { useEffect, useRef } from 'react';
import createEngine, { DefaultLinkModel } from '@projectstorm/react-diagrams';
import { DiagramModel } from '@projectstorm/react-diagrams';
import { CanvasWidget } from '@projectstorm/react-canvas-core';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import {
  SourceNodeFactory,
  LogicNodeFactory,
  SinkNodeFactory,
  SourceNodeModel,
  LogicNodeModel,
} from '../../lib/graph/TaxNodeModels.js';
import { useAppStore } from '../../store/appStore.js';
import { extractScenarioGraph, extractTaxLawGraph } from '../../lib/graph/GraphSerializationService.js';
import { NodeToolbar } from './NodeToolbar.js';

function buildEngine(): DiagramEngine {
  // Disable built-in DeleteItemsAction so nodes can only be removed via the trash button
  const engine = createEngine({ registerDefaultDeleteItemsAction: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factories = engine.getNodeFactories() as any;
  factories.registerFactory(new SourceNodeFactory());
  factories.registerFactory(new LogicNodeFactory());
  factories.registerFactory(new SinkNodeFactory());
  return engine;
}

const FORMULA_VAR_REGEX = /\$([a-zA-Z]\w*)/g;

function parseFormulaVars(formula: string): string[] {
  const vars = new Set<string>();
  let m: RegExpExecArray | null;
  FORMULA_VAR_REGEX.lastIndex = 0;
  while ((m = FORMULA_VAR_REGEX.exec(formula)) !== null) vars.add(m[1]);
  return Array.from(vars).sort();
}

export function GraphEditor(): React.ReactElement {
  const engineRef = useRef<DiagramEngine | null>(null);
  const autoAddedConfigRef = useRef<number | null>(null);

  const {
    graphConfig,
    activeScenarioId,
    activeScenarioGraphId,
    activeTaxConfigId,
    saveScenarioGraph,
    saveTaxLawGraph,
    saveScenarioGraphAs,
    saveTaxLawGraphAs,
    taxInputRows,
    taxRuleRows,
    scenarioGraph,
    taxLawGraph,
  } = useAppStore((s) => ({
    graphConfig: s.graphConfig,
    activeScenarioId: s.activeScenarioId,
    activeScenarioGraphId: s.activeScenarioGraphId,
    activeTaxConfigId: s.activeTaxConfigId,
    saveScenarioGraph: s.saveScenarioGraph,
    saveTaxLawGraph: s.saveTaxLawGraph,
    saveScenarioGraphAs: s.saveScenarioGraphAs,
    saveTaxLawGraphAs: s.saveTaxLawGraphAs,
    taxInputRows: s.activeTaxConfigId ? s._taxRules.get(s.activeTaxConfigId) ?? [] : [],
    taxRuleRows: s.activeTaxConfigId ? s._taxRuleRows.get(s.activeTaxConfigId) ?? [] : [],
    scenarioGraph: s.scenarioGraph,
    taxLawGraph: s.taxLawGraph,
  }));

  if (!engineRef.current) {
    engineRef.current = buildEngine();
  }
  const engine = engineRef.current;

  // Deserialize a saved graph; mark config handled to skip auto-add
  useEffect(() => {
    const model = new DiagramModel();
    if (graphConfig) {
      try {
        model.deserializeModel(
          JSON.parse(JSON.stringify(graphConfig)) as Parameters<typeof model.deserializeModel>[0],
          engine,
        );
        autoAddedConfigRef.current = activeTaxConfigId;
      } catch {
        // Fall through to empty model
      }
    }
    engine.setModel(model);

    // Enforce single-link on input ports
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enforceHandle = (model as any).registerListener({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      linksUpdated: ({ link, isCreated }: any) => {
        if (!isCreated) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let portHandle: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        portHandle = link.registerListener({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          targetPortChanged: ({ entity, port }: any) => {
            if (!port?.getOptions?.().in) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allLinks = Object.values(port.getLinks?.() ?? {}) as any[];
            allLinks.forEach((other: any) => {
              if (other.getID?.() !== entity.getID?.()) other.remove();
            });
            engine.repaintCanvas();
            portHandle?.deregister?.();
          },
        });
      },
    });

    return () => enforceHandle?.deregister?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphConfig?.id]);

  // Reset gate when tax config changes
  useEffect(() => {
    autoAddedConfigRef.current = null;
  }, [activeTaxConfigId]);

  // Restore saved Scenario Graph (Source nodes at saved positions).
  // Does not require activeTaxConfigId — uses the graph's own taxConfigId so nodes
  // appear immediately when a custom scenario is loaded, before Tax Law is chosen.
  useEffect(() => {
    if (!scenarioGraph) return;
    const configId = scenarioGraph.taxConfigId;
    const model = engine.getModel();
    // Remove auto-placed Source nodes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Object.values((model as any).getNodes()) as any[]).forEach((n: any) => {
      if (n.extras?.kind !== 'SourceNode') return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.values(n.getPorts()).forEach((p: any) => Object.values(p.getLinks()).forEach((l: any) => l.remove()));
      model.removeNode(n);
    });
    // Place saved Source nodes at saved positions
    scenarioGraph.nodes.forEach((entry) => {
      const node = new SourceNodeModel(entry.label, configId, entry.inputId, '', entry.staticValueOverride);
      node.setPosition(entry.x, entry.y);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (model as any).addNode(node);
    });
    autoAddedConfigRef.current = configId;
    engine.repaintCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioGraph?.id]);

  // Restore saved Tax Law Graph (Logic nodes + links)
  useEffect(() => {
    if (!taxLawGraph || !activeTaxConfigId) return;
    const model = engine.getModel();

    // Remove existing Logic nodes and their links
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Object.values((model as any).getNodes()) as any[]).forEach((n: any) => {
      if (n.extras?.kind !== 'LogicNode') return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.values(n.getPorts()).forEach((p: any) => Object.values(p.getLinks()).forEach((l: any) => l.remove()));
      model.removeNode(n);
    });

    // Build sourceNode map (inputId → node) from whatever Source nodes are on canvas
    const sourceByInputId: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Object.values((model as any).getNodes()) as any[]).forEach((n: any) => {
      if (n.extras?.kind === 'SourceNode') sourceByInputId[n.extras.sourceBinding?.inputId ?? ''] = n;
    });

    // Place saved Logic nodes; remember savedNodeId → new instance for link restoration
    const newNodeById: Record<string, LogicNodeModel> = {};
    taxLawGraph.nodes.forEach((entry) => {
      const rule = taxRuleRows.find((r) => r.id === entry.ruleId);
      const formula = rule?.formula ?? '';
      const node = new LogicNodeModel(entry.ruleName, activeTaxConfigId, entry.ruleId, formula);
      node.setPosition(entry.x, entry.y);
      const count = entry.inputCount ?? 0;
      for (let i = 0; i < count; i++) node.addInputPort();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (model as any).addNode(node);
      newNodeById[entry.nodeId] = node;
    });

    // Restore links
    taxLawGraph.links.forEach((link) => {
      const targetNode = newNodeById[link.targetNodeId];
      if (!targetNode) return;
      const targetPort = targetNode.getPort(link.targetPort);
      if (!targetPort) return;
      // Source is either another LogicNode or a SourceNode matched by inputId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceNode: any = newNodeById[link.sourceNodeId] ?? sourceByInputId[link.targetPort];
      if (!sourceNode) return;
      const sourcePort = sourceNode.getPort(link.sourcePort);
      if (!sourcePort) return;
      const newLink = new DefaultLinkModel();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newLink.setSourcePort(sourcePort as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newLink.setTargetPort(targetPort as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (model as any).addLink(newLink);
    });

    autoAddedConfigRef.current = activeTaxConfigId;
    engine.repaintCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxLawGraph?.id]);

  // Auto-place source + logic nodes and wire default connections
  useEffect(() => {
    if (!activeTaxConfigId || !taxInputRows.length) return;
    if (autoAddedConfigRef.current === activeTaxConfigId) return;
    autoAddedConfigRef.current = activeTaxConfigId;

    const model = engine.getModel();

    // Remove previously auto-placed nodes (keep Sink nodes)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Object.values((model as any).getNodes()) as any[]).forEach((n) => {
      if (n.extras?.kind === 'SourceNode' || n.extras?.kind === 'LogicNode') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.values(n.getPorts()).forEach((p: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Object.values(p.getLinks()).forEach((l: any) => l.remove());
        });
        model.removeNode(n);
      }
    });

    const sourceByInputId: Record<string, SourceNodeModel> = {};
    taxInputRows.forEach((input, i) => {
      const node = new SourceNodeModel(
        input.description,
        activeTaxConfigId,
        input.input_id,
        input.source ?? '',
        input.static_value ?? undefined,
      );
      node.setPosition(40, 60 + i * 110);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model.addNode(node as any);
      sourceByInputId[input.input_id] = node;
    });

    taxRuleRows.forEach((rule, i) => {
      const node = new LogicNodeModel(rule.name, activeTaxConfigId, rule.id, rule.formula);
      node.setPosition(340, 60 + i * 160);

      const vars = parseFormulaVars(rule.formula);
      vars.forEach((v) => node.addNamedInputPort(v));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model.addNode(node as any);

      vars.forEach((v) => {
        const sourceNode = sourceByInputId[v];
        if (!sourceNode) return;
        const sourcePort = sourceNode.getPort('out');
        const targetPort = node.getPort(v);
        if (!sourcePort || !targetPort) return;
        const link = new DefaultLinkModel();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        link.setSourcePort(sourcePort as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        link.setTargetPort(targetPort as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model.addLink(link as any);
      });
    });

    engine.repaintCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaxConfigId, taxInputRows.length]);

  // Delete / Backspace on links only (nodes use trash button)
  useEffect(() => {
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace' && e.key !== 'Enter') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const model = engine.getModel();
      const selected = model.getSelectedEntities();
      if (!selected.length) return;

      e.stopPropagation();
      e.preventDefault();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selected.forEach((entity: any) => {
        if (typeof entity.getPorts === 'function') return; // skip nodes — use trash button
        entity.remove();
      });

      engine.repaintCanvas();
    }

    document.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => document.removeEventListener('keyup', handleKeyUp, { capture: true });
  }, [engine]);

  // Clean up dangling links
  useEffect(() => {
    function cleanDanglingLinks() {
      setTimeout(() => {
        const model = engine.getModel();
        let dirty = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.values(model.getLinks()).forEach((link: any) => {
          if (!link.getTargetPort()) {
            link.remove();
            dirty = true;
          }
        });
        if (dirty) engine.repaintCanvas();
      }, 150);
    }

    document.addEventListener('mouseup', cleanDanglingLinks);
    return () => document.removeEventListener('mouseup', cleanDanglingLinks);
  }, [engine]);

  function handleSaveScenario(name: string): void {
    if (!engine.getModel() || !activeTaxConfigId) return;
    const { nodes } = extractScenarioGraph(engine);
    saveScenarioGraph(name, nodes);
  }

  function handleSaveTaxLaw(name: string): void {
    if (!engine.getModel() || !activeTaxConfigId) return;
    const { nodes, links } = extractTaxLawGraph(engine);
    saveTaxLawGraph(name, nodes, links);
  }

  return (
    <div className="flex flex-col h-full">
      <NodeToolbar
        engine={engine}
        onSaveScenario={handleSaveScenario}
        onSaveTaxLaw={handleSaveTaxLaw}
        onSaveScenarioAs={saveScenarioGraphAs}
        onSaveTaxLawAs={saveTaxLawGraphAs}
      />
      <div className="flex-1 relative graph-canvas border border-border rounded-xl overflow-hidden shadow-inner">
        {(activeScenarioId !== null || activeScenarioGraphId !== null || activeTaxConfigId !== null) ? (
          <>
            <CanvasWidget engine={engine} className="w-full h-full bg-background" />
            {!activeTaxConfigId && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                <span className="bg-card text-muted-foreground text-xs px-4 py-2 rounded-full border border-border shadow-sm">
                  Select a Tax Law to add Logic nodes
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-foreground text-sm gap-2">
            <div className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center">
              <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-base font-medium">No Scenario Selected</span>
            <p className="text-sm text-foreground">Select a scenario to start building your tax law graph</p>
          </div>
        )}
      </div>
    </div>
  );
}
