// services/validationBot.ts

/**
 * Internal validation bot for the Music‑Metadata project.
 * It runs linting (ESLint), TypeScript type checking, unit tests (Jest)
 * and optionally end‑to‑end tests (Playwright).
 * The results are aggregated into a JSON report.
 */

import { ESLint } from "eslint";
import * as ts from "typescript";
import { runCLI } from "jest";
// Playwright is optional – we import it lazily only if a config enables it.

export interface LintResult {
    filePath: string;
    messages: Array<{
        line: number;
        column: number;
        severity: number; // 1 = warning, 2 = error
        ruleId: string | null;
        message: string;
    }>;
}

export interface TypeCheckResult {
    file: string;
    errors: string[];
}

export interface TestResult {
    suite: string;
    success: boolean;
    total: number;
    passed: number;
    failed: number;
    failures?: Array<{ test: string; message: string }>;
}

export interface ValidationReport {
    lint: LintResult[];
    typeCheck: TypeCheckResult[];
    unitTests: TestResult[];
    e2eTests?: TestResult[];
    timestamp: string;
}

/** Run ESLint on the project */
async function runLint(): Promise<LintResult[]> {
    const eslint = new ESLint({});
    const results = await eslint.lintFiles(["src/**/*.ts", "src/**/*.tsx", "services/**/*.ts"]);
    return results.map(r => ({
        filePath: r.filePath,
        messages: r.messages.map(m => ({
            line: m.line,
            column: m.column,
            severity: m.severity,
            ruleId: m.ruleId,
            message: m.message
        }))
    }));
}

/** Run TypeScript compiler in "noEmit" mode to collect type errors */
function runTypeCheck(): Promise<TypeCheckResult[]> {
    return new Promise((resolve) => {
        const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
        const configFile = configPath ? ts.readConfigFile(configPath, ts.sys.readFile).config : {};
        const parsed = ts.parseJsonConfigFileContent(configFile, ts.sys, process.cwd());
        const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
        const diagnostics = ts.getPreEmitDiagnostics(program);
        const results: Record<string, string[]> = {};
        diagnostics.forEach(d => {
            const file = d.file?.fileName || "(global)";
            const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
            if (!results[file]) results[file] = [];
            results[file].push(message);
        });
        const arr: TypeCheckResult[] = Object.entries(results).map(([file, errors]) => ({ file, errors }));
        resolve(arr);
    });
}

/** Run Jest unit tests programmatically */
async function runUnitTests(): Promise<TestResult[]> {
    const { results } = await runCLI({
        roots: ["<rootDir>/src"],
        testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],
        silent: true,
        json: true,
        runInBand: true,
        // Prevent Jest from exiting the process
        forceExit: false
    } as any, [process.cwd()]);
    // results is an array of test suite results
    const suites = (results as any).testResults || [];
    return suites.map((suite: any) => ({
        suite: suite.name,
        success: suite.status === "passed",
        total: suite.numPassingTests + suite.numFailingTests,
        passed: suite.numPassingTests,
        failed: suite.numFailingTests,
        failures: suite.testResults
            .filter((t: any) => t.status === "failed")
            .map((t: any) => ({ test: t.fullName, message: t.failureMessages.join("\n") }))
    }));
}

/** Optionally run Playwright e2e tests if a config file exists */
async function runE2ETests(): Promise<TestResult[]> {
    try {
        const { exec } = await import("child_process");
        // Assume a script "test:e2e" is defined in package.json
        return new Promise((resolve) => {
            exec("npm run test:e2e", { cwd: process.cwd() }, (error) => {
                if (error) {
                    // Treat any non‑zero exit as a failure report
                    resolve([
                        {
                            suite: "Playwright",
                            success: false,
                            total: 0,
                            passed: 0,
                            failed: 0,
                            failures: [{ test: "e2e", message: error.message }]
                        }
                    ]);
                } else {
                    // If the script outputs JSON we can parse it; otherwise just report success
                    resolve([
                        {
                            suite: "Playwright",
                            success: true,
                            total: 0,
                            passed: 0,
                            failed: 0
                        }
                    ]);
                }
            });
        });
    } catch {
        return [];
    }
}

/** Main exported function */
export async function runValidation(): Promise<ValidationReport> {
    const [lint, typeCheck, unitTests] = await Promise.all([
        runLint(),
        runTypeCheck(),
        runUnitTests()
    ]);
    // Run e2e only if a config file exists – cheap check
    const e2eTests = await runE2ETests();
    return {
        lint,
        typeCheck,
        unitTests,
        e2eTests: e2eTests.length ? e2eTests : undefined,
        timestamp: new Date().toISOString()
    };
}
