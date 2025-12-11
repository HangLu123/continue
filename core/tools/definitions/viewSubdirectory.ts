import { ToolPolicy } from "@continuedev/terminal-security";
import { Tool } from "../..";
import { ResolvedPath, resolveInputPath } from "../../util/pathResolver";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { evaluateFileAccessPolicy } from "../policies/fileAccess";

export const viewSubdirectoryTool: Tool = {
  type: "function",
  displayTitle: "查看子目录",
  wouldLikeTo: '查看 "{{{ directory_path }}}" 的结构图',
  isCurrently: '正在获取 "{{{ directory_path }}}" 的结构图',
  hasAlready: '已查看 "{{{ directory_path }}}" 的结构图',
  readonly: true,
  group: BUILT_IN_GROUP_NAME,
  isInstant: true,
  function: {
    name: BuiltInToolNames.ViewSubdirectory,
    description: "View the contents of a subdirectory",
    parameters: {
      type: "object",
      required: ["directory_path"],
      properties: {
        directory_path: {
          type: "string",
          description:
            "The path of the subdirectory to view, relative to the root of the workspace",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `To view a map of a specific folder within the project, you can use the ${BuiltInToolNames.ViewSubdirectory} tool. This will provide a visual representation of the folder's structure and organization.`,
    exampleArgs: [["directory_path", "path/to/subdirectory"]],
  },
  defaultToolPolicy: "allowedWithPermission",
  toolCallIcon: "FolderOpenIcon",
  preprocessArgs: async (args, { ide }) => {
    const directoryPath = args.directory_path as string;
    const resolvedPath = await resolveInputPath(ide, directoryPath);

    return {
      resolvedPath,
    };
  },
  evaluateToolCallPolicy: (
    basePolicy: ToolPolicy,
    _: Record<string, unknown>,
    processedArgs?: Record<string, unknown>,
  ): ToolPolicy => {
    const resolvedPath = processedArgs?.resolvedPath as
      | ResolvedPath
      | null
      | undefined;
    if (!resolvedPath) return basePolicy;

    return evaluateFileAccessPolicy(basePolicy, resolvedPath.isWithinWorkspace);
  },
};
