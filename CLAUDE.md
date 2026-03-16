# Lab

Collection of small, self-contained working examples. Each subfolder proves one concept with minimal, runnable code. Designed for future recall and recombination with coding agents.

## Conventions
- One folder per experiment, named descriptively (kebab-case)
- Every experiment has a README.md with these sections:
  - **What it proves** — the concept being demonstrated
  - **Concepts involved** — key ideas, patterns, or technologies the experiment touches
  - **Mental model** — your understanding of how it works *before* building (fill in before you start)
  - **How to run** — exact commands to execute the experiment
- No shared dependencies between experiments — each is self-contained

## Optional Artifacts
- **WALKTHROUGH.md** — A linear walkthrough of the experiment produced after building. File-by-file in reading order, each section explains what the file does, why it exists, and how it connects to the rest. Useful for any experiment with more than one or two files.
- **Interactive explanations** — For concepts that resist text explanation (request flows, state machines, data transformations), a self-contained HTML file that visualizes the concept. No build step, no dependencies — just open in a browser. Store as `explain-<concept>.html` in the experiment folder.

## Workflow
- When creating a new experiment: create folder, fill in README mental model section, write working code, produce WALKTHROUGH.md if multi-file, fill in README "what you learned" and "questions" sections, update the root README index table
- When building something new: check existing experiments for reusable prior art
- When an experiment elsewhere proves useful, move/copy it here with its own folder
