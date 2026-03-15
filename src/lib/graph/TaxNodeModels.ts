import React from 'react';
import { DefaultNodeModel } from '@projectstorm/react-diagrams';
import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import type { GenerateModelEvent, GenerateWidgetEvent } from '@projectstorm/react-canvas-core';
import type { TaxNodeExtras, TaxNodeKind } from '../../types/graph.js';
import { SourceNodeWidget } from '../../components/GraphEditor/SourceNodeWidget.js';
import { LogicNodeWidget } from '../../components/GraphEditor/LogicNodeWidget.js';
import { SinkNodeWidget } from '../../components/GraphEditor/SinkNodeWidget.js';

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

export class SinkNodeModel extends TaxBaseNodeModel {
  constructor(label: string, taxConfigId: number, outputId: string, referenceRule: string) {
    super('SinkNode', label, {
      taxConfigId,
      sinkBinding: { outputId, referenceRule },
    });
    this.addInPort('in');
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
export class SinkNodeFactory extends (AbstractReactFactory as any) {
  constructor() {
    super('SinkNode');
  }

  generateModel(_event: GenerateModelEvent): SinkNodeModel {
    return new SinkNodeModel('Sink', 0, '', '');
  }

  generateReactWidget(event: GenerateWidgetEvent<SinkNodeModel>): JSX.Element {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.createElement(SinkNodeWidget, { engine: (this as any).engine, node: event.model });
  }
}
