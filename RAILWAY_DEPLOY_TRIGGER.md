# Railway deployment trigger

Latest IDK 10.0 deployment is on the main branch.

Actual desktop grid fix: the final icon-grid script now continuously watches for newly rendered apps, removes the duplicate Apps shortcut, and places every desktop icon into a fixed two-column grid with enough row height to prevent labels from overlapping. Old saved icon coordinates are cleared so they cannot override the layout.
