# Delphi projects

The `delphi` ecosystem captures the small set of things a Delphi codebase needs so it can be built, diffed and picked up
by a new developer without surprises. The rules are `DEL-001..005` (see [generated rules](../rules/generated/del.md));
all are `proposed` until a second project has used them (ADR 4).

The first project measured is INI-Korrektur (Elementar provisioning/test-field tool, Delphi XE5 moving to RAD Studio 13,
~72 000 lines of VCL/Win32). It passes every measurable `DEL` rule; the rules exist because each one fixed a real
surprise during the XE5 to 13 upgrade.

Compared to C# or Python, Delphi gets very few rules. The reason is that Delphi has no equivalent of Roslyn analyzers
that run as part of the compiler: there is no `TreatWarningsAsErrors`-shaped switch, no banned-API analyzer, no central
package management. What the baseline can enforce from outside the IDE is the project layout, a .gitignore that keeps
IDE caches out, a .gitattributes that pins line endings, and a documented build command. That is what `DEL-001..005`
cover; anything deeper belongs in the project's own code review.

## Adopt it

1. `baseline.json`: `"ecosystems": ["delphi"]` and a topology (Delphi desktop tools are usually `local-only`). A Delphi
   project that also contains a .NET port under way may declare both ecosystems.
2. Copy `templates/delphi/.gitignore` and `templates/delphi/.gitattributes` to the repo root. Merge by hand when the
   project has them already; the key lines are `__history/`, `*.dcu`, and the `*.pas text eol=crlf` block.
3. Make sure the project has a `.dproj` (the MSBuild project file, Delphi 2007 and later). Open the `.dpr` in the
   Delphi IDE once; it writes the `.dproj` next to it.
4. In `CLAUDE.md` (or `README.md`), name the Delphi edition the project builds against, and the exact MSBuild command:

```batch
rem Put the Delphi tools into PATH
call "C:\Program Files (x86)\Embarcadero\Studio\23.0\bin\rsvars.bat"

rem Build (adjust for your .dproj and configuration)
MSBuild ini_korrektur1.dproj /p:config=Release /t:Build
```

   `rsvars.bat` lives under the Delphi install (version 23.0 above is RAD Studio 13; XE5 was 12.0, 11 is 22.0, 12 is
   22.0 too for Alexandria, etc.). Pinning this path per installed edition is what lets a pipeline reproduce the build.

## What each rule is made of

| Rule | Where it looks | What it checks |
|---|---|---|
| DEL-001 | `.gitignore` | `__history` line is present (templates/delphi/.gitignore) |
| DEL-002 | `.gitattributes` | `*.pas text eol=...` line is present (templates/delphi/.gitattributes) |
| DEL-003 | `*.dproj` files in `.`, `src/`, `legacy/` | an MSBuild `<Project ...>` root tag |
| DEL-004 | `CLAUDE.md` or `README.md` | names the Delphi edition (`Delphi 13`, `RAD Studio 13`, `Delphi XE5`, ...) |
| DEL-005 | `CLAUDE.md` or `README.md` | contains an `MSBuild ... .dproj` command |

`templates/delphi/` is itself tested: `test/delphi-rules.test.js` requires that a project built from the template plus
the documented CLAUDE.md lines passes every `DEL` rule, and that each rule fails when its setting is removed.

## What this ecosystem does not try to do yet

- **Banned units.** There is no cross-tree check that `.pas` files no longer `uses Outline`, `DirOutln`, `ColorGrd`,
  `Bde`, `Gauges`, `Spin`, or other units that were removed from Delphi between XE5 and 13. A rule like that needs a
  small Pascal-aware walker, which belongs in a follow-up. For now, the review catches it.
- **No hardcoded absolute paths in `.dproj`.** `DCC_UnitSearchPath` often holds `C:\Users\<name>\...` after an IDE
  session; a project that feeds a pipeline must move those to environment variables (`$(JCL_ROOT)`, `$(JVCL_ROOT)`,
  `$(ComPort_ROOT)`). This will come as a rule once the pipeline work on INI-Korrektur has settled.
- **BDE references.** `DbiTypes=BDE;DbiProcs=BDE;DbiErrs=BDE;` in a `.cfg` and `Bde` in the `.dproj` DCC_Namespace mark
  a pre-2005 project that has not been fully migrated. Again a follow-up, same reason.
- **Lock files.** Delphi has no ecosystem-wide lock file. Reproducible builds rely on pinning the `rsvars.bat` edition
  (DEL-005's hint) and vendoring third-party libraries like JCL/JVCL/ComPort per project.
- **Analyzer-shaped checks.** `AllowUnsafeBlocks`-shaped switches exist in Delphi only as scattered compiler directives
  (`{$POINTERMATH}`, `{$Q+}` for overflow). A rule cannot ask "is overflow checking on for the whole project" without
  parsing the `.dproj` configuration groups; that is out of scope here.
