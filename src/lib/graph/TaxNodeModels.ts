import React from 'react';
import { DefaultNodeModel } from '@projectstorm/react-diagrams';
import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import type { GenerateModelEvent, GenerateWidgetEvent } from '@projectstorm/react-canvas-core';
import type { TaxNodeExtras, TaxNodeKind } from '../../types/graph.js';
import { SourceNodeWidget } from '../../components/GraphEditor/SourceNodeWidget.js';
import { LogicNodeWidget } from '../../components/GraphEditor/LogicNodeWidget.js';
import { SinkNodeWidget } from '../../components/GraphEditor/SinkNodeWidget.js';

const VAR_REGEX = /\$([a-zA-Z]\w*)/g;

function parseFormulaVariables(formula: string): string[] {
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  VAR_REGEX.lastIndex = 0;
  while ((match = VAR_REGEX.exec(formula)) !== null) {
    vars.add(match[1]);
  }
  return Array.from(vars);
}

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
      logicBinding: { ruleId, formula },
    });
    const vars = parseFormulaVariables(formula);
    if (vars.length > 0) {
      vars.forEach((v) => this.addInPort(v));
    } else {
      this.addInPort('in');
    }
    this.addOutPort('out');
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
