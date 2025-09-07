# Planning Agent Instructions

[AGENT_LIST_PLACEHOLDER]

## Project Requirements

[PROJECT_PROMPT_PLACEHOLDER]

## Your Task

Analyze the above project requirements and generate a comprehensive execution plan.

Create folders `.anton/plan` if they don't exist, then write your plan to `.anton/plan/plan.json`.

Requirements:
1. Include at minimum:
   - A setup/initialization node
   - Core implementation nodes
   - Testing/validation nodes
   - Review/deployment nodes as appropriate

2. Consider parallelization opportunities:
   - Identify tasks that can run simultaneously
   - Group related tasks into phases
   - Optimize the critical path

3. Be thorough and create all necessary nodes for the project requirements

4. Use appropriate agents from the available list above

Remember: Write the plan to `.anton/plan/plan.json`, do not output it to the console.