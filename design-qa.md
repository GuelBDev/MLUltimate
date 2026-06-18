# Design QA

## Scope

- Provider choice dialog for merged Modrinth and CurseForge results.
- Active download count in the sidebar.
- Desktop and compact sidebar states.

## Verification

- The provider dialog uses the existing dark theme, spacing, borders, shadows, and motion language.
- Modrinth and CurseForge are visually distinct with recognizable brand icons and colors.
- Both provider cards remain readable and clickable in the tested compact desktop window.
- The dialog appears from the Library, instance Add Content flow, project details, and version rows.
- The Downloads badge appears only while a task is queued or running and disappears after completion.
- A real resource-pack download displayed `1` in the badge; the test content was removed afterward.

final result: passed
