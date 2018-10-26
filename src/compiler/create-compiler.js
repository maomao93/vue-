/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

export function createCompilerCreator (baseCompile: Function): Function {
  return function createCompiler (baseOptions: CompilerOptions) {
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      //缓存一个原型为baseOptions的对象
      const finalOptions = Object.create(baseOptions)
      //errors数组
      const errors = []
      //tips数组
      const tips = []
      //通过传入的参数判断往errors数组或tips数组中添加信息项
      finalOptions.warn = (msg, tip) => {
        (tip ? tips : errors).push(msg)
      }
      //判断option是否有传入($mount中传入的option)
      if (options) {
        // merge custom modules
        if (options.modules) {
          //合并为新数组
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        // 判断options对象中是否存在directives属性(在调用compileToFunctions中是否传入了)
        /*
          {
            shouldDecodeNewlines,
            shouldDecodeNewlinesForHref,
            delimiters: options.delimiters,
            comments: options.comments
          }
        */
        if (options.directives) {
          //合并为新对象
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        //循环将options中的key和key值复制到finalOptions对象中
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }
      //执行createCompilerCreator()中传入的参数函数baseCompile(),将字符串模板和新对象finalOptions作为参数
      //传入该函数
      const compiled = baseCompile(template, finalOptions)
      //在非生产环境下将错误放入errors数组中
      if (process.env.NODE_ENV !== 'production') {
        errors.push.apply(errors, detectErrors(compiled.ast))
      }
      //往compiled对象中添加errors和tips属性
      compiled.errors = errors
      compiled.tips = tips
      //输出compiled对象
      /*
        {
          errors,
          tips
          ast,
          render: code.render,
          staticRenderFns: code.staticRenderFns
        }
      */
      return compiled
    }
    /*输出包含了compile和compileToFunctions2个函数的对象*/
    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
