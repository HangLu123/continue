import {
  createRuleMarkdown,
  getRuleType,
  RuleType,
  RuleTypeDescriptions,
} from "@continuedev/config-yaml";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { createRuleFilePath } from "core/config/markdown/utils";
import { CreateRuleBlockArgs } from "core/tools/implementations/createRuleBlock";
import { useContext, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import Spinner from "../gui/Spinner";
import { ToolTip } from "../gui/Tooltip";
import { Button } from "../ui";
import { useRuleGeneration } from "./useRuleGeneration";

interface GenerationScreenProps {
  inputPrompt: string;
  onBack: () => void;
  onSuccess: () => void;
  isManualMode?: boolean;
}

export function GenerationScreen({
  inputPrompt,
  onBack,
  onSuccess,
  isManualMode = false,
}: GenerationScreenProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const { register, watch, setValue, reset } = useForm<CreateRuleBlockArgs>({
    defaultValues: {
      name: "",
      description: "",
      globs: "",
      alwaysApply: undefined,
      rule: "",
    },
  });

  const formData = watch();

  const [selectedRuleType, setSelectedRuleType] = useState<RuleType>(
    RuleType.Always,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const { generateRule, isGenerating, error } = useRuleGeneration(
    inputPrompt,
    (args) => {
      if (!isGenerating) {
        reset(args);
        handleRuleTypeChange(getRuleType(args));
      }
    },
  );

  useEffect(() => {
    if (!isManualMode) {
      void generateRule();
    }
  }, [isManualMode]);

  const handleRuleTypeChange = (newRuleType: RuleType) => {
    setSelectedRuleType(newRuleType);

    const alwaysApply = newRuleType === RuleType.Always;
    setValue("alwaysApply", alwaysApply);
  };

  const handleContinue = async () => {
    setFormError(null);

    if (!formData.name) {
      setFormError("规则名称为必填项");
      return;
    }

    if (!formData.rule) {
      setFormError("规则内容为必填项");
      return;
    }

    try {
      const options: any = {
        alwaysApply: formData.alwaysApply,
      };

      if (formData.description) {
        options.description = formData.description;
      }

      if (formData.globs) {
        options.globs = formData.globs;
      }

      const fileContent = createRuleMarkdown(
        formData.name,
        formData.rule,
        options,
      );

      const workspaceDirs = await ideMessenger.request(
        "getWorkspaceDirs",
        undefined,
      );

      if (workspaceDirs.status !== "success") {
        setFormError("获取工作区目录失败");
        return;
      }

      const localContinueDir = workspaceDirs.content[0];
      const ruleFilePath = createRuleFilePath(localContinueDir, formData.name);

      await ideMessenger.request("writeFile", {
        path: ruleFilePath,
        contents: fileContent,
      });
      ideMessenger.post("openFile", { path: ruleFilePath });

      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      setFormError(`创建规则文件失败：${errorMessage}`);
    }
  };

  const showNameSpinner = isGenerating && !formData.name && !isManualMode;

  return (
    <div className="px-2 pb-2 pt-4 sm:px-4">
      <div>
        <div className="text-center">
          <h2 className="mb-0">你的规则</h2>
          <p className="text-description m-0 mt-2 p-0">
            请在下面查看并编辑生成的规则
          </p>
        </div>
        <div className="mt-5">
          <div className="flex flex-col gap-4">
            <div className="space-y-4">
              {/* Rule Name */}
              <div className="space-y-1">
                <label className="text-foreground text-sm font-medium">
                  规则名称
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border w-full rounded-md border px-3 py-2 text-xs focus:outline-none"
                    placeholder={showNameSpinner ? "" : "输入规则名称..."}
                    disabled={isGenerating && !isManualMode}
                    {...register("name")}
                  />
                  {showNameSpinner && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Spinner />
                    </div>
                  )}
                </div>
              </div>

              {/* Rule Type */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-foreground text-sm font-medium">
                    规则类型
                  </label>
                  <ToolTip
                    style={{ zIndex: 100001 }}
                    content={RuleTypeDescriptions[selectedRuleType]}
                  >
                    <InformationCircleIcon className="h-4 w-4 text-gray-500" />
                  </ToolTip>
                </div>
                <div className="relative">
                  <select
                    className="border-input-border bg-input text-input-foreground focus:border-border-focus w-full rounded-md border px-3 py-2 text-xs focus:outline-none"
                    value={isGenerating ? "" : selectedRuleType}
                    onChange={(e) =>
                      handleRuleTypeChange(e.target.value as RuleType)
                    }
                    disabled={isGenerating && !isManualMode}
                  >
                    {isGenerating && !isManualMode ? (
                      <option value=""></option>
                    ) : (
                      <>
                        <option value={RuleType.Always}>
                          始终应用 (Always)
                        </option>
                        <option value={RuleType.AutoAttached}>
                          自动附加 (Auto Attached)
                        </option>
                        <option value={RuleType.AgentRequested}>
                          Agent 请求时应用 (Agent Requested)
                        </option>
                        <option value={RuleType.Manual}>
                          手动选择 (Manual)
                        </option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Description (AgentRequested) */}
              <div
                className={`space-y-1 ${selectedRuleType === RuleType.AgentRequested ? "" : "hidden"}`}
              >
                <label className="text-foreground text-sm font-medium">
                  描述
                </label>
                <textarea
                  className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border w-full resize-none rounded-md border px-3 py-2 text-xs focus:outline-none"
                  rows={3}
                  placeholder="此规则适用于哪些任务的说明..."
                  {...register("description")}
                />
              </div>

              {/* File Pattern (AutoAttached) */}
              <div
                className={`space-y-1 ${selectedRuleType === RuleType.AutoAttached ? "" : "hidden"}`}
              >
                <label className="text-foreground text-sm font-medium">
                  文件匹配模式
                </label>
                <input
                  type="text"
                  className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border w-full rounded-md border px-3 py-2 font-mono text-xs focus:outline-none"
                  placeholder="*.tsx, **/*.{ts,tsx}, tests/**/*.ts ..."
                  {...register("globs")}
                />
              </div>
            </div>

            {/* Rule Content */}
            <div className="relative">
              <label className="text-foreground text-sm font-medium">
                规则内容
              </label>
              <textarea
                className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus mt-1 box-border w-full resize-none rounded border p-2 text-xs focus:outline-none"
                rows={10}
                disabled={isGenerating && !isManualMode}
                placeholder="输入规则内容..."
                {...register("rule")}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="my-4 flex flex-col items-center gap-2">
              <div className="flex flex-row justify-center gap-3">
                <Button
                  type="button"
                  className="min-w-16"
                  onClick={onBack}
                  variant="outline"
                  disabled={isGenerating && !isManualMode}
                >
                  返回
                </Button>
                <Button
                  className="min-w-16"
                  onClick={handleContinue}
                  disabled={
                    (isGenerating && !isManualMode) ||
                    (!formData.rule && !error) ||
                    !formData.name
                  }
                >
                  继续
                </Button>
              </div>
              {formError && (
                <span className="text-error text-center text-xs">
                  创建规则失败：{formError}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
