/* @flow */

import { parseText } from 'compiler/parser/text-parser'
import { parseStyleText } from 'web/util/style'
import {
  getAndRemoveAttr,
  getBindingAttr,
  baseWarn
} from 'compiler/helpers'
/*
  作用: 解析静态或动态的style属性值
*/
function transformNode (el: ASTElement, options: CompilerOptions) {
  // 获取警告是提示函数
  const warn = options.warn || baseWarn
  // 获取静态style属性值
  const staticStyle = getAndRemoveAttr(el, 'style')
  // 存在静态style属性值
  /*
    有可能出现的情况:
      1、"{backgroundImage: 'url('+videoCover+')',height:'64px'}"
      2、"{{backgroundImage: 'url('+videoCover+')',height:'64px'}}"
      3、"backgroundImage: 'url('+videoCover+')';height:'64px'"
     所以在非生产环境下第二中情况会提示警告 第一种最后编译会被忽略
  */
  if (staticStyle) {
    /* istanbul ignore if */
    // 非生产环境下
    if (process.env.NODE_ENV !== 'production') {
      // 判断静态style属性值是否使用了vue的字面表达式
      const res = parseText(staticStyle, options.delimiters)
      // 使用了则警告提示style属性要动态绑定
      if (res) {
        warn(
          `style="${staticStyle}": ` +
          'Interpolation inside attributes has been removed. ' +
          'Use v-bind or the colon shorthand instead. For example, ' +
          'instead of <div style="{{ val }}">, use <div :style="val">.'
        )
      }
    }
    // 添加el描述对象的staticStyle属性为字符串形式的静态属性值
    el.staticStyle = JSON.stringify(parseStyleText(staticStyle))
  }
  // 获取动态style属性值
  const styleBinding = getBindingAttr(el, 'style', false /* getStatic */)
  // 存在动态属性值时
  if (styleBinding) {
    // 添加el描述对象的styleBinding属性为该动态属性值
    el.styleBinding = styleBinding
  }
}

function genData (el: ASTElement): string {
  let data = ''
  if (el.staticStyle) {
    data += `staticStyle:${el.staticStyle},`
  }
  if (el.styleBinding) {
    data += `style:(${el.styleBinding}),`
  }
  return data
}

export default {
  staticKeys: ['staticStyle'],
  transformNode,
  genData
}
