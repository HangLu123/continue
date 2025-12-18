import {
  ConfigValidationError,
  markdownToRule,
} from "@continuedev/config-yaml";
import { IDE, RuleWithSource } from "../..";
import { PROMPTS_DIR_NAME, RULES_DIR_NAME } from "../../promptFiles";
import { joinPathsToUri } from "../../util/uri";
import { getAllDotContinueDefinitionFiles } from "../loadLocalAssistants";

export const SUPPORTED_AGENT_FILES = ["AGENTS.md", "AGENT.md", "CLAUDE.md"];
/**
 * Loads rules from markdown files in the .continue/rules and .continue/prompts directories
 * and agent files (AGENTS.md, AGENT.md, CLAUDE.md) at workspace root
 */
export async function loadMarkdownRules(ide: IDE): Promise<{
  rules: RuleWithSource[];
  errors: ConfigValidationError[];
}> {
  const errors: ConfigValidationError[] = [];
  const rules: RuleWithSource[] = [];

  // First, try to load agent files from workspace root
  const workspaceDirs = await ide.getWorkspaceDirs();

  for (const workspaceDir of workspaceDirs) {
    let agentFileFound = false;
    for (const fileName of SUPPORTED_AGENT_FILES) {
      try {
        const agentFileUri = joinPathsToUri(workspaceDir, fileName);
        const exists = await ide.fileExists(agentFileUri);
        if (exists) {
          const agentContent = await ide.readFile(agentFileUri);

          const rule = markdownToRule(agentContent, {
            uriType: "file",
            fileUri: agentFileUri,
          });
          rules.push({
            ...rule,
            source: "agentFile",
            sourceFile: agentFileUri,
            alwaysApply: true,
          });
          agentFileFound = true;
        }

        break; // Use the first found agent file in this workspace
      } catch (e) {
        // File doesn't exist or can't be read, continue to next file
      }
    }
    if (agentFileFound) {
      break; // Use agent file from first workspace that has one
    }
  }

  // Load markdown files from both .continue/rules and .continue/prompts
  const dirsToCheck = [RULES_DIR_NAME, PROMPTS_DIR_NAME];

  for (const dirName of dirsToCheck) {
    try {
      const markdownFiles = await getAllDotContinueDefinitionFiles(
        ide,
        {
          includeGlobal: true,
          includeWorkspace: true,
          fileExtType: "markdown",
        },
        dirName,
      );

      // Filter to just .md files
      const mdFiles = markdownFiles.filter((file) => file.path.endsWith(".md"));

      // Process each markdown file
      for (const file of mdFiles) {
        try {
          const rule = markdownToRule(file.content, {
            uriType: "file",
            fileUri: file.path,
          });
          if (!rule.invokable) {
            rules.push({
              ...rule,
              source: "rules-block",
              sourceFile: file.path,
            });
          }
        } catch (e) {
          errors.push({
            fatal: false,
            message: `Failed to parse markdown rule file ${file.path}: ${e instanceof Error ? e.message : e}`,
          });
        }
      }
    } catch (e) {
      errors.push({
        fatal: false,
        message: `Error loading markdown rule files from ${dirName}: ${e instanceof Error ? e.message : e}`,
      });
    }
  }

  rules.unshift({
    rule: "如果没有特殊提示，尽量使用中文回答",
    alwaysApply: true,
    name: "使用中文回答",
    source: "default-chat",
  });
  // rules.unshift({
  //   rule: "角色与任务\n您是一位资深的 C 语言开发人员，精通 C 代码的单元测试与可测试性设计。您的任务是为给定的 C 源码创建简洁、高效、可维护的单元测试。\n\n您必须严格遵守以下概述的准则和工具。\n\n1. 技术栈\n语言：C（C11 或更新标准）\n测试框架：优先使用 Unity 或 CMocka（以函数级单元测试为核心，而非集成测试）\nMock / Stub：使用 CMock（如基于 Unity）或手写 stub / fake 函数，通过函数指针、宏重定义、链接替换等方式模拟外部依赖\n断言：Unity 使用 TEST_ASSERT_EQUAL、TEST_ASSERT_TRUE、TEST_ASSERT_NULL 等；CMocka 使用 assert_int_equal、assert_true、assert_non_null 等\n\n2. 测试结构和风格\n命名规则：测试函数必须具有清晰的描述性，并遵循 functionUnderTest_scenario_expectedBehavior 的模式。\n示例：calculate_sum_whenInputIsValid_shouldReturnCorrectResult\n\n组织方式（BDD 风格）：使用 Given-When-Then 模式构建每个测试函数体，并用注释区分各部分。\n\n// given\n...\n\n// when\n...\n\n// then\n...\n\n清晰性：每个测试函数只验证一个场景，避免在同一个测试中出现多个逻辑分支、复杂控制流或多重行为断言。\n\n3. 单元测试最佳实践\n单元测试关注点：仅测试当前函数或模块的行为，必须隔离所有外部依赖（如 IO、时间、随机数、系统调用、其他模块），并通过 mock 或 stub 替代。\n\n覆盖范围：生成的测试必须覆盖正常路径、边界条件（如 NULL 指针、空数据、极值）以及错误场景（如非法参数、返回错误码）。错误场景需明确断言返回值、状态码或输出参数。\n\nMock / Stub 使用原则：当参数值对测试行为不重要时可使用通用 stub；当参数值影响逻辑分支时必须显式校验参数或在 stub 中区分不同输入；禁止忽略关键参数校验。\n\n4. 回答格式\n当给定被测 C 代码片段时，仅生成完整、可编译的测试源文件，包含必要的 #include、测试函数以及测试运行入口（main 或等效）。除非明确要求，请勿在代码之外添加解释、说明或多余注释，也不要生成被测代码本身。",
  //   alwaysApply: true,
  //   name: "C语言单元测试生成规则",
  //   policy: "off",
  //   source: "default-chat",
  // });
  // rules.unshift({
  //   rule: "Explain this code in detail: 1. Overall purpose and functionality 2. Step-by-step breakdown 3. Key algorithms or patterns used 4. Potential issues or edge cases 5. Suggestions for improvement。Use clear, educational language.Include diagrams if helpful (ASCII art or Mermaid).",
  //   alwaysApply: true,
  //   name: "解释代码",
  //   policy: "off",
  //   source: "default-chat",
  // });

  return { rules, errors };
}
