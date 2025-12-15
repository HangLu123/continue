import { AnimatedEllipsis } from "../../../AnimatedEllipsis";

export function GeneratingIndicator({
  text = "正在生成",
  testId,
}: {
  text?: string;
  testId?: string;
}) {
  return (
    <div className="text-description flex items-center" data-testid={testId}>
      <span className="text-xs">{text}</span>
      <AnimatedEllipsis />
    </div>
  );
}
