import { SourceMap, type SourceMapPayload } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

/** Defines interface CoverageStat. */
interface CoverageStat {
    /** Stores covered as number. */
    'covered': number;
    /** Stores total as number. */
    'total': number;
}

/** Defines interface SourceLineHit. */
interface SourceLineHit {
    /** Stores covered as boolean. */
    'covered': boolean;
    /** Stores uncovered as boolean. */
    'uncovered': boolean;
}

/** Defines interface LcovBranch. */
interface LcovBranch {
    /** Stores hits as number. */
    'hits': number;
    /** Stores lineNumber as number. */
    'lineNumber': number;
}

/** Defines interface LcovRecord. */
interface LcovRecord {
    /** Stores branches as LcovBranch[]. */
    'branches': LcovBranch[];
    /** Stores functions as number[]. */
    'functions': number[];
    /** Stores jsFile as string. */
    'jsFile': string;
    /** Stores lines as [number, number][]. */
    'lines': [number, number][];
}

/** Defines interface FileCoverage. */
interface FileCoverage {
    /** Stores branchTotals as CoverageStat. */
    'branchTotals': CoverageStat;
    /** Stores branchesByLine as Map<number, number[]>. */
    'branchesByLine': Map<number, number[]>;
    /** Stores filePagePath as string. */
    'filePagePath': string;
    /** Stores functionTotals as CoverageStat. */
    'functionTotals': CoverageStat;
    /** Stores jsFile as string. */
    'jsFile': string;
    /** Stores lineHits as Map<number, SourceLineHit>. */
    'lineHits': Map<number, SourceLineHit>;
    /** Stores lineTotals as CoverageStat. */
    'lineTotals': CoverageStat;
    /** Stores relativeSourcePath as string. */
    'relativeSourcePath': string;
    /** Stores sourcePath as string. */
    'sourcePath': string;
}

/** Defines interface CoverageRow. */
interface CoverageRow {
    /** Stores branches as CoverageStat. */
    'branches': CoverageStat;
    /** Stores file as string. */
    'file': string;
    /** Stores functions as CoverageStat. */
    'functions': CoverageStat;
    /** Stores lines as CoverageStat. */
    'lines': CoverageStat;
    /** Stores uncoveredLines as number[]. */
    'uncoveredLines': number[];
}

/** Defines interface TableRow. */
interface TableRow {
    /** Stores branchPercent as string. */
    'branchPercent': string;
    /** Stores file as string. */
    'file': string;
    /** Stores functionPercent as string. */
    'functionPercent': string;
    /** Stores linePercent as string. */
    'linePercent': string;
    /** Stores uncoveredLines as string. */
    'uncoveredLines': string;
}

/** Defines interface TreeNode. */
interface TreeNode {
    /** Stores children as Map<string, TreeNode>. */
    'children': Map<string, TreeNode>;
    /** Stores label as string. */
    'label': string;
    /** Stores row as CoverageRow | null. */
    'row': CoverageRow | null;
}

/** Defines interface SourceOriginCandidate. */
interface SourceOriginCandidate {
    /** Original source file name candidate. */
    'fileName'?: unknown;
    /** Original source line number candidate. */
    'lineNumber'?: unknown;
}

/** Defines type CellStyle. */
type CellStyle = ((text: string) => string) | null | undefined;

/** Computes useColor for coverage reporting. */
const useColor = process.stdout.isTTY && process.env['NO_COLOR'] !== '1' && process.env['NODE_DISABLE_COLORS'] !== '1';

/** Documents the intent of the following statement. */
const ansi: Record<'bold' | 'dim' | 'green' | 'blue' | 'red' | 'yellow', [string, string]> = {
    'blue': ['\u001b[34m', '\u001b[39m'],
    'bold': ['\u001b[1m', '\u001b[22m'],
    'dim': ['\u001b[2m', '\u001b[22m'],
    'green': ['\u001b[32m', '\u001b[39m'],
    'red': ['\u001b[31m', '\u001b[39m'],
    'yellow': ['\u001b[33m', '\u001b[39m']
};

/** Computes workspaceRoot for coverage reporting. */
const workspaceRoot = process.cwd();

/** Computes testCommand for coverage reporting. */
const testCommand = process.execPath;

/** Computes testArgs for coverage reporting. */
const testArgs = [
    '--test',
    '--experimental-test-coverage',
    '--test-reporter=lcov',
    '--test-reporter-destination=stdout',
    '--test-reporter=spec',
    '--test-reporter-destination=stderr',
    '--test-coverage-include=bin/src/**/*.js',
    '--test-coverage-exclude=bin/test/**',
    'bin/test/**/*.test.js'
];

/**
 * Verifies a source-map origin contains file and line fields.
 * @param origin Candidate source-map origin value.
 * @returns True when origin has a string file name and numeric line number.
 */
function isSourceOrigin(origin: unknown): origin is {
    /** Original source file name. */
    'fileName': string;
    /** Original source line number. */
    'lineNumber': number;
} {
    /** Computes sourceOriginCandidate for coverage reporting. */
    const sourceOriginCandidate = origin as SourceOriginCandidate;

    /** Returns the computed value. */
    return typeof sourceOriginCandidate.fileName === 'string' && typeof sourceOriginCandidate.lineNumber === 'number';
}

/**
 * Normalizes a file path using platform rules.
 * @param filePath File path to normalize.
 * @returns Normalized path.
 */
function normalizePath(filePath: string): string {
    return path.normalize(filePath);
}

/**
 * Formats a percentage from covered and total counts.
 * @param covered Covered count.
 * @param total Total count.
 * @returns Percentage string with two decimals.
 */
function formatPercent(covered: number, total: number): string {
    if (total === 0) {
        return '100.00';
    }

    return ((covered / total) * 100).toFixed(2);
}

/**
 * Formats line numbers into compact ranges.
 * @param lineNumbers Sorted line numbers.
 * @returns Comma-delimited line ranges.
 */
function formatLineRanges(lineNumbers: number[]): string {
    if (lineNumbers.length === 0) {
        return '';
    }

    /** Documents the intent of the following statement. */
    const ranges: string[] = [];

    const [firstLineNumber] = lineNumbers;

    /** Tracks mutable state in rangeStart. */
    let rangeStart = firstLineNumber;

    /** Tracks mutable state in previousLine. */
    let previousLine = firstLineNumber;

    for (let index = 1; index < lineNumbers.length; index += 1) {
        /** Computes lineNumber for coverage reporting. */
        const lineNumber = lineNumbers[index];

        if (lineNumber === previousLine + 1) {
            previousLine = lineNumber;
        } else {
            ranges.push(rangeStart === previousLine ? `${ rangeStart }` : `${ rangeStart }-${ previousLine }`);

            rangeStart = lineNumber;

            previousLine = lineNumber;
        }
    }

    ranges.push(rangeStart === previousLine ? `${ rangeStart }` : `${ rangeStart }-${ previousLine }`);

    return ranges.join(', ');
}

/**
 * Compares two tree nodes, ordering directories before files.
 * @param left Left node.
 * @param right Right node.
 * @returns Negative, zero, or positive comparison value.
 */
function compareTreeNodes(left: TreeNode, right: TreeNode): number {
    /** Computes leftDirectory for coverage reporting. */
    const leftDirectory = left.children.size > 0;

    /** Computes rightDirectory for coverage reporting. */
    const rightDirectory = right.children.size > 0;

    if (leftDirectory !== rightDirectory) {
        return leftDirectory ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
}

/**
 * Builds tree-structured rows for grouped path output.
 * @param rows Flat coverage rows.
 * @returns Flattened table rows with path indentation.
 */
function buildTreeRows(rows: CoverageRow[]): TableRow[] {
    /** Documents the intent of the following statement. */
    const root: TreeNode = {
        'children': new Map<string, TreeNode>(),
        'label': '',
        'row': null
    };

    for (const row of rows) {
        /** Computes relativePath for coverage reporting. */
        const relativePath = normalizePath(path.relative(workspaceRoot, row.file));

        /** Computes pathParts for coverage reporting. */
        const pathParts = relativePath.split(path.sep).filter(Boolean);

        /** Tracks mutable state in currentNode. */
        let currentNode = root;

        for (let index = 0; index < pathParts.length; index += 1) {
            /** Computes part for coverage reporting. */
            const part = pathParts[index];

            /** Computes isLeaf for coverage reporting. */
            const isLeaf = index === pathParts.length - 1;

            if (!currentNode.children.has(part)) {
                currentNode.children.set(part, {
                    'children': new Map<string, TreeNode>(),
                    'label': part,
                    'row': null
                });
            }

            /** Computes nextNode for coverage reporting. */
            const nextNode = currentNode.children.get(part);

            if (nextNode) {
                currentNode = nextNode;

                if (isLeaf) {
                    currentNode.row = row;
                }
            }
        }
    }

    /** Documents the intent of the following statement. */
    const flattenedRows: TableRow[] = [];

    /**
     * Walks tree nodes and appends formatted output rows.
     * @param node Current node.
     * @param depth Current indentation depth.
     * @returns Nothing.
     */
    function walk(node: TreeNode, depth: number): void {
        /** Computes children for coverage reporting. */
        const children = Array.from(node.children.values())
            .sort((left, right) => compareTreeNodes(left, right));

        for (const childNode of children) {
            /** Computes isDirectory for coverage reporting. */
            const isDirectory = childNode.children.size > 0;

            if (isDirectory) {
                flattenedRows.push({
                    'branchPercent': '',
                    'file': `${ ' '.repeat(depth * 2) }${ childNode.label }`,
                    'functionPercent': '',
                    'linePercent': '',
                    'uncoveredLines': ''
                });

                walk(childNode, depth + 1);
            } else if (childNode.row) {
                flattenedRows.push({
                    'branchPercent': formatPercent(childNode.row.branches.covered, childNode.row.branches.total),
                    'file': `${ ' '.repeat(depth * 2) }${ childNode.label }`,
                    'functionPercent': formatPercent(childNode.row.functions.covered, childNode.row.functions.total),
                    'linePercent': formatPercent(childNode.row.lines.covered, childNode.row.lines.total),
                    'uncoveredLines': formatLineRanges(childNode.row.uncoveredLines)
                });
            }
        }

        return void 0;
    }

    walk(root, 0);

    return flattenedRows;
}

/**
 * Pads a cell value to a target width.
 * @param text Cell content before padding.
 * @param width Target width.
 * @returns Padded text.
 */
function padCell(text: string, width: number): string {
    return `${ text }${ ' '.repeat(Math.max(0, width - text.length)) }`;
}

/**
 * Formats a coverage cell and applies optional styling.
 * @param text Cell content before formatting.
 * @param width Target width.
 * @param style Optional style function.
 * @returns Formatted cell text.
 */
function formatCoverageCell(text: string, width: number, style: CellStyle): string {
    /** Computes padded for coverage reporting. */
    const padded = padCell(text, width);

    return typeof style === 'function' ? style(padded) : padded;
}

/**
 * Applies an ANSI style pair when colors are enabled.
 * @param text Input text.
 * @param codes ANSI open/close code pair.
 * @returns Styled or original text.
 */
function styleText(text: string, codes: [string, string]): string {
    if (!useColor) {
        return text;
    }

    const [open, close] = codes;

    return `${ open }${ text }${ close }`;
}

/**
 * Styles text in blue.
 * @param text Input text.
 * @returns Styled text.
 */
function styleBlue(text: string): string {
    return styleText(text, ansi.blue);
}

/**
 * Renders a colored pipe separator.
 * @returns Pipe character.
 */
function bluePipe(): string {
    return styleBlue('|');
}

/**
 * Renders a single table row string.
 * @param values Cell values.
 * @param widths Column widths.
 * @param styles Optional cell style functions.
 * @returns Formatted row text.
 */
function renderCoverageRow(values: string[], widths: number[], styles: CellStyle[] = []): string {
    /** Computes cells for coverage reporting. */
    const cells = values.map((value, index) => formatCoverageCell(value, widths[index], styles[index]));

    return `${ bluePipe() } ${ cells[0] } ${ bluePipe() } ${ cells[1] } ${ bluePipe() } ${ cells[2] } ${ bluePipe() } ${ cells[3] } ${ bluePipe() } ${ cells[4] } ${ bluePipe() }`;
}

/**
 * Renders a separator row for the coverage table.
 * @param widths Column widths.
 * @returns Separator row text.
 */
function renderCoverageSeparator(widths: number[]): string {
    return `|-${ '-'.repeat(widths[0]) }-|-${ '-'.repeat(widths[1]) }-|-${ '-'.repeat(widths[2]) }-|-${ '-'.repeat(widths[3]) }-|-${ '-'.repeat(widths[4]) }-|`;
}

/**
 * Writes a single line to stdout.
 * @param text Fully formatted line content to write.
 */
function printLine(text: string): void {
    process.stdout.write(`${ text }\n`);
}

/**
 * Chooses a style function based on a percentage string.
 * @param percentText Percentage text.
 * @returns A style function or null.
 */
function styleCoveragePercent(percentText: string): ((text: string) => string) | null {
    if (percentText === '') {
        return null;
    }

    /** Computes percent for coverage reporting. */
    const percent = Number.parseFloat(percentText);

    if (Number.isNaN(percent)) {
        return null;
    }

    if (percent >= 80) {
        return (text: string) => styleText(text, ansi.green);
    }

    if (percent >= 50) {
        return (text: string) => styleText(text, ansi.yellow);
    }

    return (text: string) => styleText(text, ansi.red);
}

/**
 * Chooses a file-name style function from percentage text.
 * @param percentText Percentage text.
 * @returns Style function for file-name rendering.
 */
function styleFileCoverage(percentText: string): (text: string) => string {
    /** Computes percent for coverage reporting. */
    const percent = Number.parseFloat(percentText);

    if (Number.isNaN(percent)) {
        return styleBlue;
    }

    if (percent >= 80) {
        return (text: string) => styleText(text, ansi.green);
    }

    if (percent >= 50) {
        return (text: string) => styleText(text, ansi.yellow);
    }

    return (text: string) => styleText(text, ansi.red);
}

/**
 * Styles header text.
 * @param text Input text.
 * @returns Styled text.
 */
function styleHeader(text: string): string {
    return styleText(text, ansi.blue);
}

/**
 * Styles text with dim output.
 * @param text Input text.
 * @returns Styled text.
 */
function styleDim(text: string): string {
    return styleText(text, ansi.dim);
}

/**
 * Styles separator text.
 * @param text Input text.
 * @returns Styled text.
 */
function styleSeparator(text: string): string {
    return styleBlue(text);
}

/**
 * Summarizes hit data into covered and total counts.
 * @param entries Hit values or line/hit tuples.
 * @returns Coverage summary.
 */
function summarizeHits(entries: (number | [number, number])[]): CoverageStat {
    /** Tracks mutable state in total. */
    let total = 0;

    /** Tracks mutable state in covered. */
    let covered = 0;

    for (const entry of entries) {
        /** Computes hits for coverage reporting. */
        const hits = Array.isArray(entry) ? entry[1] : entry;

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
 * Summarizes function hit values.
 * @param entries Function hit values.
 * @returns Coverage summary.
 */
function summarizeFunctions(entries: number[]): CoverageStat {
    return summarizeHits(entries);
}

/**
 * Summarizes line-hit status values.
 * @param lineHits Line-hit map.
 * @returns Coverage summary.
 */
function summarizeLineHits(lineHits: Map<number, SourceLineHit>): CoverageStat {
    /** Tracks mutable state in total. */
    let total = 0;

    /** Tracks mutable state in covered. */
    let covered = 0;

    for (const lineStatus of lineHits.values()) {
        if (lineStatus.covered || lineStatus.uncovered) {
            total += 1;

            if (lineStatus.covered && !lineStatus.uncovered) {
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
 * Summarizes branch-hit values.
 * @param branchHitsByLine Branch-hit map.
 * @returns Coverage summary.
 */
function summarizeBranchHits(branchHitsByLine: Map<number, number[]>): CoverageStat {
    /** Documents the intent of the following statement. */
    const values: number[] = [];

    for (const branchHits of branchHitsByLine.values()) {
        values.push(...branchHits);
    }

    return summarizeHits(values);
}

/**
 * Computes rendered row width including separators.
 * @param widths Column widths.
 * @returns Total rendered width.
 */
function renderCoverageRowWidth(widths: number[]): number {
    return widths.reduce((total, width) => total + width, 0) + 16;
}

/**
 * Wraps text to a target column width.
 * @param text Input text.
 * @param width Target width.
 * @returns Wrapped lines.
 */
function wrapCellText(text: string, width: number): string[] {
    if (text.length === 0) {
        return [];
    }

    if (width <= 0) {
        return [text];
    }

    /** Documents the intent of the following statement. */
    const lines: string[] = [];

    /** Tracks mutable state in currentLine. */
    let currentLine = '';

    for (const token of text.match(/\S+\s*/gu) ?? []) {
        /** Computes tokenText for coverage reporting. */
        const tokenText = token.trimEnd();

        /** Computes tokenLength for coverage reporting. */
        const tokenLength = tokenText.length;

        if (tokenLength > width) {
            if (currentLine.length > 0) {
                lines.push(currentLine.trimEnd());

                currentLine = '';
            }

            for (let index = 0; index < tokenText.length; index += width) {
                lines.push(tokenText.slice(index, index + width));
            }
        } else if (currentLine.length === 0) {
            currentLine = tokenText;
        } else if (currentLine.length + 1 + tokenLength <= width) {
            currentLine = `${ currentLine } ${ tokenText }`;
        } else {
            lines.push(currentLine.trimEnd());

            currentLine = tokenText;
        }
    }

    if (currentLine.length > 0) {
        lines.push(currentLine.trimEnd());
    }

    return lines;
}

/**
 * Collects uncovered line numbers from line-hit state.
 * @param lineHits Line-hit map.
 * @returns Sorted uncovered line numbers.
 */
function collectUncoveredLineNumbers(lineHits: Map<number, SourceLineHit>): number[] {
    /** Documents the intent of the following statement. */
    const lineNumbers: number[] = [];

    for (const [lineNumber, lineStatus] of lineHits.entries()) {
        if (lineStatus.uncovered) {
            lineNumbers.push(lineNumber);
        }
    }

    return lineNumbers.sort((left, right) => left - right);
}

/**
 * Renders a row, wrapping uncovered-line text across multiple lines.
 * @param values Cell values.
 * @param widths Column widths.
 * @param styles Optional cell style functions.
 * @returns Rendered terminal lines for the row.
 */
function renderCoverageRowLines(values: string[], widths: number[], styles: CellStyle[] = []): string[] {
    /** Computes uncoveredLines for coverage reporting. */
    const uncoveredLines = wrapCellText(values[4], widths[4]);

    if (uncoveredLines.length === 0) {
        uncoveredLines.push('');
    }

    return uncoveredLines.map((uncoveredLine, index) => renderCoverageRow([
        index === 0 ? values[0] : '',
        index === 0 ? values[1] : '',
        index === 0 ? values[2] : '',
        index === 0 ? values[3] : '',
        uncoveredLine
    ], widths, [styles[0], styles[1], styles[2], styles[3], styles[4]]));
}

/**
 * Renders a coverage table to stdout.
 * @param rows Per-file coverage rows.
 * @returns Nothing.
 */
function printCoverageTable(rows: CoverageRow[]): void {
    /** Computes totals for coverage reporting. */
    const totals = rows.reduce((accumulator: {
        /** Stores branches as CoverageStat. */
        'branches': CoverageStat;
        /** Stores functions as CoverageStat. */
        'functions': CoverageStat;
        /** Stores lines as CoverageStat. */
        'lines': CoverageStat;
    }, row: CoverageRow) => {
        accumulator.lines.covered += row.lines.covered;

        accumulator.lines.total += row.lines.total;

        accumulator.branches.covered += row.branches.covered;

        accumulator.branches.total += row.branches.total;

        accumulator.functions.covered += row.functions.covered;

        accumulator.functions.total += row.functions.total;

        return accumulator;
    }, {
        'branches': {
            'covered': 0,
            'total': 0
        },
        'functions': {
            'covered': 0,
            'total': 0
        },
        'lines': {
            'covered': 0,
            'total': 0
        }
    });

    /** Computes tableRows for coverage reporting. */
    const tableRows = buildTreeRows(rows);

    /** Computes totalsRow for coverage reporting. */
    const totalsRow = {
        'branchPercent': formatPercent(totals.branches.covered, totals.branches.total),
        'file': 'all files',
        'functionPercent': formatPercent(totals.functions.covered, totals.functions.total),
        'linePercent': formatPercent(totals.lines.covered, totals.lines.total),
        'uncoveredLines': ''
    };

    /** Computes terminalWidth for coverage reporting. */
    const terminalWidth = Number.isFinite(process.stdout.columns) ? process.stdout.columns : 120;

    /** Computes fileWidth for coverage reporting. */
    const fileWidth = Math.max('file'.length, totalsRow.file.length, ...tableRows.map((row) => row.file.length));

    /** Computes lineWidth for coverage reporting. */
    const lineWidth = Math.max('line %'.length, totalsRow.linePercent.length, ...tableRows.map((row) => row.linePercent.length));

    /** Computes branchWidth for coverage reporting. */
    const branchWidth = Math.max('branch %'.length, totalsRow.branchPercent.length, ...tableRows.map((row) => row.branchPercent.length));

    /** Computes funcWidth for coverage reporting. */
    const funcWidth = Math.max('funcs %'.length, totalsRow.functionPercent.length, ...tableRows.map((row) => row.functionPercent.length));

    /** Computes uncoveredWidth for coverage reporting. */
    const uncoveredWidth = Math.max(
        'uncovered lines'.length,
        terminalWidth - renderCoverageRowWidth([fileWidth, lineWidth, branchWidth, funcWidth, 0])
    );

    /** Computes columnWidths for coverage reporting. */
    const columnWidths = [fileWidth, lineWidth, branchWidth, funcWidth, uncoveredWidth];

    printLine('\nTS coverage report');

    printLine(styleSeparator(renderCoverageSeparator(columnWidths)));

    printLine(renderCoverageRow(['file', 'line %', 'branch %', 'funcs %', 'uncovered lines'], columnWidths, [styleHeader, styleHeader, styleHeader, styleHeader, styleHeader]));

    printLine(styleSeparator(renderCoverageSeparator(columnWidths)));

    for (const row of tableRows) {
        /** Computes lineStyle for coverage reporting. */
        const lineStyle = styleCoveragePercent(row.linePercent);

        /** Computes branchStyle for coverage reporting. */
        const branchStyle = styleCoveragePercent(row.branchPercent);

        /** Computes functionStyle for coverage reporting. */
        const functionStyle = styleCoveragePercent(row.functionPercent);

        /** Computes fileStyle for coverage reporting. */
        const fileStyle = row.linePercent === '' ? styleBlue : styleFileCoverage(row.linePercent);

        for (const renderedRow of renderCoverageRowLines([
            row.file,
            row.linePercent,
            row.branchPercent,
            row.functionPercent,
            row.uncoveredLines
        ], columnWidths, [fileStyle, lineStyle, branchStyle, functionStyle, styleDim])) {
            printLine(renderedRow);
        }
    }

    printLine(styleSeparator(renderCoverageSeparator(columnWidths)));

    printLine(renderCoverageRow([totalsRow.file, totalsRow.linePercent, totalsRow.branchPercent, totalsRow.functionPercent, totalsRow.uncoveredLines], columnWidths, [styleBlue, styleCoveragePercent(totalsRow.linePercent), styleCoveragePercent(totalsRow.branchPercent), styleCoveragePercent(totalsRow.functionPercent), styleBlue]));

    printLine(styleSeparator(renderCoverageSeparator(columnWidths)));

    return void 0;
}

/**
 * Parses lcov text into structured coverage records.
 * @param lcovText Raw lcov text.
 * @returns Parsed lcov records.
 */
function parseLcov(lcovText: string): LcovRecord[] {
    /** Collects parsed lcov records. */
    const records: LcovRecord[] = [];

    /** Documents the intent of the following statement. */
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
                const [lineNumberText, hitsText] = line.slice(3).split(',');

                /** Computes lineNumber for coverage reporting. */
                const lineNumber = Number.parseInt(lineNumberText, 10);

                /** Computes hits for coverage reporting. */
                const hits = Number.parseInt(hitsText, 10);

                if (!Number.isNaN(lineNumber) && !Number.isNaN(hits)) {
                    currentRecord.lines.push([lineNumber, hits]);
                }
            } else if (line.startsWith('BRDA:')) {
                /** Computes parts for coverage reporting. */
                const parts = line.slice(5).split(',');

                const [lineNumberText, , , hitsText] = parts;

                /** Computes lineNumber for coverage reporting. */
                const lineNumber = Number.parseInt(lineNumberText, 10);

                /** Computes hits for coverage reporting. */
                const hits = hitsText === '-' ? 0 : Number.parseInt(hitsText, 10);

                if (!Number.isNaN(lineNumber) && !Number.isNaN(hits)) {
                    currentRecord.branches.push({
                        hits,
                        lineNumber
                    });
                }
            } else if (line.startsWith('FNDA:')) {
                const [hitsText] = line.slice(5).split(',');

                /** Computes hits for coverage reporting. */
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
 * Resolves the source map file path from a JavaScript file.
 * @param jsFile JavaScript file path.
 * @returns Absolute source map path, or null when not present.
 */
async function findSourceMapPath(jsFile: string): Promise<string | null> {
    /** Computes jsText for coverage reporting. */
    const jsText = await readFile(jsFile, 'utf8');

    /** Computes sourceMapMatch for coverage reporting. */
    const sourceMapMatch = (/\/\/#[\t ]sourceMappingURL=(?<sourceMapUrl>.+)$/mu).exec(jsText);

    if (!sourceMapMatch) {
        return null;
    }

    /** Computes sourceMapUrl for coverage reporting. */
    const sourceMapUrl = sourceMapMatch.groups?.['sourceMapUrl']?.trim();

    if (!sourceMapUrl) {
        return null;
    }

    if (sourceMapUrl.startsWith('data:')) {
        return null;
    }

    return path.resolve(path.dirname(jsFile), sourceMapUrl);
}

/**
 * Loads and parses a source map referenced by a JS file.
 * @param jsFile JavaScript file path.
 * @returns Parsed source map, or null when unavailable.
 */
async function loadSourceMap(jsFile: string): Promise<SourceMap | null> {
    /** Computes sourceMapPath for coverage reporting. */
    const sourceMapPath = await findSourceMapPath(jsFile);

    if (!sourceMapPath) {
        return null;
    }

    /** Computes sourceMapText for coverage reporting. */
    const sourceMapText = await readFile(sourceMapPath, 'utf8');

    /** Computes sourceMapPayload for coverage reporting. */
    const sourceMapPayload = JSON.parse(sourceMapText) as SourceMapPayload;

    return new SourceMap(sourceMapPayload);
}

/**
 * Resolves an original source path relative to the JS file.
 * @param jsFile JavaScript file path.
 * @param originalSource Source path from source map payload.
 * @returns Absolute source file path.
 */
function resolveOriginalSourcePath(jsFile: string, originalSource: string): string {
    if (path.isAbsolute(originalSource)) {
        return originalSource;
    }

    return path.resolve(path.dirname(jsFile), originalSource);
}

/**
 * Creates initial coverage state for a source file.
 * @param sourcePath Absolute path for the TypeScript source file being tracked.
 * @param jsFile Transpiled JavaScript file that produced the coverage data.
 * @returns Initialized coverage object.
 */
function createFileCoverage(sourcePath: string, jsFile: string): FileCoverage {
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
        jsFile,
        'lineHits': new Map<number, SourceLineHit>(),
        'lineTotals': {
            'covered': 0,
            'total': 0
        },
        'relativeSourcePath': normalizePath(path.relative(workspaceRoot, sourcePath)),
        sourcePath
    };
}

/**
 * Converts lcov output into a TypeScript-oriented coverage report.
 * @param lcovText Raw lcov text.
 * @returns Promise that resolves when report output is complete.
 */
async function printTypeScriptCoverage(lcovText: string): Promise<void> {
    /** Computes records for coverage reporting. */
    const records = parseLcov(lcovText);

    /** Computes files for coverage reporting. */
    const files = new Map<string, FileCoverage>();

    for (const record of records) {
        /** Computes sourceMap for coverage reporting. */
        const sourceMap = await loadSourceMap(record.jsFile);

        if (sourceMap) {
            /** Computes fileSummaries for coverage reporting. */
            const fileSummaries = new Map<string, FileCoverage>();

            for (const [lineNumber, hits] of record.lines) {
                /** Computes origin for coverage reporting. */
                const origin = sourceMap.findOrigin(lineNumber, Number.MAX_SAFE_INTEGER);

                if (isSourceOrigin(origin)) {
                    /** Computes sourcePath for coverage reporting. */
                    const sourcePath = normalizePath(resolveOriginalSourcePath(record.jsFile, origin.fileName));

                    /** Computes file for coverage reporting. */
                    const file = files.get(sourcePath) ?? createFileCoverage(sourcePath, record.jsFile);

                    /** Computes lineStatus for coverage reporting. */
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
                /** Computes origin for coverage reporting. */
                const origin = sourceMap.findOrigin(branch.lineNumber, Number.MAX_SAFE_INTEGER);

                if (isSourceOrigin(origin)) {
                    /** Computes sourcePath for coverage reporting. */
                    const sourcePath = normalizePath(resolveOriginalSourcePath(record.jsFile, origin.fileName));

                    /** Computes file for coverage reporting. */
                    const file = files.get(sourcePath) ?? createFileCoverage(sourcePath, record.jsFile);

                    /** Computes branches for coverage reporting. */
                    const branches = file.branchesByLine.get(origin.lineNumber) ?? ([] as number[]);

                    branches.push(branch.hits);

                    file.branchesByLine.set(origin.lineNumber, branches);

                    files.set(sourcePath, file);

                    fileSummaries.set(sourcePath, file);
                }
            }

            for (const file of fileSummaries.values()) {
                file.functionTotals = summarizeFunctions(record.functions);
            }
        }
    }

    /** Computes rows for coverage reporting. */
    const rows = Array.from(files.values())
        .map((file) => ({
            'branches': summarizeBranchHits(file.branchesByLine),
            'file': file.sourcePath,
            'functions': file.functionTotals,
            'lines': summarizeLineHits(file.lineHits),
            'uncoveredLines': collectUncoveredLineNumbers(file.lineHits)
        }))
        .filter((row) => row.uncoveredLines.length > 0)
        .sort((left, right) => left.file.localeCompare(right.file));

    if (rows.length === 0) {
        return;
    }

    printCoverageTable(rows);
}

/** Computes child for coverage reporting. */
const child = spawn(testCommand, testArgs, {
    'cwd': workspaceRoot,
    'env': process.env,
    'stdio': ['ignore', 'pipe', 'inherit']
});

/** Tracks mutable state in lcovOutput. */
let lcovOutput = '';

child.stdout.setEncoding('utf8');

child.stdout.on('data', (chunk: string) => {
    lcovOutput += chunk;
});

/** Computes exitCode for coverage reporting. */
const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject);

    child.on('close', (code) => {
        resolve(code);
    });
});

await printTypeScriptCoverage(lcovOutput);

process.exitCode = typeof exitCode === 'number' ? exitCode : 1;
