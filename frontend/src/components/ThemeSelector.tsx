import { CheckCircle } from 'lucide-react';
import { useApp } from '../store';
import { themes } from '../constants/themes';

export function ThemeSelector() {
    const { theme, setTheme } = useApp();

    return (
        <div className="grid grid-cols-5 gap-3">
            {themes.map(t => (
                <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${theme === t.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                        }`}
                >
                    <div
                        className="w-6 h-6 rounded-full border-2 border-slate-600 relative"
                        style={{ backgroundColor: t.color }}
                    >
                        {theme === t.value && (
                            <CheckCircle className="w-4 h-4 text-white absolute -top-1 -right-1" />
                        )}
                    </div>
                    <span className="text-xs text-slate-400">{t.label}</span>
                </button>
            ))}
        </div>
    );
}
