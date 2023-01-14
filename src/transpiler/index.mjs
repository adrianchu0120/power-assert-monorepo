import { replace } from 'estraverse';
import { Transformation } from './transformation.mjs';
import { AssertionVisitor } from './assertion-visitor.mjs';
import { NodeCreator } from './create-node-with-loc.mjs';
import { getCurrentKey } from './controller-utils.mjs';

function isLiteral (node) {
  return node && node.type === 'Literal';
}
function isIdentifier (node) {
  return node && node.type === 'Identifier';
}
function isObjectPattern (node) {
  return node && node.type === 'ObjectPattern';
}
function isMemberExpression (node) {
  return node && node.type === 'MemberExpression';
}
function isCallExpression (node) {
  return node && node.type === 'CallExpression';
}
function isImportDeclaration (node) {
  return node && node.type === 'ImportDeclaration';
}

function createVisitor (ast, options) {
  const config = Object.assign(defaultOptions(), options);
  const targetModules = new Set(config.modules);
  const targetVariables = new Set(config.variables);

  function isAssertionModuleName (lit) {
    return isLiteral(lit) && targetModules.has(lit.value);
  }

  function isAssertionVariableName (id) {
    return isIdentifier(id) && targetVariables.has(id.name);
  }

  function isAssertionMethod (callee) {
    if (!isMemberExpression(callee)) {
      return false;
    }
    const obj = callee.object;
    if (isMemberExpression(obj)) {
      return isAssertionMethod(obj);
    } else {
      return isAssertionVariableName(obj);
    }
  }

  function isAssertionFunction (callee) {
    return isAssertionVariableName(callee);
  }

  function registerIdentifierAsAssertionVariable (id) {
    if (isIdentifier(id)) {
      targetVariables.add(id.name);
    }
  }

  function handleDestructuredAssertionAssignment (objectPattern) {
    for (const { value } of objectPattern.properties) {
      registerIdentifierAsAssertionVariable(value);
    }
  }

  function handleImportSpecifiers (importDeclaration) {
    for (const { local } of importDeclaration.specifiers) {
      registerIdentifierAsAssertionVariable(local);
    }
  }

  function registerAssertionVariables (node) {
    if (isIdentifier(node)) {
      registerIdentifierAsAssertionVariable(node);
    } else if (isObjectPattern(node)) {
      handleDestructuredAssertionAssignment(node);
    } else if (isImportDeclaration(node)) {
      handleImportSpecifiers(node);
    }
  }

  function isRequireAssert (id, init) {
    if (!isCallExpression(init)) {
      return false;
    }
    const callee = init.callee;
    if (!isIdentifier(callee) || callee.name !== 'require') {
      return false;
    }
    const arg = init.arguments[0];
    if (!isLiteral(arg) || !isAssertionModuleName(arg)) {
      return false;
    }
    return isIdentifier(id) || isObjectPattern(id);
  }

  function isRequireAssertDotStrict (id, init) {
    if (!isMemberExpression(init)) {
      return false;
    }
    if (!isRequireAssert(id, init.object)) {
      return false;
    }
    const prop = init.property;
    if (!isIdentifier(prop)) {
      return false;
    }
    return prop.name === 'strict';
  }

  function isEnhanceTargetRequire (id, init) {
    return isRequireAssert(id, init) || isRequireAssertDotStrict(id, init);
  }

  function isCaptureTargetAssertion (callee) {
    return isAssertionFunction(callee) || isAssertionMethod(callee);
  }

  function isCalleeOfParentCallExpression (parentNode, currentKey) {
    return parentNode.type === 'CallExpression' && currentKey === 'callee';
  }

  const nodeToCapture = new WeakSet();
  const blockStack = [];
  const transformation = new Transformation(blockStack);
  let decoratorFunctionIdent;
  let assertionVisitor;
  let skipping = false;

  return {
    enter: function (currentNode, parentNode) {
      const controller = this;

      if (/^Program$|Block$|Function/.test(currentNode.type)) {
        blockStack.push(currentNode);
      }

      if (assertionVisitor) {
        if (assertionVisitor.isNodeToBeSkipped(controller)) {
          skipping = true;
          // console.log(`##### skipping ${this.path().join('/')} #####`);
          return controller.skip();
        }
        const currentKey = getCurrentKey(controller);
        if (!assertionVisitor.isCapturingArgument() && !isCalleeOfParentCallExpression(parentNode, currentKey)) {
          // entering argument
          assertionVisitor.enterArgument(controller);
        }

        if (assertionVisitor.isCapturingArgument()) {
          if (assertionVisitor.isNodeToBeCaptured(controller)) {
            // calculate location then save it
            assertionVisitor.enterNodeToBeCaptured(controller);
          }
        }
      } else {
        switch (currentNode.type) {
          case 'ImportDeclaration': {
            const source = currentNode.source;
            if (!(isAssertionModuleName(source))) {
              return undefined;
            }
            this.skip();
            // register local identifier(s) as assertion variable
            registerAssertionVariables(currentNode);
            break;
          }
          case 'VariableDeclarator': {
            if (isEnhanceTargetRequire(currentNode.id, currentNode.init)) {
              this.skip();
              // register local identifier(s) as assertion variable
              registerAssertionVariables(currentNode.id);
            }
            break;
          }
          case 'AssignmentExpression': {
            if (currentNode.operator !== '=') {
              return undefined;
            }
            if (isEnhanceTargetRequire(currentNode.left, currentNode.right)) {
              this.skip();
              // register local identifier(s) as assertion variable
              registerAssertionVariables(currentNode.left);
            }
            break;
          }
          case 'CallExpression': {
            const callee = currentNode.callee;
            if (isCaptureTargetAssertion(callee)) {
              nodeToCapture.add(currentNode);

              const runtime = config.runtime;
              if (!decoratorFunctionIdent) {
                decoratorFunctionIdent = createPowerAssertImports({ transformation, controller, runtime });
              }

              // entering target assertion
              // start capturing
              assertionVisitor = new AssertionVisitor({ transformation, decoratorFunctionIdent });
              assertionVisitor.enter(controller, config.code);
              // console.log(`##### enter assertion ${this.path().join('/')} #####`);
            }
            break;
          }
        }
      }
      return undefined;
    },
    leave: function (currentNode, parentNode) {
      try {
        const controller = this;
        const path = controller.path();
        const espath = path ? path.join('/') : '';
        if (transformation.isTarget(espath)) {
          const targetNode = currentNode;
          transformation.apply(espath, targetNode);
          return targetNode;
        }
        if (!assertionVisitor) {
          return undefined;
        }
        if (skipping) {
          skipping = false;
          return undefined;
        }
        // console.log(`##### leave ${this.path().join('/')} #####`);
        if (nodeToCapture.has(currentNode)) {
          // leaving assertion
          // stop capturing
          // console.log(`##### leave assertion ${this.path().join('/')} #####`);
          const resultTree = assertionVisitor.leave(controller);
          assertionVisitor = null;
          return resultTree;
        }
        if (!assertionVisitor.isCapturingArgument()) {
          return undefined;
        }
        if (assertionVisitor.isLeavingArgument(controller)) {
          // capturing whole argument on leaving argument
          return assertionVisitor.leaveArgument(controller);
        } else if (assertionVisitor.isNodeToBeCaptured(controller)) {
          // capturing intermediate Node
          // console.log(`##### capture value ${this.path().join('/')} #####`);
          return assertionVisitor.leaveNodeToBeCaptured(controller);
        }
        return undefined;
      } finally {
        if (/^Program$|Block$|Function/.test(currentNode.type)) {
          blockStack.pop();
        }
      }
    }
  };
}

function createPowerAssertImports ({ transformation, controller, runtime }) {
  const types = new NodeCreator();
  const decoratorFunctionIdent = types.identifier('_power_');
  const decl = types.importDeclaration([
    types.importSpecifier(decoratorFunctionIdent)
  ], types.stringLiteral(runtime));
  transformation.insertDeclIntoTopLevel(controller, decl);
  return decoratorFunctionIdent;
}

function espowerAst (ast, options) {
  return replace(ast, createVisitor(ast, options));
}

function defaultOptions () {
  return {
    runtime: '@power-assert/runtime',
    modules: [
      'assert',
      'assert/strict',
      'node:assert',
      'node:assert/strict'
    ]
  };
}

export {
  espowerAst,
  defaultOptions
};