/* @flow */

import { parseText } from 'compiler/parser/text-parser'
import {
  getAndRemoveAttr,
  getBindingAttr,
  baseWarn
} from 'compiler/helpers'

function transformNode (el: ASTElement, options: CompilerOptions) {
  //获取默认的警告提示方法
  const warn = options.warn || baseWarn
  // 获取class属性值
  const staticClass = getAndRemoveAttr(el, 'class')
  // 非生产环境 && 不存在class属性值时
  if (process.env.NODE_ENV !== 'production' && staticClass) {
    // 判断静态class属性值是否使用了vue的字面表达式
    const res = parseText(staticClass, options.delimiters)
    // 使用了则提示警告
    if (res) {
      warn(
        `class="${staticClass}": ` +
        'Interpolation inside attributes has been removed. ' +
        'Use v-bind or the colon shorthand instead. For example, ' +
        'instead of <div class="{{ val }}">, use <div :class="val">.'
      )
    }
  }
  // 在el描述对象上添加staticClass属性，值为静态的class属性值字符串
  if (staticClass) {
    el.staticClass = JSON.stringify(staticClass)
  }
  // 获取动态的class属性值
  const classBinding = getBindingAttr(el, 'class', false /* getStatic */)
  // 在el描述对象上添加classBinding属性，值为class动态属性值
  if (classBinding) {
    el.classBinding = classBinding
  }
}

function genData (el: ASTElement): string {
  let data = ''
  if (el.staticClass) {
    data += `staticClass:${el.staticClass},`
  }
  if (el.classBinding) {
    data += `class:${el.classBinding},`
  }
  return data
}

export default {
  staticKeys: ['staticClass'],
  transformNode,
  genData
}
