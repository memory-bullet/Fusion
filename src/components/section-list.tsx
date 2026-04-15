import clsx from "clsx";

type SectionItem = {
  id: string;
  title: string;
  subtitle?: string;
};

export function SectionList({
  title,
  items,
  activeId,
  onSelect
}: {
  title: string;
  items: SectionItem[];
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section>
      <h3 className="mb-3 text-2xl font-semibold tracking-tight">{title}</h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={clsx(
              "line-card w-full border px-4 py-4 text-left transition",
              activeId === item.id ? "bg-slate-50" : "hover:bg-slate-50"
            )}
          >
            <div className="text-base font-medium">{index + 1} {item.title}</div>
            {item.subtitle ? <div className="mt-2 text-sm text-muted">{item.subtitle}</div> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
