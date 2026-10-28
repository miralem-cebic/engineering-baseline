# C# projects

The `csharp` ecosystem approximates what Rust guarantees at compile time with the strictest compiler and analyzer
settings the .NET SDK offers: no unsafe code, nullable references, checked arithmetic, every warning an error, banned
APIs, reproducible restore. The rules are `CSH-001..018` (see [generated rules](../rules/generated/csh.md)); all are
`proposed` until a second project has used them (ADR 4).

The first project measured is INI-Korrektur (Elementar Provisioning: a WPF tool for provisioning analyzers, .NET 10,
`local-only`). It passes every measurable `CSH` rule; its build settings are where rules 007..018 come from.

## Adopt it

1. `baseline.json`: `"ecosystems": ["csharp"]` and a topology.
2. Copy `templates/csharp/` to the solution root: `Directory.Build.props`, `Directory.Packages.props`,
   `BannedSymbols.txt`, `global.json`, `.editorconfig`. Merge by hand when the project has them already.
3. Move every `Version=` from the `.csproj` files into `Directory.Packages.props`.
4. Restore once (`dotnet restore`) and commit the generated `packages.lock.json` files; restore with `--locked-mode`
   from then on.
5. Name the local gate in `CLAUDE.md` and run it before every commit:

```bash
dotnet build MyApp.slnx -c Release                 # zero warnings, they are errors
dotnet test --solution MyApp.slnx
dotnet format MyApp.slnx --verify-no-changes
```

## What each rule is made of

| Rule | Setting or file |
|---|---|
| CSH-001, 002, 003, 004 | `Nullable`, `TreatWarningsAsErrors`, `AnalysisLevel` `latest-all`, `EnforceCodeStyleInBuild` |
| CSH-005 | `Directory.Packages.props` with `ManagePackageVersionsCentrally` |
| CSH-007, 008, 009 | `AllowUnsafeBlocks` `false`, `CheckForOverflowUnderflow`, `MSBuildTreatWarningsAsErrors` |
| CSH-010, 011 | `BannedApiAnalyzers`, `BannedSymbols.txt` with `DateTime.UtcNow`, `Task.Result`, `Task.Wait` |
| CSH-012, 013 | `RestorePackagesWithLockFile`, `NuGetAudit` + `NuGetAuditMode` `all` |
| CSH-014, 015 | `global.json`: `sdk.version`, `test.runner` |
| CSH-016, 017, 018 | no blanket `NoWarn`, a `[*.cs]` section in `.editorconfig`, `dotnet format --verify-no-changes` in the gate |

`templates/csharp/` is itself tested: `test/csharp-rules.test.js` requires that a project built from the template passes
every `CSH` rule and that each rule fails when its setting is flipped.

## Not measurable with the current checks

- NuGet lock files exist per project (`src/App/packages.lock.json`). `GEN-014` only looks at the repository root, so a
  C# solution fails it although it is locked. `CSH-012` checks the setting instead.
- `win-x64` publish settings, device-specific banned APIs (serial ports, files, processes outside adapter projects) and
  fitness tests are project decisions, not baseline rules. INI-Korrektur keeps them in its own
  `BannedSymbols.Core.txt` and engineering-rules document.
- Design rules (value objects instead of primitives, `Result<T>` for expected errors, `sealed` by default, no static
  mutable state) are reviewed, not measured. `CSH-006` stays `manual`.
