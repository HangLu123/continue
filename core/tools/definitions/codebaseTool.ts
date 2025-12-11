import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const codebaseTool: Tool = {
  type: "function",
  displayTitle: "代码库搜索",
  wouldLikeTo: "想要在代码库中搜索：{{{ query }}}",
  isCurrently: "正在代码库中搜索：{{{ query }}}",
  hasAlready: "已在代码库中搜索过：{{{ query }}}",
  readonly: true,
  isInstant: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.CodebaseTool,
    description:
      "Use this tool to semantically search through the codebase and retrieve relevant code snippets based on a natural language query. This helps find relevant code context for understanding or working with the codebase.",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description:
            "Natural language description of what you're looking for in the codebase (e.g., 'authentication logic', 'database connection setup', 'error handling')",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To search the codebase, use the ${BuiltInToolNames.CodebaseTool} tool with a natural language query. For example, to find authentication logic, you might respond with:`,
    exampleArgs: [
      ["query", "How is user authentication handled in this codebase?"],
    ],
  },
};
