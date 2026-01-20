export const themes = [
    { value: 'default', label: 'Default', color: '#0085D0' },
    { value: 'dracula', label: 'Dracula (Dark)', color: '#bd93f9' },
] as const;

export type ThemeValue = typeof themes[number]['value'];
