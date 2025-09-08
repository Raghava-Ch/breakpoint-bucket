import * as vscode from 'vscode';
import { BreakpointManager } from './breakpointManager';
import { BreakpointGroupsProvider } from './treeProvider';
import { BreakpointGroupItem, BreakpointItem, UngroupedBreakpointItem } from './types';

let breakpointManager: BreakpointManager;
let treeProvider: BreakpointGroupsProvider;

export function activate(context: vscode.ExtensionContext) {
  console.log('Breakpoint Groups extension is now active!');

  // Initialize services
  breakpointManager = new BreakpointManager(context);
  treeProvider = new BreakpointGroupsProvider(breakpointManager);

  // Register tree view
  const treeView = vscode.window.createTreeView('breakpointGroups', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
    canSelectMany: false,
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
    vscode.commands.registerCommand('breakpointGroups.createGroup', createGroup),
    vscode.commands.registerCommand('breakpointGroups.addToGroup', addToGroup),
    vscode.commands.registerCommand('breakpointGroups.removeFromGroup', removeFromGroup),
    vscode.commands.registerCommand('breakpointGroups.enableGroup', enableGroup),
    vscode.commands.registerCommand('breakpointGroups.disableGroup', disableGroup),
    vscode.commands.registerCommand('breakpointGroups.deleteGroup', deleteGroup),
    vscode.commands.registerCommand('breakpointGroups.renameGroup', renameGroup),
    vscode.commands.registerCommand('breakpointGroups.enableBreakpoint', enableBreakpoint),
    vscode.commands.registerCommand('breakpointGroups.disableBreakpoint', disableBreakpoint),
    vscode.commands.registerCommand('breakpointGroups.createGroupFromBreakpoint', createGroupFromBreakpoint)
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

export function deactivate() {
  console.log('Breakpoint Groups extension is now deactivated');
}
