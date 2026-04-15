"use client";

import { useState } from "react";

type Message = {
  role: "assistant" | "user";
  text: string;
};

export function AIMessagePanel({
  onGenerate,
  onParse,
  onExtractFile
}: {
  onGenerate: (text: string) => Promise<void>;
  onParse: (text: string) => Promise<void>;
  onExtractFile: (file: File) => Promise<string>;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Paste assignment brief here. I can generate shared context and assign tasks evenly." }
  ]);

  async function handleParse() {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: input }]);
    await onParse(input);
    setMessages((prev) => [...prev, { role: "assistant", text: "Shared context updated." }]);
    setInput("");
  }

  async function handleGenerate() {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: input }]);
    await onGenerate(input);
    setMessages((prev) => [...prev, { role: "assistant", text: "Tasks generated and auto-assigned." }]);
    setInput("");
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extracted = await onExtractFile(file);
    setInput((prev) => [prev, extracted].filter(Boolean).join("\n\n"));
    setMessages((prev) => [...prev, { role: "assistant", text: `Extracted text from ${file.name}.` }]);
    event.target.value = "";
  }

  return (
    <section className="line-card p-4">
      <div className="space-y-3">
        {messages.map((m, idx) => (
          <div
            key={`${m.role}-${idx}`}
            className={m.role === "assistant" ? "max-w-[82%] rounded-xl border border-line p-3 text-sm" : "ml-auto max-w-[82%] rounded-xl bg-slate-800 p-3 text-sm text-white"}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-full border border-line px-3 py-2">
        <input
          className="w-full border-0 bg-transparent text-sm outline-none"
          placeholder="Input assignment requirement..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={handleParse} className="rounded-full border border-line px-3 py-1 text-sm hover:bg-slate-50">
          Parse context
        </button>
        <button type="button" onClick={handleGenerate} className="rounded-full border border-accent bg-accent px-3 py-1 text-sm text-white">
          Generate + assign
        </button>
        <label className="cursor-pointer rounded-full border border-line px-3 py-1 text-sm hover:bg-slate-50">
          Upload file
          <input
            type="file"
            className="hidden"
            accept=".txt,.md,.markdown,.pdf,.docx,.html,.htm,image/*"
            onChange={handleFileSelect}
          />
        </label>
      </div>
    </section>
  );
}
