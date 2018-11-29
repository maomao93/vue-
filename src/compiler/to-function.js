/* @flow */

import { noop, extend } from 'shared/util'
import { warn as baseWarn, tip } from 'core/util/debug'

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};
/*
  作用:
        1、将参数code作为函数内容
        2、有错收集错误信息，并返回一个空函数
*/
function createFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}
/*
  作用:
        1、输出(生成包含render函数和staticRenderFns数组和ast树对象)的函数
        2、生成缓存res对象(保存有render函数和staticRenderFns数组和ast树)
*/
export function createCompileToFunctionFn (compile: Function): Function {
  //缓存一个原型为空的对象
  const cache = Object.create(null)
  //返回compileToFunctions函数
  /*
     作用:
          1、检测运行环境是否支持vue
          2、vue的字面表达式模板没有变化 && 模板字符没有变化时,将cache对象中保存的res数据输出
          3、vue的字面表达式模板有变化 || 模板字符有变化时,重新编译处理模板收集错误信息,
             在非生产环境下打印错误信息'编译模板错误: 所有的错误信息'和提示信息
          4、将动态渲染render字符串表达式作为函数内容并赋值为res.render的值,如果有错误收集错误信息。
          5、将静态渲染render字符串表达式集合staticRenderFns循环作为函数内容,并将集合赋值为res.staticRenderFns的值,
             如果有错误收集错误信息。
          6、编辑时没有错误，但是生成render函数时有错误则打印'未能生成呈现函数',并将生成render函数时的错误也打印出来
          7、将模板字符串作为key,将res作为值放入cache空对象中(避免模板没变化时需要重新编译)
  */
  return function compileToFunctions (
    template: string,
    options?: CompilerOptions,//这个options是$mount中传入的
    vm?: Component
  ): CompiledFunctionResult {
    //将options合并为一个新对象options
    options = extend({}, options)
    //options中的warn属性是否存在,不存在则缓存默认的错误函数
    const warn = options.warn || baseWarn
    //删除options中的warn属性
    delete options.warn

    /* istanbul ignore if */
    //在非生产环境下不支持
    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      //检测可能的CSP限制
      try {
        new Function('return 1')
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          /*看起来您正在使用Vue的独立构建。js在一个内容安全策略禁止不安全eval的环境中。
          模板编译器不能在此环境中工作。考虑放松策略，允许不安全eval或将模板预编译为呈现函数。*/
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

    // check cache
    // 将options.delimiters字符串化添加到模板字符串前面
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    //如果该key的模板存在则读取缓存中的模板
    if (cache[key]) {
      return cache[key]
    }

    /*
      1、合并用户传入的option和vue自定义的option
      2、将模板解析成AST树,并将ast树优化,并生成动态渲染函数render和静态渲染函数集合staticRenderFns,并收集错误警告提示信息
      3、收集ast中节点类型为1和2中指令的属性值的错误信息，并指出错误位置
      4、将包含ast树、render、staticRenderFns、errors、tips的对象输出
    */
    const compiled = compile(template, options)

    // check compilation errors/tips
    //在非生产环境下有错误或提示则打印出错误或提示
    if (process.env.NODE_ENV !== 'production') {
      if (compiled.errors && compiled.errors.length) {
        warn(
          `Error compiling template:\n\n${template}\n\n` +
          compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
          vm
        )
      }
      if (compiled.tips && compiled.tips.length) {
        compiled.tips.forEach(msg => tip(msg, vm))
      }
    }

    // turn code into functions
    const res = {}
    const fnGenErrors = []
    //执行compiled.render字符串,如果有错误则收集错误并返回一个空函数
    res.render = createFunction(compiled.render, fnGenErrors)
    //循环执行compiled.staticRenderFns中的render字符串,如果有错误则收集错误并返回一个空函数
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    //在非生产环境下打印render函数执行失败的错误
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }
    //缓存当前生成的渲染函数
    return (cache[key] = res)
  }
}
