import { type Rule, type SourceCode } from 'eslint';
import type { Comment } from 'estree';

/**
 * Checks if the given comment is a legacy V8 ignore next comment that is adjacent to the given node.
 * @param comment The comment to check.
 * @param node The AST node to check against.
 * @returns A boolean indicating whether the comment is a legacy V8 ignore next comment adjacent to the node.
 */
function isLegacyV8IgnoreNextComment(comment: Comment | undefined, node: Rule.Node): boolean {
    if (!node.loc) {
        return false;
    }

    return (
        comment?.type === 'Block' &&
        comment.value.trim() === 'v8 ignore next' &&
        comment.loc?.end.line === node.loc.start.line - 1
    );
}

/**
 * Checks if the given node has a preceding comment that matches the V8 ignore directive.
 * @param sourceCode The source code object provided by ESLint, which contains methods for accessing the code being linted and its comments.
 * @param node The AST node to check for a preceding comment.
 * @returns A boolean indicating whether the node has a preceding comment that matches the V8 ignore directive.
 */
function hasV8IgnoreNextComment(sourceCode: SourceCode, node: Rule.Node): boolean {
    if (!node.loc || !node.range) {
        return false;
    }

    /** The comment that exists on the immediate line before the inspected node. */
    const precedingComment = sourceCode.getCommentsBefore(node).at(-1);

    return (
        precedingComment?.type === 'Block' &&
        precedingComment.value.trim() === 'v8 ignore next -- @preserve' &&
        precedingComment.loc?.end.line === node.loc.start.line - 1
    );
}

/**
 * Checks if the given node is a call expression to the function `assertGuardEquals`.
 * @param node The AST node to check.
 * @returns A boolean indicating whether the node is a call expression to `assertGuardEquals`.
 */
function isAssertGuardEquals(node: Rule.Node): boolean {
    return node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'assertGuardEquals';
}

const v8IgnoreAssertGuardEquals: Rule.RuleModule = {
    /**
     * Create is a method that defines the logic for the ESLint rule. It returns an object containing visitor methods that will be called during the traversal of the Abstract Syntax Tree (AST) of the code being linted.
     * @param context The context object provided by ESLint, which contains information about the current state of the linting process and provides methods for reporting issues and accessing the source code.
     * @returns The visitor object that will be used to traverse the AST and apply the rule logic.
     */
    create(context: Rule.RuleContext) {
        const { sourceCode } = context;

        return {
            /**
             * CallExpression is a visitor method that will be called for every CallExpression node in the AST. It checks if the node is a call to `assertGuardEquals`
             * and whether it has a preceding V8 ignore comment. If not, it reports an issue and provides a fixer to automatically add the required comment.
             * @param node The CallExpression AST node being visited.
             */
            CallExpression(node): void {
                if (!isAssertGuardEquals(node)) { return; }

                if (hasV8IgnoreNextComment(sourceCode, node)) { return; }

                context.report({
                    /**
                     * Fixer function that defines how to automatically fix the reported issue. It takes a fixer object as an argument, which provides methods for creating and applying fixes to the source code.
                     * @param fixer The fixer object provided by ESLint, which contains methods for creating and applying fixes to the source code.
                     * @returns A fix object that describes the changes to be made to the source code in order to resolve the reported issue.
                     */
                    fix(fixer) {
                        /** The comment to create. */
                        const comment = '/* v8 ignore next -- @preserve */\n';

                        /** The comment directly before the code being inspected. */
                        const precedingComment = sourceCode.getCommentsBefore(node).at(-1);

                        if (isLegacyV8IgnoreNextComment(precedingComment, node)) {
                            return fixer.replaceText(precedingComment, '/* v8 ignore next -- @preserve */');
                        }

                        return fixer.insertTextBefore(node, comment);
                    },
                    'messageId': 'wrap',
                    node
                });
            }
        };
    },
    'meta': {
        'dialects': ['typescript'],
        'docs': {
            'description': 'All assertGuardEquals calls should be ignored by V8.',
            'recommended': false
        },
        'fixable': 'code',
        'messages': {
            'wrap': 'All assertGuardEquals calls should be ignored by V8.'
        },
        'type': 'problem'
    }

};

export default v8IgnoreAssertGuardEquals;
