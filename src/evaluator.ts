import chalk from "chalk";
import { INode, ITopNode, IVardecNode, ISymbolNode, NodeType, IExpressionNode, IValueNode, IOperatorNode, IFunctionCallNode } from "./parser";
import { BuiltIn } from "./token";

export interface IVar {
    name: string,
    val: any,
    type: BuiltIn
}

export interface IDummy<T> { // this interface sucks
    d: T
};

export const standardFunctions: any = {
    print: console.log
};

export default class Evaluator {
    private ast: ITopNode;
    private variables: IVar[];

    constructor(ast: ITopNode) {
        this.ast = ast;
        this.variables = [];
    }

    private parseSymbol(s: ISymbolNode) : IVar {
        const r = this.variables.find(y => y.name === s.name);
        if (!r) {
            throw `The symbol ${s.name} does not exist.`;
        }
        return r;
    }

    private nodesToLiterals(n : INode[]) : any[] {
        return n.map(v => {
            switch(v.type) {
            case NodeType.UnparsedSymbol:
            case NodeType.Symbol:
                return this.parseSymbol(v as ISymbolNode).val;
            case NodeType.StringLiteral:
                return (v as IValueNode).value.slice(1, -1);
            case NodeType.NumberLiteral:
                return (v as IValueNode).value;
            case NodeType.Expression:
                return this.parseExpression(v as IExpressionNode);
            case NodeType.UnparsedOperator:
                return (v as IOperatorNode).operator;
            default:
                return null;
            }
        }).filter(v => v);
    }

    private parseExpression(n : IExpressionNode) : any {
        // Parse symbols into IVars
        const p = (v: INode | IVar) : any => { // this name is VERY descriptive. what does this function do? it p
            if (v.type === NodeType.UnparsedSymbol) {
                return this.parseSymbol(v as ISymbolNode);
            } else if (v.type === NodeType.Expression) {
                return (v as IExpressionNode).expr.map(p);
            } else {
                return v;
            }
        }
        const expr : any[] /* actually can have either INodes, IVars or expressions turned into arrays. too tired to write a type annotation for that if it's even possible*/ = n.expr.map(p);

        // Convert into mathematical expression
        let exprStr = "";
        const r = (v: any) : void => { // yet another descriptive name
            if (v.length) {
                exprStr += "(";
                v.forEach(r);
                exprStr += ")";
                return; // i like this code
            }
            if (v.type !== NodeType.UnparsedOperator) {
                if (typeof v.type === "string") {
                    exprStr += `(${v.type === "string" ? (v as IVar).val.slice(1, -1) : (v as IVar).val})`;
                } else {
                    exprStr += `(${(v as IValueNode).value})`;
                }
            } else {
                exprStr += (v as IOperatorNode).operator;
            }
        }
        expr.forEach(r);

        return eval(exprStr);
    }

    private evaluateVariableDeclaration(n: IVardecNode) {
        this.variables.filter(v => v.name !== n.varname);
        if (['string', 'number', 'boolean'].includes(typeof n.varval)) {
            this.variables.push({
                name: n.varname,
                type: n.vartype,
                val : typeof n.varval === 'string' ? n.varval.slice(1, -1) : n.varval
            } as IVar);
        } else {
            if (n.varval.type === NodeType.Expression) {
                this.variables.push({
                    name: n.varname,
                    type: n.vartype,
                    val : this.parseExpression(n.varval)
                } as IVar);
            } else { // there is only one thing it can be now, a Symbol.
                const vv = n.varval as ISymbolNode;
                const variable = this.parseSymbol(vv);
                if (variable.type !== n.vartype) {
                    throw `Cannot set ${n.varname} to ${variable.val} - they are of different types (TODO: casting).`;
                }
                this.variables.push({
                    name: n.varname,
                    type: n.vartype,
                    val : variable.val
                });
            }
        }
    }

    private evaluateFunctionCall(n: IFunctionCallNode) {
        if (standardFunctions[n.name]) {
            standardFunctions[n.name](...this.nodesToLiterals(n.args));
        } else {
            throw `Function ${n.name} does not exist.`;
        }
    }

    private run(node: INode) {
        switch(node.type) {
        case NodeType.VariableDeclaration:
            this.evaluateVariableDeclaration(node as IVardecNode);
            break;
        case NodeType.FunctionCall:
            this.evaluateFunctionCall(node as IFunctionCallNode);
            break;
        }
    }

    public evaluate() {
        const st = Date.now();
        this.ast.body.forEach(v => this.run(v));
        console.log(chalk.grey(`Evaluated program in ${Date.now() - st} ms`));
    }
}