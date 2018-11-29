/* @flow */

import { addProp } from 'compiler/helpers'
/*
  作用:
       1、处理指令v-html
       2、存在v-text属性值时,往el的props数组中添加innerHTML属性信息对象
          {name: 'innerHTML',value: '_s(v-html的属性值)'}
*/
export default function html (el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    addProp(el, 'innerHTML', `_s(${dir.value})`)
  }
}
