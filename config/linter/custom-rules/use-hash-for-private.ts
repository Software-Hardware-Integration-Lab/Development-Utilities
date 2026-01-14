import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import type { Rule } from 'eslint';

/** Define the rule metadata along with the logic to determine whether examined item should be flagged or not. */
const useHasForPrivate: Rule.RuleModule = {
    /**
     * Business logic of the rule to evaluate properties and functions.
     * @param context The item being examined.
     * @returns Passed test or message indication actions to resolve the found deficiency.
     */
    create(context) {
        return {
            /**
             * Method to check class function for using keyword 'private' instead of being named with #.
             * @param node The function under examination.
             */
            MethodDefinition(node): void {
                /** Reassign incoming parameter with proper type for ease of reference. */
                const tsNode = node as unknown as TSESTree.MethodDefinition;

                // Ignore constructor functions at all times
                if (tsNode.kind === 'constructor') { return; }

                // Confirm function implementation violates all conditions and should be reported
                if (tsNode.accessibility === 'private' &&
                    tsNode.key.type === AST_NODE_TYPES.Identifier && !tsNode.key.name.startsWith('#')
                ) {
                    context.report({
                        'messageId': 'useHash',
                        node
                    });
                }
            },
            /**
             * Method to check class property for using keyword 'private' instead of being named with #.
             * @param node The property under examination.
             */
            PropertyDefinition(node): void {
                /** Reassign incoming parameter with proper type for ease of reference. */
                const tsNode = node as unknown as TSESTree.PropertyDefinition;

                // Confirm class property implementation violates all conditions and should be reported
                if (tsNode.accessibility === 'private' &&
                    tsNode.key.type === AST_NODE_TYPES.Identifier && !tsNode.key.name.startsWith('#')
                ) {
                    context.report({
                        'messageId': 'useHash',
                        node
                    });
                }
            }
        };
    },
    'meta': {
        'docs': {
            'description': 'Disallow use of "private" definition for properties and classes ' +
                'in favor of "#" in naming to enforce the concept at run-time'
        },
        'messages': {
            'useHash': 'Change property/function name use include "#" instead of "private" keyword to ' +
                'indicate access restriction.'
        },
        'schema': [],
        'type': 'suggestion'
    }
};

// Share the rule with the world
export default useHasForPrivate;
