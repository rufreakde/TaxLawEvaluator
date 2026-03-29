# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TaxLawEvaluator** is a UI application for simulating and evaluating tax laws. Users define economy parameters, citizen scenarios (with varying wealth levels), and tax laws as a node graph. 
The system computes outputs (state income, disposable income per scenario) and scores results via a points system taking the economy of that country and year chosen into account. 
Users should not be able to create or edit the result evaluation benchmarks it is something for admins only.

Core domain concepts:
- **Economy Inputs** — macro-level economic parameters (provided by admins)
- **Scenario Inputs** — citizen profiles with wealth/income distributions (provided by users and defaults by admins)
- **Laws as Nodes** — tax rules modeled as a composable node graph (provided by users and default sets by admins)
- **Results & Benchmark** — state income and available money per scenario (provided by admins)
- **Points System** — evaluation metric scoring the law configurations against goals. 1000 points baseline minus points for node count exponential minus pints for node rules complexity, plus points for more state income and more median wealth for citizens.

## Tech Stack

The `.gitignore` is configured for a Node.js/TypeScript frontend project (Vite, Next.js, or similar). No framework has been chosen yet — this project is in initial setup.

- **Framework**: React + https://github.com/projectstorm/react-diagrams
- **Language**: TypeScript
- **Database**: SQLite
- **Styling**: Tailwind CSS v4
- **UI**: Radix UI + shadcn/ui components
- **Testing**: Jest

## Development Setup

## Development
```bash
npm install             # Install dependencies
npm run dev             # Development server
npm run build           # Production build
npm tun e2e             # playwright test setup run
npm run test            # Run tests
```

## Code Standards
- TypeScript strict mode
- Tests for new features
- Components in PascalCase
- Utilities in camelCase
- Tailwind instead of CSS modules
- No new components without checking ui/
- Keep tests close to the original code *.test.js if possible idomatic to jest
- always use `` in any playwright test evaluation (default is 2000ms, can override if needed)

## Project-Specific Rules
- functions have to define input parameter and output typed with typescript

## Important Notes
- Production secrets in .env.production
- No direct DB queries
- Mind rate limiting

## Common Mistakes to Avoid
- DON'T: Create new README.md
- DON'T: Leave console.log in code
- DON'T: New UI components from scratch
- ALWAYS: Edit existing files
- ALWAYS: TypeScript strict mode

## Context Rules

### For Bug Fixes
- First understand, then fix
- Analyze root cause
- Write regression test
- Update changelog

### For New Features
- First define Types/Interfaces
- API-First Design
- Write tests in parallel
- Documentation comments

### For Refactoring
- Don't change functionality
- Tests must stay green
- Proceed step by step
- Measure performance
- Always run `npm run test` and `npm run e2e` after changed are completed and fix issues if any

## Git Workflow
- Feature branches from main
- PR before merge
- Squash commits on merge
- do regular delivery to main

## Architecture Notes

The node-based law system is the core design challenge: tax laws should be composable, allowing inputs (income brackets, rates, deductions) to feed into each other as a directed graph. The evaluation engine traverses this graph with the scenario inputs to produce per-citizen and aggregate outputs.

### The Scoring Engine
The system evaluates "Law Configurations" based on complexity and tax burden.
- **Deduction Logic**: 
  - Each `TaxNode` present in the graph: `-5` point.
  - Each `FormulaRule` within a node: `-1` point. For each additional `FormulaRule` within a node the negative impact value by -3.
- **Evaluation**: The engine must calculate the "Disposable Income" across all scenarios and weigh it against the final Score.

### Node Logic
We use `react-diagrams`. Each node represents a functional block:
- **Scenarios and TaxLaws**: Scenarios is a save of `Source Nodes` (provided by users) + `Default Source Nodes` (provded by admins)
- **Source Nodes**: Can be mapped to `income` or `economy` YAML data.
- **Logic Nodes**: Apply `FormulaRule` (e.g., `$a * 0.75`) to input. Note that this can be a chain of rules and / or if else conditioned switches depending on the formula.
- **Sink Nodes**: Aggregate results for State Income and Scenario Totals. Provded by admins for specific `TaxLaws` to evaluate results.

- **Economy Inputs** — macro-level economic parameters (provided by admins)
- **Scenario Inputs** — citizen profiles with wealth/income distributions (provided by users and defaults by admins)
- **Laws as Nodes** — tax rules modeled as a composable node graph (provided by users and default sets by admins)
- **Results & Benchmark** — state income and available money per scenario (provided by admins)
- **Points System** — evaluation metric scoring the law configurations against goals. 1000 points baseline minus points for node count exponential minus pints for node rules complexity, plus points for more state income and more median wealth for citizens.

## Project Structure
```
src/
├── data/<subfolders>/   # Contains yaml files for inputs / economy values / scoring values for local testing
├── data/db/     # the yaml files will be loaded as table entries into the db on startup
├── components/       # React Components
│   └── ui/          # shadcn/ui Components
├── lib/             # Utilities and Services
└── types/           # TypeScript Types
└── cfg/        # server configuration (credentials in .env never commit .env)
```