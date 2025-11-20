// Plugin settings management for MarkdownEditor

export interface PluginSettings {
  tablePlugin: boolean;
  checkboxPlugin: boolean;
  bulletListPlugin: boolean;
  codeBlockPlugin: boolean;
  blockquotePlugin: boolean;
  predictTextPlugin: boolean;
  imagePlugin: boolean;
  spellCheck: boolean;
  combinedMarkdownPlugin: boolean;
  regexDecorationsPlugin: boolean;
  noteLinkStylingPlugin: boolean;
  customMarkdownPlugin: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
  tablePlugin: true,
  checkboxPlugin: true,
  bulletListPlugin: true,
  codeBlockPlugin: true,
  blockquotePlugin: true,
  predictTextPlugin: true,
  imagePlugin: true,
  spellCheck: true,
  combinedMarkdownPlugin: true,
  regexDecorationsPlugin: true,
  noteLinkStylingPlugin: true,
  customMarkdownPlugin: true,
};

const STORAGE_KEY = 'markdownPluginSettings';

export function getPluginSettings(): PluginSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to handle new plugins
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load plugin settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function savePluginSettings(settings: PluginSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save plugin settings:', e);
  }
}

export function updatePluginSetting(key: keyof PluginSettings, value: boolean): void {
  const settings = getPluginSettings();
  settings[key] = value;
  savePluginSettings(settings);
}

export const PLUGIN_LABELS: Record<keyof PluginSettings, string> = {
  tablePlugin: 'Table Formatting',
  checkboxPlugin: 'Task Checkboxes',
  bulletListPlugin: 'Bullet Lists',
  codeBlockPlugin: 'Code Blocks',
  blockquotePlugin: 'Blockquotes',
  predictTextPlugin: 'Text Prediction',
  imagePlugin: 'Image Support',
  spellCheck: 'Spell Checking',
  combinedMarkdownPlugin: 'Markdown Headers',
  regexDecorationsPlugin: 'Syntax Highlighting',
  noteLinkStylingPlugin: 'Note Link Styling',
  customMarkdownPlugin: 'Custom Markdown',
};

export const PLUGIN_DESCRIPTIONS: Record<keyof PluginSettings, string> = {
  tablePlugin: 'Enable markdown table formatting and rendering',
  checkboxPlugin: 'Enable interactive task checkboxes in lists',
  bulletListPlugin: 'Enable automatic bullet list formatting',
  codeBlockPlugin: 'Enable code block syntax highlighting',
  blockquotePlugin: 'Enable blockquote formatting',
  predictTextPlugin: 'Enable AI-powered text prediction',
  imagePlugin: 'Enable image paste, drag-drop, and rendering',
  spellCheck: 'Enable native spell checking',
  combinedMarkdownPlugin: 'Enable header styling and markdown syntax',
  regexDecorationsPlugin: 'Enable regex-based decorations',
  noteLinkStylingPlugin: 'Enable styling for [[note]] links',
  customMarkdownPlugin: 'Enable custom markdown extensions',
};
