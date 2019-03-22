/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
//编译器创建函数的创建函数
// 缓存生成包含(生成渲染函数内容的函数和生成渲染函数的函数)对象的函数
export const createCompiler = createCompilerCreator(
  /*
    作用:
         1、解析模板成AST树对象
         2、将AST树优化，区别那些是静态的，那些是动态的
         3、将ast树对象解析成动态渲染函数字符串(render)和包含所有静态渲染函数字符串的数组(staticRenderFns)
         4、将ast树对象 、render、staticRenderFns输出
  */
  function baseCompile (
    template: string,
    options: CompilerOptions //开发者传入的option和默认的option合并后的option
  ): CompiledResult {
    // 调用 parse 函数将字符串模板解析成抽象语法树(AST)
    const ast = parse(template.trim(), options)
    if (options.optimize !== false) {
      // 优化AST树为节点信息添加static、staticInFor、staticRoot属性为false或true来表示该节点是否为纯静态的
      optimize(ast, options)
    }
    // 调用 generate 函数将 ast 编译成(动态渲染函数和静态渲染函数)
    const code = generate(ast, options)
    // 将ast树和字符串形式的render函数和staticRenderFns(包含所有静态渲染函数)数组作为属性值输出
    return {
      ast,
      render: code.render,
      staticRenderFns: code.staticRenderFns
    }
  }
)
//初始化编译函数执行顺序
//createCompilerCreator ===> createCompiler ===> createCompileToFunctionFn ===> compileToFunctions ===>
//compile ===> baseCompile ===> parse ===> optimize ===> generate ===> createFunction
