import * as vscode from 'vscode';
import { BreakpointGroup, BreakpointInfo } from './types';

export class BreakpointManager {
  private groups: Map<string, BreakpointGroup> = new Map();
  private breakpoints: Map<string, BreakpointInfo> = new Map();
  private _onDidChangeGroups = new vscode.EventEmitter<void>();
  public readonly onDidChangeGroups = this._onDidChangeGroups.event;

  constructor(private context: vscode.ExtensionContext) {
    this.loadGroups();
    this.setupBreakpointListener();
    // Sync with existing breakpoints on startup
    this.syncBreakpoints();
  }

  private setupBreakpointListener(): void {
    // Listen for breakpoint changes from VS Code
    vscode.debug.onDidChangeBreakpoints((e: vscode.BreakpointsChangeEvent) => {
      // Only sync if breakpoints were added or removed, not just enabled/disabled
      if (e.added.length > 0 || e.removed.length > 0) {
        this.syncBreakpoints();
      } else {
        // Just update the enabled state for existing breakpoints
        this.updateBreakpointStates();
      }
    });
  }

  private syncBreakpoints(): void {
    const vscodeBreakpoints = vscode.debug.breakpoints;
    this.breakpoints.clear();

    vscodeBreakpoints.forEach((bp: vscode.Breakpoint) => {
      if (bp instanceof vscode.SourceBreakpoint) {
        const breakpointInfo: BreakpointInfo = {
          id: this.generateBreakpointId(bp),
          file: bp.location.uri.fsPath,
          line: bp.location.range.start.line + 1,
          column: bp.location.range.start.character,
          condition: bp.condition,
          hitCount: bp.hitCondition ? parseInt(bp.hitCondition) : undefined,
          logMessage: bp.logMessage,
          enabled: bp.enabled
        };
        this.breakpoints.set(breakpointInfo.id, breakpointInfo);
      }
    });

    this._onDidChangeGroups.fire();
  }

  private updateBreakpointStates(): void {
    const vscodeBreakpoints = vscode.debug.breakpoints;
    
    vscodeBreakpoints.forEach((bp: vscode.Breakpoint) => {
      if (bp instanceof vscode.SourceBreakpoint) {
        const breakpointId = this.generateBreakpointId(bp);
        const breakpointInfo = this.breakpoints.get(breakpointId);
        if (breakpointInfo) {
          breakpointInfo.enabled = bp.enabled;
        }
      }
    });

    // Don't update group states here - let individual breakpoint toggles be independent
    this._onDidChangeGroups.fire();
  }


  createGroup(name: string, description?: string): BreakpointGroup {
    const group: BreakpointGroup = {
      id: this.generateGroupId(),
      name,
      breakpoints: [],
      enabled: true,
      description
    };
    
    this.groups.set(group.id, group);
    this.saveGroups();
    this._onDidChangeGroups.fire();
    return group;
  }

  deleteGroup(groupId: string): void {
    this.groups.delete(groupId);
    this.saveGroups();
    this._onDidChangeGroups.fire();
  }

  renameGroup(groupId: string, newName: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.name = newName;
      this.saveGroups();
      this._onDidChangeGroups.fire();
    }
  }

  addBreakpointToGroup(breakpointId: string, groupId: string): void {
    const group = this.groups.get(groupId);
    const breakpoint = this.breakpoints.get(breakpointId);
    
    if (group && breakpoint && !group.breakpoints.includes(breakpointId)) {
      group.breakpoints.push(breakpointId);
      this.saveGroups();
      this._onDidChangeGroups.fire();
    }
  }

  removeBreakpointFromGroup(breakpointId: string, groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.breakpoints = group.breakpoints.filter(id => id !== breakpointId);
      this.saveGroups();
      this._onDidChangeGroups.fire();
    }
  }

  enableGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.enabled = true;
      // Enable all breakpoints in the group
      this.updateGroupBreakpoints(group);
      this.saveGroups();
      this._onDidChangeGroups.fire();
    }
  }

  disableGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.enabled = false;
      // Disable all breakpoints in the group
      this.updateGroupBreakpoints(group);
      this.saveGroups();
      this._onDidChangeGroups.fire();
    }
  }

  enableBreakpoint(breakpointId: string): void {
    this.toggleBreakpoint(breakpointId, true);
  }

  disableBreakpoint(breakpointId: string): void {
    this.toggleBreakpoint(breakpointId, false);
  }

  private toggleBreakpoint(breakpointId: string, enabled: boolean): void {
    // Find and update the specific VS Code breakpoint
    const vscodeBreakpoints = vscode.debug.breakpoints;
    const vscodeBreakpoint = vscodeBreakpoints.find((bp: vscode.Breakpoint) => 
      bp instanceof vscode.SourceBreakpoint &&
      this.generateBreakpointId(bp as vscode.SourceBreakpoint) === breakpointId
    ) as vscode.SourceBreakpoint;
    
    if (vscodeBreakpoint) {
      // Create new breakpoint with updated enabled state
      const newBreakpoint = new vscode.SourceBreakpoint(
        vscodeBreakpoint.location,
        enabled,
        vscodeBreakpoint.condition,
        vscodeBreakpoint.hitCondition,
        vscodeBreakpoint.logMessage
      );
      
      // Remove old and add new
      vscode.debug.removeBreakpoints([vscodeBreakpoint]);
      vscode.debug.addBreakpoints([newBreakpoint]);
      
      // Update our internal state
      const breakpointInfo = this.breakpoints.get(breakpointId);
      if (breakpointInfo) {
        breakpointInfo.enabled = enabled;
      }
      
      // Don't fire the event here - let the onDidChangeBreakpoints handle it
      // This prevents the circular issue
    }
  }

  private updateGroupBreakpoints(group: BreakpointGroup): void {
    // Find and update VS Code breakpoints
    const vscodeBreakpoints = vscode.debug.breakpoints;
    
    group.breakpoints.forEach(breakpointId => {
      const breakpointInfo = this.breakpoints.get(breakpointId);
      if (breakpointInfo) {
        const vscodeBreakpoint = vscodeBreakpoints.find((bp: vscode.Breakpoint) => 
          bp instanceof vscode.SourceBreakpoint &&
          this.generateBreakpointId(bp as vscode.SourceBreakpoint) === breakpointId
        ) as vscode.SourceBreakpoint;
        
        if (vscodeBreakpoint) {
          // Create new breakpoint with updated enabled state
          const newBreakpoint = new vscode.SourceBreakpoint(
            vscodeBreakpoint.location,
            group.enabled,
            vscodeBreakpoint.condition,
            vscodeBreakpoint.hitCondition,
            vscodeBreakpoint.logMessage
          );
          
          // Remove old and add new
          vscode.debug.removeBreakpoints([vscodeBreakpoint]);
          vscode.debug.addBreakpoints([newBreakpoint]);
        }
      }
    });
  }

  getGroups(): BreakpointGroup[] {
    return Array.from(this.groups.values());
  }

  getBreakpoints(): BreakpointInfo[] {
    return Array.from(this.breakpoints.values());
  }

  getBreakpointsInGroup(groupId: string): BreakpointInfo[] {
    const group = this.groups.get(groupId);
    if (!group) return [];
    
    return group.breakpoints
      .map(id => this.breakpoints.get(id))
      .filter((bp): bp is BreakpointInfo => bp !== undefined);
  }

  getUngroupedBreakpoints(): BreakpointInfo[] {
    const allBreakpoints = Array.from(this.breakpoints.values());
    const groupedBreakpointIds = new Set<string>();
    
    this.groups.forEach(group => {
      group.breakpoints.forEach(bpId => groupedBreakpointIds.add(bpId));
    });
    
    return allBreakpoints.filter(bp => !groupedBreakpointIds.has(bp.id));
  }

  getGroupForBreakpoint(breakpointId: string): BreakpointGroup | undefined {
    for (const group of this.groups.values()) {
      if (group.breakpoints.includes(breakpointId)) {
        return group;
      }
    }
    return undefined;
  }

  isBreakpointGrouped(breakpointId: string): boolean {
    return this.getGroupForBreakpoint(breakpointId) !== undefined;
  }

  generateBreakpointId(breakpoint: vscode.SourceBreakpoint): string {
    return `${breakpoint.location.uri.fsPath}:${breakpoint.location.range.start.line + 1}`;
  }

  private generateGroupId(): string {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }


  private loadGroups(): void {
    const groupsData = this.context.workspaceState.get<BreakpointGroup[]>('breakpointGroups', []);
    groupsData.forEach((group: BreakpointGroup) => {
      this.groups.set(group.id, group);
    });
  }

  public saveGroups(): void {
    const groupsData = Array.from(this.groups.values());
    this.context.workspaceState.update('breakpointGroups', groupsData);
  }

  public fireGroupsChanged(): void {
    this._onDidChangeGroups.fire();
  }
}
