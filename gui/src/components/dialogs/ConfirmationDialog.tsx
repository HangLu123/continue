import { useDispatch } from "react-redux";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { Button } from "../ui/Button";

interface ConfirmationDialogProps {
  onConfirm: () => void;
  onCancel?: () => void;
  text: string;
  title?: string;
  hideCancelButton?: boolean;
  confirmText?: string;
}

function ConfirmationDialog(props: ConfirmationDialogProps) {
  const dispatch = useDispatch();

  return (
    <div className="p-4 pt-0">
      <h1 className="mb-1 text-center text-xl">
        {props.title ?? "确认操作"}
      </h1>
      <p className="text-center text-base" style={{ whiteSpace: "pre-wrap" }}>
        {props.text}
      </p>

      <div className="w/1/2 flex justify-end gap-2">
        {!!props.hideCancelButton || (
          <Button
            variant="outline"
            onClick={() => {
              dispatch(setShowDialog(false));
              dispatch(setDialogMessage(undefined));
              props.onCancel?.();
            }}
          >
            取消
          </Button>
        )}
        <Button
          onClick={() => {
            props.onConfirm();
            dispatch(setShowDialog(false));
            dispatch(setDialogMessage(undefined));
          }}
        >
          {props.confirmText ?? "确认"}
        </Button>
      </div>
    </div>
  );
}

export default ConfirmationDialog;
