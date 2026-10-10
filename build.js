// Builds the other agents' versions of VT from the one source, skills/vt/SKILL.md:
//   gemini/commands/vt.toml + gemini/gemini-extension.json   Gemini CLI (/vt <answers>)
//   PROMPT.md                                                 paste into any agent's rules or custom instructions
// Claude Code (this folder is the plugin) and Codex (copy skills/vt to ~/.codex/skills/vt) read SKILL.md as it is.
//   node build.js
const fs = require("fs"), path = require("path");
const here = __dirname;
const src = fs.readFileSync(path.join(here, "skills", "vt", "SKILL.md"), "utf8").replace(/\r\n/g, "\n");
const fm = /^---\n([\s\S]*?)\n---\n/.exec(src);
const body = src.slice(fm[0].length).trim();
const desc = (/^description:\s*(.+)$/m.exec(fm[1]) || [])[1].trim();
const version = require("./.claude-plugin/plugin.json").version;

// Gemini CLI: {{args}} is what follows /vt.
const gem = body.replace("Their answers: $ARGUMENTS", "Their answers: {{args}}").replace(/\(If that line is empty[^)]*\)/, "(If that's empty, their answers are their latest message.)");
fs.mkdirSync(path.join(here, "gemini", "commands"), { recursive: true });
fs.writeFileSync(path.join(here, "gemini", "commands", "vt.toml"),
  `# Built from skills/vt/SKILL.md by build.js; edit that, not this.\ndescription = ${JSON.stringify(desc)}\nprompt = '''\n${gem}\n'''\n`);
fs.writeFileSync(path.join(here, "gemini", "gemini-extension.json"), JSON.stringify({ name: "vt", version, description: desc }, null, 2) + "\n");

// Anywhere else: a standing rule the agent applies whenever the user answers its questions in a few words.
const any = body.replace("The user typed short answers to questions you asked. Before you act,", "Whenever the user answers questions you asked with short replies (\"yes\", \"no\", \"not yet\", \"yes / no\"), before you act,")
  .replace(/ Their answers: \$ARGUMENTS\n\n\(If that line is empty[^)]*\)\n/, "\n");
fs.writeFileSync(path.join(here, "PROMPT.md"), `<!-- Built from skills/vt/SKILL.md by build.js; edit that, not this. Paste everything below into your agent's rules, AGENTS.md or custom instructions. -->\n\n${any}\n`);
console.log("built gemini/commands/vt.toml, gemini/gemini-extension.json, PROMPT.md");
