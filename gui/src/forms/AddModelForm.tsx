import yaml from "js-yaml";
import { useCallback, useContext, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button } from "../components";
import { useAuth } from "../context/Auth";
import { IdeMessengerContext } from "../context/IdeMessenger";
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
          const parsed: any = yaml.load(text);

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
    // if (yamlConfig) {
    //   ideMessenger.post("config/deleteModel", { title: "deleteAll" });

    //   yamlConfig.models.forEach((model: any) => {
    //     ideMessenger.post("config/addModel", { model });
    //   });

    //   onDone();
    //   return;
    // }

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
    ideMessenger.post("config/addModel", { model: yamlConfig.models });

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
          <h1 className="mb-0 text-center text-2xl">
            导入模型配置文件(yaml格式)
          </h1>

          <div className="my-8 flex flex-col gap-6">
            {/* =============================
                YAML 上传区域（新增）
              ============================= */}
            <div>
              <label className="flex cursor-pointer flex-col items-center rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm transition hover:bg-zinc-700">
                <span className="text-sm text-zinc-300">
                  点击上传 YAML 配置文件
                </span>
                <input
                  type="file"
                  accept=".yaml,.yml"
                  className="hidden"
                  onChange={handleYamlUpload}
                />
              </label>

              {yamlError && (
                <p className="mt-1 text-xs text-red-500">{yamlError}</p>
              )}

              {yamlConfig && (
                <p className="mt-1 text-xs text-green-600">
                  YAML 已加载，提交时将自动导入模型配置
                </p>
              )}
              {/* ========== 显示 YAML 解析出的模型 ========== */}
              {yamlConfig && yamlConfig.models && (
                <div className="mt-4">
                  <h2 className="mb-2 text-sm font-semibold text-zinc-300">
                    已加载模型（{yamlConfig.models.length}）
                  </h2>

                  <div className="flex flex-col gap-3">
                    {yamlConfig.models.map((m: any, idx: number) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-4 transition hover:bg-zinc-800"
                      >
                        <p className="text-base font-semibold text-white">
                          {m.name}
                        </p>

                        <div className="mt-2 space-y-1 text-xs text-zinc-400">
                          <p>
                            <span className="text-zinc-500">provider: </span>
                            {m.provider}
                          </p>
                          <p>
                            <span className="text-zinc-500">model: </span>
                            {m.model}
                          </p>
                          <p>
                            <span className="text-zinc-500">apiBase: </span>
                            {m.apiBase}
                          </p>
                          <p>
                            <span className="text-zinc-500">roles: </span>
                            {m.roles?.join(", ") || "无"}
                          </p>
                          <p>
                            <span className="text-zinc-500">
                              capabilities:{" "}
                            </span>
                            {m.capabilities?.join(", ") || "无"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="mt-4 w-full">
            <Button type="submit" className="w-full" disabled={isDisabled()}>
              确定接入
            </Button>

            <span className="text-description-muted block w-full text-center text-xs">
              这将更新你的{" "}
              <span
                className="cursor-pointer underline hover:brightness-125"
                onClick={() =>
                  ideMessenger.post("config/openProfile", {
                    profileId: undefined,
                  })
                }
              >
                配置文件（config file）
              </span>
            </span>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

export default AddModelForm;
