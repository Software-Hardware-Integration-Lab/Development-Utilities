import { SourceMap, type SourceMapPayload } from 'node:module';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

/** Summary of covered and total items. */
interface CoverageSummary {
    /** Number of covered items. */
    'covered': number;
    /** Total number of items. */
    'total': number;
}

/** Per-line hit state stored for generated source lines. */
interface LineStatus {
    /** Indicates the line was covered. */
    'covered': boolean;
    /** Indicates the line was uncovered. */
    'uncovered': boolean;
}

/** Single branch hit entry from LCOV. */
interface BranchHit {
    /** Source line number for the branch. */
    'lineNumber': number;
    /** Number of hits for the branch. */
    'hits': number;
}

/** Parsed LCOV record for one generated JavaScript file. */
interface LcovRecord {
    /** Branch hit records for the file. */
    'branches': BranchHit[];
    /** Function hit counts for the file. */
    'functions': number[];
    /** Generated JavaScript file path. */
    'jsFile': string;
    /** Line hit tuples in the form [lineNumber, hits]. */
    'lines': [number, number][];
}

/** Coverage bucket for a mapped source file. */
interface FileCoverage {
    /** Aggregate branch coverage. */
    'branchTotals': CoverageSummary;
    /** Branch hit collections grouped by source line. */
    'branchesByLine': Map<number, number[]>;
    /** Output HTML path for the file page. */
    'filePagePath': string;
    /** Aggregate function coverage. */
    'functionTotals': CoverageSummary;
    /** Generated JavaScript file path. */
    'jsFile': string;
    /** Line hit states keyed by source line number. */
    'lineHits': Map<number, LineStatus>;
    /** Aggregate line coverage. */
    'lineTotals': CoverageSummary;
    /** Source path relative to the workspace root. */
    'relativeSourcePath': string;
    /** Absolute original source file path. */
    'sourcePath': string;
}

/** Aggregated counts for a directory tree node. */
interface CoverageTreeSummary {
    /** Aggregate branch coverage. */
    'branches': CoverageSummary;
    /** Number of files contained in the node. */
    'files': number;
    /** Aggregate function coverage. */
    'functions': CoverageSummary;
    /** Aggregate line coverage. */
    'lines': CoverageSummary;
}

/** Directory tree node used to render report pages. */
interface CoverageTreeNode {
    /** Aggregated coverage counts for the node. */
    'aggregate': CoverageTreeSummary;
    /** Child nodes keyed by path segment. */
    'children': Map<string, CoverageTreeNode>;
    /** File data when this node represents a file. */
    'file'?: FileCoverage;
    /** Display name of the node. */
    'name': string;
    /** Absolute output path for the node page. */
    'pagePath': string;
    /** Path relative to the tree root. */
    'relativePath': string;
    /** Node kind used for rendering. */
    'type': 'root' | 'directory' | 'file';
}

/** Minimal origin information returned by the source map lookup. */
interface SourceOriginLike {
    /** Original source file name. */
    'fileName'?: string;
    /** Original source line number. */
    'lineNumber'?: number;
}

/*
 * Coverage report data shapes are documented inline in the helpers below.
 */

/**
 * Root directory used to resolve source files and write the report output.
 */
const workspaceRoot = process.cwd();

/**
 * CLI arg value helper for options in the form --name=value.
 * @param name Name of the CLI argument.
 * @returns The value of the CLI argument, or null if not found.
 */
function getCliArgValue(name: string): string | null {
    /** Prefix used to identify the CLI argument. */
    const prefix = `--${ name }=`;

    /** CLI argument matching the prefix. */
    const match = process.argv.find((argument: string) => argument.startsWith(prefix));

    // The argument value is the suffix after the prefix, or null if no matching argument was found.
    if (!match) {
        return null;
    }

    /** Extracted value of the CLI argument. */
    const value = match.slice(prefix.length).trim();

    // An empty value is treated as null to allow --name= to unset defaults.
    return value.length > 0 ? value : null;
}

/**
 * Output directory for the generated HTML coverage site.
 */
const outputRoot = path.resolve(workspaceRoot, 'coverage', 'html');

/**
 * Node executable used to run the test suite in coverage mode.
 */
const testCommand = process.execPath;

/** Override include glob for scoped coverage runs. */
const coverageIncludePattern = getCliArgValue('include') ?? 'bin/src/**/*.js';

/** Override exclude glob for scoped coverage runs. */
const coverageExcludePattern = getCliArgValue('exclude') ?? 'bin/test/**';

/** Override test glob/file for scoped coverage runs. */
const testTargetPattern = getCliArgValue('tests') ?? 'bin/test/**/*.test.js';

/**
 * LCOV and spec reporter configuration for the Node test runner.
 */
const testArgs = [
    '--test',
    '--experimental-test-coverage',
    '--test-reporter=lcov',
    '--test-reporter-destination=stdout',
    '--test-reporter=spec',
    '--test-reporter-destination=stderr',
    `--test-coverage-include=${ coverageIncludePattern }`,
    `--test-coverage-exclude=${ coverageExcludePattern }`,
    testTargetPattern
];

/**
 * Spawns the test runner and captures its LCOV output.
 */
const child = spawn(testCommand, testArgs, {
    'cwd': workspaceRoot,
    'env': process.env,
    'stdio': ['ignore', 'pipe', 'inherit']

});

/**
 * Accumulates the LCOV text emitted by the test runner.
 */
let lcovOutput = '';

child.stdout.setEncoding('utf8');

child.stdout.on('data', (chunk: string) => {
    lcovOutput += chunk;
});

/**
 * Parses the LCOV stream produced by the Node test runner.
 * @param lcovText Raw LCOV output.
 * @returns Parsed coverage records.
 */
function parseLcov(lcovText: string): LcovRecord[] {
    /** Parsed LCOV records accumulated from the input stream. */
    const records: LcovRecord[] = [];

    /** LCOV record currently being assembled. */
    let currentRecord: LcovRecord | null = null;

    for (const line of lcovText.split(/\r?\n/u)) {
        if (line.startsWith('SF:')) {
            currentRecord = {
                'branches': [],
                'functions': [],
                'jsFile': line.slice(3).trim(),
                'lines': []
            };
        } else if (line === 'end_of_record') {
            if (currentRecord) {
                records.push(currentRecord);
            }

            currentRecord = null;
        } else if (currentRecord) {
            if (line.startsWith('DA:')) {
                /** Source line number from the LCOV line-hit entry. */
                const [lineNumberText, hitsText] = line.slice(3).split(',');

                /** Parsed source line number. */
                const lineNumber = Number.parseInt(lineNumberText, 10);

                /** Parsed hit count for the source line. */
                const hits = Number.parseInt(hitsText, 10);

                if (!Number.isNaN(lineNumber) && !Number.isNaN(hits)) {
                    currentRecord.lines.push([lineNumber, hits]);
                }
            } else if (line.startsWith('BRDA:')) {
                /** LCOV branch fields split by comma. */
                const parts = line.slice(5).split(',');

                /** Parsed source line number for the branch. */
                const lineNumber = Number.parseInt(parts[0], 10);

                /** Raw branch hit count token. */
                const [, , , hitsText] = parts;

                /** Parsed hit count for the branch. */
                const hits = hitsText === '-' ? 0 : Number.parseInt(hitsText, 10);

                if (!Number.isNaN(lineNumber) && !Number.isNaN(hits)) {
                    currentRecord.branches.push({
                        hits,
                        lineNumber
                    });
                }
            } else if (line.startsWith('FNDA:')) {
                /** Function hit count token from the LCOV entry. */
                const [hitsText] = line.slice(5).split(',');

                /** Parsed hit count for the function. */
                const hits = Number.parseInt(hitsText, 10);

                if (!Number.isNaN(hits)) {
                    currentRecord.functions.push(hits);
                }
            }
        }
    }

    return records;
}

/**
 * Extracts the source map path from the generated JavaScript file footer.
 * @param jsFile Generated JavaScript file path.
 * @returns Source map path or null if none exists.
 */
async function findSourceMapPath(jsFile: string): Promise<string | null> {
    /** Generated JavaScript source text. */
    const jsText = await readFile(jsFile, 'utf8');

    /** Match for the sourceMappingURL footer. */
    const sourceMapMatch = (/\/\/[#@][\t ]sourceMappingURL=(?<sourceMapUrl>.+)$/mu).exec(jsText);

    if (!sourceMapMatch) {
        return null;
    }

    /** Source map URL extracted from the footer comment. */
    const sourceMapUrl = sourceMapMatch.groups?.['sourceMapUrl'];

    if (!sourceMapUrl) {
        return null;
    }

    if (sourceMapUrl.startsWith('data:')) {
        return null;
    }

    return path.resolve(path.dirname(jsFile), sourceMapUrl);
}

/**
 * Loads the source map that corresponds to a generated JavaScript file.
 * @param jsFile Generated JavaScript file path.
 * @returns Parsed source map or null if none exists.
 */
async function loadSourceMap(jsFile: string): Promise<SourceMap | null> {
    /** Source map file path resolved from the generated JS file. */
    const sourceMapPath = await findSourceMapPath(jsFile);

    if (!sourceMapPath) {
        return null;
    }

    /** Raw source map JSON text. */
    const sourceMapText = await readFile(sourceMapPath, 'utf8');

    /** Parsed source map payload. */
    const sourceMapPayload = JSON.parse(sourceMapText) as SourceMapPayload;

    return new SourceMap(sourceMapPayload);
}

/**
 * Normalizes path separators so comparisons and links stay stable.
 * @param filePath Path to normalize.
 * @returns Normalized path.
 */
function normalizePath(filePath: string): string {
    return path.normalize(filePath);
}

/**
 * Resolves a source map entry to an absolute on-disk source path.
 * @param jsFile Generated JavaScript file path.
 * @param originalSource Source path from the source map.
 * @returns Absolute source file path.
 */
function resolveOriginalSourcePath(jsFile: string, originalSource: string): string {
    if (path.isAbsolute(originalSource)) {
        return originalSource;
    }

    return path.resolve(path.dirname(jsFile), originalSource);
}

/**
 * Creates the mutable coverage bucket for a single source file.
 * @param sourcePath Original source file path.
 * @param jsFile Generated JavaScript file path.
 * @returns Mutable coverage bucket for the source file.
 */
function createFileCoverage(sourcePath: string, jsFile: string): FileCoverage {
    /** Preserves the generated JavaScript file path for this coverage bucket. */
    const generatedJsFile = jsFile;

    /** Remembers the original source file path for this coverage bucket. */
    const originalSourcePath = sourcePath;

    return {
        'branchTotals': {
            'covered': 0,
            'total': 0
        },
        'branchesByLine': new Map<number, number[]>(),
        'filePagePath': '',
        'functionTotals': {
            'covered': 0,
            'total': 0
        },
        'jsFile': generatedJsFile,
        'lineHits': new Map<number, LineStatus>(),
        'lineTotals': {
            'covered': 0,
            'total': 0
        },
        'relativeSourcePath': '',
        'sourcePath': originalSourcePath
    };
}

/**
 * Returns an empty coverage summary object.
 * @returns Empty branch, line, and function coverage totals.
 */
function createEmptySummaryBundle(): CoverageTreeSummary {
    return {
        'branches': {
            'covered': 0,
            'total': 0
        },
        'files': 0,
        'functions': {
            'covered': 0,
            'total': 0
        },
        'lines': {
            'covered': 0,
            'total': 0
        }
    };
}

/**
 * Clones a simple covered/total summary.
 * @param summary Summary to clone.
 * @returns Cloned summary object.
 */
function cloneSummary(summary: CoverageSummary): CoverageSummary {
    return {
        'covered': summary.covered,
        'total': summary.total
    };
}

/**
 * Counts how many LCOV entries are covered versus total.
 * @param entries LCOV hit counts.
 * @returns Covered and total counts.
 */
function summarizeHits(entries: (number | [number, number])[]): CoverageSummary {
    /** Number of entries examined. */
    let total = 0;

    /** Number of covered entries. */
    let covered = 0;

    for (const entry of entries) {
        /** Hit count extracted from the LCOV entry. */
        const hits = typeof entry === 'number' ? entry : entry[1];

        total += 1;

        if (hits > 0) {
            covered += 1;
        }
    }

    return {
        covered,
        total
    };
}

/**
 * Collapses line hit state into covered and total line counts.
 * @param lineHits Per-line hit state.
 * @returns Covered and total counts.
 */
function summarizeLineHits(lineHits: Map<number, LineStatus>): CoverageSummary {
    /** Number of line entries examined. */
    let total = 0;

    /** Number of covered lines. */
    let covered = 0;

    for (const lineStatus of lineHits.values()) {
        if (lineStatus.covered || lineStatus.uncovered) {
            total += 1;

            // Count the source line as covered when at least one mapped segment executed.
            if (lineStatus.covered) {
                covered += 1;
            }
        }
    }

    return {
        covered,
        total
    };
}

/**
 * Collapses branch hit lists into a single summary.
 * @param branchHitsByLine Branch hit lists grouped by line.
 * @returns Covered and total counts.
 */
function summarizeBranchHits(branchHitsByLine: Map<number, number[]>): CoverageSummary {
    /** Flattened branch hit counts across all lines. */
    const values = [];

    for (const branchHits of branchHitsByLine.values()) {
        values.push(...branchHits);
    }

    return summarizeHits(values);
}

/**
 * Maps LCOV records back to original TypeScript sources and aggregates per-file coverage data.
 * @param records Parsed LCOV records.
 * @returns Aggregated file coverage entries.
 */
async function collectFileCoverage(records: LcovRecord[]): Promise<FileCoverage[]> {
    /** Source files indexed by normalized path. */
    const files = new Map<string, FileCoverage>();

    /** Cached source text lines keyed by absolute source path. */
    const sourceLineCache = new Map<string, string[]>();

    /**
     * Retrieves source lines for a file path using an in-memory cache.
     * @param sourcePath Absolute source file path.
     * @returns Source lines for the file, or an empty array when the file cannot be read.
     */
    async function getSourceLines(sourcePath: string): Promise<string[]> {
        /** Cached source lines for the file, if any. */
        const cached = sourceLineCache.get(sourcePath);

        // Return cached lines when available to avoid redundant disk reads for the same source file.
        if (cached) {
            // Cache hit.
            return cached;
        }

        try {
            /** Source text for the file read from disk. */
            const sourceText = await readFile(sourcePath, 'utf8');

            /** Source lines for the file. */
            const lines = sourceText.split(/\r?\n/u);

            // Cache the source lines for future lookups.
            sourceLineCache.set(sourcePath, lines);

            // Cache miss.
            return lines;
        } catch {
            // If the source file can't be read, return an empty array so the mapping can still proceed without source text.
            return [];
        }
    }

    /**
     * Returns true when the provided line contains executable-looking code.
     * @param lineText Source line text.
     * @returns True for non-empty, non-comment-only lines.
     */
    function isExecutableLookingLine(lineText: string | undefined): boolean {
        if (typeof lineText === 'undefined') {
            return false;
        }

        /** Trimmed source line text for analysis. */
        const trimmed = lineText.trim();

        if (trimmed.length === 0) {
            return false;
        }

        return !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
    }

    /**
     * Maps a generated line to the most representative source location.
     * @param sourceMap Source map for the generated file.
     * @param generatedLine Generated JavaScript line number.
     * @param jsFile Generated JavaScript file path.
     * @returns Selected source origin for the generated line.
     */
    async function selectOriginForGeneratedLine(sourceMap: SourceMap, generatedLine: number, jsFile: string): Promise<SourceOriginLike | null> {
        /** Candidate mapped from the start of the generated line. */
        const startOrigin = sourceMap.findOrigin(generatedLine, 0) as SourceOriginLike;

        /** Candidate mapped from the end of the generated line. */
        const endOrigin = sourceMap.findOrigin(generatedLine, Number.MAX_SAFE_INTEGER) as SourceOriginLike;

        if (!startOrigin.fileName && !endOrigin.fileName) {
            return null;
        }

        if (!startOrigin.fileName || !startOrigin.lineNumber) {
            return endOrigin;
        }

        if (!endOrigin.fileName || !endOrigin.lineNumber) {
            return startOrigin;
        }

        /** Resolved source path for start-origin candidate. */
        const startPath = normalizePath(resolveOriginalSourcePath(jsFile, startOrigin.fileName));

        /** Resolved source path for end-origin candidate. */
        const endPath = normalizePath(resolveOriginalSourcePath(jsFile, endOrigin.fileName));

        /** Source lines for start-origin file. */
        const startLines = await getSourceLines(startPath);

        /** Source lines for end-origin file. */
        const endLines = await getSourceLines(endPath);

        /** Candidate source text at the mapped start-origin line. */
        const startLineText = startLines[startOrigin.lineNumber - 1];

        /** Candidate source text at the mapped end-origin line. */
        const endLineText = endLines[endOrigin.lineNumber - 1];

        /** When one candidate maps to an empty or comment-only line and the other maps to a more code-like line, prefer the more executable-looking mapping. */
        const startLooksExecutable = isExecutableLookingLine(startLineText);

        /** When one candidate maps to an empty or comment-only line and the other maps to a more code-like line, prefer the more executable-looking mapping. */
        const endLooksExecutable = isExecutableLookingLine(endLineText);

        if (startLooksExecutable !== endLooksExecutable) {
            return endLooksExecutable ? endOrigin : startOrigin;
        }

        // Prefer the end-of-line mapping when both candidates are similarly code-like.
        return endOrigin;
    }

    for (const record of records) {
        /** Source map for the generated JavaScript file. */
        const sourceMap = await loadSourceMap(record.jsFile);

        if (sourceMap) {
            /** Source files touched by the current LCOV record. */
            const fileSummaries = new Map<string, FileCoverage>();

            for (const [lineNumber, hits] of record.lines) {
                /** Original source location mapped from the generated line. */
                const origin = await selectOriginForGeneratedLine(sourceMap, lineNumber, record.jsFile);

                if (origin?.fileName && origin.lineNumber) {
                    /** Normalized original source path for the current line. */
                    const sourcePath = normalizePath(resolveOriginalSourcePath(record.jsFile, origin.fileName));

                    /** Mutable coverage bucket for the source file. */
                    const file = files.get(sourcePath) ?? createFileCoverage(sourcePath, record.jsFile);

                    /** Line hit state for the mapped source line. */
                    const lineStatus = file.lineHits.get(origin.lineNumber) ?? {
                        'covered': false,
                        'uncovered': false
                    };

                    if (hits > 0) {
                        lineStatus.covered = true;
                    } else {
                        lineStatus.uncovered = true;
                    }

                    file.lineHits.set(origin.lineNumber, lineStatus);

                    files.set(sourcePath, file);

                    fileSummaries.set(sourcePath, file);
                }
            }

            for (const branch of record.branches) {
                /** Original source location mapped from the generated branch line. */
                const origin = await selectOriginForGeneratedLine(sourceMap, branch.lineNumber, record.jsFile);

                if (origin?.fileName && origin.lineNumber) {
                    /** Normalized original source path for the current branch. */
                    const sourcePath = normalizePath(resolveOriginalSourcePath(record.jsFile, origin.fileName));

                    /** Mutable coverage bucket for the source file. */
                    const file = files.get(sourcePath) ?? createFileCoverage(sourcePath, record.jsFile);

                    /** Branch hit list for the mapped source line. */
                    const branches = file.branchesByLine.get(origin.lineNumber) ?? [];

                    branches.push(branch.hits);

                    file.branchesByLine.set(origin.lineNumber, branches);

                    files.set(sourcePath, file);

                    fileSummaries.set(sourcePath, file);
                }
            }

            for (const file of fileSummaries.values()) {
                file.functionTotals = summarizeHits(record.functions);
            }
        }
    }

    /** Final sorted coverage entries. */
    const results: FileCoverage[] = [];

    for (const file of files.values()) {
        file.lineTotals = summarizeLineHits(file.lineHits);

        file.branchTotals = summarizeBranchHits(file.branchesByLine);

        file.relativeSourcePath = normalizePath(path.relative(workspaceRoot, file.sourcePath));

        file.filePagePath = path.join(outputRoot, `${ file.relativeSourcePath }.html`);

        results.push(file);
    }

    return results.sort((left, right) => left.relativeSourcePath.localeCompare(right.relativeSourcePath));
}

/**
 * Recursively rolls file coverage up into each directory node.
 * @param node Tree node to aggregate.
 * @returns Aggregated summary bundle for the node.
 */
function updateAggregate(node: CoverageTreeNode): CoverageTreeSummary {
    /** Aggregated totals for the current tree node. */
    const aggregate = createEmptySummaryBundle();

    if (node.file) {
        aggregate.lines = cloneSummary(node.file.lineTotals);

        aggregate.branches = cloneSummary(node.file.branchTotals);

        aggregate.functions = cloneSummary(node.file.functionTotals);

        aggregate.files = 1;

        node.aggregate = aggregate;

        return aggregate;
    }

    for (const childNode of node.children.values()) {
        /** Aggregated coverage from the child node. */
        const childAggregate = updateAggregate(childNode);

        aggregate.lines.covered += childAggregate.lines.covered;

        aggregate.lines.total += childAggregate.lines.total;

        aggregate.branches.covered += childAggregate.branches.covered;

        aggregate.branches.total += childAggregate.branches.total;

        aggregate.functions.covered += childAggregate.functions.covered;

        aggregate.functions.total += childAggregate.functions.total;

        aggregate.files += childAggregate.files;
    }

    node.aggregate = aggregate;

    return aggregate;
}

/**
 * Builds the directory tree used for the HTML index pages.
 * @param files Source file coverage entries.
 * @returns Directory tree root node.
 */
function buildTree(files: FileCoverage[]): CoverageTreeNode {
    /** Root directory node for the report tree. */
    const root: CoverageTreeNode = {
        'aggregate': createEmptySummaryBundle(),
        'children': new Map<string, CoverageTreeNode>(),
        'name': '',
        'pagePath': path.join(outputRoot, 'index.html'),
        'relativePath': '',
        'type': 'root'
    };

    for (const file of files) {
        /** Path segments that make up the source file location. */
        const pathParts = file.relativeSourcePath.split(path.sep).filter(Boolean);

        /** Current tree node while walking the path segments. */
        let currentNode: CoverageTreeNode = root;

        for (let index = 0; index < pathParts.length; index += 1) {
            /** Current path segment being attached to the tree. */
            const part = pathParts[index];

            /** Indicates whether the current segment is the leaf file node. */
            const isLeaf = index === pathParts.length - 1;

            /** Relative path for the current child node. */
            const childRelativePath = currentNode.relativePath ? path.join(currentNode.relativePath, part) : part;

            if (!currentNode.children.has(part)) {
                currentNode.children.set(part, {
                    'aggregate': createEmptySummaryBundle(),
                    'children': new Map<string, CoverageTreeNode>(),
                    'name': part,
                    'pagePath': isLeaf ? file.filePagePath : path.join(outputRoot, childRelativePath, 'index.html'),
                    'relativePath': childRelativePath,
                    'type': isLeaf ? 'file' : 'directory'
                });
            }

            /** Existing child node for the current path segment, if any. */
            const nextNode = currentNode.children.get(part);

            if (nextNode) {
                currentNode = nextNode;

                if (isLeaf) {
                    currentNode.file = file;

                    currentNode.pagePath = file.filePagePath;

                    currentNode.type = 'file';
                }
            }
        }
    }

    updateAggregate(root);

    return root;
}

/**
 * Builds a relative hyperlink between two generated HTML files.
 * @param fromPath Source HTML file path.
 * @param toPath Target HTML file path.
 * @returns Relative hyperlink path.
 */
function relativeLink(fromPath: string, toPath: string): string {
    // The relative link using POSIX separators (so they work on all platforms regardless of the OS path format.
    return path.relative(
        path.dirname(fromPath),
        toPath
    )
        .split(path.sep)
        .join('/');
}

/**
 * Sorts directories before files and then orders siblings alphabetically.
 * @param left Left node.
 * @param right Right node.
 * @returns Sort comparison result.
 */
function compareNodes(left: CoverageTreeNode, right: CoverageTreeNode): number {
    /** Whether the left node is a directory-like entry. */
    const leftDirectory = left.type === 'directory' || left.type === 'root';

    /** Whether the right node is a directory-like entry. */
    const rightDirectory = right.type === 'directory' || right.type === 'root';

    if (leftDirectory !== rightDirectory) {
        return leftDirectory ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
}

/**
 * Escapes HTML entities before injecting file names, labels, or source text.
 * @param value Value to escape.
 * @returns Escaped HTML string.
 */
function escapeHtml(value: unknown): string {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

/**
 * Formats coverage as a percentage string, treating empty totals as fully covered.
 * @param covered Covered count.
 * @param total Total count.
 * @returns Formatted percentage string.
 */
function formatPercent(covered: number, total: number): string {
    if (total === 0) {
        return '100.00';
    }

    return ((covered / total) * 100).toFixed(2);
}

/**
 * Formats a coverage summary as a percentage and raw hit count.
 * @param summary Coverage summary.
 * @returns HTML snippet containing the formatted summary.
 */
function renderSummaryValue(summary: CoverageSummary): string {
    return `${ formatPercent(summary.covered, summary.total) }% <span class="subtle">(${ summary.covered }/${ summary.total })</span>`;
}

/**
 * Renders a single summary card used on the overview and file pages.
 * @param label Text shown on the card.
 * @param summary Coverage summary.
 * @returns HTML summary card markup.
 */
function renderSummaryCard(label: string, summary: CoverageSummary): string {
    return `
        <div class="summary-card">
            <div class="summary-label">${ escapeHtml(label) }</div>
            <div class="summary-value">${ renderSummaryValue(summary) }</div>
        </div>
    `;
}

/**
 * Builds breadcrumbs for directory and file pages.
 * @param node Tree node to render.
 * @param isRoot Whether this is the root page.
 * @returns HTML breadcrumb markup.
 */
function buildBreadcrumbs(node: CoverageTreeNode, isRoot: boolean): string {
    /** Breadcrumb parts collected for the page. */
    const parts = [];

    /** Root breadcrumb target. */
    const rootHref = isRoot ? '#' : relativeLink(node.pagePath, path.join(outputRoot, 'index.html'));

    parts.push(`<a href="${ rootHref }">Coverage</a>`);

    if (node.type === 'root') {
        return parts.join('<span class="separator">/</span>');
    }

    /** Path segments that make up the current node. */
    const segments = node.relativePath.split(path.sep).filter(Boolean);

    /** Accumulated relative path while walking the breadcrumb segments. */
    let currentRelativePath = '';

    for (let index = 0; index < segments.length; index += 1) {
        /** Current breadcrumb segment. */
        const segment = segments[index];

        currentRelativePath = currentRelativePath ? path.join(currentRelativePath, segment) : segment;

        /** Indicates whether this segment is the leaf node. */
        const isLeaf = index === segments.length - 1 && node.type === 'file';

        /** Target page path for the current breadcrumb segment. */
        const targetPath = isLeaf ? node.pagePath : path.join(outputRoot, currentRelativePath, 'index.html');

        if (isLeaf) {
            parts.push(`<span class="separator">/</span><span>${ escapeHtml(segment) }</span>`);
        } else {
            parts.push(`<span class="separator">/</span><a href="${ relativeLink(node.pagePath, targetPath) }">${ escapeHtml(segment) }</a>`);
        }
    }

    return parts.join('');
}

/**
 * Builds breadcrumbs for the file detail page.
 * @param file Source file coverage entry.
 * @returns HTML breadcrumb markup.
 */
function buildFileBreadcrumbs(file: FileCoverage): string {
    /** Path segments that make up the file path. */
    const segments = file.relativeSourcePath.split(path.sep).filter(Boolean);

    /** Collected breadcrumb links for the file page. */
    const crumbs = [`<a href="${ relativeLink(file.filePagePath, path.join(outputRoot, 'index.html')) }">Coverage</a>`];

    /** Accumulated relative path while walking the file segments. */
    let currentRelativePath = '';

    for (let index = 0; index < segments.length; index += 1) {
        /** Current file path segment. */
        const segment = segments[index];

        currentRelativePath = currentRelativePath ? path.join(currentRelativePath, segment) : segment;

        /** Indicates whether this segment is the file leaf. */
        const isLeaf = index === segments.length - 1;

        if (isLeaf) {
            crumbs.push(`<span class="separator">/</span><span>${ escapeHtml(segment) }</span>`);
        } else {
            /** Directory page path for the current segment. */
            const dirPath = path.join(outputRoot, currentRelativePath, 'index.html');

            crumbs.push(`<span class="separator">/</span><a href="${ relativeLink(file.filePagePath, dirPath) }">${ escapeHtml(segment) }</a>`);
        }
    }

    return crumbs.join('');
}

/**
 * Converts per-line hit state into a CSS class.
 * @param file Source file coverage entry.
 * @param lineNumber Source line number.
 * @returns CSS class name for the line.
 */
function determineLineStatus(file: FileCoverage, lineNumber: number): 'neutral' | 'uncovered' | 'covered' | 'partial' {
    /** Current line coverage state, if any. */
    const lineStatus = file.lineHits.get(lineNumber);

    if (!lineStatus) {
        return 'neutral';
    }

    if (lineStatus.covered && lineStatus.uncovered) {
        return 'partial';
    }

    if (lineStatus.uncovered) {
        return 'uncovered';
    }

    return lineStatus.covered ? 'covered' : 'neutral';
}

/**
 * Determines whether a source line should always render as neutral in the HTML view.
 * This avoids misleading coverage colors on comment/blank lines that can receive mapped hits.
 * @param lineText Source line text.
 * @returns True when the line is non-executable display-only content.
 */
function shouldRenderNeutralLine(lineText: string): boolean {
    /** Trimmed source line text for analysis. */
    const trimmed = lineText.trim();

    // When a line is empty or contains only comment tokens, it should render as neutral to avoid misleading coverage colors from mapped hits that don't necessarily indicate executable code on that line.
    if (trimmed.length === 0) {
        // An empty line is not executable, so it should render as neutral.
        return true;
    }

    // Lines that contain only comment tokens are not executable, so they should render as neutral to avoid misleading coverage colors from mapped hits that don't necessarily indicate executable code on that line.
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/');
}

/**
 * Builds client-side behavior for generated report pages.
 * @returns Inline script text.
 */
function buildClientScript(): string {
    return `
(() => {
    /** Attaches function collapse toggles on source detail pages. */
    function setupFunctionToggles() {
        const toggleButtons = Array.from(document.querySelectorAll('.fn-toggle[data-range-id]'));

        if (toggleButtons.length === 0) {
            return;
        }

        for (const toggle of toggleButtons) {
            if (toggle instanceof HTMLButtonElement) {
                const rangeId = toggle.getAttribute('data-range-id');

                if (rangeId) {
                    const bodyRows = Array.from(document.querySelectorAll('tr[data-fn-body="' + rangeId + '"]'));

                    if (bodyRows.length > 0) {
                        let collapsed = false;

                        toggle.addEventListener('click', () => {
                            collapsed = !collapsed;

                            toggle.textContent = collapsed ? '▸' : '▾';
                            toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

                            for (const row of bodyRows) {
                                row.classList.toggle('fn-collapsed-row', collapsed);
                            }
                        });
                    }
                }
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupFunctionToggles, { 'once': true });
    } else {
        setupFunctionToggles();
    }
})();
`;
}

/**
 * Writes a standalone HTML document that shares the common report stylesheet.
 * @param filePath Output file path.
 * @param title Page title.
 * @param body HTML body content.
 * @returns Resolves once the HTML file is written.
 */
async function writeHtmlFile(filePath: string, title: string, body: string): Promise<void> {
    /** Relative link to the shared stylesheet. */
    const stylesheetHref = relativeLink(filePath, path.join(outputRoot, 'style.css'));

    /** Full HTML document for the page. */
    const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${ escapeHtml(title) }</title>
    <link rel="stylesheet" href="${ stylesheetHref }" />
</head>
<body>
    <main class="page">
        ${ body }
    </main>
    <script>${ buildClientScript() }</script>
</body>
</html>
`;

    await mkdir(path.dirname(filePath), { 'recursive': true });

    await writeFile(filePath, html, 'utf8');
}

/**
 * Renders a single table row in the directory listing.
 * @param childNode Child node to render.
 * @param currentPagePath Current page path used for relative links.
 * @returns HTML table row markup.
 */
function buildChildRow(childNode: CoverageTreeNode, currentPagePath: string): string {
    /** Relative link to the child page. */
    const pageLink = relativeLink(currentPagePath, childNode.pagePath);

    /** Tree glyph for the child node. */
    const icon = childNode.type === 'directory' ? '▸' : '•';

    /** Display label for the child node. */
    const label = childNode.type === 'directory' ? `${ escapeHtml(childNode.name) }/` : escapeHtml(childNode.name);

    return `
        <tr class="${ childNode.type }">
            <td class="name-col"><a href="${ pageLink }">${ icon } ${ label }</a></td>
            <td class="metric-col">${ renderSummaryValue(childNode.aggregate.lines) }</td>
            <td class="metric-col">${ renderSummaryValue(childNode.aggregate.branches) }</td>
            <td class="metric-col">${ renderSummaryValue(childNode.aggregate.functions) }</td>
            <td class="count-col">${ childNode.aggregate.files }</td>
        </tr>
    `;
}

/**
 * Writes the source file detail page with line-level coverage highlighting.
 * @param file Source file coverage entry.
 * @returns Resolves once the file page is written.
 */
async function writeFilePage(file: FileCoverage): Promise<void> {
    /** Raw source text for the file page. */
    const sourceText = await readFile(file.sourcePath, 'utf8');

    /** Individual source lines for the rendered table. */
    const sourceLines = sourceText.split(/\r?\n/u);

    /**
     * Counts brace delta for a source line.
     * @param text Source line text.
     * @returns Net open-minus-close brace count.
     */
    function countBraceDelta(text: string): number {
        /** Net open-minus-close brace count for the line. */
        let delta = 0;

        for (const char of text) {
            if (char === '{') {
                delta += 1;
            } else if (char === '}') {
                delta -= 1;
            }
        }

        return delta;
    }

    /**
     * Returns true for likely function or method start lines.
     * @param text Source line text.
     * @returns True when the line appears to begin a function block.
     */
    function isFunctionStartLine(text: string): boolean {
        /** Trimmed source line text. */
        const trimmed = text.trim();

        if (!trimmed.endsWith('{')) {
            return false;
        }

        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            return false;
        }

        if (trimmed.startsWith('}') && (/(?<temp1>\s*catch\s*\(|\s*else\b|\s*finally\b)/u).test(trimmed.slice(1))) {
            return false;
        }

        if ((/^(?<temp1>if|for|while|switch|catch|else|try|do)\b/u).test(trimmed)) {
            return false;
        }

        return (/\bfunction\b/u).test(trimmed) || (/\)\s*:\s*[^=]+\{\s*$/u).test(trimmed) || (/\)\s*\{\s*$/u).test(trimmed);
    }

    /** Function ranges keyed by start line number. */
    const functionStarts = new Map<number, {
        /** End line number of the function. */
        'end': number;
        /** Unique identifier for the function. */
        'id': string;
    }>();

    /** Function body line ownership keyed by line number. */
    const functionBodyLines = new Map<number, string>();

    /** Monotonic function id counter used for data attributes. */
    let functionCounter = 0;

    for (let index = 0; index < sourceLines.length; index += 1) {
        /** Source line text for the current line index. */
        const lineText = sourceLines[index];

        // Detect function start lines and walk forward to find the full function block for collapsible toggles.
        if (isFunctionStartLine(lineText)) {
            /** Walks forward to find the end of the function block by tracking open and close braces. */
            let depth = 1;

            /** Tentative end line index for the function block. */
            let endIndex = index;

            for (let cursor = index + 1; cursor < sourceLines.length; cursor += 1) {
                depth += countBraceDelta(sourceLines[cursor]);

                if (depth <= 0) {
                    endIndex = cursor;

                    break;
                }
            }

            if (endIndex > index + 1) {
                functionCounter += 1;

                /** Unique function id for data attributes. */
                const functionId = `fn-${ functionCounter }`;

                /** Start line number for the function block (1-based). */
                const startLine = index + 1;

                /** End line number for the function block (1-based). */
                const endLine = endIndex + 1;

                // Register the function block range for toggle button rendering and line ownership tracking.
                functionStarts.set(startLine, {
                    'end': endLine,
                    'id': functionId
                });

                // The function body includes all lines after the signature line up to and including the closing brace line.
                for (let line = startLine + 1; line <= endLine; line += 1) {
                    // Register function body line ownership for worst-status calculation and toggle behavior.
                    functionBodyLines.set(line, functionId);
                }
            }
        }
    }

    /** Breadcrumb markup for the file page. */
    const breadcrumbs = buildFileBreadcrumbs(file);

    /** Rank ordering for function worst-status calculation. */
    const statusRank: Readonly<Record<'neutral' | 'covered' | 'partial' | 'uncovered', number>> = {
        'covered': 1,
        'neutral': 0,
        'partial': 2,
        'uncovered': 3
    };

    /** Line display status by source line number. */
    const lineDisplayStatus = new Map<number, 'neutral' | 'covered' | 'partial' | 'uncovered'>();

    /** Worst status by function id. */
    const functionWorstStatus = new Map<string, 'neutral' | 'covered' | 'partial' | 'uncovered'>();

    for (let index = 0; index < sourceLines.length; index += 1) {
        /** 1-based source line number. */
        const lineNumber = index + 1;

        /** Source line text for the current line index. */
        const lineText = sourceLines[index];

        /** Mapped coverage status for the current line. */
        const mappedStatus = determineLineStatus(file, lineNumber);

        /** Final display status for the current line after considering neutral rendering rules. */
        const status = shouldRenderNeutralLine(lineText) ? 'neutral' : mappedStatus;

        // Register the line display status for CSS class assignment.
        lineDisplayStatus.set(lineNumber, status);

        /** Optional function id if this line starts a collapsible function block. */
        const functionId = functionStarts.get(lineNumber)?.id ?? functionBodyLines.get(lineNumber);

        if (functionId && status !== 'neutral') {
            /** When the line belongs to a function block, update the worst-status for the function if the current line status is ranked worse than the previously recorded worst-status. This allows the function toggle button to reflect the most severe coverage status among all lines in the function body. */
            const currentWorst = functionWorstStatus.get(functionId) ?? 'neutral';

            if (statusRank[status] > statusRank[currentWorst]) {
                functionWorstStatus.set(functionId, status);
            }
        }
    }

    /** Table rows with line-by-line coverage status. */
    const lineRows = sourceLines.map((lineText: string, index: number) => {
        /** 1-based source line number. */
        const lineNumber = index + 1;

        /** Display class for the current line after filtering non-executable rows. */
        const status = lineDisplayStatus.get(lineNumber) ?? 'neutral';

        /** Number of branches associated with the line. */
        const branchCount = file.branchesByLine.get(lineNumber)?.length ?? 0;

        /** Optional function id if this line starts a collapsible function block. */
        const functionStart = functionStarts.get(lineNumber);

        /** Optional function id if this line belongs to a collapsible function body. */
        const functionBodyId = functionBodyLines.get(lineNumber);

        /** Toggle button markup for function start lines. */
        const toggleMarkup = functionStart ? `<button type="button" class="fn-toggle" data-range-id="${ functionStart.id }" data-worst="${ functionWorstStatus.get(functionStart.id) ?? 'neutral' }" title="Toggle function body" aria-label="Toggle function body" aria-expanded="true">▾</button>` : '';

        /** Additional row attributes for function body tracking. */
        const rowFunctionAttribute = functionBodyId ? ` data-fn-body="${ functionBodyId }"` : '';

        return `
            <tr class="${ status }"${ rowFunctionAttribute }>
                <td class="line-number">${ toggleMarkup }${ lineNumber }</td>
                <td class="code-cell"><span class="source-code">${ escapeHtml(lineText || ' ') }</span>${ branchCount > 0 ? `<span class="branch-note">${ branchCount } branch${ branchCount === 1 ? '' : 'es' }</span>` : '' }</td>
            </tr>
        `;
    }).join('');

    /** File detail page body. */
    const body = `
        <section class="hero file-hero">
            <div>
                <h1>${ escapeHtml(file.relativeSourcePath) }</h1>
                <p class="subtle">${ escapeHtml(file.sourcePath) }</p>
                <p class="subtle">Line colors: green=covered, red=uncovered, yellow=partial (mixed mapped hits from transformed output/source maps).</p>
                <p class="subtle">Use the ▾ buttons beside function signatures to collapse/expand function bodies.</p>
            </div>
            <div class="summary-grid compact">
                ${ renderSummaryCard('Lines', file.lineTotals) }
                ${ renderSummaryCard('Branches', file.branchTotals) }
                ${ renderSummaryCard('Functions', file.functionTotals) }
            </div>
        </section>
        <nav class="breadcrumbs">${ breadcrumbs }</nav>
        <section class="source-panel">
            <table class="source-table">
                <tbody>
                    ${ lineRows }
                </tbody>
            </table>
        </section>
    `;

    await writeHtmlFile(file.filePagePath, file.relativeSourcePath, body);
}

/**
 * Writes one HTML page for a directory node and its children.
 * @param node Node to render.
 * @param isRoot Whether this is the root page.
 * @returns Resolves once the page and descendants are written.
 */
async function writeDirectoryPage(node: CoverageTreeNode, isRoot: boolean): Promise<void> {
    if (node.type !== 'root') {
        await mkdir(path.dirname(node.pagePath), { 'recursive': true });
    }

    /** Output page path for the current directory node. */
    const pagePath = node.type === 'root' ? path.join(outputRoot, 'index.html') : node.pagePath;

    /** Display title for the current page. */
    const pageTitle = isRoot ? 'Coverage report' : node.relativePath;

    /** Breadcrumb markup for the current page. */
    const breadcrumbs = buildBreadcrumbs(node, isRoot);

    /** Child rows for the directory listing table. */
    const childRows = Array.from(node.children.values())
        .sort(compareNodes)
        .map((childNode) => buildChildRow(childNode, pagePath));

    /** Directory listing page body. */
    const body = `
        <section class="hero">
            <h1>${ escapeHtml(pageTitle) }</h1>
            <div class="summary-grid">
                ${ renderSummaryCard('Lines', node.aggregate.lines) }
                ${ renderSummaryCard('Branches', node.aggregate.branches) }
                ${ renderSummaryCard('Functions', node.aggregate.functions) }
                <div class="summary-card muted"><div class="summary-label">Files</div><div class="summary-value">${ node.aggregate.files }</div></div>
            </div>
        </section>
        <nav class="breadcrumbs">${ breadcrumbs }</nav>
        <section class="listing">
            <table>
                <thead>
                    <tr>
                        <th class="name-col">Path</th>
                        <th class="metric-col">Lines</th>
                        <th class="metric-col">Branches</th>
                        <th class="metric-col">Functions</th>
                        <th class="count-col">Files</th>
                    </tr>
                </thead>
                <tbody>
                    ${ childRows.join('') }
                </tbody>
            </table>
        </section>
    `;

    await writeHtmlFile(pagePath, pageTitle, body);

    for (const childNode of node.children.values()) {
        if (childNode.type === 'directory') {
            await writeDirectoryPage(childNode, false);
        } else if (childNode.file) {
            await writeFilePage(childNode.file);
        }
    }
}

/**
 * Returns the stylesheet used by every generated report page.
 * @returns Generated stylesheet CSS text.
 */
function buildStylesheet(): string {
    return `
:root {
    color-scheme: light;
    --bg: #f5f7fa;
    --panel: #ffffff;
    --panel-alt: #f8fafc;
    --text: #1f2937;
    --muted: #667085;
    --border: #d7dde7;
    --shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
    --covered-bg: #d8f0dd;
    --covered-border: #7cc38a;
    --covered-text: #14532d;
    --partial-bg: #fff3bf;
    --partial-border: #e0bf46;
    --partial-text: #6b4f00;
    --uncovered-bg: #ffd7d7;
    --uncovered-border: #ef8d8d;
    --uncovered-text: #8a1f1f;
    --code-bg: #fdfefe;
    --accent: #2457a6;
    --accent-soft: rgba(36, 87, 166, 0.08);
    --row-hover: #f3f7fb;
}

* { box-sizing: border-box; }

html, body {
    margin: 0;
    min-height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
}

body {
    padding: 20px;
}

.page {
    max-width: 1320px;
    margin: 0 auto;
}

.hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 16px;
    padding: 22px 24px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow);
}

.hero h1 {
    margin: 0 0 8px;
    font-size: 26px;
    line-height: 1.2;
    font-weight: 700;
}

.subtle {
    color: var(--muted);
    font-size: 14px;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    min-width: min(680px, 100%);
}

.summary-grid.compact {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    min-width: min(520px, 100%);
}

.summary-card {
    padding: 14px 16px;
    background: var(--panel-alt);
    border: 1px solid var(--border);
    border-radius: 10px;
}

.summary-card.muted {
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.summary-label {
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.summary-value {
    margin-top: 6px;
    font-size: 18px;
    font-weight: 700;
}

.summary-value .subtle {
    font-size: 13px;
}

.breadcrumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    align-items: center;
    margin-bottom: 14px;
    color: var(--muted);
    font-size: 14px;
}

.breadcrumbs a {
    color: var(--accent);
    text-decoration: none;
}

.breadcrumbs a:hover {
    text-decoration: underline;
}

.separator {
    margin: 0 8px;
    color: var(--muted);
}

.listing,
.source-panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow);
    overflow: hidden;
}

table {
    width: 100%;
    border-collapse: collapse;
}

thead th {
    padding: 12px 14px;
    background: #eef2f7;
    border-bottom: 1px solid var(--border);
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    text-align: left;
}

tbody td {
    padding: 0;
    border-bottom: 1px solid rgba(217, 225, 236, 0.8);
    vertical-align: top;
}

tbody tr:last-child td {
    border-bottom: 0;
}

tbody tr:hover td {
    background: var(--row-hover);
}

.name-col,
.metric-col,
.count-col {
    padding: 11px 14px;
    white-space: nowrap;
}

.name-col {
    width: 48%;
}

.metric-col,
.count-col {
    width: 13%;
    text-align: right;
}

.name-col a {
    color: var(--text);
    text-decoration: none;
    font-weight: 600;
}

.name-col a:hover {
    text-decoration: underline;
}

.directory .name-col a {
    color: var(--accent);
}

.file .name-col a {
    color: #314155;
}

.source-table {
    table-layout: fixed;
}

.source-table tbody td {
    border-bottom: 1px solid rgba(217, 225, 236, 0.45);
}

.source-table .line-number {
    width: 84px;
    padding: 6px 12px 6px 14px;
    color: var(--muted);
    text-align: right;
    font-variant-numeric: tabular-nums;
    background: #eef2f7;
    border-right: 1px solid var(--border);
}

.fn-toggle {
    margin-right: 6px;
    padding: 0;
    width: 16px;
    height: 16px;
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    vertical-align: middle;
    border-radius: 3px;
}

.fn-toggle:hover {
    color: var(--accent);
}

.fn-toggle[data-worst="covered"] {
    background: var(--covered-bg);
    color: var(--covered-text);
}

.fn-toggle[data-worst="partial"] {
    background: var(--partial-bg);
    color: var(--partial-text);
}

.fn-toggle[data-worst="uncovered"] {
    background: var(--uncovered-bg);
    color: var(--uncovered-text);
}

.fn-collapsed-row {
    display: none;
}

.source-table .code-cell {
    padding: 0;
    font-family: Consolas, 'SFMono-Regular', 'Liberation Mono', Menlo, monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre;
}

.source-code {
    display: block;
    min-height: 1.5em;
    padding: 6px 16px;
    background: var(--code-bg);
}

.source-table tbody tr:hover .source-code,
.source-table tbody tr:hover .line-number {
    filter: saturate(1.04);
}

.branch-note {
    display: inline-block;
    margin: 0 16px 8px;
    padding: 3px 8px;
    color: var(--muted);
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 11px;
    border-radius: 999px;
    background: var(--accent-soft);
}

.covered .source-code,
.covered .line-number {
    background: var(--covered-bg);
    color: var(--covered-text);
}

.partial .source-code,
.partial .line-number {
    background: var(--partial-bg);
    color: var(--partial-text);
}

.uncovered .source-code,
.uncovered .line-number {
    background: var(--uncovered-bg);
    color: var(--uncovered-text);
}

.neutral .source-code,
.neutral .line-number {
    background: #eef2f7;
    color: var(--muted);
}

@media (max-width: 1100px) {
    body { padding: 14px; }

    .hero {
        flex-direction: column;
    }

    .summary-grid,
    .summary-grid.compact {
        width: 100%;
        min-width: 0;
        grid-template-columns: 1fr 1fr;
    }

    .name-col { width: auto; }
}

@media (max-width: 700px) {
    .summary-grid,
    .summary-grid.compact {
        grid-template-columns: 1fr;
    }

    .metric-col,
    .count-col {
        white-space: normal;
    }

    .name-col {
        white-space: normal;
    }

    .source-table .line-number {
        width: 64px;
    }
}
`;
}

/**
 * Generates the HTML coverage site from LCOV output.
 * @param lcovText Raw LCOV output from the Node test runner.
 * @returns Resolves once the report has been written.
 */
async function generateHtmlCoverage(lcovText: string): Promise<void> {
    /** Parsed LCOV records from the test runner output. */
    const records = parseLcov(lcovText);

    /** Aggregated coverage entries for each source file. */
    const files = await collectFileCoverage(records);

    /** Directory tree built from the aggregated file list. */
    const tree = buildTree(files);

    await rm(outputRoot, {
        'force': true,
        'recursive': true
    });

    await mkdir(outputRoot, {
        'recursive': true
    });

    await writeFile(path.join(outputRoot, 'style.css'), buildStylesheet(), 'utf8');

    await writeDirectoryPage(tree, true);
}

/** Waits for the test process to finish, then generates the HTML report. */
const exitCode = await new Promise((resolve, reject) => {
    /** Rejects the promise if the child process emits an error. */
    child.on('error', (error: unknown) => {
        /** Converts the error to an instance of Error if it isn't already. */
        const errorToEmit = error instanceof Error ? error : new Error(String(error));

        // Ensure the error is emitted as an uncaught exception to avoid silent promise rejections and to provide a stack trace.
        reject(errorToEmit);
    });

    /** Resolves with the exit code when the child process closes. */
    child.on('close', (code: number | null) => {
        // If the process was terminated by a signal, code will be null. In that case, we treat it as an error scenario and reject with a non-zero exit code to indicate failure.
        resolve(code);
    });
});

// Generate the HTML report from the LCOV output, then exit with the test process's exit code or 1 if the code is null (e.g., if the process was killed by a signal).
try {
    await generateHtmlCoverage(lcovOutput);

    // Emit a clear success message so report generation is visible even when tests fail.
    // eslint-disable-next-line no-console
    console.log(`Generated TypeScript HTML coverage report at ${ path.join('coverage', 'html', 'index.html') }`);
} catch (error) {
    /** Error text for report generation failure output. */
    const message = error instanceof Error ? error.stack ?? error.message : String(error);

    // Emit a clear failure message when HTML report generation fails.
    // eslint-disable-next-line no-console
    console.error(`Failed to generate TypeScript HTML coverage report: ${ message }`);

    // Preserve failure semantics when report generation fails.
    process.exitCode = 1;

    throw error;
}

// If the test process was terminated by a signal, we treat it as an error scenario and exit with code 1 to indicate failure. Otherwise, we exit with the test process's exit code.
process.exitCode = typeof exitCode === 'number' ? exitCode : 1;
