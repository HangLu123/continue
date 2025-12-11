import { Tool } from "../..";

import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const searchWebTool: Tool = {
  type: "function",
  displayTitle: "搜索网页",
  wouldLikeTo: '搜索网页内容："{{{ query }}}"',
  isCurrently: '正在搜索网页内容："{{{ query }}}"',
  hasAlready: '已搜索过网页内容："{{{ query }}}"',
  readonly: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.SearchWeb,
    description:
      "Performs a web search, returning top results. Use this tool sparingly - only for questions that require specialized, external, and/or up-to-date knowledege. Common programming questions do not require web search.",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "The natural language search query",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
  systemMessageDescription: {
    prefix: `To search the web, use the ${BuiltInToolNames.SearchWeb} tool with a natural language query. For example, to search for the current weather, you would respond with:`,
    exampleArgs: [["query", "What is the current weather in San Francisco?"]],
  },
  toolCallIcon: "GlobeAltIcon",
};
