import { useContext, useLayoutEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Input, SecondaryButton } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";

function AddRuleDialog({ mode }: { mode: "workspace" | "global" }) {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const [name, setName] = useState("new-rule");
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    // 短暂延迟后自动聚焦输入框
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const closeDialog = () => {
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("规则名称不能为空");
      return;
    }
    setError(undefined);
    setIsSubmitting(true);
    try {
      if (mode === "global") {
        ideMessenger.post("config/addGlobalRule", {
          baseFilename: trimmed,
        });
      } else {
        ideMessenger.post("config/addLocalWorkspaceBlock", {
          blockType: "rules",
          baseFilename: trimmed,
        });
      }
      closeDialog();
    } catch (err) {
      setIsSubmitting(false);
      setError("创建规则文件失败");
    }
  };

  const title = mode === "global" ? "添加全局规则" : "添加工作区规则";

  return (
    <div className="px-2 pt-4 sm:px-4">
      <div>
        <h1 className="mb-0">{title}</h1>
        <p className="m-0 mt-2 p-0 text-stone-500">
          为新的规则文件输入一个名称。
        </p>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
          <label className="flex w-full flex-col gap-1">
            <span>规则名称</span>
            <Input
              ref={inputRef}
              type="text"
              placeholder="例如：api-guidelines"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="mt-2 flex flex-row justify-end gap-2">
            <SecondaryButton
              className="min-w-16"
              disabled={isSubmitting}
              type="submit"
            >
              创建
            </SecondaryButton>
            <SecondaryButton
              type="button"
              className="min-w-16"
              onClick={closeDialog}
            >
              取消
            </SecondaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddRuleDialog;
