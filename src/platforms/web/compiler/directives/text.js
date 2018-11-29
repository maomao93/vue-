/* @flow */

import { addProp } from 'compiler/helpers'
/*
  作用:
        1、处理v-text指令
        2、存在v-text属性值时,往el的props数组中添加原生dom属性
           textContent属性信息对象{name: 'textContent',value: '_s(v-text的属性值)'}
*/
export default function text (el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    addProp(el, 'textContent', `_s(${dir.value})`)
  }
}
