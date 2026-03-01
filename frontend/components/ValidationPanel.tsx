// components/ValidationPanel.tsx

import React, { useState } from 'react';
import { ValidationReport } from '../services/validationBot';

const getEnv = (key: string): string => {
    // @ts-ignore
    return (import.meta.env && import.meta.env[key]) || (typeof process !== 'undefined' && process && process.env && process.env[key]) || "";
};

/**
 * Simple panel that triggers the internal validation bot and displays results.
 * It can be rendered as a modal or an inline drawer. For simplicity we render
 * it as a fixed‑position overlay that can be toggled via a button in the header.
 */
export const ValidationPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [report, setReport] = useState<ValidationReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runValidation = async () => {
        setLoading(true);
        setError(null);
        try {
            // Updated to call local Python backend instead of missing /api/ endpoint
            const res = await fetch('http://localhost:8888/system/validate', {
                method: 'GET'
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text.substring(0, 100) || 'Validation request failed');
            }
            const data = await res.json();
            setReport(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-light-card dark:bg-dark-card rounded-xl shadow-xl w-full max-w-2xl p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    aria-label="Close validation panel"
                >
                    ✕
                </button>
                <h2 className="text-xl font-semibold mb-4">Project Validation</h2>
                {loading && (
                    <div className="flex items-center space-x-2 mb-4">
                        <div className="w-4 h-4 border-2 border-accent-violet border-t-transparent rounded-full animate-spin" />
                        <span>Running validation…</span>
                    </div>
                )}
                {error && <div className="text-red-600 mb-4">Error: {error}</div>}
                {!report && !loading && (
                    <button
                        onClick={runValidation}
                        className="px-4 py-2 bg-accent-violet text-white rounded hover:bg-accent-violet/80 transition"
                    >
                        Run Validation
                    </button>
                )}
                {report && (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {/* Lint results */}
                        <section>
                            <h3 className="font-medium mb-2">Lint ({report.lint.reduce((c, r) => c + r.messages.length, 0)} issues)</h3>
                            {report.lint.map((file, i) => (
                                <details key={i} className="mb-2">
                                    <summary className="cursor-pointer text-sm text-slate-600 dark:text-slate-400">
                                        {file.filePath}
                                    </summary>
                                    <ul className="ml-4 list-disc text-xs">
                                        {file.messages.map((msg, j) => (
                                            <li key={j} className={msg.severity === 2 ? 'text-red-600' : 'text-yellow-600'}>
                                                Line {msg.line}, Col {msg.column}: {msg.message} {msg.ruleId && `(${msg.ruleId})`}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            ))}
                        </section>
                        {/* TypeScript check */}
                        <section>
                            <h3 className="font-medium mb-2">Type Check ({report.typeCheck.reduce((c, r) => c + r.errors.length, 0)} errors)</h3>
                            {report.typeCheck.map((file, i) => (
                                <details key={i} className="mb-2">
                                    <summary className="cursor-pointer text-sm text-slate-600 dark:text-slate-400">
                                        {file.file}
                                    </summary>
                                    <ul className="ml-4 list-disc text-xs text-red-600">
                                        {file.errors.map((e, j) => (
                                            <li key={j}>{e}</li>
                                        ))}
                                    </ul>
                                </details>
                            ))}
                        </section>
                        {/* Unit tests */}
                        <section>
                            <h3 className="font-medium mb-2">Unit Tests</h3>
                            {report.unitTests.map((suite, i) => (
                                <details key={i} className="mb-2">
                                    <summary className="cursor-pointer text-sm text-slate-600 dark:text-slate-400">
                                        {suite.suite} – {suite.success ? '✅ Passed' : '❌ Failed'} ({suite.passed}/{suite.total})
                                    </summary>
                                    {suite.failures && suite.failures.length > 0 && (
                                        <ul className="ml-4 list-disc text-xs text-red-600">
                                            {suite.failures.map((f, j) => (
                                                <li key={j}>{f.test}: {f.message}</li>
                                            ))}
                                        </ul>
                                    )}
                                </details>
                            ))}
                        </section>
                        {/* Optional e2e tests */}
                        {report.e2eTests && report.e2eTests.length > 0 && (
                            <section>
                                <h3 className="font-medium mb-2">End‑to‑End Tests</h3>
                                {report.e2eTests.map((suite, i) => (
                                    <details key={i} className="mb-2">
                                        <summary className="cursor-pointer text-sm text-slate-600 dark:text-slate-400">
                                            {suite.suite} – {suite.success ? '✅ Passed' : '❌ Failed'}
                                        </summary>
                                        {suite.failures && suite.failures.length > 0 && (
                                            <ul className="ml-4 list-disc text-xs text-red-600">
                                                {suite.failures.map((f, j) => (
                                                    <li key={j}>{f.test}: {f.message}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </details>
                                ))}
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ValidationPanel;
