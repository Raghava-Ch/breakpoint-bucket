# Breakpoint Bucket

A VS Code extension that allows you to group breakpoints and enable/disable them collectively or individually.

## Features

- **Create Breakpoint Buckets**: Organize your breakpoints into named groups
- **Bulk Operations**: Enable or disable all breakpoints in a group with a single click
- **Individual Control**: Still manage individual breakpoints within groups
- **Persistent Storage**: Groups and assignments are saved across VS Code sessions
- **Visual Management**: Dedicated sidebar panel for easy group management

## Usage

### Creating Groups

1. Open the "Breakpoint Groups" panel in the Explorer sidebar
2. Click the "+" button to create a new group
3. Enter a name and optional description for your group

### Adding Breakpoints to Groups

1. Right-click on any breakpoint in the Breakpoints panel
2. Select "Add to Group"
3. Choose the group you want to add the breakpoint to

### Managing Groups

- **Enable/Disable Group**: Right-click on a group and select "Enable Group" or "Disable Group"
- **Rename Group**: Right-click on a group and select "Rename Group"
- **Delete Group**: Right-click on a group and select "Delete Group"
- **Remove Breakpoint**: Right-click on a breakpoint within a group and select "Remove from Group"

## Commands

- `Breakpoint Groups: Create New Group` - Create a new breakpoint group
- `Breakpoint Groups: Add to Group` - Add selected breakpoint to a group
- `Breakpoint Groups: Enable Group` - Enable all breakpoints in a group
- `Breakpoint Groups: Disable Group` - Disable all breakpoints in a group
- `Breakpoint Groups: Delete Group` - Delete a breakpoint group
- `Breakpoint Groups: Rename Group` - Rename a breakpoint group

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 to run the extension in a new Extension Development Host window

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package extension
vsce package
```

## Requirements

- VS Code 1.74.0 or higher
- Node.js 16.x or higher

## License

MIT
