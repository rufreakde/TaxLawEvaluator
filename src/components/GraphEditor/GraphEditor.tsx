import React, { useEffect, useRef } from 'react';
import createEngine from '@projectstorm/react-diagrams';
import { DiagramModel } from '@projectstorm/react-diagrams';
import { CanvasWidget } from '@projectstorm/react-canvas-core';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import { SourceNodeFactory, LogicNodeFactory, SinkNodeFactory } from '../../lib/graph/TaxNodeModels.js';
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

export function GraphEditor(): React.ReactElement {
  const engineRef = useRef<DiagramEngine | null>(null);
  const { graphConfig, activeTaxConfigId, saveGraphConfig } = useAppStore((s) => ({
    graphConfig: s.graphConfig,
    activeTaxConfigId: s.activeTaxConfigId,
    saveGraphConfig: s.saveGraphConfig,
  }));

  if (!engineRef.current) {
    engineRef.current = buildEngine();
  }
  const engine = engineRef.current;

  useEffect(() => {
    const model = new DiagramModel();
    if (graphConfig) {
      try {
        model.deserializeModel(
          JSON.parse(JSON.stringify(graphConfig)) as Parameters<typeof model.deserializeModel>[0],
          engine,
        );
      } catch {
        // Start with empty model if deserialization fails
      }
    }
    engine.setModel(model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphConfig?.id]);

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
    // Embed the full diagram serialization into the config for storage
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
