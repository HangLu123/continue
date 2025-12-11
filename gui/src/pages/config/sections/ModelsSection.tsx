import { ModelRole } from "@continuedev/config-yaml";
import { ModelDescription } from "core";
import { useContext, useState } from "react";
import Shortcut from "../../../components/gui/Shortcut";
import { useEditModel } from "../../../components/mainInput/Lump/useEditBlock";
import { Card, Divider, Toggle } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { AddModelForm } from "../../../forms/AddModelForm";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../../redux/thunks/updateSelectedModelByRole";
import { getMetaKeyLabel, isJetBrains } from "../../../util";
import { ConfigHeader } from "../components/ConfigHeader";
import { ModelRoleRow } from "../components/ModelRoleRow";

export function ModelsSection() {
  const { selectedProfile } = useAuth();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const config = useAppSelector((state) => state.config.config);
  const jetbrains = isJetBrains();
  const metaKey = getMetaKeyLabel();
  const [showAdditionalRoles, setShowAdditionalRoles] = useState(false);

  function handleRoleUpdate(role: ModelRole, model: ModelDescription | null) {
    if (!model) {
      return;
    }

    void dispatch(
      updateSelectedModelByRole({
        role,
        selectedProfile,
        modelTitle: model.title,
      }),
    );
  }

  const handleConfigureModel = useEditModel();

  function handleAddModel() {
    const isLocal = selectedProfile?.profileType === "local";

    if (isLocal) {
      dispatch(setShowDialog(true));
      dispatch(
        setDialogMessage(
          <AddModelForm
            onDone={() => {
              dispatch(setShowDialog(false));
            }}
          />,
        ),
      );
    } else {
      void ideMessenger.request("controlPlane/openUrl", {
        path: "?type=models",
        orgSlug: undefined,
      });
    }
  }

  return (
    <div className="space-y-4">
      <ConfigHeader
        title="模型配置"
        onAddClick={handleAddModel}
        addButtonTooltip="添加模型"
      />

      <Card>
        <ModelRoleRow
          role="chat"
          displayName="聊天模型"
          shortcut={
            <span className="text-2xs text-description-muted">
              (<Shortcut>{`cmd ${jetbrains ? "J" : "L"}`}</Shortcut>)
            </span>
          }
          description={
            <span>
              用于 Chat、Plan、Agent 模式
            </span>
          }
          models={config.modelsByRole.chat}
          selectedModel={config.selectedModelByRole.chat ?? undefined}
          onSelect={(model) => handleRoleUpdate("chat", model)}
          onConfigure={handleConfigureModel}
          setupURL="https://docs.continue.dev/chat/model-setup"
        />

        <Divider />

        <ModelRoleRow
          role="autocomplete"
          displayName="自动补全模型"
          description={
            <span>
              用于实时代码自动补全
            </span>
          }
          models={config.modelsByRole.autocomplete}
          selectedModel={config.selectedModelByRole.autocomplete ?? undefined}
          onSelect={(model) => handleRoleUpdate("autocomplete", model)}
          onConfigure={handleConfigureModel}
          setupURL="https://docs.continue.dev/autocomplete/model-setup"
        />

        {/* Jetbrains has a model selector inline */}
        {!jetbrains && (
          <>
            <Divider />
            <ModelRoleRow
              role="edit"
              displayName="代码编辑模型"
              shortcut={
                <span className="text-2xs text-description-muted">
                  (<Shortcut>cmd I</Shortcut>)
                </span>
              }
              description={
                <span>
                  用于根据你的指令修改选中的代码片段
                </span>
              }
              models={config.modelsByRole.edit}
              selectedModel={config.selectedModelByRole.edit ?? undefined}
              onSelect={(model) => handleRoleUpdate("edit", model)}
              onConfigure={handleConfigureModel}
              setupURL="https://docs.continue.dev/edit/model-setup"
            />
          </>
        )}
      </Card>

      <Card>
        <Toggle
          isOpen={showAdditionalRoles}
          onToggle={() => setShowAdditionalRoles(!showAdditionalRoles)}
          title="更多模型角色"
          subtitle="Apply、Embed、Rerank"
        >
          <div className="flex flex-col">
            <ModelRoleRow
              role="apply"
              displayName="Apply 模型"
              description="用于将生成的代码块应用到文件中"
              models={config.modelsByRole.apply}
              selectedModel={config.selectedModelByRole.apply ?? undefined}
              onSelect={(model) => handleRoleUpdate("apply", model)}
              onConfigure={handleConfigureModel}
              setupURL="https://docs.continue.dev/customize/model-roles/apply"
            />

            <Divider />

            <ModelRoleRow
              role="embed"
              displayName="嵌入模型（Embed）"
              description="用于为 @codebase 与 @docs 上下文生成和查询 Embedding"
              models={config.modelsByRole.embed}
              selectedModel={config.selectedModelByRole.embed ?? undefined}
              onSelect={(model) => handleRoleUpdate("embed", model)}
              onConfigure={handleConfigureModel}
              setupURL="https://docs.continue.dev/customize/model-roles/embeddings"
            />

            <Divider />

            <ModelRoleRow
              role="rerank"
              displayName="重排序模型（Rerank）"
              description="用于对 @codebase 与 @docs 上下文结果进行重排序"
              models={config.modelsByRole.rerank}
              selectedModel={config.selectedModelByRole.rerank ?? undefined}
              onSelect={(model) => handleRoleUpdate("rerank", model)}
              onConfigure={handleConfigureModel}
              setupURL="https://docs.continue.dev/customize/model-roles/reranking"
            />
          </div>
        </Toggle>
      </Card>
    </div>
  );
}
