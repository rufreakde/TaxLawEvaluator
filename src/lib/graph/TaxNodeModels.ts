import React from 'react';
import { DefaultNodeModel, DefaultPortModel } from '@projectstorm/react-diagrams';
import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import type { GenerateModelEvent, GenerateWidgetEvent } from '@projectstorm/react-canvas-core';
import type { TaxNodeExtras, TaxNodeKind } from '../../types/graph.js';
import type { ResolvedVariableMap } from '../../types/variableMapping.js';
import { SourceNodeWidget } from '../../components/GraphEditor/SourceNodeWidget.js';
import { LogicNodeWidget } from '../../components/GraphEditor/LogicNodeWidget.js';
import { ResultNodeWidget } from '../../components/GraphEditor/ResultNodeWidget.js';
import { BenchmarkResultNodeWidget } from '../../components/GraphEditor/BenchmarkResultNodeWidget.js';

export abstract class TaxBaseNodeModel extends DefaultNodeModel {
  extras: TaxNodeExtras;

  constructor(kind: TaxNodeKind, label: string, extras: Omit<TaxNodeExtras, 'kind'>) {
    super({ type: kind, name: label });
    this.extras = { kind, ...extras };
  }

  override serialize(): ReturnType<DefaultNodeModel['serialize']> & { extras: TaxNodeExtras } {
    return { ...super.serialize(), extras: this.extras };
  }

  override deserialize(event: Parameters<DefaultNodeModel['deserialize']>[0]): void {
    super.deserialize(event);
    const data = event.data as { extras?: TaxNodeExtras };
    if (data.extras) {
      this.extras = data.extras;
    }
  }
}

export class SourceNodeModel extends TaxBaseNodeModel {
  constructor(label: string, taxConfigId: number, inputId: string, sourceExpression: string, staticValue?: number) {
    super('SourceNode', label, {
      taxConfigId,
      sourceBinding: { inputId, sourceExpression, staticValue },
    });
    this.addOutPort('out');
  }
}

export class LogicNodeModel extends TaxBaseNodeModel {
  constructor(label: string, taxConfigId: number, ruleId: number, formula: string) {
    super('LogicNode', label, {
      taxConfigId,
      logicBinding: { ruleId, formula, inputCount: 0 },
    });
    this.addOutPort('out');
  }

  /** Add a port with an explicit name (e.g. 'a', 'b') — used for formula-driven auto-wiring. */
  addNamedInputPort(name: string): void {
    const binding = this.extras.logicBinding;
    if (!binding) return;
    if (this.getPort(name)) return; // already exists
    this.addInPort(name);
    binding.inputCount = (binding.inputCount ?? 0) + 1;
  }

  addInputPort(): string | null {
    const binding = this.extras.logicBinding;
    if (!binding) return null;
    const count = binding.inputCount ?? 0;
    if (count >= 26) return null;
    const letter = String.fromCharCode(97 + count);
    this.addInPort(letter);
    binding.inputCount = count + 1;
    return letter;
  }

  removeLastInputPort(): void {
    const binding = this.extras.logicBinding;
    if (!binding) return;
    const count = binding.inputCount ?? 0;
    if (count === 0) return;
    const letter = String.fromCharCode(97 + count - 1);
    const port = this.getPort(letter);
    if (port) {
      Object.values(port.getLinks()).forEach((link) => link.remove());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.removePort(port as any);
    }
    binding.inputCount = count - 1;
  }
}

export class ResultNodeModel extends TaxBaseNodeModel {
  constructor(label: string, taxConfigId: number, outputId: string, referenceRule: string) {
    super('ResultNode', label, {
      taxConfigId,
      resultBinding: { outputId, referenceRule },
    });
    this.addInPort('in');
    this.addOutPort('out');
  }

  /** Sum all numeric values from connected nodes */
  sumInputValues(resolvedVars: ResolvedVariableMap | null): number | 'error' {
    const inPort = this.getPort('in');
    if (!inPort) return 0;

    const links = Object.values(inPort.getLinks()) as unknown[];
    let sum = 0;
    let hasError = false;

    for (const linkRaw of links) {
      const link = linkRaw as any;
      const sourcePort = link.getSourcePort?.();
      if (!sourcePort) continue;

      const sourceNode = sourcePort.getNode?.() as any;
      if (sourceNode?.extras?.kind === 'SourceNode') {
        const inputId: string = sourceNode.extras.sourceBinding?.inputId ?? '';
        const value = inputId ? resolvedVars?.variables[inputId] : sourceNode.extras.sourceBinding?.staticValue;
        if (typeof value !== 'number' || !isFinite(value)) {
          hasError = true;
        } else {
          sum += value;
        }
      } else if (sourceNode?.extras?.kind === 'LogicNode') {
        // Logic node value would need to be computed via formula - this is handled by the widget
        hasError = true;
      } else if (sourceNode?.extras?.kind === 'ResultNode') {
        hasError = true;
      }
    }

    return hasError ? 'error' : sum;
  }
}

export class BenchmarkResultNodeModel extends TaxBaseNodeModel {
  constructor(
    label: string,
    benchmarkId: string,
    targetValue: number,
    outputId?: string,
    taxConfigId: number = 0
  ) {
    super('BenchmarkResultNode', label, {
      taxConfigId,
      benchmarkResultBinding: { targetValue, benchmarkId, outputId },
    });
    this.addInPort('in');
  }

  getTargetValue(): number {
    return this.extras.benchmarkResultBinding?.targetValue ?? 0;
  }

  getBenchmarkId(): string {
    return this.extras.benchmarkResultBinding?.benchmarkId ?? '';
  }

  getOutputId(): string | undefined {
    return this.extras.benchmarkResultBinding?.outputId;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class SourceNodeFactory extends (AbstractReactFactory as any) {
  constructor() {
    super('SourceNode');
  }

  generateModel(_event: GenerateModelEvent): SourceNodeModel {
    return new SourceNodeModel('Source', 0, '', '');
  }

  generateReactWidget(event: GenerateWidgetEvent<SourceNodeModel>): JSX.Element {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.createElement(SourceNodeWidget, { engine: (this as any).engine, node: event.model });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class LogicNodeFactory extends (AbstractReactFactory as any) {
  constructor() {
    super('LogicNode');
  }

  generateModel(_event: GenerateModelEvent): LogicNodeModel {
    return new LogicNodeModel('Logic', 0, 0, '');
  }

  generateReactWidget(event: GenerateWidgetEvent<LogicNodeModel>): JSX.Element {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.createElement(LogicNodeWidget, { engine: (this as any).engine, node: event.model });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ResultNodeFactory extends (AbstractReactFactory as any) {
  constructor() {
    super('ResultNode');
  }

  generateModel(_event: GenerateModelEvent): ResultNodeModel {
    return new ResultNodeModel('Result', 0, '', '');
  }

  generateReactWidget(event: GenerateWidgetEvent<ResultNodeModel>): JSX.Element {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.createElement(ResultNodeWidget, { engine: (this as any).engine, node: event.model });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class BenchmarkResultNodeFactory extends (AbstractReactFactory as any) {
  constructor() {
    super('BenchmarkResultNode');
  }

  generateModel(_event: GenerateModelEvent): BenchmarkResultNodeModel {
    return new BenchmarkResultNodeModel('Benchmark', '', 0);
  }

  generateReactWidget(event: GenerateWidgetEvent<BenchmarkResultNodeModel>): JSX.Element {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.createElement(BenchmarkResultNodeWidget, { engine: (this as any).engine, node: event.model });
  }
}
