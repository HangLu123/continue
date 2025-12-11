import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { HubSessionInfo } from "core/control-plane/AuthTypes";
import { isContinueTeamMember } from "core/util/isContinueTeamMember";
import { useContext, useEffect, useState } from "react";
import { Card, Toggle, useFontSize } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectCurrentOrg } from "../../../redux/slices/profilesSlice";
import { setLocalStorage } from "../../../util/localStorage";
import { ConfigHeader } from "../components/ConfigHeader";
import { ContinueFeaturesMenu } from "../components/ContinueFeaturesMenu";
import { UserSetting } from "../components/UserSetting";

export function UserSettingsSection() {
  /////// User settings section //////
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const currentOrg = useAppSelector(selectCurrentOrg);

  const [showExperimental, setShowExperimental] = useState(false);
  const { session } = useAuth();

  function handleUpdate(sharedConfig: SharedConfigSchema) {
    // Optimistic update
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    // IMPORTANT no need for model role updates (separate logic for selected model roles)
    // simply because this function won't be used to update model roles

    // Actual update to core which propagates back with config update event
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  // Disable autocomplete
  const disableAutocompleteInFiles = (
    config.tabAutocompleteOptions?.disableInFiles ?? []
  ).join(", ");
  const [formDisableAutocomplete, setFormDisableAutocomplete] = useState(
    disableAutocompleteInFiles,
  );

  useEffect(() => {
    // Necessary so that reformatted/trimmed values don't cause dirty state
    setFormDisableAutocomplete(disableAutocompleteInFiles);
  }, [disableAutocompleteInFiles]);

  // Workspace prompts
  const promptPath = config.experimental?.promptPath || "";

  const handleEnableStaticContextualizationToggle = (value: boolean) => {
    handleUpdate({ enableStaticContextualization: value });
  };

  // TODO defaults are in multiple places, should be consolidated and probably not explicit here
  const showSessionTabs = config.ui?.showSessionTabs ?? false;
  const continueAfterToolRejection =
    config.ui?.continueAfterToolRejection ?? false;
  const codeWrap = config.ui?.codeWrap ?? false;
  const showChatScrollbar = config.ui?.showChatScrollbar ?? false;
  const readResponseTTS = config.experimental?.readResponseTTS ?? false;
  const displayRawMarkdown = config.ui?.displayRawMarkdown ?? false;
  const disableSessionTitles = config.disableSessionTitles ?? false;
  const useCurrentFileAsContext =
    config.experimental?.useCurrentFileAsContext ?? false;
  const enableExperimentalTools =
    config.experimental?.enableExperimentalTools ?? false;
  const onlyUseSystemMessageTools =
    config.experimental?.onlyUseSystemMessageTools ?? false;
  const codebaseToolCallingOnly =
    config.experimental?.codebaseToolCallingOnly ?? false;
  const enableStaticContextualization =
    config.experimental?.enableStaticContextualization ?? false;

  const allowAnonymousTelemetry = config.allowAnonymousTelemetry ?? true;

  const useAutocompleteMultilineCompletions =
    config.tabAutocompleteOptions?.multilineCompletions ?? "auto";
  const modelTimeout = config.tabAutocompleteOptions?.modelTimeout ?? 150;
  const debounceDelay = config.tabAutocompleteOptions?.debounceDelay ?? 250;
  const fontSize = useFontSize();

  const cancelChangeDisableAutocomplete = () => {
    setFormDisableAutocomplete(disableAutocompleteInFiles);
  };
  const handleDisableAutocompleteSubmit = () => {
    handleUpdate({
      disableAutocompleteInFiles: formDisableAutocomplete
        .split(",")
        .map((val) => val.trim())
        .filter((val) => !!val),
    });
  };

  const hasContinueEmail = isContinueTeamMember(
    (session as HubSessionInfo)?.account?.id,
  );

  const disableTelemetryToggle =
    currentOrg?.policy?.allowAnonymousTelemetry === false;

  return (
    <div>
      <div className="flex flex-col">
        <ConfigHeader title="用户设置" />
        <div className="space-y-6">
          {/* Chat Interface Settings */}
          <div>
            <ConfigHeader title="聊天界面" variant="sm" />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="toggle"
                  title="显示会话标签页"
                  description="在聊天窗口上方显示标签页，用于组织和切换不同的对话。"
                  value={showSessionTabs}
                  onChange={(value) => handleUpdate({ showSessionTabs: value })}
                />
                <UserSetting
                  type="toggle"
                  title="代码块自动换行"
                  description="长代码行将自动换行，而不是出现水平滚动条。"
                  value={codeWrap}
                  onChange={(value) => handleUpdate({ codeWrap: value })}
                />
                <UserSetting
                  type="toggle"
                  title="显示聊天滚动条"
                  description="在聊天窗口中显示滚动条。"
                  value={showChatScrollbar}
                  onChange={(value) =>
                    handleUpdate({ showChatScrollbar: value })
                  }
                />
                <UserSetting
                  type="toggle"
                  title="语音朗读回复"
                  description="使用文本转语音朗读模型的回复内容。"
                  value={readResponseTTS}
                  onChange={(value) => handleUpdate({ readResponseTTS: value })}
                />
                <UserSetting
                  type="toggle"
                  title="启用会话标题"
                  description="在每个会话的第一条消息后自动生成摘要标题（基于当前聊天模型）。"
                  value={!disableSessionTitles}
                  onChange={(value) =>
                    handleUpdate({ disableSessionTitles: !value })
                  }
                />
                <UserSetting
                  type="toggle"
                  title="格式化 Markdown"
                  description="关闭后将以原始文本显示回复内容。"
                  value={!displayRawMarkdown}
                  onChange={(value) =>
                    handleUpdate({ displayRawMarkdown: !value })
                  }
                />
              </div>
            </Card>
          </div>

          {/* Telemetry Settings */}
          <div>
            <ConfigHeader title="遥测" variant="sm" />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="toggle"
                  title="允许匿名遥测"
                  description="允许 Continue 发送匿名的使用数据。"
                  value={allowAnonymousTelemetry}
                  disabled={disableTelemetryToggle}
                  onChange={(value) =>
                    handleUpdate({ allowAnonymousTelemetry: value })
                  }
                />
              </div>
            </Card>
          </div>

          {/* Appearance Settings */}
          <div>
            <ConfigHeader title="外观" variant="sm" />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="number"
                  title="字体大小"
                  description="设置 UI 元素的基础字体大小。"
                  value={fontSize}
                  onChange={(val) => {
                    setLocalStorage("fontSize", val);
                    handleUpdate({ fontSize: val });
                  }}
                  min={7}
                  max={50}
                />
              </div>
            </Card>
          </div>

          {/* Autocomplete Settings */}
          <div>
            <ConfigHeader title="自动补全" variant="sm" />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="select"
                  title="多行补全"
                  description="控制自动补全是否允许多行内容。"
                  value={useAutocompleteMultilineCompletions}
                  onChange={(value) =>
                    handleUpdate({
                      useAutocompleteMultilineCompletions: value as
                        | "auto"
                        | "always"
                        | "never",
                    })
                  }
                  options={[
                    { label: "自动", value: "auto" },
                    { label: "总是开启", value: "always" },
                    { label: "关闭", value: "never" },
                  ]}
                />
                <UserSetting
                  type="number"
                  title="补全超时（毫秒）"
                  description="自动补全请求允许的最大时间。"
                  value={modelTimeout}
                  onChange={(val) => handleUpdate({ modelTimeout: val })}
                  min={100}
                  max={5000}
                />
                <UserSetting
                  type="number"
                  title="补全防抖（毫秒）"
                  description="触发补全前需要等待的最小输入间隔时间。"
                  value={debounceDelay}
                  onChange={(val) => handleUpdate({ debounceDelay: val })}
                  min={0}
                  max={2500}
                />
                <UserSetting
                  type="input"
                  title="在以下文件中禁用补全"
                  description="输入以逗号分隔的 glob 匹配模式，将在匹配的文件中禁用自动补全。"
                  placeholder="**/*.(txt,md)"
                  value={formDisableAutocomplete}
                  onChange={setFormDisableAutocomplete}
                  onSubmit={handleDisableAutocompleteSubmit}
                  onCancel={cancelChangeDisableAutocomplete}
                  isDirty={
                    formDisableAutocomplete !== disableAutocompleteInFiles
                  }
                  isValid={formDisableAutocomplete.trim() !== ""}
                />
              </div>
            </Card>
          </div>

          {/* Experimental Settings */}
          <div>
            <ConfigHeader title="实验性功能" variant="sm" />
            <Card>
              <Toggle
                isOpen={showExperimental}
                onToggle={() => setShowExperimental(!showExperimental)}
                title="显示实验性设置"
              >
                <div className="flex flex-col gap-x-1 gap-y-4">
                  <UserSetting
                    type="toggle"
                    title="默认添加当前文件"
                    description="在每次新对话中，默认将当前打开的文件作为上下文添加。"
                    value={useCurrentFileAsContext}
                    onChange={(value) =>
                      handleUpdate({ useCurrentFileAsContext: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title="启用实验性工具"
                    description="允许使用仍在开发中的实验性工具。"
                    value={enableExperimentalTools}
                    onChange={(value) =>
                      handleUpdate({ enableExperimentalTools: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title="仅使用系统消息工具"
                    description="Continue 将不会尝试原生工具调用，只会使用系统消息工具。"
                    value={onlyUseSystemMessageTools}
                    onChange={(value) =>
                      handleUpdate({ onlyUseSystemMessageTools: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title="@Codebase：仅使用工具调用"
                    description="@codebase 上下文仅会使用工具调用来检索代码。"
                    value={codebaseToolCallingOnly}
                    onChange={(value) =>
                      handleUpdate({ codebaseToolCallingOnly: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title="工具拒绝后继续流式输出"
                    description="当工具调用被拒绝时，模型仍会继续输出内容。"
                    value={continueAfterToolRejection}
                    onChange={(value) =>
                      handleUpdate({ continueAfterToolRejection: value })
                    }
                  />

                  {hasContinueEmail && (
                    <ContinueFeaturesMenu
                      enableStaticContextualization={
                        enableStaticContextualization
                      }
                      handleEnableStaticContextualizationToggle={
                        handleEnableStaticContextualizationToggle
                      }
                    />
                  )}
                </div>
              </Toggle>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
