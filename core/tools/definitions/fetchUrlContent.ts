import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const fetchUrlContentTool: Tool = {
  type: "function",
  displayTitle: "读取 URL",
  wouldLikeTo: "获取 {{{ url }}}",
  isCurrently: "正在获取 {{{ url }}}",
  hasAlready: "已获取 {{{ url }}}",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.FetchUrlContent,
    description:
      "Can be used to view the contents of a website using a URL. Do NOT use this for files.",
    parameters: {
      type: "object",
      required: ["url"],
      properties: {
        url: {
          type: "string",
          description: "The URL to read",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To fetch the content of a URL, use the ${BuiltInToolNames.FetchUrlContent} tool. For example, to read the contents of a webpage, you might respond with:`,
    exampleArgs: [["url", "https://example.com"]],
  },
  toolCallIcon: "GlobeAltIcon",
};
