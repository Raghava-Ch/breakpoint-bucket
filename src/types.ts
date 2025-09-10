import * as vscode from 'vscode';

export interface BreakpointGroup {
  id: string;
  name: string;
  breakpoints: string[]; // Array of breakpoint IDs
  enabled: boolean;
  color?: string;
  description?: string;
}

export interface BreakpointInfo {
  id: string;
  file: string;
  line: number;
  column?: number;
  condition?: string;
  hitCount?: number;
  logMessage?: string;
  enabled: boolean;
}

export interface GroupTreeItem extends vscode.TreeItem {
  contextValue: 'group' | 'breakpoint' | 'ungrouped-breakpoint';
  groupId?: string;
  breakpointId?: string;
}

export class BreakpointGroupItem extends vscode.TreeItem {
  public readonly groupId: string;
  
  constructor(
    public readonly group: BreakpointGroup,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private breakpointManager?: any
  ) {
    // Use bucket symbol for group
    const groupSymbol = '🪣';
    super(`${groupSymbol} ${group.name}`, collapsibleState);
    this.contextValue = 'group';
    this.groupId = group.id;
    
    // Calculate group state based on breakpoint states
    const groupState = this.calculateGroupState();
    this.tooltip = `${group.name} - ${groupState} (${group.breakpoints.length} breakpoints)`;
    this.description = `${group.breakpoints.length} breakpoints`;
    
    // Use proper checkbox styling - no additional icons
    this.label = `${groupSymbol} ${group.name}`;
    this.checkboxState = this.getCheckboxState(groupState);
    // Remove iconPath to eliminate reserved space
    this.iconPath = undefined;
  }
  
  private calculateGroupState(): 'All Enabled' | 'Partial' | 'All Disabled' {
    if (!this.breakpointManager) return 'All Disabled';
    
    const breakpoints = this.breakpointManager.getBreakpointsInGroup(this.groupId);
    if (breakpoints.length === 0) return 'All Disabled';
    
    const enabledCount = breakpoints.filter((bp: any) => bp.enabled).length;
    if (enabledCount === 0) return 'All Disabled';
    if (enabledCount === breakpoints.length) return 'All Enabled';
    return 'Partial';
  }
  
  private getCheckboxState(state: 'All Enabled' | 'Partial' | 'All Disabled'): vscode.TreeItemCheckboxState {
    switch (state) {
      case 'All Enabled':
        return vscode.TreeItemCheckboxState.Checked;
      case 'All Disabled':
        return vscode.TreeItemCheckboxState.Unchecked;
      case 'Partial':
        // For partial state, we'll use a custom approach since VS Code doesn't have a built-in partial state
        return vscode.TreeItemCheckboxState.Unchecked; // We'll handle this visually
    }
  }
}

export class BreakpointItem extends vscode.TreeItem {
  public readonly breakpointId: string;
  public readonly groupId: string;
  
  constructor(
    public readonly breakpoint: BreakpointInfo,
    groupId: string
  ) {
    // Show breakpoint like native VS Code breakpoints panel
    const fileName = breakpoint.file.split('/').pop() || breakpoint.file;
    const filePath = breakpoint.file;
    
    // Format label with line number on the right
    super(`${fileName}`, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'breakpoint';
    this.breakpointId = breakpoint.id;
    this.groupId = groupId;
    
    // Set description to show full path (will be truncated by VS Code based on width)
    this.description = filePath;
    
    // Add line number as a separate property for right alignment
    this.label = `${fileName}`;
    
    // Add line number to the right side using resourceUri and command
    this.resourceUri = vscode.Uri.file(breakpoint.file);
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [
        vscode.Uri.file(breakpoint.file),
        {
          selection: new vscode.Range(
            new vscode.Position(breakpoint.line - 1, 0),
            new vscode.Position(breakpoint.line - 1, 0)
          )
        }
      ]
    };
    
    this.tooltip = `${breakpoint.file}:${breakpoint.line}${breakpoint.condition ? ` (${breakpoint.condition})` : ''} - ${breakpoint.enabled ? 'Enabled' : 'Disabled'}`;
    
    // Use proper checkbox styling - no additional icons
    this.checkboxState = breakpoint.enabled ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
    // Remove iconPath to eliminate reserved space
    this.iconPath = undefined;
  }
}

export class UngroupedBreakpointItem extends vscode.TreeItem {
  public readonly breakpointId: string;
  
  constructor(
    public readonly breakpoint: BreakpointInfo
  ) {
    // Show breakpoint like native VS Code breakpoints panel
    const fileName = breakpoint.file.split('/').pop() || breakpoint.file;
    const filePath = breakpoint.file;
    
    // Format label with line number on the right
    super(`${fileName}`, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'ungrouped-breakpoint';
    this.breakpointId = breakpoint.id;
    
    // Set description to show full path (will be truncated by VS Code based on width)
    this.description = filePath;
    
    // Add line number as a separate property for right alignment
    this.label = `${fileName}`;
    
    // Add line number to the right side using resourceUri and command
    this.resourceUri = vscode.Uri.file(breakpoint.file);
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [
        vscode.Uri.file(breakpoint.file),
        {
          selection: new vscode.Range(
            new vscode.Position(breakpoint.line - 1, 0),
            new vscode.Position(breakpoint.line - 1, 0)
          )
        }
      ]
    };
    
    this.tooltip = `${breakpoint.file}:${breakpoint.line}${breakpoint.condition ? ` (${breakpoint.condition})` : ''} - ${breakpoint.enabled ? 'Enabled' : 'Disabled'}`;
    
    // Use proper checkbox styling - no additional icons
    this.checkboxState = breakpoint.enabled ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
    // Remove iconPath to eliminate reserved space
    this.iconPath = undefined;
  }
}
