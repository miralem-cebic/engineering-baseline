export type Level = 'must' | 'should' | 'proposed';

export type Ecosystem = 'typescript' | 'react' | 'postgres' | 'swift' | 'kotlin' | 'csharp' | 'python';

export type Topology = 'local-only' | 'hosted-no-db' | 'hosted-db';

export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type Expected = JsonValue | { readonly exists: true } | { readonly oneOf: readonly JsonValue[] };

export type Check =
  | { readonly type: 'manual' }
  | { readonly type: 'file-exists'; readonly paths: readonly string[] }
  | {
      readonly type: 'file-contains';
      readonly paths: readonly string[];
      readonly pattern: string;
      readonly flags?: string;
    }
  | {
      readonly type: 'file-not-contains';
      readonly paths: readonly string[];
      readonly pattern: string;
      readonly flags?: string;
    }
  | {
      readonly type: 'json-value';
      readonly files: readonly string[];
      readonly path: string;
      readonly expected: Expected;
      readonly resolveExtends?: boolean;
    }
  | { readonly type: 'package-script'; readonly scripts: readonly string[]; readonly pattern?: string }
  | { readonly type: 'package-dependency'; readonly names: readonly string[] }
  | { readonly type: 'dir-unique-prefix'; readonly dirs: readonly string[]; readonly prefix: string }
  | { readonly type: 'sql-tables-have-rls'; readonly dirs: readonly string[] }
  | { readonly type: 'eslint-rule'; readonly rule: string }
  | { readonly type: 'max-lines'; readonly path: string; readonly max: number }
  | {
      readonly type: 'repo-contains';
      readonly dirs: readonly string[];
      readonly exts: readonly string[];
      readonly pattern: string;
      readonly flags?: string;
    };

export type CheckType = Check['type'];

export interface Rule {
  readonly id: string;
  readonly title: string;
  readonly rationale: string;
  readonly level: Level;
  readonly since: string;
  readonly ecosystems?: readonly Ecosystem[];
  readonly topologies?: readonly Topology[];
  readonly checks: readonly Check[];
  readonly hint?: string;
}

export type Status = 'pass' | 'fail' | 'skip' | 'manual' | 'waived';

export interface CheckResult {
  readonly status: 'pass' | 'fail' | 'skip' | 'manual';
  readonly detail: string;
}

export interface RuleResult {
  readonly rule: Rule;
  readonly status: Status;
  readonly details: readonly string[];
}

export interface Fs {
  readText(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
  list(dir: string): Promise<string[] | null>;
  walk(dir: string, exts: readonly string[]): Promise<string[]>;
}

export interface EslintPort {
  printConfig(sampleFile: string): Promise<Result<Record<string, unknown>>>;
}

export interface Context {
  readonly fs: Fs;
  readonly eslint: EslintPort;
  readonly now: Date;
}

export interface Waiver {
  readonly rule: string;
  readonly reason: string;
  readonly expires: string;
}

export interface ProjectConfig {
  readonly baseline: string;
  readonly ecosystems: readonly Ecosystem[];
  readonly topology: Topology;
  readonly waivers: readonly Waiver[];
}
