import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  Gantt,
  Task,
  EventOption,
  StylingOption,
  ViewMode,
  DisplayOption,
} from "gantt-task-react";
import { createHeaderLocal } from "./task-list-header";
import { ViewSwitcher } from "./view-switcher";
import { IInputs } from "../generated/ManifestTypes";
import { createTooltip } from "./gantt-tooltip";
import { createTaskListLocal } from "./task-list-table";
import { isErrorDialogOptions } from "../helper";

export type UniversalGanttProps = {
  context: ComponentFramework.Context<IInputs>;
  tasks: Task[];
  locale: string;
  recordDisplayName: string;
  startDisplayName: string;
  endDisplayName: string;
  progressDisplayName: string;
  startFieldName: string;
  endFieldName: string;
  progressFieldName: string;
  includeTime: boolean;
  isProgressing: boolean;
  crmUserTimeOffset: number;
  fontSize: string;
  ganttHeight?: number;
  rowHeight: number;
  headerHeight: number;
  listCellWidth: string;
  columnWidthQuarter: number;
  columnWidthHalf: number;
  columnWidthDay: number;
  columnWidthWeek: number;
  columnWidthMonth: number;
  columnWidthYear: number;
  onViewChange: (viewMode: ViewMode) => void;
  onExpanderStateChange: (itemId: string, expanderState: boolean) => void;
} & EventOption &
  DisplayOption;
export const UniversalGantt: React.FunctionComponent<UniversalGanttProps> = (
  props
) => {
  const [view, setView] = React.useState(props.viewMode);
  const { context } = props;
  // Events
  const handleDateChange = async (task: Task) => {
    const recordRef =
      context.parameters.entityDataSet.records[task.id].getNamedReference();
    const entityName =
      recordRef.etn || ((recordRef as any).logicalName as string);
    let resultState = true;
    try {
      await context.webAPI.updateRecord(entityName, task.id, {
        [props.endFieldName]: new Date(
          task.end.getTime() - props.crmUserTimeOffset * 60000
        ),
        [props.startFieldName]: new Date(
          task.start.getTime() - props.crmUserTimeOffset * 60000
        ),
      });
    } catch (e) {
      if (isErrorDialogOptions(e)) {
        context.navigation.openErrorDialog(e);
      } else {
        console.error(e);
      }
      resultState = false;
    }
    context.parameters.entityDataSet.refresh();
    return resultState;
  };

  const handleProgressChange = async (task: Task) => {
    const recordRef =
      context.parameters.entityDataSet.records[task.id].getNamedReference();
    const entityName =
      recordRef.etn || ((recordRef as any).logicalName as string);
    let resultState = true;
    try {
      await context.webAPI.updateRecord(entityName, task.id, {
        [props.progressFieldName]: task.progress,
      });
    } catch (e) {
      if (isErrorDialogOptions(e)) {
        context.navigation.openErrorDialog(e);
      } else {
        console.error(e);
      }
      resultState = false;
    }
    context.parameters.entityDataSet.refresh();
    return resultState;
  };

  const handleOpenRecord = async (task: Task) => {
    const recordRef =
      context.parameters.entityDataSet.records[task.id].getNamedReference();
    context.parameters.entityDataSet.openDatasetItem(recordRef);
  };

  const handleSelect = (task: Task, isSelected: boolean) => {
    if (isSelected) {
      context.parameters.entityDataSet.setSelectedRecordIds([task.id]);
    } else {
      context.parameters.entityDataSet.clearSelectedRecordIds();
    }
  };

  const handleExpanderClick = (task: Task) => {
    props.onExpanderStateChange(task.id, !!task.hideChildren);
  };

  // Styling
  const formatDateShort = (value: Date, includeTime?: boolean) => {
    return context.formatting.formatDateShort(value, includeTime);
  };

  let options: StylingOption & EventOption = {
    fontSize: props.fontSize,
    fontFamily: "SegoeUI, Segoe UI",
    headerHeight: props.headerHeight,
    rowHeight: props.rowHeight,
    barCornerRadius: 0,
    listCellWidth: props.listCellWidth,
    TaskListHeader: createHeaderLocal(
      props.recordDisplayName,
      props.startDisplayName,
      props.endDisplayName
    ),
    TooltipContent: createTooltip(
      props.startDisplayName,
      props.endDisplayName,
      props.progressDisplayName,
      context.resources.getString("Duration"),
      context.resources.getString("Duration_Metric"),
      props.includeTime,
      formatDateShort
    ),
    TaskListTable: createTaskListLocal(
      props.includeTime,
      handleOpenRecord,
      formatDateShort
    ),
  };

  switch (view) {
    case ViewMode.Year:
      options.columnWidth = props.columnWidthYear;
      break;
    case ViewMode.Month:
      options.columnWidth = props.columnWidthMonth;
      break;
    case ViewMode.Week:
      options.columnWidth = props.columnWidthWeek;
      break;
    case ViewMode.Day:
      options.columnWidth = props.columnWidthDay;
      break;
    case ViewMode.HalfDay:
      options.columnWidth = props.columnWidthHalf;
      break;
    default:
      options.columnWidth = props.columnWidthQuarter;
  }

  if (props.isProgressing) {
    options.onProgressChange = handleProgressChange;
  }

  return (
    <div className="Gantt-Wrapper">
      <ViewSwitcher
        context={context}
        onViewChange={(viewMode) => {
          props.onViewChange(viewMode);
          setView(viewMode);
        }}
      />
      <Gantt
        {...props}
        {...options}
        viewMode={view}
        onDoubleClick={handleOpenRecord}
        onDateChange={handleDateChange}
        onSelect={handleSelect}
        onExpanderClick={handleExpanderClick}
      />
    </div>
  );
};
