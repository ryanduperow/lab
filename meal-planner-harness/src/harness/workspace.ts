import fs from "node:fs";
import path from "node:path";

export class Workspace {
  constructor(private dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }

  get path(): string {
    return this.dir;
  }

  resolve(filename: string): string {
    return path.join(this.dir, filename);
  }

  readArtifact<T>(filename: string): T {
    const content = fs.readFileSync(this.resolve(filename), "utf-8");
    return JSON.parse(content) as T;
  }

  writeArtifact(filename: string, data: unknown): void {
    fs.writeFileSync(this.resolve(filename), JSON.stringify(data, null, 2));
  }

  writeText(filename: string, content: string): void {
    fs.writeFileSync(this.resolve(filename), content);
  }
}
