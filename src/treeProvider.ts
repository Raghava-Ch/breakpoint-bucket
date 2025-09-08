import * as vscode from 'vscode';
import { BreakpointManager } from './breakpointManager';
import { BreakpointGroupItem, BreakpointItem, UngroupedBreakpointItem } from './types';

export class BreakpointGroupsProvider implements vscode.TreeDataProvider<BreakpointGroupItem | BreakpointItem | UngroupedBreakpointItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BreakpointGroupItem | BreakpointItem | UngroupedBreakpointItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private breakpointManager: BreakpointManager) {
    this.breakpointManager.onDidChangeGroups(() => {
      this._onDidChangeTreeData.fire();
    });
  }

  // Update checkbox states with three-state logic
  async resolveTreeItem(item: BreakpointGroupItem | BreakpointItem | UngroupedBreakpointItem, element: BreakpointGroupItem | BreakpointItem | UngroupedBreakpointItem, token: vscode.CancellationToken): Promise<BreakpointGroupItem | BreakpointItem | UngroupedBreakpointItem> {
    if (element instanceof BreakpointGroupItem) {
      // Calculate group state based on breakpoint states
      const breakpoints = this.breakpointManager.getBreakpointsInGroup(element.groupId);
      const enabledCount = breakpoints.filter(bp => bp.enabled).length;
      
      let groupState: 'All Enabled' | 'Partial' | 'All Disabled';
      if (breakpoints.length === 0) {
        groupState = 'All Disabled';
      } else if (enabledCount === 0) {
        groupState = 'All Disabled';
      } else if (enabledCount === breakpoints.length) {
        groupState = 'All Enabled';
      } else {
        groupState = 'Partial';
      }
      
      // Update checkbox state and visual indicator
      if (groupState === 'All Enabled') {
        element.checkboxState = vscode.TreeItemCheckboxState.Checked;
        element.label = `🪣 ${element.group.name}`;
      } else if (groupState === 'All Disabled') {
        element.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
        element.label = `🪣 ${element.group.name}`;
      } else {
        // Partial state - show as unchecked but with visual indicator
        element.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
        element.label = `🪣 ${element.group.name} (${enabledCount}/${breakpoints.length})`;
      }
      
      // Update tooltip
      element.tooltip = `${element.group.name} - ${groupState} (${breakpoints.length} breakpoints)`;
      
    } else if (element instanceof BreakpointItem || element instanceof UngroupedBreakpointItem) {
      const breakpoint = this.breakpointManager.getBreakpoints().find(bp => bp.id === element.breakpointId);
      if (breakpoint) {
        // Update breakpoint checkbox state based on enabled status
        element.checkboxState = breakpoint.enabled ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
      }
    }
    return element;
  }

  getTreeItem(element: BreakpointGroupItem | BreakpointItem | UngroupedBreakpointItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BreakpointGroupItem | BreakpointItem | UngroupedBreakpointItem): (BreakpointGroupItem | BreakpointItem | UngroupedBreakpointItem)[] {
    if (!element) {
      // Return ungrouped breakpoints first, then groups
      const ungroupedBreakpoints = this.breakpointManager.getUngroupedBreakpoints().map(breakpoint => 
        new UngroupedBreakpointItem(breakpoint)
      );
      
      const groups = this.breakpointManager.getGroups().map(group => 
        new BreakpointGroupItem(group, vscode.TreeItemCollapsibleState.Expanded, this.breakpointManager)
      );
      
      return [...ungroupedBreakpoints, ...groups];
    }

    if (element instanceof BreakpointGroupItem) {
      // Return breakpoints in this group
      const breakpoints = this.breakpointManager.getBreakpointsInGroup(element.groupId!);
      return breakpoints.map(breakpoint => 
        new BreakpointItem(breakpoint, element.groupId!)
      );
    }

    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
