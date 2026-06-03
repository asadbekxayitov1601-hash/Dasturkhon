import { useRef } from 'react';
import { Plus, X } from 'lucide-react';

interface ListInputProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}

/**
 * Telegram-poll-style list editor: each entry is its own input row that can be
 * removed; Enter adds the next row, Backspace on an empty row removes it, and an
 * "Add" button appends a new one.
 */
export function ListInput({ items, onChange, placeholder, addLabel = 'Add' }: ListInputProps) {
  const rows = items.length ? items : [''];
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (i: number, val: string) => {
    const next = [...rows];
    next[i] = val;
    onChange(next);
  };

  const add = (focusIndex?: number) => {
    onChange([...rows, '']);
    if (focusIndex !== undefined) {
      requestAnimationFrame(() => refs.current[focusIndex]?.focus());
    }
  };

  const remove = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    onChange(next.length ? next : ['']);
  };

  return (
    <div className="space-y-2">
      {rows.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 text-center text-xs font-semibold text-gray-400 shrink-0">{i + 1}</span>
          <input
            ref={(el) => (refs.current[i] = el)}
            value={item}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(i + 1);
              } else if (e.key === 'Backspace' && item === '' && rows.length > 1) {
                e.preventDefault();
                remove(i);
                requestAnimationFrame(() => refs.current[Math.max(0, i - 1)]?.focus());
              }
            }}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            aria-label="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => add(rows.length)}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-1"
      >
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}
