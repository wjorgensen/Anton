# Anton Visual Editor

A React Flow-based visual editor for the Anton AI Orchestration Platform. This application provides a drag-and-drop interface for creating and managing AI agent execution flows.

## Features

- ✨ **Visual Flow Design**: Drag-and-drop agents onto an infinite canvas
- 🎨 **Dark Theme**: Black and white design with light blue (#3B82F6) accent color
- 📦 **Agent Library**: Pre-configured agents for setup, execution, testing, integration, review, and summary tasks
- 🔧 **Node Editing**: Double-click nodes to edit instructions and ClaudeMD content
- 🗺️ **Canvas Controls**: Zoom, pan, minimap, and flow controls
- 💾 **Import/Export**: Save and load flow configurations as JSON
- ⚡ **Real-time Status**: Visual feedback for node states (pending, running, completed, failed, reviewing)

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19
- **Flow Editor**: React Flow v12 (@xyflow/react)
- **Styling**: Tailwind CSS v3
- **State Management**: Zustand
- **Icons**: Lucide React
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Building for Production

```bash
npm run build
npm start
```

## Usage

1. **Add Agents**: Drag agents from the left sidebar onto the canvas
2. **Connect Nodes**: Drag from output handles to input handles to create connections
3. **Edit Nodes**: Double-click any node to edit its instructions and configuration
4. **Control Flow**: Use the control panel to run, stop, and manage your flow
5. **Navigate**: Use zoom controls, minimap, or scroll to navigate large flows
6. **Export/Import**: Save your flows as JSON files for later use

## Agent Categories

- **Setup Agents**: Initialize projects (Next.js, Vite, Express, etc.)
- **Execution Agents**: Develop features (React, Node.js, etc.)
- **Testing Agents**: Run tests (Jest, Playwright, etc.)
- **Integration Agents**: Handle git operations and merging
- **Review Agents**: Code review and quality checks
- **Summary Agents**: Generate project documentation

## Design System

The application follows a strict black and white color scheme with a light blue accent:

- **Background**: Pure black (#000000)
- **Cards/Panels**: Near black (#0A0A0A)
- **Text**: White (#FFFFFF)
- **Accent**: Light blue (#3B82F6)
- **Success**: Green (#10B981)
- **Error**: Red (#EF4444)
- **Warning**: Amber (#F59E0B)

All interactive elements feature subtle glow effects and smooth transitions.

## Project Structure

```
src/
├── app/              # Next.js app directory
├── components/       # React components
│   ├── nodes/       # Custom node components
│   ├── AgentLibrary.tsx
│   ├── FlowEditor.tsx
│   └── NodeEditModal.tsx
├── lib/             # Utility functions and data
│   └── agents.ts    # Agent library definitions
├── store/           # Zustand state management
│   └── flowStore.ts
└── types/           # TypeScript type definitions
    └── agent.ts
```

## License

ISC