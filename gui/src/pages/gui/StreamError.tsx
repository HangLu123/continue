import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardIcon,
  Cog6ToothIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { DISCORD_LINK } from "core/util/constants";
import { useContext, useMemo } from "react";
import { GhostButton, SecondaryButton } from "../../components";
import { useEditModel } from "../../components/mainInput/Lump/useEditBlock";
import { useMainEditor } from "../../components/mainInput/TipTapEditor";
import { DiscordIcon } from "../../components/svg/DiscordIcon";
import { GithubIcon } from "../../components/svg/GithubIcon";
import ToggleDiv from "../../components/ToggleDiv";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { selectSelectedProfile } from "../../redux/slices/profilesSlice";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { streamResponseThunk } from "../../redux/thunks/streamResponse";
import { isLocalProfile } from "../../util";
import { analyzeError } from "../../util/errorAnalysis";
import { OutOfCreditsDialog } from "./OutOfCreditsDialog";

interface StreamErrorProps {
  error: unknown;
}

const StreamErrorDialog = ({ error }: StreamErrorProps) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedModel = useAppSelector(selectSelectedChatModel);
  const selectedProfile = useAppSelector(selectSelectedProfile);
  const { session, refreshProfiles } = useAuth();
  const { mainEditor } = useMainEditor();

  const {
    parsedError,
    statusCode,
    message,
    modelTitle,
    providerName,
    apiKeyUrl,
  } = useMemo(() => analyzeError(error, selectedModel), [error, selectedModel]);

  const handleRefreshProfiles = () => {
    void refreshProfiles("从流错误对话框点击重新加载配置");
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };

  const copyErrorToClipboard = () => {
    void navigator.clipboard.writeText(parsedError);
  };

  const history = useAppSelector((store) => store.session.history);

  const checkKeysButton = apiKeyUrl ? (
    <GhostButton
      className="flex items-center"
      onClick={() => ideMessenger.ide.openUrl(apiKeyUrl)}
    >
      <KeyIcon className="mr-1.5 h-3.5 w-3.5" />
      <span>查看密钥</span>
    </GhostButton>
  ) : null;

  const handleEditModel = useEditModel();

  const configButton = (
    <GhostButton
      className="flex items-center"
      onClick={() => handleEditModel(selectedModel)}
    >
      <Cog6ToothIcon className="mr-1.5 h-3.5 w-3.5" />
      <span>查看配置</span>
    </GhostButton>
  );

  const resubmitButton = (
    <GhostButton
      className="flex items-center"
      onClick={() => {
        let index = -1;
        for (let i = history.length - 1; i >= 0; i--) {
          if (
            history[i].message.role === "user" ||
            history[i].message.role === "tool"
          ) {
            index = i;
            break;
          }
        }

        if (!mainEditor) {
          console.error("未找到主编辑器，无法重新提交消息。");
          return;
        }

        const editorState =
          index === -1 ? mainEditor.getJSON() : history[index].editorState;

        void dispatch(
          streamResponseThunk({
            editorState,
            modifiers: {
              noContext: true,
              useCodebase: false,
            },
            index: index === -1 ? 0 : index,
          }),
        );
        dispatch(setShowDialog(false));
        dispatch(setDialogMessage(undefined));
      }}
    >
      <ArrowPathIcon className="mr-1.5 h-3.5 w-3.5" />
      <span>重新提交上一条消息</span>
    </GhostButton>
  );

  if (parsedError.includes("You're out of credits!")) {
    return <OutOfCreditsDialog />;
  }

  let errorContent = (
    <div className="mb-1 mt-3">
      <div className="m-0 p-0">
        <p className="m-0 mb-2 p-0">
          处理来自 {selectedModel?.title || "模型"} 的响应时发生错误。
        </p>
        <p className="m-0 p-0">
          请尝试重新提交消息。如果问题仍然存在，请使用下方按钮向我们报告该问题。
        </p>
        <div className="mt-3">{resubmitButton}</div>
      </div>
    </div>
  );

  // 针对特定错误码的提示
  if (statusCode === 429) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>
          {`这可能意味着你的 ${modelTitle} 请求被 ${providerName} 触发了速率限制。`}
        </span>
        <div className="flex flex-row flex-wrap justify-start gap-3 py-4">
          {checkKeysButton}
          {configButton}
        </div>
      </div>
    );
  }

  if (statusCode === 404) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>可能的原因：</span>
        <ul className="m-0">
          <li>
            <span>无效的</span>
            <code>apiBase</code>
            {selectedModel && (
              <>
                <span>{`：`}</span>
                <code>{selectedModel.apiBase}</code>
              </>
            )}
          </li>
          <li>
            <span>未找到模型 / 部署</span>
            {selectedModel && (
              <>
                <span>{`：`}</span>
                <code>{selectedModel.model}</code>
              </>
            )}
          </li>
        </ul>
        <div>{configButton}</div>
      </div>
    );
  }

  if (statusCode === 401) {
    errorContent = (
      <div className="flex flex-col gap-2">
        {session && selectedProfile && !isLocalProfile(selectedProfile) && (
          <div className="flex flex-col gap-1">
            <span>如果你的 Hub 密钥可能已发生变化，请刷新你的 Agent</span>
            <SecondaryButton onClick={handleRefreshProfiles}>
              刷新 Agent 密钥
            </SecondaryButton>
          </div>
        )}
        <span>你的 API Key 可能无效。</span>
        <div className="flex flex-row flex-wrap gap-2">
          {checkKeysButton}
          {configButton}
        </div>
      </div>
    );
  }

  if (statusCode === 403) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>可能原因：你没有权限访问该模型部署。</span>
        <div className="flex flex-row flex-wrap gap-2">
          {checkKeysButton}
          {configButton}
        </div>
      </div>
    );
  }

  if (
    message &&
    (message.toLowerCase().includes("overloaded") ||
      message.toLowerCase().includes("malformed json"))
  ) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>提供方服务器很可能过载，导致流式响应被中断。请稍后重试。</span>
        {selectedModel ? (
          <span>
            提供方：
            <code>{selectedModel.provider}</code>
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-3 pb-3 pt-3">
      <h3 className="text-error m-0 p-0 text-lg font-medium">
        处理模型响应时出错
      </h3>

      {errorContent}

      {message && (
        <div className="mb-2">
          <ToggleDiv
            title="查看错误输出"
            testId="error-output-toggle"
            defaultOpen
          >
            <div className="flex flex-col gap-0 rounded-sm">
              <code className="text-editor-foreground block max-h-48 overflow-y-auto p-3 font-mono text-xs">
                {parsedError}
              </code>

              <div className="flex flex-row items-center justify-end gap-2 p-2">
                <GhostButton
                  onClick={copyErrorToClipboard}
                  className="flex items-center"
                >
                  <ClipboardIcon className="mr-1.5 h-3.5 w-3.5" />
                  <span>复制输出</span>
                </GhostButton>

                <GhostButton
                  onClick={() => {
                    ideMessenger.post("toggleDevTools", undefined);
                  }}
                  className="flex items-center"
                >
                  <ArrowTopRightOnSquareIcon className="mr-1.5 h-4 w-4" />
                  <span className="text-xs">查看日志</span>
                </GhostButton>
              </div>
            </div>
          </ToggleDiv>
        </div>
      )}

      <div>
        <span className="text-base font-medium">报告此错误</span>
        <div className="mt-2 flex flex-row flex-wrap items-center gap-2">
          <GhostButton
            className="flex flex-row items-center gap-2 rounded px-3 py-1.5"
            onClick={() => {
              const issueTitle = `错误：${selectedModel?.title || "模型"} - ${statusCode || "未知错误"}`;
              const issueBody = `**错误详情**

模型：${selectedModel?.title || "未知"}
提供方：${selectedModel?.provider || "未知"}
状态码：${statusCode || "N/A"}

**错误输出**
\`\`\`
${parsedError}
\`\`\`

**补充说明**
请在此处补充更多上下文信息
`;
              const url = `https://github.com/continuedev/continue/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
              ideMessenger.post("openUrl", url);
            }}
          >
            <GithubIcon className="h-5 w-5" />
            <span className="xs:flex hidden">提交 GitHub Issue</span>
          </GhostButton>

          <GhostButton
            className="flex flex-row items-center gap-2 rounded px-3 py-1.5"
            onClick={() => {
              ideMessenger.post("openUrl", DISCORD_LINK);
            }}
          >
            <DiscordIcon className="h-5 w-5" />
            <span className="xs:flex hidden">Discord 社区</span>
          </GhostButton>
        </div>
      </div>
    </div>
  );
};

export default StreamErrorDialog;
