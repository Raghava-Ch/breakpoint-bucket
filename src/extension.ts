import * as vscode from 'vscode';
import { BreakpointManager } from './breakpointManager';
import { BreakpointGroupsProvider } from './treeProvider';
import { BreakpointGroupItem, BreakpointItem, UngroupedBreakpointItem } from './types';

let breakpointManager: BreakpointManager;
let treeProvider: BreakpointGroupsProvider;
let treeView: vscode.TreeView<BreakpointGroupItem | BreakpointItem | UngroupedBreakpointItem>;

export function activate(context: vscode.ExtensionContext) {
  console.log('Breakpoint Groups extension is now active!');

  // Initialize services
  breakpointManager = new BreakpointManager(context);
  treeProvider = new BreakpointGroupsProvider(breakpointManager);

  // Register tree view
  treeView = vscode.window.createTreeView('breakpointBucket', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
    canSelectMany: true, // Enable multi-selection for bulk operations
  });

  // Handle checkbox state changes with three-state logic
  let isUpdatingCheckbox = false;
  let lastUserAction: 'group' | 'breakpoint' | null = null;

  treeView.onDidChangeCheckboxState((e: vscode.TreeCheckboxChangeEvent<BreakpointGroupItem | BreakpointItem | UngroupedBreakpointItem>) => {
    if (isUpdatingCheckbox) {
      return; // Prevent circular events
    }

    for (const [item, state] of e.items) {
      if (item instanceof BreakpointGroupItem) {
        // Precise group checkbox behavior - enable/disable based on checkbox state
        lastUserAction = 'group';
        const shouldBeEnabled = state === vscode.TreeItemCheckboxState.Checked;

        isUpdatingCheckbox = true;
        if (shouldBeEnabled) {
          breakpointManager.enableGroup(item.groupId);
        } else {
          breakpointManager.disableGroup(item.groupId);
        }
        isUpdatingCheckbox = false;

      } else if (item instanceof BreakpointItem || item instanceof UngroupedBreakpointItem) {
        // Precise breakpoint checkbox behavior - enable/disable based on checkbox state
        lastUserAction = 'breakpoint';
        const shouldBeEnabled = state === vscode.TreeItemCheckboxState.Checked;
        isUpdatingCheckbox = true;
        if (shouldBeEnabled) {
          enableBreakpoint(item);
        } else {
          disableBreakpoint(item);
          // After first disableBreakpoint, stop processing other iterations
          isUpdatingCheckbox = false;
          break;
        }
        isUpdatingCheckbox = false;
      }
    }
  });

  // Register commands
  const commands = [
    vscode.commands.registerCommand('breakpointBucket.createGroup', createGroup),
    vscode.commands.registerCommand('breakpointBucket.addToGroup', addToGroup),
    vscode.commands.registerCommand('breakpointBucket.removeFromGroup', removeFromGroup),
    vscode.commands.registerCommand('breakpointBucket.enableGroup', enableGroup),
    vscode.commands.registerCommand('breakpointBucket.disableGroup', disableGroup),
    vscode.commands.registerCommand('breakpointBucket.deleteGroup', deleteGroup),
    vscode.commands.registerCommand('breakpointBucket.renameGroup', renameGroup),
    vscode.commands.registerCommand('breakpointBucket.enableBreakpoint', enableBreakpoint),
    vscode.commands.registerCommand('breakpointBucket.disableBreakpoint', disableBreakpoint),
    vscode.commands.registerCommand('breakpointBucket.createGroupFromBreakpoint', createGroupFromBreakpoint),
    vscode.commands.registerCommand('breakpointBucket.removeAllBreakpointsInGroup', removeAllBreakpointsInGroup),
    vscode.commands.registerCommand('breakpointBucket.removeAllUngroupedBreakpoints', removeAllUngroupedBreakpoints),
    vscode.commands.registerCommand('breakpointBucket.removeAllGroups', removeAllGroups),
    vscode.commands.registerCommand('breakpointBucket.moveBreakpointToGroup', moveBreakpointToGroup),
    vscode.commands.registerCommand('breakpointBucket.moveSelectedBreakpointsToGroup', moveSelectedBreakpointsToGroup)
  ];

  context.subscriptions.push(...commands, treeView);
}

async function createGroup() {
  const name = await vscode.window.showInputBox({
    prompt: 'Enter group name',
    placeHolder: 'e.g., Authentication, Database, API Calls'
  });

  if (name) {
    const description = await vscode.window.showInputBox({
      prompt: 'Enter group description (optional)',
      placeHolder: 'Brief description of this breakpoint group'
    });

    breakpointManager.createGroup(name, description);
    vscode.window.showInformationMessage(`Created breakpoint group: ${name}`);
  }
}

async function addToGroup(breakpoint?: any) {
  let breakpointId: string;

  if (breakpoint && breakpoint.breakpointId) {
    // Called from context menu on ungrouped breakpoint
    breakpointId = breakpoint.breakpointId;
  } else if (breakpoint) {
    // Called from breakpoints panel context menu
    breakpointId = generateBreakpointId(breakpoint);
  } else {
    vscode.window.showWarningMessage('No breakpoint selected');
    return;
  }

  const groups = breakpointManager.getGroups();
  if (groups.length === 0) {
    const createGroup = await vscode.window.showInformationMessage(
      'No groups exist. Create one first?',
      'Create Group'
    );
    if (createGroup) {
      await vscode.commands.executeCommand('breakpointGroups.createGroup');
      // Try again after creating group
      const newGroups = breakpointManager.getGroups();
      if (newGroups.length > 0) {
        const groupItems = newGroups.map(group => ({
          label: group.name,
          description: group.description,
          group
        }));

        const selectedGroup = await vscode.window.showQuickPick(groupItems, {
          placeHolder: 'Select a group to add the breakpoint to'
        });

        if (selectedGroup) {
          breakpointManager.addBreakpointToGroup(breakpointId, selectedGroup.group.id);
          vscode.window.showInformationMessage(`Added breakpoint to group: ${selectedGroup.group.name}`);
        }
      }
    }
    return;
  }

  const groupItems = groups.map(group => ({
    label: group.name,
    description: group.description,
    group
  }));

  const selectedGroup = await vscode.window.showQuickPick(groupItems, {
    placeHolder: 'Select a group to add the breakpoint to'
  });

  if (selectedGroup) {
    breakpointManager.addBreakpointToGroup(breakpointId, selectedGroup.group.id);
    vscode.window.showInformationMessage(`Added breakpoint to group: ${selectedGroup.group.name}`);
  }
}

function removeFromGroup(element: any) {
  if (element && element.breakpointId && element.groupId) {
    breakpointManager.removeBreakpointFromGroup(element.breakpointId, element.groupId);
    vscode.window.showInformationMessage('Removed breakpoint from group');
  }
}

function enableGroup(element: any) {
  if (element && element.groupId) {
    breakpointManager.enableGroup(element.groupId);
  }
}

function disableGroup(element: any) {
  if (element && element.groupId) {
    breakpointManager.disableGroup(element.groupId);
  }
}

async function deleteGroup(element: any) {
  if (element && element.groupId) {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete the group "${element.label}"?`,
      'Delete',
      'Cancel'
    );

    if (confirm === 'Delete') {
      breakpointManager.deleteGroup(element.groupId);
      vscode.window.showInformationMessage(`Deleted group: ${element.label}`);
    }
  }
}

async function renameGroup(element: any) {
  if (element && element.groupId) {
    const newName = await vscode.window.showInputBox({
      prompt: 'Enter new group name',
      value: element.label,
      placeHolder: 'Group name'
    });

    if (newName && newName !== element.label) {
      breakpointManager.renameGroup(element.groupId, newName);
      vscode.window.showInformationMessage(`Renamed group to: ${newName}`);
    }
  }
}

function enableBreakpoint(element: any) {
  if (element && element.breakpointId) {
    breakpointManager.enableBreakpoint(element.breakpointId);
  }
}

function disableBreakpoint(element: any) {
  if (element && element.breakpointId) {
    breakpointManager.disableBreakpoint(element.breakpointId);
  }
}

async function createGroupFromBreakpoint(element: any) {
  if (!element || !element.breakpointId) {
    vscode.window.showWarningMessage('No breakpoint selected');
    return;
  }

  const name = await vscode.window.showInputBox({
    prompt: 'Enter group name',
    placeHolder: 'e.g., Authentication, Database, API Calls'
  });

  if (name) {
    const group = breakpointManager.createGroup(name);
    breakpointManager.addBreakpointToGroup(element.breakpointId, group.id);
    vscode.window.showInformationMessage(`Created group "${name}" and added breakpoint`);
  }
}


function generateBreakpointId(breakpoint: any): string {
  // Extract file path and line from the breakpoint
  if (breakpoint.uri && breakpoint.range) {
    return `${breakpoint.uri.fsPath}:${breakpoint.range.start.line + 1}`;
  }
  // Fallback for different breakpoint formats
  return `${breakpoint.id || Date.now()}`;
}

async function removeAllBreakpointsInGroup(element: any) {
  if (!element || !element.groupId) {
    vscode.window.showWarningMessage('No group selected');
    return;
  }

  const group = breakpointManager.getGroups().find(g => g.id === element.groupId);
  if (!group) {
    vscode.window.showWarningMessage('Group not found');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to remove all breakpoints from group "${group.name}"?`,
    'Remove All',
    'Cancel'
  );

  if (confirm === 'Remove All') {
    const breakpoints = breakpointManager.getBreakpointsInGroup(element.groupId);
    
    // Remove breakpoints from VS Code
    const vscodeBreakpoints = vscode.debug.breakpoints;
    const breakpointsToRemove = vscodeBreakpoints.filter((bp: vscode.Breakpoint) => 
      bp instanceof vscode.SourceBreakpoint &&
      breakpoints.some(bpInfo => 
        `${(bp as vscode.SourceBreakpoint).location.uri.fsPath}:${(bp as vscode.SourceBreakpoint).location.range.start.line + 1}` === bpInfo.id
      )
    );

    if (breakpointsToRemove.length > 0) {
      vscode.debug.removeBreakpoints(breakpointsToRemove);
    }

    // Clear group breakpoints
    group.breakpoints = [];
    breakpointManager.saveGroups();
    breakpointManager.fireGroupsChanged();
    
    vscode.window.showInformationMessage(`Removed ${breakpoints.length} breakpoints from group "${group.name}"`);
  }
}

async function removeAllUngroupedBreakpoints() {
  const ungroupedBreakpoints = breakpointManager.getUngroupedBreakpoints();
  
  if (ungroupedBreakpoints.length === 0) {
    vscode.window.showInformationMessage('No ungrouped breakpoints found');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to remove all ${ungroupedBreakpoints.length} ungrouped breakpoints?`,
    'Remove All',
    'Cancel'
  );

  if (confirm === 'Remove All') {
    // Remove breakpoints from VS Code
    const vscodeBreakpoints = vscode.debug.breakpoints;
    const breakpointsToRemove = vscodeBreakpoints.filter((bp: vscode.Breakpoint) => 
      bp instanceof vscode.SourceBreakpoint &&
      ungroupedBreakpoints.some(bpInfo => 
        `${(bp as vscode.SourceBreakpoint).location.uri.fsPath}:${(bp as vscode.SourceBreakpoint).location.range.start.line + 1}` === bpInfo.id
      )
    );

    if (breakpointsToRemove.length > 0) {
      vscode.debug.removeBreakpoints(breakpointsToRemove);
    }

    vscode.window.showInformationMessage(`Removed ${ungroupedBreakpoints.length} ungrouped breakpoints`);
  }
}

async function removeAllGroups() {
  const groups = breakpointManager.getGroups();
  
  if (groups.length === 0) {
    vscode.window.showInformationMessage('No groups found');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to remove all ${groups.length} groups? Breakpoints will become ungrouped.`,
    'Remove All Groups',
    'Cancel'
  );

  if (confirm === 'Remove All Groups') {
    // Clear all groups (breakpoints will become ungrouped)
    groups.forEach(group => {
      group.breakpoints = [];
    });
    
    breakpointManager.saveGroups();
    breakpointManager.fireGroupsChanged();
    
    vscode.window.showInformationMessage(`Removed all ${groups.length} groups. Breakpoints are now ungrouped.`);
  }
}

async function moveBreakpointToGroup(element: any) {
  if (!element || !element.breakpointId) {
    vscode.window.showWarningMessage('No breakpoint selected');
    return;
  }

  const groups = breakpointManager.getGroups();
  if (groups.length === 0) {
    vscode.window.showWarningMessage('No groups exist. Create one first.');
    return;
  }

  const groupItems = groups.map(group => ({
    label: group.name,
    description: group.description,
    group
  }));

  const selectedGroup = await vscode.window.showQuickPick(groupItems, {
    placeHolder: 'Select a group to move the breakpoint to'
  });

  if (selectedGroup) {
    // Remove from current group if it exists
    const currentGroup = breakpointManager.getGroupForBreakpoint(element.breakpointId);
    if (currentGroup) {
      breakpointManager.removeBreakpointFromGroup(element.breakpointId, currentGroup.id);
    }

    // Add to new group
    breakpointManager.addBreakpointToGroup(element.breakpointId, selectedGroup.group.id);
    vscode.window.showInformationMessage(`Moved breakpoint to group: ${selectedGroup.group.name}`);
  }
}

async function moveSelectedBreakpointsToGroup() {
  // Get the tree view selection
  const selection = treeView.selection;
  const breakpointItems = selection.filter(item => 
    item instanceof BreakpointItem || item instanceof UngroupedBreakpointItem
  ) as (BreakpointItem | UngroupedBreakpointItem)[];

  if (breakpointItems.length === 0) {
    vscode.window.showWarningMessage('No breakpoints selected. Select one or more breakpoints first.');
    return;
  }

  const groups = breakpointManager.getGroups();
  if (groups.length === 0) {
    vscode.window.showWarningMessage('No groups exist. Create one first.');
    return;
  }

  const groupItems = groups.map(group => ({
    label: group.name,
    description: group.description,
    group
  }));

  const selectedGroup = await vscode.window.showQuickPick(groupItems, {
    placeHolder: `Select a group to move ${breakpointItems.length} breakpoint(s) to`
  });

  if (selectedGroup) {
    let movedCount = 0;
    
    for (const breakpointItem of breakpointItems) {
      // Remove from current group if it exists
      const currentGroup = breakpointManager.getGroupForBreakpoint(breakpointItem.breakpointId);
      if (currentGroup) {
        breakpointManager.removeBreakpointFromGroup(breakpointItem.breakpointId, currentGroup.id);
      }

      // Add to new group
      breakpointManager.addBreakpointToGroup(breakpointItem.breakpointId, selectedGroup.group.id);
      movedCount++;
    }

    vscode.window.showInformationMessage(`Moved ${movedCount} breakpoint(s) to group: ${selectedGroup.group.name}`);
  }
}

export function deactivate() {
  console.log('Breakpoint Bucket extension is now deactivated');
}
