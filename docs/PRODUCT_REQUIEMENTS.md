Multi-Database Client (Hormus) - Product Requirements Document

1. Objective

Build a fast, developer-first desktop database client that supports multiple databases via a modular adapter system.

Key Goals
	•	Low-latency query execution and rendering
	•	Strong UX for engineers (not DBAs)
	•	Safe interaction with production data
	•	Extensible architecture for adding new databases

⸻

2. Target Users

Primary
	•	Backend / full-stack engineers
	•	Data engineers (light usage)

Secondary
	•	DevOps / SREs
	•	Analysts

⸻

3. Core Principles
	•	Capability-based DB abstraction
	•	Local-first desktop app
	•	Performance-first (grid + streaming)
	•	Safety-first (guardrails)
	•	Incremental DB support

⸻

4. Tech Stack

Desktop Shell
	•	Electron

Runtime
	•	Bun

Frontend
	•	React
	•	shadcn/ui
	•	TailwindCSS

State
	•	Zustand
	•	React Query

DB Drivers (initial)
	•	PostgreSQL: pg
	•	MySQL: mysql2

Editor
	•	Monaco Editor

Grid
	•	AG Grid (recommended)

IPC Layer
	•	Electron IPC
	•	Zod validation

⸻

5. High-Level Architecture

Renderer (React UI)
  |
  | IPC
  v
Main Process (Bun runtime)
  |
  ├── Connection Manager
  ├── Query Execution Engine
  ├── Adapter Layer
  ├── Metadata Service
  └── Worker Threads


⸻

PHASE 1 - Core MVP

Goal

Deliver a usable DB client for Postgres/MySQL with strong query + grid UX.

Features

Connection Management
	•	Collection Manager is the app landing screen
	•	Create / edit / delete connections
	•	Choose which connection to open from Collection Manager
	•	PostgreSQL + MySQL
	•	Store credentials securely

Window Model
	•	One window per connection
	•	Isolated state per window

Query Editor
	•	Monaco editor
	•	Multi-tab queries
	•	Per-connection editor workspace opened after connection selection
	•	Run selected / full query
	•	Keyboard shortcuts
	•	Basic autocomplete

Query Execution
	•	Execute SQL statements
	•	Handle errors
	•	Multi-statement support

Results Grid
	•	Virtualized rendering
	•	Column resizing
	•	Sorting
	•	Copy data
	•	CSV export
	•	Row limit (e.g. 10k)

Schema Explorer
	•	Schema selector in the top-left of the query workspace
	•	Tree view of tables and other database objects on the left side
	•	Lazy loading
	•	Click to query

Workspace Layout
	•	Screen 1: Collection Manager for connection CRUD and choosing a database
	•	Screen 2: Query workspace for a specific connection
	•	Query workspace keeps the schema selector at the top-left
	•	Left rail shows database objects in a tree structure
	•	Main area is split vertically:
		•	Top half: query editor
		•	Bottom half: results grid

Adapter Layer (v1)

interface DBAdapter {
  connect()
  disconnect()
  query(sql)
  listSchemas()
  listTables(schema)
  describeTable(table)
}

Local Storage
	•	Connections
	•	Query history

Packaging
	•	macOS + Windows

⸻

PHASE 2 - Power Features

Goal

Make the product competitive and sticky.

Features

Connections
	•	SSH tunneling
	•	Connection pooling
	•	Health indicators

Query Engine
	•	Streaming results
	•	Cancel query
	•	Timeout handling

Results Grid v2
	•	Server-side pagination
	•	Infinite scroll
	•	JSON viewer
	•	Type-aware rendering

SQL Editor
	•	Advanced autocomplete
	•	Query formatting
	•	Snippets
	•	Saved queries

Schema Explorer
	•	Search tables
	•	Indexes + constraints
	•	Quick actions

Safety
	•	Read-only mode
	•	Production flags
	•	Confirmation dialogs

Data Tools
	•	CSV/JSON export
	•	CSV import

Databases
	•	SQLite
	•	SQL Server

Adapter Capabilities

capabilities = {
  transactions: true,
  streaming: true,
  explain: true
}


⸻

PHASE 3 - Differentiation

Goal

Create a strong competitive advantage.

Features

AI
	•	Query explain
	•	Query optimization
	•	Query generation

Collaboration
	•	Shared queries
	•	Workspaces

Observability
	•	Query analytics
	•	Slow query insights

Guardrails
	•	Row limits
	•	Data masking
	•	Approval workflows

Cloud Sync
	•	Sync connections
	•	Sync queries

Plugin System
	•	External adapters
	•	Extensions

Multi-DB Workflows
	•	Data diffing
	•	Schema comparison

⸻

Non-Functional Requirements

Performance
	•	Grid supports 10k+ rows
	•	Schema load < 1s

Reliability
	•	No crashes on invalid queries
	•	Retry logic

Security
	•	Encrypted credentials
	•	No query leakage

⸻

Key Risks
	•	Grid performance
	•	Adapter inconsistencies
	•	Query cancellation
	•	Electron overhead

⸻

Repo Structure

/apps
  /desktop

/packages
  /core
  /adapters
  /types
  /ipc


⸻

Build Plan

Step 1
	•	Electron setup
	•	IPC
	•	Monaco editor

Step 2
	•	Postgres adapter
	•	Connection manager

Step 3
	•	Grid + schema explorer

Step 4
	•	MySQL adapter
	•	Packaging

⸻

Open Questions

Product
	•	Target ICP?
	•	Core differentiation?

Technical
	•	SQL only or NoSQL?
	•	Need cloud sync?

UX
	•	Multi-window vs workspace?
	•	Tabs vs notebooks?

Monetization
	•	Paid app?
	•	Freemium?
	•	Team features?
