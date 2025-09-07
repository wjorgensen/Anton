# Anton Agents

This directory contains the system prompts and instruction templates for Anton's AI agents.

## Structure

```
anton-agents/
├── system/          # System prompts (Claude.md files)
│   ├── planner.md      # Main planning agent system prompt
│   └── plan-fixer.md   # Plan review and fix agent system prompt
└── prompts/         # Instruction templates
    ├── planner-instructions.md      # Template for planning instructions
    └── plan-fixer-instructions.md   # Template for plan fixing instructions
```

## System Prompts

System prompts define the agent's role, capabilities, and behavior patterns. These are passed to Claude using the `--append-system-prompt` flag.

### planner.md
The main planning agent that:
- Analyzes project requirements
- Identifies parallelizable tasks
- Creates execution plans with nodes and dependencies
- Maximizes parallel execution
- Includes testing loops

### plan-fixer.md
The plan review agent that:
- Validates plan structure
- Checks for duplicate nodes
- Verifies dependencies
- Ensures requirements coverage
- Fixes structural issues

## Instruction Prompts

Instruction prompts are templates that get filled with dynamic content (like user requirements) and passed as the main prompt to Claude.

### planner-instructions.md
Template for generating plans from user requirements.

### plan-fixer-instructions.md
Template for reviewing and fixing generated plans.

## Usage

The backend PlanningService automatically:
1. Copies the appropriate system prompts to the execution directory
2. Fills instruction templates with user input
3. Spawns Claude with both system prompt and instructions

## Adding New Agents

To add a new agent:
1. Create a system prompt in `system/` describing the agent's role
2. Create an instruction template in `prompts/` for the agent's tasks
3. Update the backend service to use the new agent

## Best Practices

- Keep system prompts focused on the agent's identity and capabilities
- Use instruction templates for task-specific details
- Avoid duplication between system prompts and instructions
- Test agents thoroughly with various inputs