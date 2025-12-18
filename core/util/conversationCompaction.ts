import { ILLM } from "..";
import { HistoryManager } from "./history";
import { stripImages } from "./messageContent";

export interface CompactionParams {
  sessionId: string;
  index: number;
  historyManager: HistoryManager;
  currentModel: ILLM;
}

/**
 * Compacts conversation history up to a specified index by generating a summary.
 * This helper function extracts the compaction logic from the main core handler.
 *
 * @param params - Object containing sessionId, index, historyManager, and currentModel
 * @returns Promise<void> - Updates the session with the conversation summary
 */
export async function compactConversation({
  sessionId,
  index,
  historyManager,
  currentModel,
}: CompactionParams): Promise<void> {
  // Get the current session
  const session = historyManager.load(sessionId);
  const historyUpToIndex = session.history.slice(0, index + 1);

  // Apply the same filtering logic as in constructMessages, but exclude the target message
  // if it already has a summary (we're re-compacting)
  let summaryContent = "";
  let filteredHistory = historyUpToIndex;

  // First, check if the target message already has a summary and ignore it
  const targetMessageHasSummary = historyUpToIndex[index].conversationSummary;
  const searchHistory = targetMessageHasSummary
    ? historyUpToIndex.slice(0, index)
    : historyUpToIndex;

  // Find the most recent conversation summary (excluding target if it has one)
  for (let i = searchHistory.length - 1; i >= 0; i--) {
    const summary = searchHistory[i].conversationSummary;
    if (summary) {
      summaryContent = summary;
      // Only include messages that come AFTER the message with the summary
      filteredHistory = historyUpToIndex.slice(i + 1);
      break;
    }
  }

  // Create messages from filtered history
  const messages = filteredHistory.map((item: any) => item.message);

  // If there's a previous summary, include it as a user message at the beginning
  if (summaryContent) {
    messages.unshift({
      role: "user",
      content: `Previous conversation summary:\n\n${summaryContent}`,
    });
  }

  const compactionPrompt = {
    role: "user" as const,
    content:
      "创建一份全面的对话总结，准确捕捉继续推进工作所需的所有关键信息，确保后续衔接顺畅。请以结构化方式组织内容，保持技术准确性与上下文连续性。\n\n你的总结应包含以下部分：\n\n1. **对话概览**：描述讨论的主要主题及其演进过程，包括期间出现的重点变化或方向调整。\n\n2. **当前开发进展**：详细说明最近正在实现、修改或调试的内容，涵盖所采用的具体技术方案与方法论。\n\n3. **技术栈**：列出讨论中涉及的所有相关技术、框架、库、编码模式以及架构决策。\n\n4. **文件操作**：记录所有被创建、修改或引用的文件，说明其用途及关键改动；包含重要代码片段及其所在位置。\n\n5. **解决方案与问题排查**：总结遇到的问题及其解决方式，包括调试步骤或采用的临时方案。\n\n6. **待完成工作**：明确指出尚未完成的任务、待实现的功能或下一步计划，需直接关联用户的请求及当前进度。\n\n如果对话中已有先前的总结，请在整合其有效信息的同时，移除已过时的内容。重点放在技术细节的精确性上，并包含对继续工作至关重要的具体标识符（如文件路径、函数名、类名等）。全文请使用第三人称，保持客观、技术化的表达风格。",
  };

  // Generate the summary using the current model
  const response = await currentModel.chat(
    [...messages, compactionPrompt],
    new AbortController().signal,
    {},
  );

  // Update the target message with the conversation summary
  const updatedHistory = [...session.history];
  updatedHistory[index] = {
    ...updatedHistory[index],
    conversationSummary: stripImages(response.content),
  };

  // Update the session with the new history
  const updatedSession = {
    ...session,
    history: updatedHistory,
  };

  historyManager.save(updatedSession);
}
