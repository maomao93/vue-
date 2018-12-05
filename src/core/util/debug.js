/* @flow */

import config from '../config'
import { noop } from 'shared/util'

export let warn = noop
export let tip = noop
export let generateComponentTrace = (noop: any) // work around flow check
export let formatComponentName = (noop: any)

if (process.env.NODE_ENV !== 'production') {
  // 在非生产环境下判断是否存在console对象
  const hasConsole = typeof console !== 'undefined'
  //(开头必须以-或_)a 或者 直接a
  const classifyRE = /(?:^|[-_])(\w)/g
  const classify = str => str
    // 将匹配到的字符转成大写
    .replace(classifyRE, c => c.toUpperCase())
    // 将-或_字符去掉
    .replace(/[-_]/g, '')
  // 初始化错误函数
  warn = (msg, vm) => {
    // 是否传递vue实例? 空函数 : 空字符串
    const trace = vm ? generateComponentTrace(vm) : ''
    // 配置中定义了错误函数
    if (config.warnHandler) {
      // 执行错误函数
      config.warnHandler.call(null, msg, vm, trace)
      // 存在console对线 && 警告提示控制器是打开的
    } else if (hasConsole && (!config.silent)) {
      // 在控制台中打印错误信息
      console.error(`[Vue warn]: ${msg}${trace}`)
    }
  }
  // 初始化提示函数
  tip = (msg, vm) => {
    // 存在console对线 && 警告提示控制器是打开的
    if (hasConsole && (!config.silent)) {
      // 打印提示信息
      console.warn(`[Vue tip]: ${msg}` + (
        vm ? generateComponentTrace(vm) : ''
      ))
    }
  }
  /*
      作用:
            1、获取组件的名字以及该组件在文件中的位置
            2、将文件名以及路径进行字符串拼接
  */
  formatComponentName = (vm, includeFile) => {
    // 当前实例为根实例(根组件) 直接返回'<Root>'
    if (vm.$root === vm) {
      return '<Root>'
    }
    /*
      实例为函数 && cid标志不为null？
        实例的options
        : 是否是vue实例？
            实例options || 实例构造函数的options
            :
            实例 || 空对象
    */
    const options = typeof vm === 'function' && vm.cid != null
      ? vm.options
      : vm._isVue
        ? vm.$options || vm.constructor.options
        : vm || {}
    // 缓存组件名
    let name = options.name || options._componentTag
    // 缓存该组件在文件中的路径
    const file = options.__file
    // 未设置组件名但是有路径时,将文件名当成组件名
    if (!name && file) {
      const match = file.match(/([^/\\]+)\.vue$/)
      name = match && match[1]
    }
    // 存在文件名或组件名,将名字中的_或-去掉全部转换成大写否则返回<Anonymous>;存在路径则返回`at 路径`否则''
    return (
      (name ? `<${classify(name)}>` : `<Anonymous>`) +
      (file && includeFile !== false ? ` at ${file}` : '')
    )
  }
  /*
      作用:
            1、将str参数相加Math.floor(n / 2)次
  */
  const repeat = (str, n) => {
    let res = ''
    // 当n=0时退出
    while (n) {
      // 取n/2的余数 === 1时  字符相加
      if (n % 2 === 1) res += str
      // n > 1时  字符相加
      if (n > 1) str += str
      n >>= 1 // 相当于 n = Math.floor(n / 2)
    }
    return res
  }
  /*
      作用:
            1、当组件编译存在错误时,更加明确的打印出错误的位置、组件名以及组件在文件中的路径
            2、递归组件确定那一层的递归组件
  */
  generateComponentTrace = vm => {
    // 实例_isVue属性为true && 存在父元素
    if (vm._isVue && vm.$parent) {
      const tree = []
      let currentRecursiveSequence = 0
      // 当实例存在时
      while (vm) {
        // tree数组大于0
        if (tree.length > 0) {
          // 获取数组中的最后一个实例(上一个实例)
          const last = tree[tree.length - 1]
          // 当前实例的构造函数 全等于 该数组最后一个实例的构造函数(递归组件的构造函数指向和内容都相同)
          if (last.constructor === vm.constructor) {
            // 递归组件计数器 +1(用来明确出现问题的是哪一层级的递归组件)
            currentRecursiveSequence++
            vm = vm.$parent
            // 进入下一循环
            continue
            // 构造函数不相等 && 计数变量 > 0
          } else if (currentRecursiveSequence > 0) {
            // 将数组最后一项设为数组,该项保存实例和当前计数变量的值
            tree[tree.length - 1] = [last, currentRecursiveSequence]
            // 并清空计数变量
            currentRecursiveSequence = 0
          }
        }
        // 往tree数组中放入实例
        tree.push(vm)
        // 将实例更新为该实例的父实例
        vm = vm.$parent
      }
      // 循环tree数组,具体指出出错在哪一个组件中
      return '\n\nfound in\n\n' + tree
        .map((vm, i) => `${
          i === 0 ? '---> ' : repeat(' ', 5 + i * 2)
        }${
          // 为递归组件时,返回组件名以及所在路径并确定时那一层的递归组件;否则返回组件名以及所在路径
          Array.isArray(vm)
            ? `${formatComponentName(vm[0])}... (${vm[1]} recursive calls)`
            : formatComponentName(vm)
        }`)
        .join('\n')
    } else {
      // 根实例直接返回<root> at 组件在文件中的路径名
      return `\n\n(found in ${formatComponentName(vm)})`
    }
  }
}
