import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import yaml from "js-yaml";
import { useCallback, useContext, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button, Input, StyledActionButton } from "../components";
import Alert from "../components/gui/Alert";
import ModelSelectionListbox from "../components/modelSelection/ModelSelectionListbox";
import { useAuth } from "../context/Auth";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { completionParamsInputs } from "../pages/AddNewModel/configs/completionParamsInputs";
import { DisplayInfo } from "../pages/AddNewModel/configs/models";
import {
  ProviderInfo,
  providers,
} from "../pages/AddNewModel/configs/providers";
import { useAppDispatch } from "../redux/hooks";
import { updateSelectedModelByRole } from "../redux/thunks/updateSelectedModelByRole";

interface AddModelFormProps {
  onDone: () => void;
  hideFreeTrialLimitMessage?: boolean;
}

const MODEL_PROVIDERS_URL =
  "https://docs.continue.dev/customize/model-providers";
const CODESTRAL_URL = "https://console.mistral.ai/codestral";
const CONTINUE_SETUP_URL = "https://docs.continue.dev/setup/overview";

export function AddModelForm({
  onDone,
  hideFreeTrialLimitMessage,
}: AddModelFormProps) {
  /** -----------------------------
   * 状态管理
   ------------------------------ */
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo>(
    providers["openai"]!,
  );
  const dispatch = useAppDispatch();
  const { selectedProfile } = useAuth();
  const [selectedModel, setSelectedModel] = useState(
    selectedProvider.packages[0],
  );
  const formMethods = useForm();
  const ideMessenger = useContext(IdeMessengerContext);

  /** --- YAML 状态 --- */
  const [yamlConfig, setYamlConfig] = useState<any>(null);
  const [yamlError, setYamlError] = useState<string | null>(null);

  /** -----------------------------
   * Provider & Model 数据
   ------------------------------ */
  const popularProviderTitles = [
    providers["openai"]?.title || "",
    providers["anthropic"]?.title || "",
    providers["mistral"]?.title || "",
    providers["gemini"]?.title || "",
    providers["azure"]?.title || "",
    providers["ollama"]?.title || "",
  ];

  const allProviders = Object.entries(providers)
    .filter(([key]) => !["openai-aiohttp"].includes(key))
    .map(([, p]) => p!)
    .filter(Boolean);

  const popularProviders = allProviders
    .filter((p) => popularProviderTitles.includes(p.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  const otherProviders = allProviders
    .filter((p) => !popularProviderTitles.includes(p.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  const selectedProviderApiKeyUrl = selectedModel.params.model.startsWith(
    "codestral",
  )
    ? CODESTRAL_URL
    : selectedProvider.apiKeyUrl;

  /** -----------------------------
   * 禁用状态判断
   ------------------------------ */
  function isDisabled() {
    if (yamlConfig) return false;

    if (selectedProvider.downloadUrl) return false;

    const required = selectedProvider.collectInputFor
      ?.filter((i) => i.required)
      .map((i) => formMethods.watch(i.key));

    return !required?.every((value) => value && value.length > 0);
  }

  /** Provider 切换时重置 Model */
  useEffect(() => {
    setSelectedModel(selectedProvider.packages[0]);
  }, [selectedProvider]);

  /** -----------------------------
   * YAML 上传处理
   ------------------------------ */
  const handleYamlUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith(".yaml") && !file.name.endsWith(".yml")) {
        setYamlError("文件格式必须为 .yaml 或 .yml");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = yaml.load(text);

          if (
            !parsed ||
            typeof parsed !== "object" ||
            !parsed["name"] ||
            !parsed["version"] ||
            !parsed["schema"] ||
            !Array.isArray(parsed["models"])
          ) {
            setYamlError(
              "YAML 格式不符合要求。必备字段：name, version, schema, models[]",
            );
            return;
          }

          setYamlError(null);
          setYamlConfig(parsed);
        } catch (err) {
          setYamlError("YAML 解析失败：" + (err as Error).message);
        }
      };

      reader.readAsText(file);
    },
    [],
  );

  /** -----------------------------
   * 表单提交（包含 YAML 导入逻辑）
   ------------------------------ */
  async function onSubmit() {
    /** ====== 如果 YAML 存在，优先使用 YAML ====== */
    if (yamlConfig) {
      ideMessenger.post("config/deleteModel", { title: "deleteAll" });

      yamlConfig.models.forEach((model: any) => {
        ideMessenger.post("config/addModel", { model });
      });

      onDone();
      return;
    }

    /** ====== 以下为原表单逻辑 ====== */
    const apiKey = formMethods.watch("apiKey");
    const hasApiKey = apiKey && apiKey !== "";

    const reqInputFields: Record<string, any> = {};
    for (let input of selectedProvider.collectInputFor ?? []) {
      reqInputFields[input.key] = formMethods.watch(input.key);
    }

    const model = {
      ...selectedProvider.params,
      ...selectedModel.params,
      ...reqInputFields,
      provider: selectedProvider.provider,
      title: selectedModel.title,
      ...(hasApiKey ? { apiKey } : {}),
    };

    ideMessenger.post("config/deleteModel", { title: "deleteAll" });
    ideMessenger.post("config/addModel", { model });

    ideMessenger.post("config/openProfile", {
      profileId: "local",
    });

    void dispatch(
      updateSelectedModelByRole({
        selectedProfile,
        role: "chat",
        modelTitle: model.title,
      }),
    );

    onDone();
  }

  /** -----------------------------
   * Provider 下载按钮
   ------------------------------ */
  function onClickDownloadProvider() {
    selectedProvider.downloadUrl &&
      ideMessenger.post("openUrl", selectedProvider.downloadUrl);
  }

  /** -----------------------------
   * UI 渲染
   ------------------------------ */
  return (
    <FormProvider {...formMethods}>
      <form onSubmit={formMethods.handleSubmit(onSubmit)}>
        <div className="mx-auto max-w-md p-6">
          <h1 className="mb-0 text-center text-2xl">Add Chat Model</h1>

          <div className="my-8 flex flex-col gap-6">
            {/* =============================
                YAML 上传区域（新增）
              ============================= */}
            <div>
              <label className="block text-sm font-medium">
                导入 YAML 配置文件
              </label>
              <input
                type="file"
                accept=".yaml,.yml"
                onChange={handleYamlUpload}
                className="mt-2 w-full text-sm"
              />

              {yamlError && (
                <p className="mt-1 text-xs text-red-500">{yamlError}</p>
              )}

              {yamlConfig && (
                <p className="mt-1 text-xs text-green-600">
                  YAML 已加载，提交时将自动导入模型配置
                </p>
              )}
            </div>

            {/* ===== 如果 YAML 已上传，则隐藏原表单区域 ===== */}
            {!yamlConfig && (
              <>
                {/* Provider 选择 */}
                <div>
                  <label className="block text-sm font-medium">Provider</label>
                  <ModelSelectionListbox
                    selectedProvider={selectedProvider}
                    setSelectedProvider={(val: DisplayInfo) => {
                      const match = [
                        ...popularProviders,
                        ...otherProviders,
                      ].find((provider) => provider.title === val.title);
                      match && setSelectedProvider(match);
                    }}
                    topOptions={popularProviders}
                    otherOptions={otherProviders}
                  />

                  <span className="text-description-muted mt-1 block text-xs">
                    Don't see your provider?{" "}
                    <a
                      className="cursor-pointer underline"
                      onClick={() =>
                        ideMessenger.post("openUrl", MODEL_PROVIDERS_URL)
                      }
                    >
                      Click here
                    </a>{" "}
                    to view the full list
                  </span>
                </div>

                {/* Download provider */}
                {selectedProvider.downloadUrl && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Install provider
                    </label>
                    <StyledActionButton onClick={onClickDownloadProvider}>
                      <p className="text-sm underline">
                        {selectedProvider.downloadUrl}
                      </p>
                      <ArrowTopRightOnSquareIcon width={24} height={24} />
                    </StyledActionButton>
                  </div>
                )}

                {/* Model 选择 */}
                <div>
                  <label className="block text-sm font-medium">Model</label>
                  <ModelSelectionListbox
                    selectedProvider={selectedModel}
                    setSelectedProvider={(val: DisplayInfo) => {
                      const options =
                        Object.entries(providers).find(
                          ([, provider]) =>
                            provider?.title === selectedProvider.title,
                        )?.[1]?.packages ?? [];

                      const match = options.find(
                        (option) => option.title === val.title,
                      );
                      match && setSelectedModel(match);
                    }}
                    topOptions={
                      Object.entries(providers).find(
                        ([, provider]) =>
                          provider?.title === selectedProvider.title,
                      )?.[1]?.packages
                    }
                  />
                </div>

                {/* Codestral 提示 */}
                {selectedModel.params.model.startsWith("codestral") && (
                  <Alert className="my-2">
                    <p className="m-0 text-sm font-bold">Codestral API key</p>
                    <p className="m-0 mt-1">
                      Note that codestral requires a different API key from
                      other Mistral models
                    </p>
                  </Alert>
                )}

                {/* API Key */}
                {selectedProvider.apiKeyUrl && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      API key
                    </label>
                    <Input
                      id="apiKey"
                      className="w-full"
                      type="password"
                      placeholder={`Enter your ${selectedProvider.title} API key`}
                      {...formMethods.register("apiKey")}
                    />
                  </div>
                )}

                {/* 其他 Required 字段 */}
                {selectedProvider.collectInputFor &&
                  selectedProvider.collectInputFor
                    .filter(
                      (field) =>
                        !Object.values(completionParamsInputs).some(
                          (input) => input.key === field.key,
                        ) &&
                        field.required &&
                        field.key !== "apiKey",
                    )
                    .map((field) => (
                      <div key={field.key}>
                        <label className="mb-1 block text-sm font-medium">
                          {field.label}
                        </label>
                        <Input
                          id={field.key}
                          className="w-full"
                          defaultValue={field.defaultValue}
                          placeholder={`${field.placeholder}`}
                          {...formMethods.register(field.key)}
                        />
                      </div>
                    ))}
              </>
            )}
          </div>

          {/* Submit */}
          <div className="mt-4 w-full">
            <Button type="submit" className="w-full" disabled={isDisabled()}>
              Connect
            </Button>

            <span className="text-description-muted block w-full text-center text-xs">
              This will update your{" "}
              <span
                className="cursor-pointer underline hover:brightness-125"
                onClick={() =>
                  ideMessenger.post("config/openProfile", {
                    profileId: undefined,
                  })
                }
              >
                config file
              </span>
            </span>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

export default AddModelForm;
