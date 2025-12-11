import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { useContext } from "react";
import Alert from "../../../components/gui/Alert";
import { Card, Divider } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectCurrentOrg } from "../../../redux/slices/profilesSlice";
import { ConfigHeader } from "../components/ConfigHeader";
import { UserSetting } from "../components/UserSetting";
import IndexingProgress from "../features/indexing";
import { DocsSection } from "./DocsSection";

function CodebaseSubSection() {
  const config = useAppSelector((state) => state.config.config);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="mb-0 text-sm font-semibold">@codebase 索引</h3>
      </div>

      <Card>
        <div className="py-2">
          {config.disableIndexing ? (
            <div className="p-1">
              <p className="text-center font-semibold">索引功能已禁用</p>
            </div>
          ) : (
            <IndexingProgress />
          )}
        </div>
      </Card>
    </div>
  );
}

function EnableIndexingSetting() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const currentOrg = useAppSelector(selectCurrentOrg);

  function handleUpdate(sharedConfig: SharedConfigSchema) {
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  const disableIndexing = config.disableIndexing ?? false;
  const disableIndexingToggle =
    currentOrg?.policy?.allowCodebaseIndexing === false;

  return (
    <div className="flex flex-col gap-4">
      <UserSetting
        title="启用索引"
        type="toggle"
        description={
          <div className="text-foreground">
            允许对代码库进行索引，以用于搜索和上下文理解。
            <br />
            <br />
            请注意，索引过程可能会占用大量系统资源， 尤其是在大型代码库环境中。
          </div>
        }
        value={!disableIndexing}
        disabled={disableIndexingToggle}
        onChange={(value) => handleUpdate({ disableIndexing: !value })}
      />
    </div>
  );
}

export function IndexingSettingsSection() {
  const config = useAppSelector((state) => state.config.config);
  const disableIndexing = config.disableIndexing ?? false;

  return (
    <>
      <ConfigHeader title="索引设置" />

      <Alert type="warning" className="mb-6">
        <div className="space-y-4">
          <div>
            <div className="-mt-0.5 text-sm font-medium">索引功能已被弃用</div>
          </div>
          <Divider className="border-inherit" />
          <EnableIndexingSetting />
        </div>
      </Alert>

      {!disableIndexing && (
        <div className="space-y-8">
          <CodebaseSubSection />
          <DocsSection />
        </div>
      )}
    </>
  );
}
