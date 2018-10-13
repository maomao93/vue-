/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
//编译器创建函数的创建函数
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions //开发者传入的option和默认的option合并后的option
): CompiledResult {
  // 调用 parse 函数将字符串模板解析成抽象语法树(AST)
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  // 调用 generate 函数将 ast 编译成渲染函数
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
//初始化编译函数执行顺序
//createCompilerCreator ===> createCompiler ===> createCompileToFunctionFn ===> compileToFunctions ===>
//compile ===> baseCompile ===> parse ===> optimize ===> generate ===> createFunction
