import { useContext, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { CONFIG_ROUTES } from "../../util/navigation";
import Alert from "../gui/Alert";

export const FatalErrorIndicator = () => {
  const { refreshProfiles } = useAuth();
  const configError = useAppSelector((store) => store.config.configError);
  const ideMessenger = useContext(IdeMessengerContext);
  const location = useLocation();
  const navigate = useNavigate();

  const hasFatalErrors = useMemo(() => {
    return configError?.some((error) => error.fatal);
  }, [configError]);

  const configLoading = useAppSelector((state) => state.config.loading);
  const showConfigPage = () => {
    navigate(CONFIG_ROUTES.CONFIGS);
  };
  const currentPath = `${location.pathname}${location.search}`;

  const { selectedProfile } = useAuth();

  if (!hasFatalErrors) {
    return null;
  }

  const displayName = selectedProfile
    ? (selectedProfile.title ??
      `${selectedProfile.fullSlug?.ownerSlug}/${selectedProfile.fullSlug?.packageSlug}`)
    : "配置文件";

  return (
    <Alert type="error" className="mx-2 my-1 px-2">
      <span>加载失败：</span>{" "}
      <span className="italic">{displayName}</span>
      {"。 "}
      <span>在可用模型之前，聊天功能已被禁用。</span>
      <div className="mt-2 flex flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
        {configLoading ? (
          <div>重新加载中...</div>
        ) : (
          <div
            className={`cursor-pointer underline`}
            onClick={() => {
              refreshProfiles("Clicked reload in fatal indicator");
            }}
          >
            重新加载
          </div>
        )}
        {currentPath !== CONFIG_ROUTES.CONFIGS && (
          <div onClick={showConfigPage} className="cursor-pointer underline">
            查看配置
          </div>
        )}
      </div>
    </Alert>
  );
};