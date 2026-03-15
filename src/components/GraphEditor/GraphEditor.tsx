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
import type { GraphConfig } from '../../types/graph.js';
import { NodeToolbar } from './NodeToolbar.js';

function buildEngine(): DiagramEngine {
  const engine = createEngine();
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

  const { graphConfig, activeTaxConfigId, saveGraphConfig, taxInputRows, taxRuleRows } =
    useAppStore((s) => ({
      graphConfig: s.graphConfig,
      activeTaxConfigId: s.activeTaxConfigId,
      saveGraphConfig: s.saveGraphConfig,
      taxInputRows: s.activeTaxConfigId ? s._taxRules.get(s.activeTaxConfigId) ?? [] : [],
      taxRuleRows: s.activeTaxConfigId ? s._taxRuleRows.get(s.activeTaxConfigId) ?? [] : [],
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

    // Enforce single-link on input ports: when a new link lands on an in-port
    // that already has a connection, remove the old link and keep only the new one.
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

  // Reset gate when tax config changes (must run BEFORE auto-add effect)
  useEffect(() => {
    autoAddedConfigRef.current = null;
  }, [activeTaxConfigId]);

  // Auto-place source + logic nodes and wire default connections
  useEffect(() => {
    if (!activeTaxConfigId || !taxInputRows.length) return;
    if (autoAddedConfigRef.current === activeTaxConfigId) return;
    autoAddedConfigRef.current = activeTaxConfigId;

    const model = engine.getModel();

    // Remove any previously auto-placed nodes (keep Sink nodes)
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

    // Source nodes — left column; keep a lookup by inputId for wiring
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

    // Logic (tax rule) nodes — middle column; add formula-derived ports + default links
    taxRuleRows.forEach((rule, i) => {
      const node = new LogicNodeModel(rule.name, activeTaxConfigId, rule.id, rule.formula);
      node.setPosition(340, 60 + i * 160);

      const vars = parseFormulaVars(rule.formula);
      vars.forEach((v) => node.addNamedInputPort(v));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model.addNode(node as any);

      // Wire each formula variable to the matching source node
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
    // taxRuleRows is intentionally excluded — it loads atomically with taxInputRows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaxConfigId, taxInputRows.length]);

  // Delete / Backspace / Enter: properly clean up port links before removing nodes/links.
  // Uses keyup to match react-diagrams' DeleteItemsAction timing; capture phase + stopPropagation
  // prevents the default action from also firing.
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
        if (typeof entity.getPorts === 'function') {
          // Node — clean all port links first to avoid orphaned references
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Object.values(entity.getPorts()).forEach((port: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Object.values(port.getLinks()).forEach((link: any) => link.remove());
          });
        }
        entity.remove();
      });

      engine.repaintCanvas();
    }

    document.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => document.removeEventListener('keyup', handleKeyUp, { capture: true });
  }, [engine]);

  // Clean up dangling links (drag released without connecting to a port)
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

  function handleSave(): void {
    if (!engine.getModel() || !activeTaxConfigId) return;
    const serialized = engine.getModel().serialize();
    const config: GraphConfig = {
      id: graphConfig?.id ?? '',
      name: graphConfig?.name ?? 'Tax Law',
      taxConfigId: activeTaxConfigId,
      nodes: [],
      links: [],
    };
    (config as GraphConfig & { _diagram: unknown })._diagram = serialized;
    saveGraphConfig(config);
  }

  return (
    <div className="flex flex-col h-full">
      <NodeToolbar engine={engine} onSave={handleSave} />
      <div className="flex-1 relative bg-gray-50 border rounded overflow-hidden">
        {activeTaxConfigId ? (
          <CanvasWidget engine={engine} className="w-full h-full" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a tax configuration to start editing the law graph.
          </div>
        )}
      </div>
    </div>
  );
}
