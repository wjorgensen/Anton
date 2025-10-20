#!/usr/bin/env node

/**
 * MCP Server for Anton Planning Agents
 * Provides tools for building, validating, and managing IR graphs
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import {
  startSession,
  getIR,
  setConstraints,
  addNode,
  updateNode,
  deleteNode,
  addPort,
  removePort,
  addEdge,
  removeEdge,
  setPortType,
  setContracts,
  validateGraph,
  getValidationErrors,
  canonicalizeIR,
  exportSnapshot,
  planFileLayout,
  synthesizeFileLayout,
  emitImplBatches,
  buildImplPlan,
  insertAdapter,
  renamePort,
  splitNode,
  mergeNodes,
  patchIR,
  validateCompatibility,
  scoreIR,
  getRPGView,
  getImplView,
  exportGraphviz,
} from "./tools.ts";

const server = new Server(
  {
    name: "@anton/planning-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const tools: Tool[] = [
  {
    name: "start_session",
    description: "Initialize a new planning session. Creates project folder with anton-plan.json and logs/ directory.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Project folder name & ID seed"
        },
        goal: {
          type: "string",
          description: "One-line purpose of the project"
        },
        capabilities: {
          type: "array",
          items: { type: "string" },
          description: "Flat tags to validate coverage (e.g., ['ingress:http','auth:jwt','storage:kv'])"
        },
        io_boundaries: {
          type: "object",
          properties: {
            inputs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string" },
                  id: { type: "string" },
                  spec: { type: "string" }
                },
                required: ["kind", "id", "spec"]
              }
            },
            outputs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string" },
                  id: { type: "string" },
                  spec: { type: "string" }
                },
                required: ["kind", "id", "spec"]
              }
            }
          },
          required: ["inputs", "outputs"],
          description: "Required I/O boundaries (may have empty arrays)"
        }
      },
      required: ["name", "goal", "capabilities", "io_boundaries"],
    },
  },
  {
    name: "get_ir",
    description: "Get the current IR state.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "set_constraints",
    description: "Set or update global constraints (runtime, licenses).",
    inputSchema: {
      type: "object",
      properties: {
        constraints: {
          type: "object",
          properties: {
            runtime: { type: "array", items: { type: "string" } },
            licenses_allow: { type: "array", items: { type: "string" } },
            licenses_deny: { type: "array", items: { type: "string" } },
          },
        },
      },
      required: ["constraints"],
    },
  },
  {
    name: "add_node",
    description: "Add a new node to the IR. ID is auto-generated. Ports can be defined with names (types added later via set_port_type).",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "Optional request ID for idempotency" },
        name_hint: { type: "string", description: "Optional hint for ID generation (will be sanitized and versioned)" },
        kind: {
          type: "string",
          enum: ["framework", "module", "atom", "adapter", "infra", "test"],
          description: "Type of node being added"
        },
        summary: {
          type: "string",
          description: "Detailed description of what this node does"
        },
        inputs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Port name (e.g., 'request', 'data')" },
              required: { type: "boolean", description: "Whether this input is required (default: true)" }
            },
            required: ["name"]
          },
          description: "Input ports (just names; types assigned later)"
        },
        outputs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Port name (e.g., 'response', 'result')" },
              required: { type: "boolean", description: "Whether this output is required (default: true)" }
            },
            required: ["name"]
          },
          description: "Output ports (just names; types assigned later)"
        },
        language: {
          type: "string",
          description: "Primary implementation language (go, ts, py, etc.)"
        },
        framework_hint: {
          type: "string",
          description: "Framework recommendation (e.g., 'express', 'nextjs', 'fastapi')"
        },
        build_prompt: {
          type: "string",
          description: "Detailed build instructions for code generation"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for categorization"
        },
      },
      required: ["kind", "summary"],
    },
  },
  {
    name: "update_node",
    description: "Update an existing node. Only fields from add_node can be updated. Cannot change ID.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "Optional request ID for idempotency" },
        id: { type: "string", description: "ID of the node to update" },
        kind: {
          type: "string",
          enum: ["framework", "module", "atom", "adapter", "infra", "test"],
          description: "Type of node"
        },
        summary: { type: "string", description: "Description of the node" },
        language: { type: "string", description: "Programming language (go, ts, py, etc.)" },
        framework_hint: { type: "string", description: "Framework recommendation" },
        build_prompt: { type: "string", description: "Detailed build instructions" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for categorization" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_node",
    description: "Delete a node. Use force=true to delete even if it has edges.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        id: { type: "string" },
        force: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "add_port",
    description: "Add a port to an existing node. Types can be assigned later with set_port_type.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "Optional request ID for idempotency" },
        node: { type: "string", description: "Node ID" },
        direction: {
          type: "string",
          enum: ["input", "output"],
          description: "Whether this is an input or output port"
        },
        name: { type: "string", description: "Port name (must be unique within direction)" },
        required: {
          type: "boolean",
          description: "Whether this port is required (default: true)"
        }
      },
      required: ["node", "direction", "name"],
    },
  },
  {
    name: "remove_port",
    description: "Remove a port from a node. Fails if the port has connected edges.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "Optional request ID for idempotency" },
        node: { type: "string", description: "Node ID" },
        direction: {
          type: "string",
          enum: ["input", "output"],
          description: "Whether this is an input or output port"
        },
        port: { type: "string", description: "Port name to remove" }
      },
      required: ["node", "direction", "port"],
    },
  },
  {
    name: "add_edge",
    description: "Add an edge connecting two ports. Validates nodes/ports exist, checks for cycles, and persists to anton-plan.json.",
    inputSchema: {
      type: "object",
      properties: {
        edgeId: {
          type: "string",
          description: "Optional edge ID for idempotency"
        },
        edge: {
          type: "object",
          properties: {
            from: {
              type: "object",
              properties: {
                node: { type: "string", description: "Source node ID" },
                port: { type: "string", description: "Output port name" },
              },
              required: ["node", "port"],
            },
            to: {
              type: "object",
              properties: {
                node: { type: "string", description: "Target node ID" },
                port: { type: "string", description: "Input port name" },
              },
              required: ["node", "port"],
            },
            order_before: {
              type: "boolean",
              description: "If true, source node must fully complete before target can start (execution ordering constraint)"
            },
          },
          required: ["from", "to"],
        },
      },
      required: ["edge"],
    },
  },
  {
    name: "remove_edge",
    description: "Remove an edge by specifying from and to nodes/ports. Persists to anton-plan.json.",
    inputSchema: {
      type: "object",
      properties: {
        edgeId: {
          type: "string",
          description: "Optional edge ID for idempotency"
        },
        from: {
          type: "object",
          properties: {
            node: { type: "string", description: "Source node ID" },
            port: { type: "string", description: "Output port name" },
          },
          required: ["node", "port"],
        },
        to: {
          type: "object",
          properties: {
            node: { type: "string", description: "Target node ID" },
            port: { type: "string", description: "Input port name" },
          },
          required: ["node", "port"],
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "set_port_type",
    description: "Set or update the type of a port.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        node: { type: "string" },
        direction: { type: "string", enum: ["input", "output"] },
        port: { type: "string" },
        type: { type: "object" },
      },
      required: ["node", "direction", "port", "type"],
    },
  },
  {
    name: "set_contracts",
    description: "Set pre/post conditions for a node.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        node: { type: "string" },
        contracts: {
          type: "object",
          properties: {
            pre: { type: "array", items: { type: "string" } },
            post: { type: "array", items: { type: "string" } },
          },
        },
      },
      required: ["node", "contracts"],
    },
  },
  {
    name: "validate_graph",
    description: "Run all validators on the current IR. Returns summary and errors.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_validation_errors",
    description: "Get detailed validation errors from the last validate_graph call.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "canonicalize_ir",
    description: "Sort and normalize the IR (nodes, edges, ports, types).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "export_snapshot",
    description: "Export the current IR as JSON or YAML (base64 encoded).",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["json", "yaml"] },
      },
      required: ["format"],
    },
  },
  {
    name: "plan_file_layout",
    description: "Deterministically map nodes to files using policy rules and persist the layout in the IR.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        policy: { type: "string", enum: ["go", "ts", "py", "auto"] },
        roleToFolder: { type: "object" },
        testLayout: { type: "string", enum: ["dedicated", "co-located"] },
      },
    },
  },
  {
    name: "synthesize_file_layout",
    description: "[deprecated] Alias for plan_file_layout.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        policy: { type: "string", enum: ["go", "ts", "py", "auto"] },
        roleToFolder: { type: "object" },
        testLayout: { type: "string", enum: ["dedicated", "co-located"] },
      },
    },
  },
  {
    name: "emit_impl_batches",
    description: "Emit topologically ordered implementation batches (requires ready-phase IR and file layout).",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
      },
    },
  },
  {
    name: "build_impl_plan",
    description: "[deprecated] Alias for emit_impl_batches (nodeToFiles is ignored).",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        nodeToFiles: { type: "object" },
      },
    },
  },
  {
    name: "insert_adapter",
    description: "Insert an adapter node between two connected ports and rewire the edge.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        edge: {
          type: "object",
          properties: {
            from: {
              type: "object",
              properties: {
                node: { type: "string" },
                port: { type: "string" },
              },
              required: ["node", "port"],
            },
            to: {
              type: "object",
              properties: {
                node: { type: "string" },
                port: { type: "string" },
              },
              required: ["node", "port"],
            },
          },
          required: ["from", "to"],
        },
        adapter: {
          type: "object",
          properties: {
            name_hint: { type: "string" },
            summary: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            language: { type: "string" },
            buffer: { type: "boolean" },
          },
          required: ["summary"],
        },
      },
      required: ["edge", "adapter"],
    },
  },
  {
    name: "rename_port",
    description: "Rename an input or output port and update incident edges.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        node: { type: "string" },
        direction: { type: "string", enum: ["input", "output"] },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["node", "direction", "from", "to"],
    },
  },
  {
    name: "split_node",
    description: "Split a node into multiple nodes, distributing inputs and outputs explicitly.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        node: { type: "string" },
        parts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name_hint: { type: "string" },
              summary: { type: "string" },
              inputs: { type: "array", items: { type: "string" } },
              outputs: { type: "array", items: { type: "string" } },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["summary", "inputs", "outputs"],
          },
        },
      },
      required: ["node", "parts"],
    },
  },
  {
    name: "merge_nodes",
    description: "Merge multiple nodes of the same kind into a single composite node.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        nodes: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
        name_hint: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["nodes", "summary"],
    },
  },
  {
    name: "patch_ir",
    description: "Apply RFC6902 JSON Patch operations transactionally to the IR.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["add", "remove", "replace"] },
              path: { type: "string" },
              value: {},
            },
            required: ["op", "path"],
          },
        },
      },
      required: ["operations"],
    },
  },
  {
    name: "validate_compatibility",
    description: "Evaluate runtime, licensing, and policy compatibility constraints.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "score_ir",
    description: "Compute a heuristic score for the IR (coverage, adapter usage, graph depth).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_rpg_view",
    description: "Return the current IR with validation summary and phase metadata.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_impl_view",
    description: "Return persisted file layout and the latest implementation plan preview.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "export_graphviz",
    description: "Render the IR or implementation view as Graphviz DOT text.",
    inputSchema: {
      type: "object",
      properties: {
        view: { type: "string", enum: ["rpg", "impl"] },
      },
      required: ["view"],
    },
  },
];

// Request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    let result;
    switch (name) {
      case "start_session":
        result = await startSession(args as any);
        break;
      case "get_ir":
        result = await getIR();
        break;
      case "set_constraints":
        result = await setConstraints(args as any);
        break;
      case "add_node":
        result = await addNode(args as any);
        break;
      case "update_node":
        result = await updateNode(args as any);
        break;
      case "delete_node":
        result = await deleteNode(args as any);
        break;
      case "add_port":
        result = await addPort(args as any);
        break;
      case "remove_port":
        result = await removePort(args as any);
        break;
      case "add_edge":
        result = await addEdge(args as any);
        break;
      case "remove_edge":
        result = await removeEdge(args as any);
        break;
      case "set_port_type":
        result = await setPortType(args as any);
        break;
      case "set_contracts":
        result = await setContracts(args as any);
        break;
      case "validate_graph":
        result = await validateGraph();
        break;
      case "get_validation_errors":
        result = await getValidationErrors();
        break;
      case "canonicalize_ir":
        result = await canonicalizeIR();
        break;
      case "export_snapshot":
        result = await exportSnapshot(args as any);
        break;
      case "plan_file_layout":
        result = await planFileLayout(args as any);
        break;
      case "synthesize_file_layout":
        result = await synthesizeFileLayout(args as any);
        break;
      case "emit_impl_batches":
        result = await emitImplBatches(args as any);
        break;
      case "build_impl_plan":
        result = await buildImplPlan(args as any);
        break;
      case "insert_adapter":
        result = await insertAdapter(args as any);
        break;
      case "rename_port":
        result = await renamePort(args as any);
        break;
      case "split_node":
        result = await splitNode(args as any);
        break;
      case "merge_nodes":
        result = await mergeNodes(args as any);
        break;
      case "patch_ir":
        result = await patchIR(args as any);
        break;
      case "validate_compatibility":
        result = await validateCompatibility();
        break;
      case "score_ir":
        result = await scoreIR();
        break;
      case "get_rpg_view":
        result = await getRPGView();
        break;
      case "get_impl_view":
        result = await getImplView();
        break;
      case "export_graphviz":
        result = await exportGraphviz(args as any);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: false,
            errors: [{ code: "SCHEMA_INVALID", msg: errorMessage }],
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Anton Planning MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
