import { Tool } from "../..";

import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const viewDiffTool: Tool = {
  type: "function",
  displayTitle: "查看差异",
  wouldLikeTo: "查看 Git diff",
  isCurrently: "正在获取 Git diff",
  hasAlready: "已查看 Git diff",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ViewDiff,
    description: "View the current diff of working changes",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  systemMessageDescription: {
    prefix: `To view the current git diff, use the ${BuiltInToolNames.ViewDiff} tool. This will show you the changes made in the working directory compared to the last commit.`,
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "CodeBracketIcon",
};
