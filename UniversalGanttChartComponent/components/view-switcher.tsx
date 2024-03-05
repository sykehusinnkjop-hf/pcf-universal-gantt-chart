import * as React from "react";
import { ViewMode } from "gantt-task-react";
import { IInputs } from "../generated/ManifestTypes";

export const ViewSwitcher: React.FunctionComponent<{
  context: ComponentFramework.Context<IInputs>;
  onViewChange: (viewMode: ViewMode) => void;
}> = ({ context, onViewChange }) => {
  return (
    <div className="Gantt-Header">
      <button
        className="Gantt-Button Gantt-Button_Header"
        onClick={() => onViewChange(ViewMode.QuarterDay)}
      >
        {'KVART DAG'}
      </button>
      <div className="Gantt-Header_Separator">|</div>
      <button
        className="Gantt-Button Gantt-Button_Header"
        onClick={() => onViewChange(ViewMode.HalfDay)}
      >
        {'HALV DAG'}
      </button>
      <div className="Gantt-Header_Separator">|</div>
      <button
        className="Gantt-Button Gantt-Button_Header"
        onClick={() => onViewChange(ViewMode.Day)}
      >
        {'DAG'}
      </button>
      <div className="Gantt-Header_Separator">|</div>
      <button
        className="Gantt-Button Gantt-Button_Header"
        onClick={() => onViewChange(ViewMode.Week)}
      >
        {'UKE'}
      </button>
      <div className="Gantt-Header_Separator">|</div>
      <button
        className="Gantt-Button Gantt-Button_Header"
        onClick={() => onViewChange(ViewMode.Month)}
      >
        {'MÅNED'}
      </button>
      {/* <div className="Gantt-Header_Separator">|</div>
      <button
        className="Gantt-Button Gantt-Button_Header"
        onClick={() => onViewChange(ViewMode.Year)}
      >
        {'ÅR'}
      </button> */}
    </div>
  );
};
