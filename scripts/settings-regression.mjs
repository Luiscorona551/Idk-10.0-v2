import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../apps.js', import.meta.url), 'utf8');
const required = [
  "settings:",
  "data-settings-panel",
  "data-settings-tab",
  "data-settings-panel='general'",
  "data-settings-panel='appearance'",
  "data-settings-panel='system'",
  "data-settings-panel='privacy'",
  "Settings",
  "Appearance",
  "System & Recovery",
  "Privacy & Security"
];
const forbidden = [
  "IDK Quick Settings",
  "Personalization Packs"
];
for (const value of required) {
  if (!source.includes(value)) throw new Error('Settings regression: missing ' + value);
}
for (const value of forbidden) {
  if (source.includes(value)) throw new Error('Settings regression: legacy surface still present: ' + value);
}
if (!/const showTab = id =>/.test(source)) throw new Error('Settings regression: tab controller missing');
if (!/showTab\(requestedTab\)/.test(source)) throw new Error('Settings regression: initial tab selection missing');
console.log('Settings regression smoke test passed.');
