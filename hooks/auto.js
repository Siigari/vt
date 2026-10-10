#!/usr/bin/env node
// VT auto mode, a Claude Code UserPromptSubmit hook. When Claude's last message asked questions and the user's reply
// is short, it tells Claude to read the reply with the vt skill before acting. Otherwise it does nothing.
// Off: set VT_AUTO=0 in the environment. Never blocks a prompt; any error just lets the prompt through.
const fs = require("fs");

const MAX_REPLY = 160;   // characters: longer replies are real instructions, not shorthand

function lastAssistantText(file) {
  let lines;
  try {
    const size = fs.statSync(file).size, n = Math.min(size, 2 * 1024 * 1024), fd = fs.openSync(file, "r"), buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, size - n); fs.closeSync(fd);
    lines = buf.toString("utf8").split("\n");
  } catch { return ""; }
  for (let i = lines.length - 1; i >= 0; i--) {
    let ev; try { ev = JSON.parse(lines[i]); } catch { continue; }
    if (ev.type === "user" && ev.message && typeof ev.message.content === "string") return "";   // the user spoke after it
    if (ev.type !== "assistant" || !ev.message || ev.isSidechain) continue;
    const text = (ev.message.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
    if (text) return text;
  }
  return "";
}
// Questions: a numbered or bulleted item with a "?" in it, a line ending in "?", or a questions / needs section,
// in the closing part of the message.
function asksQuestions(text) {
  const tail = text.slice(-2500);
  return /^\s*(\*\*)?(\d{1,2}[.)]|[-*•])\s[^\n]*\?/m.test(tail)
    || /\?\s*(\*\*)?\s*$/m.test(tail)
    || /^(\s*[-*]?\s*(\*\*)?)?(questions?|needs (you|your (call|input|answer))|open questions|decisions?( for you)?)\b[^\n]*:/im.test(tail);
}

let input = "";
process.stdin.on("data", (d) => { input += d; });
const debug = (what) => { if (process.env.VT_DEBUG) try { fs.appendFileSync(process.env.VT_DEBUG, new Date().toISOString() + " " + what + "\n"); } catch {} };
process.stdin.on("end", () => {
  try {
    if (process.env.VT_AUTO === "0") return;
    const h = JSON.parse(input || "{}");
    const prompt = String(h.prompt != null ? h.prompt : h.user_prompt || "").trim();
    if (!prompt || prompt.length > MAX_REPLY || /^\//.test(prompt)) return;
    const last = h.transcript_path ? lastAssistantText(h.transcript_path) : "";
    debug(`keys=${Object.keys(h).join(",")} prompt=${JSON.stringify(prompt)} transcript=${h.transcript_path} last=${last.length} asks=${asksQuestions(last)}`);
    if (!last || !asksQuestions(last)) return;
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "VT (Vibecoder Translator): this message looks like short answers to the questions in your last message. Before acting, use the vt skill: spell each answer out faithfully (show the \"VT read your answers as:\" block, or check the unclear ones with the user), then act on them. If it isn't answering your questions, ignore this note.",
      },
    }));
  } catch {}
});
