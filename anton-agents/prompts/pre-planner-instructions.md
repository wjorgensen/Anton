# Pre-Planning Validation Task

Analyze the following user prompt and determine:
1. Whether it describes a software project that can be planned and built
2. An appropriate project name (50 characters max, lowercase with hyphens)

User Prompt:
{{USER_PROMPT}}

Respond with JSON only in this format:
- If valid project: {"isProjectDescription": true, "name": "project-name"}
- If not valid: {"isProjectDescription": false, "name": null}