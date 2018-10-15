/* @flow */

import { inBrowser } from 'core/util/index'

// check whether current browser encodes a char inside attribute values
let div
//作用: 判断是否将'\n'转义为了&#10;
function getShouldDecode (href: boolean): boolean {
  //创建一个节点
  div = div || document.createElement('div')
  //通过参数判断添加不同的行内容
  div.innerHTML = href ? `<a href="\n"/>` : `<div a="\n"/>`
  //判断行内是否将'\n'转义为了&#10;
  return div.innerHTML.indexOf('&#10;') > 0
}

// #3663: IE encodes newlines inside attribute values while other browsers don't
//判断是否将普通标签的属性值中的'\n'转义为了&#10;
export const shouldDecodeNewlines = inBrowser ? getShouldDecode(false) : false
// #6828: chrome encodes content in a[href]
//判断是否在客户端环境? 判断是否将a链接中的'\n'转义为了&#10; : false
export const shouldDecodeNewlinesForHref = inBrowser ? getShouldDecode(true) : false
