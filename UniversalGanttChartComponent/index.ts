import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { Xrm } from "./xrm";
import * as ReactDOM from "react-dom";
import * as React from "react";
import { Task, ViewMode } from "gantt-task-react";
import { UniversalGantt } from "./components/universal-gantt";
import { generate } from "@ant-design/colors";
import { TaskType } from "gantt-task-react/dist/types/public-types";
import { isErrorDialogOptions } from "./helper";

type DataSet = ComponentFramework.PropertyTypes.DataSet;

type StartEnd = {
  start: any
  end: any
}

type TParentTaskCache = {
  [type: string]: any
}

export class UniversalGanttChartComponent
  implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
  private _container: HTMLDivElement;
  private _displayNameStr = "title";
  private _scheduledStartStr = "startTime";
  private _scheduledEndStr = "endTime";
  private _progressStr = "progress";
  private _taskTypeOption = "taskTypeOption";
  private _parentRecordStr = "parentRecord";
  private _displayColorText = "displayColorText";
  private _displayColorOption = "displayColorOption";
  private _dataSetName = "entityDataSet";
  private _defaultEntityColor = "#2975B2";
  private _defaultTaskType: TaskType = "task";
  private _viewMode: ViewMode;
  private _crmUserTimeOffset: number;
  private _dataSet: DataSet;
  private _locale: string;
  private _taskTypeMap: any;
  private _projects: {
    [index: string]: boolean;
  };
  private parentTasksCache: TParentTaskCache = {}

  constructor() {
    this.handleViewModeChange = this.handleViewModeChange.bind(this);
    this.handleExpanderStateChange = this.handleExpanderStateChange.bind(this);
    this.generateColorTheme = this.generateColorTheme.bind(this);
  }

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ) {
    // Need to track container resize so that control could get the available width. The available height won't be provided even this is true
    context.mode.trackContainerResize(true);
    this._container = container;
    this._viewMode = <ViewMode>context.parameters.viewMode.raw;
    this._crmUserTimeOffset =
      context.userSettings.getTimeZoneOffsetMinutes(new Date()) +
      new Date().getTimezoneOffset();
    this._projects = {};
    context.parameters.entityDataSet.paging.setPageSize(5000);
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    this.updateViewAsync(context);
  }

  /**
   * Async wrapper for update view method
   */
  private async updateViewAsync(context: ComponentFramework.Context<IInputs>) {
    this._dataSet = context.parameters.entityDataSet;
    //Columns retrieve
    const columns = this._dataSet.columns;
    const nameField = columns.find((c) => c.alias === this._displayNameStr);
    const startField = columns.find((c) => c.alias === this._scheduledStartStr);
    const endField = columns.find((c) => c.alias === this._scheduledEndStr);
    const progressField = columns.find((c) => c.alias === this._progressStr);
    if (
      !nameField ||
      !startField ||
      !endField ||
      !context.parameters.timeStep.raw
    )
      return;

    try {
      const tasks = await this.generateTasks(
        context,
        this._dataSet,
        !!progressField
      );

      if (!this._locale) {
        this._locale = await this.getLocalCode(context);
      }
      const listCellWidth = !!context.parameters.listCellWidth.raw
        ? `${context.parameters.listCellWidth.raw}px`
        : "";
      //header display names
      const recordDisplayName =
        context.parameters.customHeaderDisplayName.raw || nameField.displayName;
      const startDisplayName =
        context.parameters.customHeaderStartName.raw || startField.displayName;
      const endDisplayName =
        context.parameters.customHeaderEndName.raw || endField.displayName;
      const progressFieldName = !!progressField ? progressField.name : "";
      const progressDisplayName =
        context.parameters.customHeaderProgressName.raw ||
        (!!progressField ? progressField.displayName : "");

      //height setup
      const rowHeight = !!context.parameters.rowHeight.raw
        ? context.parameters.rowHeight.raw
        : 50;
      const headerHeight = !!context.parameters.headerHeight.raw
        ? context.parameters.headerHeight.raw
        : 50;

      let ganttHeight: number | undefined;
      if (context.mode.allocatedHeight !== -1) {
        ganttHeight = context.mode.allocatedHeight - 15;
      } else if (context.parameters.isSubgrid.raw === "no") {
        ganttHeight = this._container.offsetHeight - 100;
      }

      //width setup
      const columnWidthQuarter = context.parameters.columnWidthQuarter.raw || 0;
      const columnWidthHalf = context.parameters.columnWidthHalf.raw || 0;
      const columnWidthDay = context.parameters.columnWidthDay.raw || 0;
      const columnWidthWeek = context.parameters.columnWidthWeek.raw || 0;
      const columnWidthMonth = context.parameters.columnWidthMonth.raw || 0;
      const columnWidthYear = 350;

      const includeTime =
        context.parameters.displayDateFormat.raw === "datetime";

      const fontSize = context.parameters.fontSize.raw || "14px";
      //create gantt
      const gantt = React.createElement(UniversalGantt, {
        context,
        tasks,
        ganttHeight,
        recordDisplayName,
        startDisplayName,
        endDisplayName,
        progressDisplayName,
        startFieldName: startField.name,
        endFieldName: endField.name,
        progressFieldName: progressFieldName,
        listCellWidth: listCellWidth,
        timeStep: context.parameters.timeStep.raw,
        rowHeight: rowHeight,
        headerHeight: headerHeight,
        isProgressing: !!progressField,
        viewMode: this._viewMode,
        includeTime: includeTime,
        locale: this._locale,
        rtl: context.userSettings.isRTL,
        crmUserTimeOffset: this._crmUserTimeOffset,
        fontSize,
        columnWidthQuarter,
        columnWidthHalf,
        columnWidthDay,
        columnWidthWeek,
        columnWidthMonth,
        columnWidthYear,
        onViewChange: this.handleViewModeChange,
        onExpanderStateChange: this.handleExpanderStateChange,
      });

      ReactDOM.render(gantt, this._container);
    } catch (e) {
      console.error(e);
    }
  }

  private getParentTasks(context: ComponentFramework.Context<IInputs>, recordId: string) {

    const finalParentIdArray: string[] = []
    try {
      context.webAPI.retrieveMultipleRecords('shi_templateprojecttaskdependency', `?$select=_shi_successortaskid_value,_shi_predecessortaskid_value&$filter=_shi_successortaskid_value eq  ${recordId}`).then(
        (result) => {

          const data = result.entities

          data.forEach((element: any) => {
            finalParentIdArray.push(element?._shi_predecessortaskid_value)
          });

          this.parentTasksCache[recordId] = finalParentIdArray

        },
        (error) => {
          alert(error?.message)
        }
      )

    } catch (err: any) {

    }

  }

  private sortRecords(dataset: ComponentFramework.PropertyTypes.DataSet): string[] {
    const getParentId = (guid: string): string | null => {
      const parentRecord = dataset.records[guid].getValue(this._parentRecordStr) as ComponentFramework.EntityReference;
      return parentRecord ? parentRecord.id.guid : null;
    };

    const buildHierarchy = (parentId: string | null, level: number = 0): string[] => {
      return dataset.sortedRecordIds
        .filter(guid => getParentId(guid) === parentId)
        .reduce((acc: string[], guid) => {
          acc.push(guid); // Add the current item
          const children = buildHierarchy(guid, level + 1); // Recursively add children
          return acc.concat(children); // Concatenate the children to the accumulator
        }, []);
    };

    return buildHierarchy(null); // Start with top-level items (those with no parent)
  }

  private hasChildren(dataset: ComponentFramework.PropertyTypes.DataSet, parentId: string): boolean {
    const parentRecordStr = this._parentRecordStr; // Assume this is defined somewhere in your class

    // Iterate through all records to check if any has the given parentId as its parent
    for (const recordId in dataset.records) {
      const record = dataset.records[recordId];
      const parentRef = record.getValue(parentRecordStr) as ComponentFramework.EntityReference;

      // Check if the parentRef exists and matches the parentId
      if (parentRef && parentRef.id.guid === parentId) {
        return true; // A child is found, return true
      }
    }

    // No children found for the given parentId
    return false;
  }

  private findChildrenStartEndDates(dataset: ComponentFramework.PropertyTypes.DataSet, parentId: string, visited: Set<string> = new Set<string>()): StartEnd {
    let earliestStart: string | undefined = undefined;
    let latestEnd: string | undefined = undefined;

    for (const recordId in dataset.records) {
      //if (visited.has(recordId)) continue; // Skip already visited records to avoid infinite recursion
      //visited.add(recordId); // Mark the current record as visited

      const record = dataset.records[recordId];
      const parentRef = record.getValue(this._parentRecordStr) as ComponentFramework.EntityReference;

      // Check if the parentRef exists and matches the parentId
      if (parentRef && parentRef.id.guid === parentId) {
        if (!this.hasChildren(dataset, recordId)) {
          const currentStart = record.getValue('shi_start_date') as string;
          const currentEnd = record.getValue('shi_end_date') as string;


          if (!earliestStart || currentStart < earliestStart) {
            earliestStart = currentStart;
          }

          if (!latestEnd || currentEnd > latestEnd) {
            latestEnd = currentEnd;
          }
        }
        // Recursively find start and end dates for children, if any
        if (this.hasChildren(dataset, recordId)) {
          const result = this.findChildrenStartEndDates(dataset, recordId, visited);
         
          if (!earliestStart || (result.start && result.start < earliestStart)) {
            earliestStart = result.start;
          }

          if (!latestEnd || (result.end && result.end > latestEnd)) {
            latestEnd = result.end;
          }
        }
      }

    }

    return { start: earliestStart, end: latestEnd };
  }

  private findHierarchyLevel(dataset: ComponentFramework.PropertyTypes.DataSet, recordId: string): number {
    const getParentId = (guid: string): string | null => {
      const record = dataset.records[guid];
      if (!record) {
        return null; // Record not found, may be at top level or invalid ID
      }
      const parentRecord = record.getValue(this._parentRecordStr) as ComponentFramework.EntityReference;
      return parentRecord ? parentRecord.id.guid : null;
    };

    const getLevel = (guid: string, currentLevel: number = 0): number => {
      const parentId = getParentId(guid);
      if (!parentId) {
        // No parent found, this is a top-level item
        return currentLevel;
      }
      // Recursively check the parent's level, incrementing the level count
      return getLevel(parentId, currentLevel + 1);
    };

    return getLevel(recordId);
  }

  private async generateTasks(
    context: ComponentFramework.Context<IInputs>,
    dataset: ComponentFramework.PropertyTypes.DataSet,
    isProgressing: boolean
  ) {
    let entityTypesAndColors: {
      entityLogicalName: string;
      backgroundColor: string;
      backgroundSelectedColor: string;
      progressColor: string;
      progressSelectedColor: string;
    }[] = [];

    dataset.sortedRecordIds = this.sortRecords(dataset)

    const isDisabled = context.parameters.displayMode.raw === "readonly";
    let tasks: Task[] = [];
    for (const recordId of dataset.sortedRecordIds) {
      const record = dataset.records[recordId];
      const name = <string>record.getValue(this._displayNameStr);
      let start = <string>record.getValue(this._scheduledStartStr);
      let end = <string>record.getValue(this._scheduledEndStr);

      let dependencies: string[] = []

      const parentRecord = <ComponentFramework.EntityReference>(
        record.getValue(this._parentRecordStr)
      );

      let taskTypeOption: TaskType = 'task'
      if (this.hasChildren(dataset, recordId)) {
        taskTypeOption = 'project'
        const result = this.findChildrenStartEndDates(dataset, recordId)
        start = result.start
        end = result.end

      }

      if (recordId in this.parentTasksCache) dependencies = this.parentTasksCache[recordId]
      this.getParentTasks(context, recordId)

      const hierarchyLevel = this.findHierarchyLevel(dataset, recordId)

      const progress = isProgressing
        ? Number(record.getValue(this._progressStr))
        : 0;
      const colorText = <string>record.getValue(this._displayColorText);
      const optionValue = <string>record.getValue(this._displayColorOption);
      const optionColum = dataset.columns.find(
        (c) => c.alias == this._displayColorOption
      );
      const optionLogicalName = !!optionColum ? optionColum.name : "";
      const taskType = taskTypeOption

      const entRef = record.getNamedReference();
      const entName = entRef.etn || <string>(<any>entRef).logicalName;

      let entityColorTheme = entityTypesAndColors.find(
        (e) => e.entityLogicalName === entName
      );



      if (!entityColorTheme || colorText || optionLogicalName || taskType === 'project' || taskType === 'task') {
        entityColorTheme = await this.generateColorTheme(
          context,
          entName,
          colorText,
          optionValue,
          optionLogicalName,
          taskType
        );
        entityTypesAndColors.push(entityColorTheme);
      }

      if (!name || !start || !end) continue;
      try {
        const taskId = record.getRecordId();
        const task: Task = {
          id: taskId,
          name,
          start: new Date(
            new Date(start).getTime() + this._crmUserTimeOffset * 60000
          ),
          end: new Date(
            new Date(end).getTime() + this._crmUserTimeOffset * 60000
          ),
          progress: progress,
          type: taskType,
          isDisabled: isDisabled,
          styles: { ...entityColorTheme },
          indent: hierarchyLevel * 10,
        };
        if (taskType === "project") {
          const expanderState = this._projects[taskId];
          if (!expanderState) {
            this._projects[taskId] = false;
            task.hideChildren = false;
          } else {
            task.hideChildren = this._projects[taskId];
          }
        }

        if (dependencies) {
          task.dependencies = dependencies
        }

        if (parentRecord) {
          const parentRecordId = parentRecord.id.guid;
          const parentRecordRef = dataset.records[parentRecordId];
          if (parentRecordId) {
            task.project = parentRecordId;
          }
        }

        tasks.push(task);
      } catch (e) {
        throw new Error(
          `Create task error. Record id: ${record.getRecordId()}, name: ${name}, start time: ${start}, end time: ${end}, progress: ${progress}. Error text ${e}`
        );
      }
    }
    return tasks;
  }


  private async generateColorTheme(
    context: ComponentFramework.Context<IInputs>,
    entName: string,
    colorText: string,
    optionValue: string,
    optionLogicalName: string,
    taskType: string,
  ) {
    let entityColor = this._defaultEntityColor;
    //Model App
    if (context.mode.allocatedHeight === -1 && !colorText) {
      if (optionValue) {
        //Get by OptionSet Color
        const result = await context.utils.getEntityMetadata(entName, [
          optionLogicalName,
        ]);
        const attributes: Xrm.EntityMetadata.AttributesCollection =
          result["Attributes"];
        const optionMetadata = attributes.getByName(optionLogicalName);
        entityColor =
          optionMetadata.attributeDescriptor.OptionSet.find(
            (o) => o.Value === +optionValue
          )?.Color || entityColor;
      } else {
        //Get by Entity Color
        const result = await context.utils.getEntityMetadata(entName, [
          "EntityColor",
        ]);
        entityColor = result["EntityColor"];
      }
    } else if (colorText) {
      //Get by Text Color
      entityColor = colorText;
    }

    const colors = generate(entityColor);
    let backgroundColor = context.parameters.customBackgroundColor.raw || colors[2];

    if (taskType === 'project') { backgroundColor = '#ffa940' }
    if (taskType === 'task') { backgroundColor = '#bae637' }
    const backgroundSelectedColor =
      context.parameters.customBackgroundSelectedColor.raw || colors[3];
    const progressColor =
      context.parameters.customProgressColor.raw || colors[4];
    const progressSelectedColor =
      context.parameters.customProgressSelectedColor.raw || colors[5];

    return {
      entityLogicalName: entName,
      backgroundColor: backgroundColor,
      backgroundSelectedColor: backgroundSelectedColor,
      progressColor: progressColor,
      progressSelectedColor: progressSelectedColor,
    };
  }

  private handleViewModeChange(viewMode: ViewMode) {
    this._viewMode = viewMode;
  }

  private handleExpanderStateChange(itemId: string, expanderState: boolean) {
    this._projects[itemId] = expanderState;
    this._dataSet.refresh();
  }

  private async getLocalCode(context: ComponentFramework.Context<IInputs>) {
    try {
      const languages = await context.webAPI.retrieveMultipleRecords(
        "languagelocale",
        `?$select=code&$filter=localeid eq ${context.userSettings.languageId}`
      );
      if (languages.entities.length > 0) {
        const code = languages.entities[0].code;
        return code;
      }
    } catch (e) {
      if (isErrorDialogOptions(e)) {
        context.navigation.openErrorDialog(e);
      } else {
        console.error(e);
      }
    }

    return "en"; // English
  }
  /**
   * It is called by the framework prior to a control receiving new data.
   * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as “bound” or “output”
   */
  public getOutputs(): IOutputs {
    return {};
  }

  /**
   * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
   * i.e. cancelling any pending remote calls, removing listeners, etc.
   */
  public destroy(): void {
    ReactDOM.unmountComponentAtNode(this._container);
  }
}
