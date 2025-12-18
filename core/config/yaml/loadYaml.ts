import {
  AssistantUnrolled,
  BLOCK_TYPES,
  ConfigResult,
  ConfigValidationError,
  isAssistantUnrolledNonNullable,
  mergeConfigYamlRequestOptions,
  mergeUnrolledAssistants,
  ModelRole,
  PackageIdentifier,
  RegistryClient,
  unrollAssistant,
  validateConfigYaml,
} from "@continuedev/config-yaml";
import { dirname } from "node:path";

import {
  ContinueConfig,
  IDE,
  IdeInfo,
  IdeSettings,
  ILLMLogger,
  InternalMcpOptions,
} from "../..";
import { MCPManagerSingleton } from "../../context/mcp/MCPManagerSingleton";
import { ControlPlaneClient } from "../../control-plane/client";
import TransformersJsEmbeddingsProvider from "../../llm/llms/TransformersJsEmbeddingsProvider";
import { getAllPromptFiles } from "../../promptFiles/getPromptFiles";
import { GlobalContext } from "../../util/GlobalContext";
import { modifyAnyConfigWithSharedConfig } from "../sharedConfig";

import { convertPromptBlockToSlashCommand } from "../../commands/slash/promptBlockSlashCommand";
import { slashCommandFromPromptFile } from "../../commands/slash/promptFileSlashCommand";
import { loadJsonMcpConfigs } from "../../context/mcp/json/loadJsonMcpConfigs";
import { getControlPlaneEnvSync } from "../../control-plane/env";
import { PolicySingleton } from "../../control-plane/PolicySingleton";
import { getBaseToolDefinitions } from "../../tools";
import { getCleanUriPath } from "../../util/uri";
import { loadConfigContextProviders } from "../loadContextProviders";
import { getAllDotContinueDefinitionFiles } from "../loadLocalAssistants";
import { unrollLocalYamlBlocks } from "./loadLocalYamlBlocks";
import { LocalPlatformClient } from "./LocalPlatformClient";
import { llmsFromModelConfig } from "./models";
import {
  convertYamlMcpConfigToInternalMcpOptions,
  convertYamlRuleToContinueRule,
} from "./yamlToContinueConfig";

async function loadConfigYaml(options: {
  overrideConfigYaml: AssistantUnrolled | undefined;
  controlPlaneClient: ControlPlaneClient;
  orgScopeId: string | null;
  ideSettings: IdeSettings;
  ide: IDE;
  packageIdentifier: PackageIdentifier;
}): Promise<ConfigResult<AssistantUnrolled>> {
  const {
    overrideConfigYaml,
    controlPlaneClient,
    orgScopeId,
    ideSettings,
    ide,
    packageIdentifier,
  } = options;

  // Add local .continue blocks
  const localBlockPromises = BLOCK_TYPES.map(async (blockType) => {
    const localBlocks = await getAllDotContinueDefinitionFiles(
      ide,
      { includeGlobal: true, includeWorkspace: true, fileExtType: "yaml" },
      blockType,
    );
    return localBlocks.map((b) => ({
      uriType: "file" as const,
      fileUri: b.path,
    }));
  });
  const localPackageIdentifiers: PackageIdentifier[] = (
    await Promise.all(localBlockPromises)
  ).flat();

  // logger.info(
  //   `Loading config.yaml from ${JSON.stringify(packageIdentifier)} with root path ${rootPath}`,
  // );

  // Registry client is only used if local blocks are present, but logic same for hub/local assistants
  const getRegistryClient = async () => {
    const rootPath =
      packageIdentifier.uriType === "file"
        ? dirname(getCleanUriPath(packageIdentifier.fileUri))
        : undefined;
    return new RegistryClient({
      accessToken: await controlPlaneClient.getAccessToken(),
      apiBase: getControlPlaneEnvSync(ideSettings.continueTestEnvironment)
        .CONTROL_PLANE_URL,
      rootPath,
    });
  };

  const errors: ConfigValidationError[] = [];

  let config: AssistantUnrolled | undefined;

  if (overrideConfigYaml) {
    config = overrideConfigYaml;
    if (localPackageIdentifiers.length > 0) {
      const unrolledLocal = await unrollLocalYamlBlocks(
        localPackageIdentifiers,
        ide,
        await getRegistryClient(),
        orgScopeId,
        controlPlaneClient,
      );
      if (unrolledLocal.errors) {
        errors.push(...unrolledLocal.errors);
      }
      if (unrolledLocal.config) {
        config = mergeUnrolledAssistants(config, unrolledLocal.config);
      }
    }
  } else {
    // This is how we allow use of blocks locally
    const unrollResult = await unrollAssistant(
      packageIdentifier,
      await getRegistryClient(),
      {
        renderSecrets: true,
        currentUserSlug: "",
        onPremProxyUrl: null,
        orgScopeId,
        platformClient: new LocalPlatformClient(
          orgScopeId,
          controlPlaneClient,
          ide,
        ),
        injectBlocks: localPackageIdentifiers,
      },
    );
    config = unrollResult.config;
    if (unrollResult.errors) {
      errors.push(...unrollResult.errors);
    }
  }

  if (config && isAssistantUnrolledNonNullable(config)) {
    errors.push(...validateConfigYaml(config));
  }

  if (errors?.some((error) => error.fatal)) {
    return {
      errors,
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  // Set defaults if undefined (this lets us keep config.json uncluttered for new users)
  return {
    config,
    errors,
    configLoadInterrupted: false,
  };
}

export async function configYamlToContinueConfig(options: {
  config: AssistantUnrolled;
  ide: IDE;
  ideInfo: IdeInfo;
  uniqueId: string;
  llmLogger: ILLMLogger;
  workOsAccessToken: string | undefined;
}): Promise<{ config: ContinueConfig; errors: ConfigValidationError[] }> {
  let { config, ide, ideInfo, uniqueId, llmLogger } = options;

  const localErrors: ConfigValidationError[] = [];

  const continueConfig: ContinueConfig = {
    slashCommands: [],
    tools: getBaseToolDefinitions(),
    mcpServerStatuses: [],
    contextProviders: [],
    modelsByRole: {
      chat: [],
      edit: [],
      apply: [],
      embed: [],
      autocomplete: [],
      rerank: [],
      summarize: [],
    },
    selectedModelByRole: {
      chat: null,
      edit: null, // not currently used
      apply: null,
      embed: null,
      autocomplete: null,
      rerank: null,
      summarize: null,
    },
    rules: [],
    requestOptions: { ...config.requestOptions },
  };

  // Right now, if there are any missing packages in the config, then we will just throw an error
  if (!isAssistantUnrolledNonNullable(config)) {
    return {
      config: continueConfig,
      errors: [
        {
          message:
            "Failed to load config due to missing blocks, see which blocks are missing below",
          fatal: true,
        },
      ],
    };
  }

  for (const rule of config.rules ?? []) {
    const convertedRule = convertYamlRuleToContinueRule(rule);
    continueConfig.rules.push(convertedRule);
  }

  continueConfig.data = config.data?.map((d) => ({
    ...d,
    requestOptions: mergeConfigYamlRequestOptions(
      d.requestOptions,
      continueConfig.requestOptions,
    ),
  }));
  continueConfig.docs = config.docs?.map((doc) => ({
    title: doc.name,
    startUrl: doc.startUrl,
    rootUrl: doc.rootUrl,
    faviconUrl: doc.faviconUrl,
    useLocalCrawling: doc.useLocalCrawling,
    sourceFile: doc.sourceFile,
  }));

  // Prompt files -
  try {
    const promptFiles = await getAllPromptFiles(ide, undefined, true);

    continueConfig.slashCommands?.push({
      name: "解释代码",
      description: "解释代码",
      prompt: `用通俗易懂的语言解释选中的代码在做什么。假设读者是一名刚学习完该语言特性和基础语法的初学者。请重点解释以下内容：1）代码的目的；2）它接收哪些输入；3）它产生哪些输出；4）它是如何通过逻辑和算法实现其目的的；5）代码中任何重要的逻辑流程或数据转换。请使用初学者可以理解的简单语言，提供足够的细节，让读者全面了解代码想要完成的事情，但不要过于技术化。请将解释组织成连贯的段落，使用正确的标点和语法。撰写解释时，假设读者对这段代码没有任何先验背景。不要对未在共享代码中展示的变量或函数做出假设。回答应以被解释代码的名称作为开头。`,
      source: "built-in",
      sourceFile: undefined,
    });
    continueConfig.slashCommands?.push({
      name: "添加注释",
      description: "添加注释",
      prompt:
        "为选中的代码编写一段简要的文档注释。如果在当前文件或其他具有相同文件扩展名的文件中已存在文档注释，请将它们作为示例。请注意选中代码的作用范围（例如：导出的函数 / API，还是函数内部的实现细节），并为该作用范围使用符合习惯的文档风格。只为选中的代码生成文档，不要生成任何代码。不要包含除文档注释之外的任何代码或注释。仅输出选中代码对应的文档内容，不要输出其他任何内容。",
      source: "built-in",
      sourceFile: undefined,
    });
    continueConfig.slashCommands?.push({
      name: "生成单元测试",
      description: "生成单元测试",
      prompt:
        "请先查看上下文，以确定当前需要使用的测试框架和测试库。然后，使用检测到的测试框架和库，为选中的函数生成一组包含多个测试用例的单元测试。请务必导入被测试的函数，并使用共享上下文中展示的相同模式、测试框架、约定和库。仅基于共享代码导入模块、函数、依赖项和 mock。如果在共享上下文中已经存在针对该代码的测试套件，请重点为尚未覆盖的场景生成新的测试。如果未检测到任何测试套件，请为上下文所使用代码语种导入常见的单元测试库。重点验证关键功能，使用简单且完整的断言。在编写测试之前，请先确定应使用并导入哪些测试库和框架。最后，请将完整、可运行的新单元测试代码输出，不要包含任何注释、片段或 TODO。新测试应验证预期功能，并覆盖边界情况，包含所有必要的导入（包括被测试的函数）。不要重复共享上下文中已有的测试。仅输出完整可运行的测试代码。",
      source: "built-in",
      sourceFile: undefined,
    });
    continueConfig.slashCommands?.push({
      name: "查找代码问题",
      description: "查找代码问题",
      prompt:
        "请审查并分析选中的代码，找出在代码问题、可读性、可维护性、性能、安全性等方面可能存在的改进空间。不要列出代码中已经被解决的问题。请重点提供最多 5 条建设性的改进建议，以帮助代码变得更加健壮、高效或更符合最佳实践。对于每一条建议，请简要说明其潜在收益。在列出建议之后，请总结整体上是否存在显著的代码质量提升空间，或者该代码是否整体遵循了良好的设计原则。如果未发现任何问题，请回复“没有发现错误”。",
      source: "built-in",
      sourceFile: undefined,
    });

    promptFiles.forEach((file) => {
      try {
        const slashCommand = slashCommandFromPromptFile(
          file.path,
          file.content,
        );
        if (slashCommand) {
          continueConfig.slashCommands?.push(slashCommand);
        }
      } catch (e) {
        localErrors.push({
          fatal: false,
          message: `Failed to convert prompt file ${file.path} to slash command: ${e instanceof Error ? e.message : e}`,
        });
      }
    });
  } catch (e) {
    localErrors.push({
      fatal: false,
      message: `Error loading local prompt files: ${e instanceof Error ? e.message : e}`,
    });
  }

  config.prompts?.forEach((prompt) => {
    try {
      const slashCommand = convertPromptBlockToSlashCommand(prompt);
      continueConfig.slashCommands?.push(slashCommand);
    } catch (e) {
      localErrors.push({
        message: `Error loading prompt ${prompt.name}: ${e instanceof Error ? e.message : e}`,
        fatal: false,
      });
    }
  });

  // Models
  let warnAboutFreeTrial = false;
  const defaultModelRoles: ModelRole[] = ["chat", "summarize", "apply", "edit"];
  for (const model of config.models ?? []) {
    model.roles = model.roles ?? defaultModelRoles; // Default to all 4 chat-esque roles if not specified

    if (model.provider === "free-trial") {
      warnAboutFreeTrial = true;
    }
    try {
      const llms = await llmsFromModelConfig({
        model,
        uniqueId,
        llmLogger,
        config: continueConfig,
      });

      if (model.roles?.includes("chat")) {
        continueConfig.modelsByRole.chat.push(...llms);
      }

      if (model.roles?.includes("summarize")) {
        continueConfig.modelsByRole.summarize.push(...llms);
      }

      if (model.roles?.includes("apply")) {
        continueConfig.modelsByRole.apply.push(...llms);
      }

      if (model.roles?.includes("edit")) {
        continueConfig.modelsByRole.edit.push(...llms);
      }

      if (model.roles?.includes("autocomplete")) {
        continueConfig.modelsByRole.autocomplete.push(...llms);
      }

      if (model.roles?.includes("embed")) {
        const { provider } = model;
        if (provider === "transformers.js") {
          if (ideInfo.ideType === "vscode") {
            continueConfig.modelsByRole.embed.push(
              new TransformersJsEmbeddingsProvider(),
            );
          } else {
            localErrors.push({
              fatal: false,
              message: `Transformers.js embeddings provider not supported in this IDE.`,
            });
          }
        } else {
          continueConfig.modelsByRole.embed.push(...llms);
        }
      }

      if (model.roles?.includes("rerank")) {
        continueConfig.modelsByRole.rerank.push(...llms);
      }
    } catch (e) {
      localErrors.push({
        fatal: false,
        message: `Failed to load model:\nName: ${model.name}\nModel: ${model.model}\nProvider: ${model.provider}\n${e instanceof Error ? e.message : e}`,
      });
    }
  }

  // Add transformers js to the embed models in vs code if not already added
  if (
    ideInfo.ideType === "vscode" &&
    !continueConfig.modelsByRole.embed.find(
      (m) => m.providerName === "transformers.js",
    )
  ) {
    continueConfig.modelsByRole.embed.push(
      new TransformersJsEmbeddingsProvider(),
    );
  }

  if (warnAboutFreeTrial) {
    localErrors.push({
      fatal: false,
      message:
        "Model provider 'free-trial' is no longer supported, will be ignored.",
    });
  }

  const { providers, errors: contextErrors } = loadConfigContextProviders(
    config.context,
    !!config.docs?.length,
    ideInfo.ideType,
  );

  continueConfig.contextProviders = providers;
  localErrors.push(...contextErrors);

  // Trigger MCP server refreshes (Config is reloaded again once connected!)
  const mcpManager = MCPManagerSingleton.getInstance();

  const orgPolicy = PolicySingleton.getInstance().policy;
  if (orgPolicy?.policy?.allowMcpServers === false) {
    await mcpManager.shutdown();
  } else {
    const mcpOptions: InternalMcpOptions[] = (config.mcpServers ?? []).map(
      (server) =>
        convertYamlMcpConfigToInternalMcpOptions(server, config.requestOptions),
    );
    const { errors: jsonMcpErrors, mcpServers } = await loadJsonMcpConfigs(
      ide,
      true,
      config.requestOptions,
    );
    localErrors.push(...jsonMcpErrors);
    mcpOptions.push(...mcpServers);
    mcpManager.setConnections(mcpOptions, false, { ide });
  }

  return { config: continueConfig, errors: localErrors };
}

export async function loadContinueConfigFromYaml(options: {
  ide: IDE;
  ideSettings: IdeSettings;
  ideInfo: IdeInfo;
  uniqueId: string;
  llmLogger: ILLMLogger;
  workOsAccessToken: string | undefined;
  overrideConfigYaml: AssistantUnrolled | undefined;
  controlPlaneClient: ControlPlaneClient;
  orgScopeId: string | null;
  packageIdentifier: PackageIdentifier;
}): Promise<ConfigResult<ContinueConfig>> {
  const {
    ide,
    ideSettings,
    ideInfo,
    uniqueId,
    llmLogger,
    workOsAccessToken,
    overrideConfigYaml,
    controlPlaneClient,
    orgScopeId,
    packageIdentifier,
  } = options;

  const configYamlResult = await loadConfigYaml({
    overrideConfigYaml,
    controlPlaneClient,
    orgScopeId,
    ideSettings,
    ide,
    packageIdentifier,
  });

  if (!configYamlResult.config || configYamlResult.configLoadInterrupted) {
    return {
      errors: configYamlResult.errors,
      config: undefined,
      configLoadInterrupted: true,
    };
  }

  const { config: continueConfig, errors: localErrors } =
    await configYamlToContinueConfig({
      config: configYamlResult.config,
      ide,
      ideInfo,
      uniqueId,
      llmLogger,
      workOsAccessToken,
    });

  // Apply shared config
  // TODO: override several of these values with user/org shared config
  // Don't try catch this - has security implications and failure should be fatal
  const sharedConfig = new GlobalContext().getSharedConfig();
  const withShared = modifyAnyConfigWithSharedConfig(
    continueConfig,
    sharedConfig,
  );
  if (withShared.allowAnonymousTelemetry === undefined) {
    withShared.allowAnonymousTelemetry = true;
  }

  return {
    config: withShared,
    errors: [...(configYamlResult.errors ?? []), ...localErrors],
    configLoadInterrupted: false,
  };
}
