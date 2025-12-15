import { BaseSessionMetadata } from "core";
import type { RemoteSessionMetadata } from "core/control-plane/client";
import MiniSearch from "minisearch";
import React, {
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Shortcut from "../gui/Shortcut";

import { XMarkIcon } from "@heroicons/react/24/solid";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  newSession,
  setAllSessionMetadata,
} from "../../redux/slices/sessionSlice";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { refreshSessionMetadata } from "../../redux/thunks/session";
import { getFontSize, getPlatform } from "../../util";
import { ROUTES } from "../../util/navigation";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";
import { Button } from "../ui";
import { HistoryTableRow } from "./HistoryTableRow";
import { groupSessionsByDate, parseDate } from "./util";

export function History() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const ideMessenger = useContext(IdeMessengerContext);

  const [searchTerm, setSearchTerm] = useState("");

  const minisearch = useRef<MiniSearch>(
    new MiniSearch({
      fields: ["title"],
      storeFields: ["title", "sessionId", "id"],
    }),
  ).current;

  const allSessionMetadata = useAppSelector(
    (state) => state.session.allSessionMetadata,
  );
  const isSessionMetadataLoading = useAppSelector(
    (state) => state.session.isSessionMetadataLoading,
  );

  useEffect(() => {
    try {
      minisearch.removeAll();
      minisearch.addAll(
        allSessionMetadata.map((session) => ({
          title: session.title,
          sessionId: session.sessionId,
          id: session.sessionId,
        })),
      );
    } catch (e) {
      console.log("error adding sessions to minisearch", e);
    }
  }, [allSessionMetadata]);

  const platform = useMemo(() => getPlatform(), []);

  const filteredAndSortedSessions: (
    | BaseSessionMetadata
    | RemoteSessionMetadata
  )[] = useMemo(() => {
    // 1. 精确匹配
    const exactResults = minisearch.search(searchTerm, {
      fuzzy: false,
    });

    // 2. 模糊匹配
    const fuzzyResults = minisearch.search(searchTerm, {
      fuzzy: 0.3,
    });

    // 3. 前缀匹配
    const prefixResults = minisearch.search(searchTerm, {
      prefix: true,
      fuzzy: 0.2,
    });

    // 合并结果，精确匹配优先
    const allResults = [
      ...exactResults.map((r) => ({ ...r, priority: 3 })),
      ...fuzzyResults.map((r) => ({ ...r, priority: 2 })),
      ...prefixResults.map((r) => ({ ...r, priority: 1 })),
    ];

    // 去重并保留最高优先级
    const uniqueResultsMap = new Map<string, any>();
    allResults.forEach((result) => {
      const existing = uniqueResultsMap.get(result.id);
      if (!existing || existing.priority < result.priority) {
        uniqueResultsMap.set(result.id, result);
      }
    });
    const uniqueResults = Array.from(uniqueResultsMap.values());

    const sessionIds = uniqueResults
      .sort((a, b) => b.priority - a.priority || b.score - a.score)
      .map((result) => result.id);

    return allSessionMetadata
      .filter((session) => {
        return searchTerm === "" || sessionIds.includes(session.sessionId);
      })
      .sort(
        (a, b) =>
          parseDate(b.dateCreated).getTime() -
          parseDate(a.dateCreated).getTime(),
      );
  }, [allSessionMetadata, searchTerm, minisearch]);

  const sessionGroups = useMemo(() => {
    return groupSessionsByDate(filteredAndSortedSessions);
  }, [filteredAndSortedSessions]);

  const showClearSessionsDialog = () => {
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title={`清空会话`}
          text={`确定要永久删除所有聊天会话（包括当前会话）吗？`}
          onConfirm={async () => {
            // 乐观 UI 更新
            dispatch(setAllSessionMetadata([]));

            // 实际清除 + 刷新
            await ideMessenger.request("history/clear", undefined);
            void dispatch(refreshSessionMetadata({}));

            // 启动新会话
            dispatch(newSession());
            navigate(ROUTES.HOME);
          }}
        />,
      ),
    );
    dispatch(setShowDialog(true));
  };

  return (
    <div
      style={{ fontSize: getFontSize() }}
      className="flex flex-1 flex-col overflow-auto overflow-x-hidden px-1"
    >
      <div className="relative my-2 mt-4 flex justify-center space-x-2">
        <input
          className="bg-vsc-input-background text-vsc-foreground flex-1 rounded-md border border-none py-1 pl-2 pr-8 text-sm outline-none focus:outline-none"
          ref={searchInputRef}
          placeholder="搜索历史会话"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <XMarkIcon
            className="text-vsc-foreground hover:bg-vsc-background duration-50 absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 transform cursor-pointer rounded-full p-0.5 transition-colors"
            onClick={() => {
              setSearchTerm("");
              if (searchInputRef.current) {
                searchInputRef.current.focus();
              }
            }}
          />
        )}
      </div>

      <div className="thin-scrollbar flex w-full flex-1 flex-col overflow-y-auto">
        {filteredAndSortedSessions.length === 0 && (
          <div className="m-3 text-center">
            {isSessionMetadataLoading ? (
              "正在加载会话..."
            ) : (
              <>
                未找到任何历史会话。您可以点击 “+” 按钮 或使用快捷键：
                <Shortcut>meta L</Shortcut>
                开始一个新的会话。
              </>
            )}
          </div>
        )}

        <table className="flex w-full flex-1 flex-col">
          <tbody className="">
            {sessionGroups.map((group, groupIndex) => (
              <Fragment key={group.label}>
                <tr
                  className={`user-select-none sticky mb-3 ml-2 flex h-6 justify-start text-left text-base font-bold opacity-75 ${
                    groupIndex === 0 ? "mt-2" : "mt-8"
                  }`}
                >
                  <td colSpan={3}>{group.label}</td>
                </tr>
                {group.sessions.map((session, sessionIndex) => (
                  <HistoryTableRow
                    key={session.sessionId}
                    sessionMetadata={session}
                    index={sessionIndex}
                  />
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-border flex flex-col items-end justify-center border-0 border-t border-solid px-2 py-3 text-xs">
        <Button variant="secondary" size="sm" onClick={showClearSessionsDialog}>
          清空聊天记录
        </Button>
        <span
          className="text-description text-2xs"
          data-testid="history-sessions-note"
        >
          聊天记录保存于{" "}
          <span className="italic">
            {platform === "windows"
              ? "%USERPROFILE%/.continue"
              : "~/.continue/sessions"}
          </span>
        </span>
      </div>
    </div>
  );
}
